import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { deduplicateProducts } from "@/utils/deduplicateProducts";
import type { GiftResult } from "@/types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function resolveAmazon(query: string): Promise<{ url: string; imageUrl: string }> {
  const fallback = `https://www.amazon.sa/s?k=${encodeURIComponent(query)}&language=en_AE`;
  try {
    const res = await fetch(
      `https://www.amazon.sa/s?k=${encodeURIComponent(query)}&language=en_AE`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4000) }
    );
    const html = await res.text();

    const dpMatch = html.match(/href="(\/[^"]*\/dp\/[A-Z0-9]{10}[^"]*?)"/);
    const productUrl = dpMatch ? `https://www.amazon.sa${dpMatch[1].split('"')[0]}` : fallback;

    const imgMatch = html.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.jpg/);
    const imageUrl = imgMatch ? imgMatch[0] : "";

    return { url: productUrl, imageUrl };
  } catch {
    return { url: fallback, imageUrl: "" };
  }
}


export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { gender, age, interests, budget } = await req.json();
    const seed = Math.random().toString(36).slice(2, 8);
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      // @ts-expect-error thinkingConfig not in types yet
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const buildPrompt = (extra = "") => `You are a Saudi Arabia gift expert. Return ONLY a JSON array (no markdown, no explanation) with exactly 6 gift suggestions. Seed: ${seed}

Recipient: ${gender === "m" ? "Male" : "Female"}, age ${age}, interests: ${(interests as string[]).join(", ") || "general"}, budget: up to ${budget} SAR.

STRICT RULE: Every single product MUST cost less than ${budget} SAR. Do NOT suggest anything that costs more. If a product category (e.g. KitchenAid, iPhone, etc.) is known to cost more than ${budget} SAR, skip it entirely and pick a cheaper alternative.${extra}

Each item must have these exact fields:
- id: "1" to "6"
- name: real brand + product name available in Saudi Arabia
- price: SAR price as a number, strictly under ${budget}
- currency: "SAR"
- store: "Amazon.sa"
- searchQuery: short English search query (e.g. "Sony WH-1000XM5 headphones")
- inStock: true

Suggest products actually sold in Saudi Arabia on Amazon.sa.`;

    const prompt = buildPrompt();

    const parseProducts = (text: string) => {
      const raw = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array: " + raw.slice(0, 200));
      return (JSON.parse(match[0]) as Array<GiftResult & { searchQuery?: string }>)
        .filter((p) => Number(p.price) <= budget);
    };

    let withinBudget = parseProducts((await model.generateContent(prompt)).response.text());

    if (withinBudget.length < 4) {
      const retry = parseProducts(
        (await model.generateContent(buildPrompt(` You previously gave items over ${budget} SAR — do NOT do that again.`))).response.text()
      );
      withinBudget = [...withinBudget, ...retry].filter((p) => Number(p.price) <= budget);
    }

    const slice = withinBudget.slice(0, 4);
    if (slice.length === 0) throw new Error("No products within budget after retry");

    const resolved = await Promise.all(slice.map(async (p) => {
      const query = p.searchQuery || p.name;
      return await resolveAmazon(query);
    }));

    const clean: GiftResult[] = slice.map((p, i) => ({
      id: String(i + 1),
      name: p.name,
      price: Number(p.price),
      currency: "SAR" as const,
      store: p.store,
      url: resolved[i].url,
      imageUrl: resolved[i].imageUrl,
      inStock: true,
    }));

    return NextResponse.json(deduplicateProducts(clean));
  } catch (err) {
    const msg = String(err);
    console.error("gift-search error:", msg);
    return NextResponse.json({ error: "Search failed — " + msg.slice(0, 200) }, { status: 500 });
  }
}


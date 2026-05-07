# Muhtar — AI Gift Finder for Saudi Arabia

**Muhtar** is a web application that helps users discover thoughtful, personalized gifts from Saudi online stores. You describe the recipient, and Muhtar returns four tailored product suggestions with direct links to purchase.

> PMU Senior Capstone Project · Al Khobar · Spring 2026

---

## What it does

- **Gift Discovery** — Enter the recipient's gender, age, interests, and budget. Muhtar uses AI to suggest four products from Amazon.sa and Noon.com, each from a different category.
- **Product Comparison** — Search any product to get a side-by-side AI comparison of three alternatives, with pros, cons, and a recommendation.
- **Search History** — Every gift search and comparison is saved to your account so you can revisit past results.
- **Credits System** — Each search costs 5 credits. New accounts receive 100 free credits on sign-up.
- **Phone Authentication** — Sign in with your Saudi mobile number. No passwords.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom design system |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini 2.5 Flash |
| Auth | Custom HMAC-signed session tokens |
| Deployment | Vercel |

---

## Project Structure

```
app/
  signin/             # Phone OTP authentication flow
  (app)/
    gifts/            # Gift discovery page
    compare/          # Product comparison page
    history/          # Search history
    profile/          # Account & preferences
    more/             # Help, FAQ, about
  api/
    auth/             # send-otp, verify-otp, create-user, signout
    gift-search/      # AI gift generation endpoint
    compare-products/ # AI product comparison endpoint
    credits/          # Deduct & add credits
    history/          # Search history CRUD

components/           # Reusable UI components
lib/                  # Session management, Supabase client, React contexts
hooks/                # useAuth, useCredits, useSearchHistory
utils/                # Formatting and deduplication helpers
types/                # Shared TypeScript interfaces
```
---

## Authentication

Muhtar uses a fully custom phone authentication system:

1. User enters their Saudi mobile number
2. App accepts OTP code `1234` (demo — no SMS gateway required for presentation)
3. On first login, user sets their name and a new account is created
4. On subsequent logins, the existing account is found by phone number
5. A signed HMAC-SHA256 session token is issued as an httpOnly cookie (30-day expiry)

---

## Key Design Decisions

- **No third-party auth** — Session management is handled manually with Web Crypto API (`crypto.subtle`) for full control and edge runtime compatibility.
- **Server-side URL building** — Store search URLs are constructed on the server using `encodeURIComponent`, preventing truncation or malformed links from AI output.
- **Thinking mode disabled** — Gemini 2.5 Flash is configured with `thinkingBudget: 0` for faster, cleaner JSON responses.
- **Varied results** — A random seed is injected into each AI prompt so repeated searches return different suggestions.

---

## Live Demo

[muhtar.gift](https://www.muhtar.gift)

Use any Saudi phone number and OTP code `1234` to sign in.


# ai-worker

One Cloudflare Worker, two endpoints — both are just thin proxies to
Gemini, sharing the same JWT-verification and CORS logic:

- **`POST /scan-receipt`** — OCR for the "🪄 Baca Struk Otomatis" button.
  Never touches the database.
- **`POST /assistant`** — the AI Assistant chat (`/asisten` page).
  Function-calling: replies with plain text, or a structured "action"
  (e.g. `propose_budget`) that the app renders as a confirmation card.
  Also never touches the database directly — same principle as
  `/scan-receipt`, the app writes to Supabase itself after the person
  confirms.

Kept as one deployment on purpose: splitting into two Workers would
just mean maintaining the identical auth/CORS code twice. See
`src/index.ts` for the router.

## Setup

```bash
cd cloudflare/ai-worker
npm install

# 1. Point at your Supabase project (same value as the app's
#    PUBLIC_SUPABASE_URL — not secret, so it lives in wrangler.toml).
#    Edit the SUPABASE_URL line in wrangler.toml.

# 2. (Optional) Edit GEMINI_MODELS in wrangler.toml to change which
#    Gemini models are tried, and in what order. See the comment above
#    it in wrangler.toml.

# 3. Set your Gemini API key as a real secret (never committed):
npx wrangler secret put GEMINI_API_KEY
# paste your key when prompted

# 4. Add your production app URL to ALLOWED_ORIGINS in wrangler.toml
#    once you have one (comma-separated), e.g.:
#    ALLOWED_ORIGINS = "http://localhost:5173,https://myfinance.example.com"

# 5. Deploy
npx wrangler deploy
```

`wrangler deploy` prints the Worker's URL, e.g.
`https://myfinance-ai-worker.<your-subdomain>.workers.dev`.

Put that URL (just the root, no path) into the main app's `.env` as:

```
PUBLIC_AI_WORKER_URL=https://myfinance-ai-worker.<your-subdomain>.workers.dev
```

## Local dev

```bash
npx wrangler dev
```

This runs the Worker on `http://localhost:8787`. Point
`PUBLIC_AI_WORKER_URL` at that while developing, then switch back to
the deployed URL for production builds.

## Adding a new AI-backed endpoint later

1. Add a new handler file (`src/yourFeature.ts`), following the shape of
   `scanReceipt.ts` or `assistant.ts` — takes `(request, env, cors)`,
   returns a `Response`.
2. Add a `case '/your-path':` in `src/index.ts`'s switch statement.
3. Reuse `callGeminiWithFallback` from `shared/gemini.ts` so the new
   endpoint automatically gets the same model-rotation behavior.

## Why a JWT check and not just an API key of our own?

Because the app's Supabase anon key is already public (safe, since every
table is RLS-protected) — reusing it as a "secret" here would let anyone
who reads the app's bundle call this Worker too. Verifying the caller's
actual Supabase *login* token (which only exists after a real user signs
in) is what actually restricts this to your app's real users, not just
your app's public config.

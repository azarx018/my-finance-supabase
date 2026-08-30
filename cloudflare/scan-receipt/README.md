# scan-receipt Worker

Proxies a receipt photo to Gemini and returns structured fields
(amount, date, description, category_id) for MyFinance's "🪄 Baca Struk
Otomatis" button. Never touches the database — the app still saves the
transaction itself through its normal sync path.

## Setup

```bash
cd cloudflare/scan-receipt
npm install

# 1. Point at your Supabase project (same value as the app's
#    PUBLIC_SUPABASE_URL — not secret, so it lives in wrangler.toml).
#    Edit the SUPABASE_URL line in wrangler.toml.

# 2. Set your Gemini API key as a real secret (never committed):
npx wrangler secret put GEMINI_API_KEY
# paste your key when prompted

# 3. Add your production app URL to ALLOWED_ORIGINS in wrangler.toml
#    once you have one (comma-separated), e.g.:
#    ALLOWED_ORIGINS = "http://localhost:5173,https://myfinance.example.com"

# 4. Deploy
npx wrangler deploy
```

`wrangler deploy` prints the Worker's URL, e.g.
`https://myfinance-scan-receipt.<your-subdomain>.workers.dev`.

Put that URL into the main app's `.env` as:

```
PUBLIC_SCAN_RECEIPT_URL=https://myfinance-scan-receipt.<your-subdomain>.workers.dev
```

## Local dev

```bash
npx wrangler dev
```

This runs the Worker on `http://localhost:8787`. Point
`PUBLIC_SCAN_RECEIPT_URL` at that while developing, then switch back to
the deployed URL for production builds.

## Why a JWT check and not just an API key of our own?

Because the app's Supabase anon key is already public (safe, since every
table is RLS-protected) — reusing it as a "secret" here would let anyone
who reads the app's bundle call this Worker too. Verifying the caller's
actual Supabase *login* token (which only exists after a real user signs
in) is what actually restricts this to your app's real users, not just
your app's public config.

# CI/CD Deploy Setup (GitHub Actions)

`.github/workflows/deploy.yml` deploys the Cloudflare Worker (OCR
proxy) on every push to `main`. The SvelteKit app itself is deployed by
Vercel's own native GitHub integration — no Action needed for that
part, Vercel handles it automatically whenever you push.

This workflow exists specifically because `wrangler` doesn't run
natively in Termux — GitHub's runner is a normal Ubuntu machine, so it
sidesteps that entirely. You never need to run `wrangler` locally.

## Where to add secrets

GitHub repo → **Settings → Secrets and variables → Actions → New
repository secret**. Add the 3 below.

## Cloudflare secrets

| Secret name | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → use the **"Edit Cloudflare Workers"** template → create → copy the token (shown once) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → click into any domain/Workers overview → the Account ID is shown in the right sidebar (also visible in the dashboard URL: `dash.cloudflare.com/<ACCOUNT_ID>/...`) |
| `GEMINI_API_KEY` | The key you already have from Google AI Studio — same one, just also stored here so the workflow can push it into the Worker automatically |

The API token needs **Workers Scripts: Edit** permission at minimum —
the "Edit Cloudflare Workers" template already includes this, so unless
you're customizing permissions manually, just use that template as-is.

## Also needed: environment variable in Vercel itself

Not a GitHub secret — set this directly in the Vercel dashboard
(**Project → Settings → Environment Variables**):

- `PUBLIC_SCAN_RECEIPT_URL` — the `*.workers.dev` URL from your first
  Worker deploy (see below). `PUBLIC_SUPABASE_URL` and
  `PUBLIC_SUPABASE_ANON_KEY` you presumably already set there when you
  first connected this repo to Vercel.

## First-time order of operations

1. Add the 3 GitHub secrets above.
2. Push to `main` (or run the workflow manually from the **Actions**
   tab → "Deploy Cloudflare Worker" → **Run workflow**).
3. The job finishes and prints the Worker's URL in its logs (look for
   `Published myfinance-scan-receipt` → the `*.workers.dev` line right
   after it).
4. Add that URL as `PUBLIC_SCAN_RECEIPT_URL` in Vercel's dashboard.
5. Trigger a Vercel redeploy (push a commit, or use "Redeploy" in the
   Vercel dashboard) so it picks up the new env var — Vercel won't
   rebuild on its own just because a dashboard env var changed.

After that, every push to `main` keeps the Worker in sync automatically
— Vercel deploys the app side on its own as it always has.


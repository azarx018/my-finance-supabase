# Routing: app (SPA/PWA)

Repo ini hanya berisi **app**. Landing page, `/privacy`, dan `/terms` ada di repo terpisah (`flowmoney-landing`).

| URL | Dilayani oleh |
|---|---|
| `/` | SPA → `src/routes/+page.svelte` → redirect ke `/dashboard` |
| `/login`, `/auth/callback`, `/dashboard`, `/budget`, … | SPA (`index.html`, noindex) |
| `/sw.js`, `/manifest.webmanifest`, `/_app/*` | file asli di `build/` |

- `vercel.json`: `rewrites` semua path ke `/index.html` + header cache untuk `sw.js` dan `/_app/immutable/*`.
- PWA: `start_url: '/'`, `id: '/'`; service worker memakai `navigateFallback: '/index.html'`.
- `scripts/patch-sw.mjs` + `scripts/verify-build.mjs` (postbuild) memastikan `index.html` ter-precache untuk offline.
- Link Syarat/Privasi di halaman login menuju landing (`https://azh-flowmoney.vercel.app`, bisa dioverride env `VITE_LANDING_URL`).
- Domain app: `https://flowmoney-app-azh.vercel.app`. Landing ada di repo/project Vercel terpisah (`https://azh-flowmoney.vercel.app`).

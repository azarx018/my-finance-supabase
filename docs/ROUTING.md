# Routing: landing page vs. PWA app

Satu repo, satu deploy Vercel (`azh-flowmoney.vercel.app`), dua "dunia" yang dipisah jalurnya.

| URL | Dilayani oleh | Offline / PWA |
|---|---|---|
| `/` | `static/landing.html` (via `routes` di `vercel.json`) | **Tidak** — hanya via link/online |
| `/privacy`, `/terms` | `static/privacy.html`, `static/terms.html` (via `routes`) | **Tidak** — publik, online saja |
| `/landing/*` | gambar landing (webp + `og.png`) | tidak di-cache SW |
| `/robots.txt`, `/sitemap.xml` | file statis | — |
| `/login`, `/dashboard`, `/budget`, … | SPA (`index.html`, noindex) | ya, precache + offline |
| `/sw.js`, `/manifest.webmanifest`, `/_app/*` | file asli di `build/` | — |

Alur: pengunjung buka `/` → landing → CTA ke `https://azh-flowmoney.vercel.app/login`
(sudah login otomatis masuk `/dashboard`). PWA terinstal selalu mulai dari `/dashboard`.

## Kenapa begini (jangan diubah tanpa baca)
1. **`vercel.json` pakai `routes`, bukan `rewrites`.** Build SPA menghasilkan `build/index.html`;
   Vercel mengecek filesystem *sebelum* `rewrites`, jadi rewrite `/ → landing` tidak akan pernah jalan.
   `routes` jalan berurutan: `/` → landing, lalu filesystem, lalu fallback SPA.
   (`routes` tidak boleh digabung dengan `rewrites/redirects/headers/cleanUrls/trailingSlash`;
   header cache sudah ditulis langsung di dalam `routes`.)
2. **Landing tidak masuk service worker** (`vite.config.ts` → `workbox`):
   `globIgnores` (`landing.html`, `landing/**`, `privacy.html`, `terms.html` tidak di-precache), `directoryIndex: null`
   (SW tidak menjawab `/` dengan app shell), `navigateFallbackDenylist` (navigasi ke `/` langsung ke network).
3. **`start_url` manifest = `/dashboard`**, `id` tetap `/` supaya instalasi lama dianggap app yang sama.
4. **`scripts/verify-build.mjs`** jalan otomatis setelah `npm run build` (termasuk di Vercel) dan
   menggagalkan build kalau landing bocor ke `sw.js`, app shell tidak ter-precache, atau ada aset landing yang hilang.
5. Landing memakai localStorage ber-prefix `fm-landing:` supaya tidak tabrakan dengan key app (`my-finance:*`).
6. Landing yang dibuka dari PWA terinstal (standalone) otomatis diarahkan ke `/dashboard`.
7. Semua gambar landing = file hash di `static/landing/` (cache `immutable` 1 tahun). Kalau ganti gambar,
   pakai nama file baru (hash baru) — jangan timpa nama lama. Pengecualian: `og.png` (tanpa hash, cache normal).

## Edit landing
Edit `static/landing.html`. Kalau ganti domain, ubah URL di: CTA, `og:*`/`twitter:*`/`canonical`/JSON-LD
di `<head>` landing, `static/robots.txt`, `static/sitemap.xml`, dan `ALLOWED_ORIGINS` di
`cloudflare/ai-worker/wrangler.toml`. Supabase → Authentication → URL Configuration juga perlu domain baru.

## Font
Bricolage Grotesque (variable, subset Latin) & DM Mono di-host sendiri di `static/fonts/` (lisensi OFL disertakan).
App memprecache font (`woff` di `globPatterns`) sehingga tampil sama saat offline; landing memakai file yang sama.

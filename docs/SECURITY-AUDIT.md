# npm audit — triase & cara membereskan

Laporan `npm audit` berisi dua jenis hal: yang **tidak bisa dieksploitasi di app ini** (hampir semuanya) dan yang
memang perlu upgrade besar. Jangan jalankan `npm audit fix --force`: ia melompat ke `@sveltejs/kit@3` + banyak paket
sekaligus dan bisa merusak build/PWA tanpa kelihatan.

## Apakah kena ke pengguna? (diperiksa terhadap repo ini)
| Temuan | Berlaku di app ini? | Alasan |
|---|---|---|
| kit: open redirect di *enhanced form submission* | Tidak | tidak ada form action / `use:enhance` di `src/` |
| kit: XSS via cache-control di halaman *prerendered* | Tidak | `ssr = false`, `prerender = false` (`src/routes/+layout.ts`) |
| cookie `< 0.7.0` | Tidak | dipakai kode server kit; hasil build adalah file statis (adapter-static), tidak ada server |
| esbuild / vite dev server | Hanya di laptop | hanya saat `npm run dev`; bukan di Vercel. Jangan buka dev server di Wi-Fi umum |
| deepmerge, glob, minimatch, workbox-build, rollup node-resolve | Tidak | alat build; inputnya file repo sendiri |

Jadi aman untuk rilis. Build/deploy tidak diblokir audit (CI hanya `npm install`).

## Yang sudah diubah di repo
`package.json` → `overrides`: `cookie ^0.7.2`, `esbuild ^0.25.0` (perbaikan standar untuk dua advisory itu, tanpa lompat versi mayor).
Setelah `npm install`, cek: `npm ls cookie esbuild` (hanya boleh ada versi baru). Kalau `npm run build` / `npm run dev` gagal karena esbuild,
hapus blok `overrides`, jalankan `npm install` lagi, dan lanjut ke langkah upgrade di bawah.

## Membersihkan sisanya (kit / vite-plugin-svelte / deepmerge / glob) — upgrade terkontrol
Lakukan di branch terpisah:
1. `git checkout -b upgrade-deps`
2. `npm audit fix` (yang non-mayor: glob/minimatch). Kalau masih muncul: `npm ls glob minimatch` untuk melihat siapa yang menahan.
3. Naikkan bersamaan (npm yang memilih versi yang saling cocok):
   `npm i -D vite@latest @sveltejs/kit@latest @sveltejs/vite-plugin-svelte@latest @sveltejs/adapter-static@latest svelte@latest vite-plugin-pwa@latest @vite-pwa/sveltekit@latest`
4. Butuh Node ≥ 20.19 (Vercel: Settings → Node.js Version 22.x; GitHub Actions: `node-version: 22`).
5. `npm run build` — `postbuild` (`scripts/verify-build.mjs`) otomatis memastikan app shell ter-precache.
   Lalu buka `npm run preview` (cek login, offline, install PWA).
6. Tempat yang paling mungkin perlu penyesuaian: opsi `SvelteKitPWA` di `vite.config.ts`, opsi `adapter()` di `svelte.config.js`.
7. Kalau `@vite-pwa/sveltekit` belum punya rilis yang cocok dengan kit versi baru: tahan di kit 2.x terbaru + vite baru, dan terima 2 advisory kit
   yang tidak berlaku (tabel di atas). Jangan memaksa.

Tempel output `npm ls vite @sveltejs/kit @vite-pwa/sveltekit` + sisa `npm audit` kalau ada yang gagal, supaya penyesuaian konfigurasinya tepat.

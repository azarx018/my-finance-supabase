# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/). Versi sumber: `package.json`.

## [1.0.1] — 2026-11-08

### Ditambahkan
- **Login dengan Google.** Tombol "Lanjut dengan Google" di `/login` (`signInWithOAuth` di `src/lib/stores/auth.ts`), pemilih akun selalu muncul.
- **Login Google tanpa redirect ke supabase.co** (opsional): tombol resmi Google Identity Services + `signInWithIdToken`, aktif kalau `VITE_GOOGLE_CLIENT_ID` diisi; otomatis jatuh balik ke alur redirect. Lihat `docs/OAUTH.md` bagian 4.
- **Halaman `/auth/callback`** (`src/routes/auth/callback/+page.svelte`): tujuan balik OAuth. Menampilkan "Menyelesaikan login…", meneruskan ke `/dashboard` begitu sesi terbaca, dan menampilkan pesan error + tombol kembali ke `/login` kalau login dibatalkan/gagal atau sesi tak muncul dalam 10 detik. Route guard (`+layout.svelte`) mengecualikan halaman ini.
- Font Bricolage Grotesque di-host sendiri (`static/fonts`, lisensi OFL) — tidak lagi bergantung ke Google Fonts, tampil sama saat offline.
- `scripts/patch-sw.mjs` + `scripts/verify-build.mjs` (`postbuild`): memastikan `index.html` ter-precache supaya app jalan offline.
- Dokumen: `docs/OAUTH.md` (setup Google OAuth), `docs/SECURITY-AUDIT.md`, `ROUTING.md`.
- `package.json` `overrides` untuk `cookie` dan `esbuild` (perbaikan kerentanan dependensi).

### Diperbaiki
- **Asisten AI tidak nyambung dengan data app.** Saldo dompet, tabungan, hutang/piutang, pemasukan/pengeluaran bulan ini & lalu, dan pemakaian budget sekarang dikirim sebagai snapshot di tiap pesan dan dimasukkan ke prompt; sanitizer worker tidak lagi membuangnya; status kartu usulan (sudah/belum diterapkan) ikut di riwayat chat; ada aturan "jangan jawab 0 / jangan menebak". Detail: `docs/AUDIT-ASISTEN.md`. Tes: `npm run test:assistant`. **Worker perlu di-deploy ulang.**

### Diubah
- **Landing dipisah dari app** ke repo/project sendiri (`https://azh-flowmoney.vercel.app`). Repo ini hanya app (`https://flowmoney-app-azh.vercel.app`). Link Syarat/Privasi di login menuju landing (override: env `VITE_LANDING_URL`).
- `vercel.json`: `rewrites` semua path ke `/index.html`, header cache `sw.js` & `/_app/immutable/*`.
- PWA: `start_url` `/`, `id` `/`, `background_color` putih. `app.html` diberi `noindex`; `robots.txt` `Disallow: /`.
- `ALLOWED_ORIGINS` Cloudflare Worker menambahkan `https://flowmoney-app-azh.vercel.app`.
- Halaman login: `100dvh` + padding safe-area, `role` pada pesan error/info.
- Versi diubah ke `1.0.1`.

### Auto-deploy dimatikan
- Workflow Worker hanya `workflow_dispatch` (manual dari tab Actions); `vercel.json` memakai `git.deploymentEnabled: false`.

### Tidak termasuk (sengaja)
- Logika keuangan dari versi sebelumnya (savings rate sisa bulan lalu, `for_month`, rollover budget, snapshot & `savingOps`, tes logika) dan panel Asisten kontekstual (bergantung ke snapshot keuangan) tidak dibawa ke versi ini.

### Perlu dilakukan setelah deploy
- Aktifkan Google di Supabase (Authentication → Providers → Google) dan isi Site URL / Redirect URLs `https://flowmoney-app-azh.vercel.app` (`/**`); tambahkan origin di Google Cloud. Lihat `docs/OAUTH.md`.
- Deploy ulang Cloudflare Worker (manual) agar CORS menerima domain app.

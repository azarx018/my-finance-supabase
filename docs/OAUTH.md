# Setup Login Google (OAuth)

Kode di app sudah siap (`signInWithOAuth` di `src/lib/stores/auth.ts`, tombol di `/login`, dan halaman tujuan balik `/auth/callback`).
Tinggal konfigurasi di Google Cloud & Supabase — tidak perlu ubah env Vercel.

Domain app: `https://flowmoney-app-azh.vercel.app`

## 1. Google Cloud Console
1. https://console.cloud.google.com → pilih/buat project.
2. **APIs & Services → OAuth consent screen**: User type *External*, isi App name (Flow Money), support email,
   developer email. Scope cukup default (`email`, `profile`, `openid`) — tidak butuh verifikasi Google.
   Klik **Publish app** supaya semua orang bisa login (kalau masih "Testing", hanya test user yang bisa).
3. **Credentials → Create Credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://flowmoney-app-azh.vercel.app` (dan `http://localhost:5173` untuk dev)
   - Authorized redirect URIs: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
     (`<PROJECT_REF>` = bagian depan `PUBLIC_SUPABASE_URL`; di Supabase: Auth → Providers → Google menampilkan URL persisnya)
4. Salin **Client ID** dan **Client secret**.

## 2. Supabase Dashboard
1. **Authentication → Providers → Google**: aktifkan, tempel Client ID & Client secret, simpan.
2. **Authentication → URL Configuration**:
   - Site URL: `https://flowmoney-app-azh.vercel.app`
   - Redirect URLs (tambahkan): `https://flowmoney-app-azh.vercel.app/**` dan `http://localhost:5173/**`
   (Tanpa ini, login balik ke halaman yang salah / ditolak. Link reset password juga memakai daftar ini.)

## 3. Cara kerja & catatan
- Alur: tombol di `/login` → Google → Supabase → kembali ke `/auth/callback` membawa sesi → app otomatis lanjut ke `/dashboard` dan sync jalan.
- `/auth/callback` menampilkan "Menyelesaikan login…". Kalau Google/Supabase mengembalikan error (dibatalkan, provider belum aktif) atau sesi tak muncul dalam 10 detik,
  halaman itu menampilkan pesannya + tombol kembali ke `/login`. Pastikan `https://flowmoney-app-azh.vercel.app/**` ada di Redirect URLs (sudah tercakup wildcard).
- Flow yang dipakai tetap *implicit* (default) supaya link konfirmasi email / reset password tetap bisa dibuka dari
  browser/HP yang berbeda. Jangan ganti ke PKCE kecuali siap menguji ulang email flow.
- Akun dengan email yang sama (email+password dan Google) otomatis tergabung oleh Supabase selama emailnya terverifikasi,
  jadi data lama tetap muncul.
- Login butuh internet. Setelah masuk, app tetap offline-first seperti biasa.
- Kalau error "provider is not enabled" → langkah 2.1 belum disimpan. Kalau "redirect_uri_mismatch" → cek langkah 1.3.
- Menambah penyedia lain (GitHub/Apple): aktifkan di Supabase lalu panggil `signInWithOAuth('github')`.
- Saat nanti ingin tampil "resmi": siapkan halaman Privacy Policy & Terms di domain yang sama lalu isi di OAuth consent screen.

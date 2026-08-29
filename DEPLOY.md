# Panduan Deploy — My Finance

Panduan konkret untuk project ini spesifik, bukan tutorial umum. Ikuti urutan ini.

## 1. Setup Supabase Production

1. Buka [supabase.com](https://supabase.com) → New Project. Catat **region** yang dipilih
   (pilih yang paling dekat mayoritas user, mis. Singapore untuk Indonesia).
2. Buka **SQL Editor** → tempel seluruh isi `supabase/schema.sql` dari project ini → Run.
   Pastikan tidak ada error (harus muncul "Success. No rows returned").
3. Buka **Authentication → Providers** → pastikan "Email" aktif. Kalau mau pakai konfirmasi
   email, cek juga **Authentication → Email Templates**.
4. Buka **Authentication → URL Configuration**:
   - **Site URL**: isi dengan domain final kamu nanti (mis. `https://my-finance.vercel.app`).
     Boleh diisi setelah deploy pertama (lihat langkah 4 di bagian Vercel).
   - **Redirect URLs**: tambahkan domain yang sama, plus `http://localhost:5173` untuk testing
     lokal.
5. Buka **Settings → API** → catat dua nilai ini (dipakai di langkah berikutnya):
   - `Project URL`
   - `anon public` key

**Jangan** pakai project Supabase yang sama dengan yang dipakai untuk development/testing kamu
sebelumnya kalau isinya sudah campur data uji coba — mulai dari project baru yang bersih untuk
production, supaya data asli user nggak tercampur data testing.

## 2. Deploy ke Vercel

1. Push folder project ini ke GitHub (repo baru, private boleh).
2. Buka [vercel.com](https://vercel.com) → New Project → import repo tadi.
3. Vercel akan auto-detect SvelteKit. Framework preset: **SvelteKit**. Build command &
   output directory biarkan default (Vercel punya adapter SvelteKit sendiri) — **tapi project
   ini pakai `adapter-static`**, jadi:
   - Build command: `npm run build`
   - Output directory: `build`
4. Sebelum klik Deploy, buka tab **Environment Variables**, tambahkan:
   ```
   PUBLIC_SUPABASE_URL=<Project URL dari langkah 1.5>
   PUBLIC_SUPABASE_ANON_KEY=<anon public key dari langkah 1.5>
   ```
5. Klik **Deploy**. Setelah selesai, Vercel kasih domain (mis. `my-finance-xyz.vercel.app`).
6. **Balik ke Supabase** → Authentication → URL Configuration → update **Site URL** dan
   **Redirect URLs** dengan domain Vercel yang baru didapat. Ini penting — kalau di-skip, login
   akan redirect ke tempat yang salah atau gagal.

### Kalau pakai Netlify sebagai alternatif

Sama persis konsepnya: build command `npm run build`, publish directory `build`, environment
variables sama seperti di atas. `adapter-static` menghasilkan output statis biasa yang jalan di
host mana pun.

## 3. Verifikasi setelah deploy

Jangan langsung anggap selesai — cek urutan ini di domain production:

1. Buka domain → harus otomatis ke `/login`
2. Daftar akun baru → cek email masuk (kalau email confirmation aktif) → login
3. Tambah 1 dompet, 1 transaksi → refresh halaman → data harus tetap ada (baca dari Dexie lokal)
4. Buka **Supabase Dashboard → Table Editor → wallets/transactions** → baris yang baru dibuat
   harus muncul di sana (bukti sync jalan)
5. Buka domain yang sama di browser/device lain, login dengan akun sama → data harus muncul
   (bukti pull + Realtime jalan)
6. DevTools → Application → Manifest → pastikan tidak ada error merah
7. DevTools → Application → Service Workers → pastikan status "activated and is running"
8. Matikan jaringan (DevTools → Network → Offline) → refresh → app harus tetap terbuka

## 4. Checklist regresi manual (opsional tapi disarankan)

Kalau mau lebih menyeluruh, jalankan urutan ini sekali dari awal sampai akhir (simulasi user baru):

- [ ] Daftar akun → login → logout → login lagi
- [ ] Ganti tema ke Cherry Blossom + toggle dark mode → cek semua halaman ikut berubah warna
- [ ] Dompet: tambah 2 dompet, edit salah satu, hapus salah satu (yang bukan terakhir)
- [ ] Transaksi: catat income & expense di kedua dompet, edit satu, hapus satu
- [ ] Dashboard: cek net worth & savings rate sesuai transaksi yang dicatat
- [ ] Budget: buat budget untuk 1 kategori, catat pengeluaran di kategori itu, cek progress bar
- [ ] Tabungan: buat kantong, tabung, tarik sebagian, tandai selesai, buka lagi, hapus
- [ ] Hutang: catat hutang & piutang, bayar sebagian, bayar lunas, edit yang belum lunas
- [ ] Kalender: cek titik penanda muncul di tanggal yang tepat, tambah pengingat
- [ ] Analitik: ganti-ganti periode, cek chart & angka konsisten dengan data yang dicatat
- [ ] Settings: export JSON, hapus 1 transaksi kecil, import balik file itu → transaksi kembali
- [ ] Offline: putus jaringan, catat 1 transaksi, sambungkan lagi, cek muncul di Supabase

## 5. Setelah production stabil

- Ikon PWA masih SVG (lihat catatan Sprint 8 di README utama) — generate PNG resmi via
  [realfavicongenerator.net](https://realfavicongenerator.net) kalau mau polish lebih jauh untuk
  iOS.
- Pertimbangkan aktifkan **Supabase Point-in-Time Recovery** atau backup otomatis di
  Settings → Database kalau data user sudah mulai berharga.
- Pantau **Supabase → Reports** untuk cek quota (baris database, bandwidth) terutama di plan
  gratis.

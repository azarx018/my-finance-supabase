# My Finance (SvelteKit + Supabase + offline-first)

Rebuild dari vanilla-JS "My Finance" v5.8, fresh start (tidak mewarisi data lama).
Stack: **SvelteKit + TypeScript + Tailwind + Dexie (local DB) + Supabase (auth & sync) + vite-plugin-pwa**.

## Status: Sprint 0 — Setup & Skema ✅ · Sprint 1 — Data layer & sync ✅ · Sprint 2 — App shell & navigasi ✅ · Sprint 3 — Dashboard, Transaksi, Dompet ✅ · Sprint 4 — Budget & Tabungan ✅ · Sprint 5 — Hutang/Piutang & Notifikasi Harian ✅ · Sprint 6 — Analitik & Kalender ✅ · Sprint 7 — Export/Import ✅ · Sprint 8 — PWA Hardening ✅

Yang sudah ada di scaffold ini:

- Project SvelteKit dengan `adapter-static` (app 100% client-side, tidak butuh server)
- Tailwind dikonfigurasi supaya semua warna mengarah ke CSS variable (`var(--primary)`, dst),
  bukan hex statis — jadi ganti tema tetap **runtime** (ganti atribut `data-theme`), sama seperti
  app lama, bukan perlu rebuild.
- 3 tema di `src/app.css`: **Emerald** (default), **Pink — Soft Cherry Blossom** (baru, ganti dari
  pink gelap lama), **Ocean Blue**. Buka `/` setelah `npm run dev` untuk lihat preview + swatch-nya.
- Skema Supabase lengkap di `supabase/schema.sql`: 9 tabel (wallets, custom_categories,
  saving_buckets, goals, debts, debt_payments, budgets, reminders, transactions), semua dengan
  `user_id` + `updated_at` + `deleted_at` (soft delete) untuk kebutuhan sync nanti, plus index dan
  RLS policy (user hanya bisa akses baris miliknya sendiri) sudah jadi.
- `vite-plugin-pwa` sudah dikonfigurasi: cache-first untuk app shell, tapi request ke Supabase
  sengaja **tidak** di-cache oleh service worker — itu tanggung jawab sync engine (Dexie + queue),
  bukan SW, supaya tidak ada dua lapis caching yang saling tumpang tindih.

### Sprint 1 — apa yang dibangun

- **`src/lib/db/dexie.ts`** — skema Dexie (local DB), mirror 1:1 dari tabel Supabase. Field
  sengaja pakai nama yang sama persis (snake_case: `wallet_id`, `cat_id`, dst) supaya push/pull
  tidak butuh lapisan mapping key sama sekali.
- **`src/lib/db/repo.ts`** — `upsertRecord()` / `softDeleteRecord()` generik untuk semua 9 tabel:
  tulis ke Dexie dulu (instan, offline-capable), lalu antre untuk dikirim ke Supabase. Semua fitur
  nanti (transaksi, wallet, dst di Sprint 3+) tinggal pakai fungsi ini, otomatis offline-first
  tanpa perlu logic online/offline sendiri-sendiri per fitur.
- **`src/lib/sync/engine.ts`** — mesin sync: `flushQueue()` (push antrian lokal ke Supabase,
  berhenti di kegagalan pertama supaya urutan tetap terjaga untuk last-write-wins), `pullAll()`
  (tarik semua perubahan sejak checkpoint terakhir per tabel), `subscribeRealtime()` (live update
  dari device lain via Supabase Realtime). Auto-retry tiap 15 detik + saat event `online`.
- **`src/lib/stores/session.ts`** + **`src/lib/stores/auth.ts`** — auth Supabase (email/password),
  memicu `startSync()`/`stopSync()` otomatis saat login/logout.
- **`/login`** — halaman masuk/daftar sederhana (tampilan sementara, dipercantik di Sprint 2), dan
  route guard di root layout yang redirect otomatis kalau belum login.
- Halaman `/` sekarang punya **smoke-test sync**: indikator online/offline, jumlah antrian belum
  terkirim (reaktif via `liveQuery`), tombol "Tambah dompet contoh" untuk uji Dexie→queue→Supabase
  end-to-end, dan tombol "Paksa sync" manual.

### Cara test Sprint 1

1. Jalankan `npm run dev`, buka `/`, daftar akun baru lewat `/login`
2. Klik "Tambah dompet contoh" — cek tabel `wallets` di Supabase dashboard, barisnya harus muncul
3. Matikan jaringan (DevTools → Network → Offline), klik lagi "Tambah dompet contoh" — badge
   berubah "Offline", tapi wallet tetap muncul di list (dari Dexie) dan angka "Menunggu dikirim"
   naik
4. Nyalakan jaringan lagi — dalam ≤15 detik (atau klik "Paksa sync") baris itu terkirim, angka
   pending balik ke 0
5. Buka app yang sama di browser/device lain, login dengan akun yang sama — wallet yang dibuat di
   step 2 harus muncul otomatis (via `pullAll` + Realtime)

### Sprint 2 — apa yang dibangun

Routing sekarang beneran pakai file-based routing SvelteKit (bukan satu halaman yang isinya
di-swap `.active` seperti versi vanilla) — tiap halaman punya URL sendiri, jadi bisa di-refresh,
di-bookmark, dan dapat back/forward browser gratis.

- **`src/routes/(app)/+layout.svelte`** — shell aplikasi: splash boot, header, area konten,
  bottom nav, FAB. Membungkus semua halaman utama.
- **`src/lib/nav/config.ts`** — satu sumber kebenaran untuk 5 tab bottom-nav, judul tiap halaman,
  daftar sub-page (yang tampil back-button, bukan logo), dan kapan FAB muncul/warnanya — port
  langsung dari `js/ui/nav.js` yang lama.
- **Halaman**: `/dashboard`, `/riwayat`, `/dompet`, `/budget`, `/tabungan`, `/hutang`, `/analitik`,
  `/kalender` — masih placeholder ("dibangun di Sprint N"), tapi shell/nav di sekitarnya sudah
  hidup penuh. `/lainnya` dan `/settings` sudah fungsional (menu + ganti tema + mode gelap +
  logout) karena murah untuk dibangun sekarang dan sekalian jadi bukti komponen-komponen baru
  jalan sama-sama.
- **Komponen reusable** di `src/lib/components/`: `BottomSheet.svelte`, `Modal.svelte`,
  `ToastHost.svelte` (+ `src/lib/stores/toast.ts`), `CatPill.svelte`, `ThemeSwitcher.svelte` — ini
  yang bakal dipakai ulang di Sprint 3+ untuk form tambah transaksi, dompet, dll, alih-alih tiap
  fitur bikin markup sheet sendiri seperti di versi vanilla.
- **`src/lib/stores/ui.ts`** — theme & dark mode jadi satu store bersama; Header dan Settings
  baca/tulis store yang sama, jadi tidak ada prop-drilling.
- Halaman uji-coba sync dari Sprint 1 dipindah ke `/dev` (masih ada, cuma bukan bagian dari alur
  utama) — cara testnya sama seperti sebelumnya.

### Cara cek Sprint 2

1. `npm run dev`, login, kamu otomatis diarahkan ke `/dashboard`
2. Coba tap semua 5 tab bottom-nav — highlight tab aktif harus berubah sesuai halaman
3. Tap ikon "⋯" di header → masuk `/lainnya` → tap salah satu (misal Dompet) → header berubah
   jadi tombol back, tap back → kembali ke `/lainnya`
4. Buka `/settings` → ganti tema ke "Cherry Blossom" dan toggle mode gelap → seluruh app langsung
   berubah warna (karena semua CSS variable-based)
5. Di halaman `/riwayat`, `/analitik`, `/dompet`, `/hutang` → FAB (tombol bulat +) harus muncul;
   di halaman lain FAB harus hilang

### Sprint 3 — apa yang dibangun

Tiga halaman ini sekarang isinya asli, bukan placeholder lagi:

- **Dashboard** (`/dashboard`) — kartu Total Kekayaan (net worth semua dompet), pemasukan/pengeluaran
  bulan ini, savings rate, daftar dompet ringkas, 5 transaksi terbaru. *(Quick-insight budget/hutang
  dari dashboard versi lama menyusul begitu fitur Budget & Hutang dibangun di Sprint 4–5 — kartunya
  belum ada isinya untuk ditampilkan.)*
- **Transaksi** (`/riwayat`) — CRUD penuh: tambah/edit/hapus, pencarian, filter tipe & rentang
  waktu, lewat `TxSheet` yang mereplikasi form aslinya (toggle income/expense, scroll kategori,
  pilih dompet, tanggal, catatan).
- **Dompet** (`/dompet`) — CRUD penuh: tambah/edit/hapus dompet, saldo dihitung live dari
  `computeWalletStats` (port 1:1 dari `features/wallet.js`, termasuk aturan transfer/saving-transfer/
  debt-transfer yang tidak dihitung sebagai income/expense).

Yang jadi fondasi di balik layar (dipakai berulang mulai sprint ini):

- **`src/lib/stores/data.ts`** — `$wallets`/`$transactions`/`$customCategories`, reaktif langsung
  dari Dexie via `liveQuery`. Ini yang menggantikan pola `refreshPages('dompet','dashboard')` di
  app lama — tulis lewat `upsertRecord()` (Sprint 1), semua halaman yang menampilkan data itu
  otomatis re-render, tanpa perlu manggil refresh di masing-masing fitur.
- **`src/lib/data/`** — `format.ts`, `categories.ts`, `wallets.ts`, `analytics.ts`: fungsi murni
  (bukan class/global state) hasil port dari `core/utils.js`, `core/state.js`, `features/wallet.js`,
  `features/analytics.js`.
- **`src/lib/stores/fab.ts`** — FAB di shell (Sprint 2) sekarang bisa dipicu per-halaman: tiap
  halaman `onMount` daftar aksinya sendiri (buka sheet tambah), tanpa layout perlu tahu logic
  spesifik tiap fitur.
- **`WalletSheet.svelte`** & **`TxSheet.svelte`** — form add/edit reusable, pakai `BottomSheet` +
  `CatPill` dari Sprint 2.

**Belum termasuk di Sprint 3** (sengaja, biar scope tetap CRUD inti dulu): foto struk/kamera pada
transaksi, dan transfer antar-dompet. Keduanya gampang ditambah menyusul karena field & tabelnya
(`photo`, tipe `transfer`) sudah ada dari Sprint 0.

### Cara cek Sprint 3

1. Buka `/dompet`, tap + → isi nama & saldo awal → simpan. Cek muncul di list, dan (kalau online)
   muncul juga di tabel `wallets` Supabase.
2. Buka `/riwayat`, tap + → catat satu pemasukan dan satu pengeluaran ke dompet itu
3. Buka `/dashboard` → Total Kekayaan, kartu pemasukan/pengeluaran, dan savings rate harus sudah
   mencerminkan transaksi yang baru dicatat
4. Kembali ke `/dompet` → saldo dompet harus ikut berubah sesuai transaksi
5. Edit salah satu transaksi (ubah nominal) → cek dashboard & saldo dompet ikut update otomatis
   (tanpa refresh manual)

### Sprint 4 — apa yang dibangun

- **Budget** (`/budget`) — CRUD budget per kategori (bulan berjalan), kartu ringkasan total
  limit/terpakai/sisa, progress bar keseluruhan dengan tips otomatis (aman/hampir habis/over),
  daftar budget per kategori dengan progress masing-masing, dan daftar "Pengeluaran Tanpa Budget"
  (kategori yang belum dianggarkan, diurutkan dari terbesar) — port 1:1 dari `pages/budget.js`.
  Termasuk alur "+ Kategori Baru" langsung dari sheet budget (`NewCategorySheet.svelte`), dengan
  guard: kategori custom yang masih dipakai transaksi tidak bisa dihapus.
- **Tabungan** (`/tabungan`) — CRUD kantong tabungan (nama, target, ikon), tab Aktif/Selesai, dan
  alur Tabung/Tarik (`SavingTxSheet.svelte`) yang memvalidasi saldo dompet (untuk setor) atau saldo
  kantong (untuk tarik) sebelum mengizinkan transaksi — port 1:1 dari `features/saving.js`. Kantong
  yang ditandai selesai tidak bisa menerima setoran baru sampai dibuka lagi, sama seperti aslinya.
  *(Fitur "Impian/Goals" lama sengaja tidak diporting — sudah jadi dead code sejak v5.4 di app asli,
  digantikan total oleh sistem kantong tabungan ini; lihat komentar di `features/saving.js`.)*

Diketahui belum seratus persen sama seperti aslinya: menghapus satu transaksi bertipe
`saving_transfer` langsung dari halaman Transaksi belum otomatis ikut menghapus baris
`saving_txs` pasangannya (di app asli ini ditangani lewat field `savingTxRef`). Menghapus lewat
tombol 🗑️ di kartu kantong (yang menghapus semua transaksi terkait sekaligus) sudah bekerja penuh.

### Cara cek Sprint 4

1. Buka `/budget`, tap + → pilih kategori (atau buat kategori baru) → isi nominal → simpan
2. Catat pengeluaran di kategori itu lewat `/riwayat` → progress bar budget di `/budget` harus
   ikut bergerak
3. Buka `/tabungan`, tap + → buat kantong dengan target → tap "⬆️ Tabung" → coba setor lebih besar
   dari saldo dompet (harus ditolak), lalu setor jumlah wajar (harus berhasil dan saldo dompet
   berkurang di `/dompet`)
4. Tap "🏁" pada kantong → status berubah jadi Selesai, pindah ke tab Selesai, tombol "Tabung" hilang
5. Tap "🗑️" pada kantong → konfirmasi hapus → kantong beserta transaksinya hilang dan saldo dompet
   kembali seperti semula

### Sprint 5 — apa yang dibangun

- **Hutang & Piutang** (`/hutang`) — CRUD penuh untuk hutang (kamu pinjam) dan piutang (kamu
  pinjamkan): kartu ringkasan total belum lunas, filter (semua/belum lunas/lunas/mendesak ≤7 hari),
  progress bar cicilan, riwayat 2 pembayaran terakhir, badge status (mendesak/segera/lunas) — port
  1:1 dari `pages/hutang.js` + `features/debt.js`.
  - Nyatat hutang baru otomatis bikin transaksi `debt_transfer` bertanda `[Otomatis]` yang
    mempengaruhi saldo dompet tanpa dihitung income/expense (pinjol dari orang = saldo nambah,
    minjemin ke orang = saldo berkurang).
  - `PaymentSheet.svelte` — bayar/terima cicilan dengan tombol cepat 50%/Full, validasi tidak
    boleh melebihi sisa hutang, otomatis tandai lunas kalau sudah terbayar penuh.
  - Edit hutang yang mengubah nominal/dompet/jenis akan menawarkan (via konfirmasi) untuk
    menyesuaikan transaksi `[Otomatis]` awalnya juga — persis seperti logic `submitDebt()` di
    app asli, termasuk pilihan untuk membiarkan histori lama tidak berubah.
- **Notifikasi harian** (di `/settings`) — toggle + jam pengingat "jangan lupa catat pengeluaran",
  port dari `scheduleNotif()`/`startNotifLoop()`. Preferensinya disimpan di `localStorage` (bukan
  disinkron ke Supabase) karena sifatnya device-local, sama seperti behavior aslinya.

**Penyesuaian scope dari rencana awal:** reminder per-tanggal (yang di app asli hidup di halaman
Kalender — pilih tanggal dulu baru bisa tambah pengingat) saya pindah ke Sprint 6, karena reminder
itu butuh UI kalender yang belum ada sampai sprint itu. Notifikasi harian (yang tidak butuh
kalender) sudah selesai sekarang.

### Cara cek Sprint 5

1. Buka `/hutang`, tap + → pilih "Hutang" atau "Piutang" → isi nama, jumlah, jatuh tempo, dompet →
   simpan. Cek saldo dompet berubah sesuai arah (`/dompet`)
2. Tap "💳 Bayar" pada hutang yang belum lunas → coba isi lebih dari sisa (harus ditolak) → coba
   tombol "50%" lalu "Full" → bayar penuh → status berubah jadi "✅ Lunas" otomatis
3. Edit hutang yang belum lunas, ubah nominalnya → akan muncul konfirmasi menyesuaikan transaksi
   awal atau tidak
4. Buka `/settings` → aktifkan "Ingatkan catat pengeluaran" → browser akan minta izin notifikasi

### Sprint 6 — apa yang dibangun

- **Analitik** (`/analitik`) — port 1:1 dari `pages/analitik.js`: filter periode (bulan ini/3
  bulan/6 bulan/tahun ini), kartu ringkasan (net, savings rate, jumlah transaksi), 4 stat card
  (pemasukan, pengeluaran + perbandingan vs bulan lalu, net tabungan, rata-rata pemasukan 3 bulan),
  kartu savings rate dengan progress bar, tren bulanan (bar chart), breakdown kategori (donut
  chart), pengeluaran per hari (mini bar per hari), dan Top 5 pengeluaran.
  - **Catatan teknis:** chart aslinya digambar manual di `<canvas>` (`js/charts.js`). Di sini saya
    ganti jadi SVG deklaratif (`BarChart.svelte`, `DonutChart.svelte`) — secara visual setara,
    tapi jauh lebih pas dengan cara Svelte bekerja (reaktif otomatis lewat data binding, tanpa
    perlu manual redraw di `onMount`/resize listener seperti pola canvas).
- **Kalender** (`/kalender`) — grid bulan dengan navigasi prev/next, titik penanda per hari
  (pemasukan/pengeluaran/pengingat), ringkasan bulan (total masuk/keluar/jumlah pengingat), dan
  panel agenda harian saat tanggal dipilih (pengingat + transaksi hari itu) — port 1:1 dari
  `pages/kalender.js`.
- **Reminder per-tanggal** — `ReminderSheet.svelte`, dipicu dari tombol "+ Pengingat" inline di
  panel agenda kalender (bukan FAB global, sama seperti aslinya — kalender memang salah satu
  halaman yang FAB-nya sengaja disembunyikan). Ini melengkapi penyesuaian scope dari Sprint 5.

### Cara cek Sprint 6

1. Buka `/analitik`, ganti periode ke "3 Bulan" atau "Tahun Ini" → semua kartu, bar chart, donut,
   dan top 5 harus ikut menyesuaikan
2. Buka `/kalender` → titik hijau/merah harus muncul di tanggal yang ada transaksinya (cek dengan
   transaksi yang sudah dicatat di sprint sebelumnya)
3. Tap tanggal hari ini → panel bawah menampilkan transaksi hari itu
4. Tap tanggal lain (tanpa transaksi) → tap "+ Pengingat" → isi judul → simpan → titik kuning
   muncul di tanggal itu, dan pengingatnya muncul di panel agenda saat tanggal itu dipilih lagi
5. Navigasi ke bulan sebelumnya/berikutnya dengan tombol panah → ringkasan bulan ikut berubah

### Sprint 7 — apa yang dibangun

- **Export/Import** (di `/settings` → "Data & Backup") — port dari `features/backup.js`:
  - Ekspor JSON: seluruh 9 tabel (baris aktif saja) jadi satu file backup
  - Ekspor CSV: transaksi saja, kolom sama seperti aslinya
  - Impor JSON: baca file backup, upsert setiap baris ke Dexie (otomatis ikut antre sync ke
    Supabase juga, sama seperti input manual)

**Dua keputusan desain yang saya buat, beda dari aslinya, dan sengaja saya jelaskan:**

1. **Impor sekarang bersifat merge, bukan replace total.** App asli waktu import JSON akan
   *mengganti seluruh data* dengan isi file (karena itu satu-satunya salinan data). Di app ini,
   replace total akan ikut menghapus/menimpa data di Supabase dan device lain yang tersinkron —
   jadi saya bikin jadi merge (upsert per-ID: yang ID-nya sama diperbarui, yang baru ditambahkan)
   supaya tidak ada resiko kehilangan data di device lain secara tidak sengaja.
2. **Auto-backup mingguan (`checkAutoBackup`/`doAutoBackup`) sengaja tidak diporting.** Fitur itu
   ada di app asli sebagai jaring pengaman karena datanya cuma tersimpan lokal di satu device.
   Sekarang datanya sudah otomatis tersinkron ke Supabase (Sprint 1) setiap ada perubahan, jadi
   fitur itu jadi redundant — bukan lupa, tapi memang tidak relevan lagi di arsitektur baru.

**Diketahui belum didukung:** impor file backup dari app vanilla yang lama (field-nya camelCase
seperti `walletId`, `catId`, beda dengan skema Supabase yang snake_case). Kalau nanti dibutuhkan,
ini bisa ditambah sebagai fungsi konversi terpisah.

### Cara cek Sprint 7

1. Catat beberapa transaksi/dompet, lalu buka `/settings` → "Ekspor Backup JSON" → cek file
   ke-download berisi semua data
2. Coba "Ekspor CSV" → buka di spreadsheet, kolomnya harus rapi (termasuk yang ada koma/kutip di
   deskripsi)
3. Hapus satu transaksi kecil, lalu "Impor Backup JSON" pakai file dari langkah 1 → transaksi yang
   sempat dihapus harus muncul lagi (karena ID-nya sama, ke-upsert balik)

### Sprint 8 — apa yang dibangun

- **Ikon app baru** (`static/icon-192.svg`) — tumpukan uang kertas dengan lambang "Rp", gradient
  hijau tua, sesuai referensi yang diminta (tanpa panah/grafik).
- **Registrasi service worker manual** (`src/lib/pwa/register.ts`) — sebelumnya `vite-plugin-pwa`
  auto-inject registrasi yang otomatis ganti versi diam-diam di background. Sekarang kita pegang
  kontrolnya sendiri lewat `virtual:pwa-register`, supaya user bisa lihat notifikasi "Update
  tersedia" dan pilih kapan reload (`UpdateBanner.svelte`), bukan tiba-tiba ke-refresh sendiri.
- **Banner offline** (`OfflineBanner.svelte`) — muncul di atas (mendorong konten ke bawah, bukan
  menimpa header) begitu koneksi putus, dan hilang otomatis saat online lagi.
- **Tombol Install App** di `/settings` — muncul hanya kalau browser menawarkan `beforeinstallprompt`
  (Chrome/Edge/Android); tap untuk memicu dialog instalasi native alih-alih mengandalkan ikon
  install kecil di address bar yang sering tidak disadari user.
- Manifest ditambah entry ikon 512×512 (memakai file SVG yang sama — karena vector, satu file sah
  dipakai untuk kedua ukuran).

**Keterbatasan yang jujur perlu disebutkan:** sandbox saya tidak punya tool render SVG→PNG dan
tidak ada akses internet untuk install satu (`cairosvg`, `rsvg-convert`, dll semua butuh
network). Jadi ikon PWA ini masih 100% SVG. Ini bekerja baik di Chrome/Edge Android & desktop,
tapi iOS Safari kadang butuh PNG asli untuk `apple-touch-icon` supaya tampil optimal di homescreen.
**Saran:** upload `static/icon-192.svg` ke situs seperti realfavicongenerator.net atau jalankan
`npx pwa-asset-generator` di lokal (butuh Node + internet) untuk generate set PNG resmi
(192, 512, apple-touch-icon, dst), lalu ganti path di `vite.config.ts` manifest icons.

### Cara cek Sprint 8

1. `npm run build && npm run preview` (mode dev PWA kadang tidak konsisten soal SW — coba build
   produksi untuk tes PWA yang akurat)
2. Buka DevTools → Application → Manifest, cek ikon & metadata muncul benar
3. DevTools → Network → centang Offline → refresh halaman → app shell harus tetap muncul (dari
   cache), dan banner "📴 Offline" muncul di atas
4. Nyalakan jaringan lagi → banner hilang otomatis
5. Di Chrome desktop/Android, buka `/settings` → kalau muncul tombol "📲 Install" → tap, harus
   muncul dialog instalasi native

## Audit pasca-Sprint 8: bug yang ditemukan & diperbaiki

Saya baca ulang seluruh kode dari Sprint 0-8 dan menemukan beberapa bug nyata, sudah semua
diperbaiki di zip ini:

1. **Build-breaking:** `vite.config.ts` import `SvelteKitPWA` dari paket `vite-plugin-pwa` —
   padahal itu diekspor dari paket terpisah `@vite-pwa/sveltekit`. Sudah ditambahkan ke
   `package.json` dan diperbaiki importnya.
2. **Bug tanggal (timezone):** `todayStr()` pakai `toISOString()` yang berbasis UTC. Untuk user
   di Indonesia (UTC+7/+8/+9), transaksi yang dicatat dini hari (sebelum ~jam 7 pagi WIB) akan
   tersimpan dengan tanggal **kemarin**. Diperbaiki jadi pakai komponen tanggal lokal. Bug yang
   sama juga ada di filter "Minggu Ini" (`getDateRange`) — ikut diperbaiki.
3. **Bug rollover bulan:** `getAvgMonthly` (Analitik) dan perbandingan "bulan ini vs bulan lalu"
   bisa salah hitung kalau tanggal hari ini di atas tanggal 28 (JS "meloncat" bulan saat tanggal
   tujuan tidak ada, mis. 31 Maret dikurangi 1 bulan). Diperbaiki dengan `setDate(1)` sebelum
   `setMonth()`.
4. **Bug warna/tanda di Riwayat:** transaksi `saving_transfer`/`debt_transfer` (mis. "Tarik dari
   Tabungan") selalu tampil merah/minus di halaman Transaksi, padahal seharusnya kadang
   hijau/plus tergantung arah dananya — sudah benar di Kalender tapi lupa diterapkan di Riwayat.
   Diekstrak jadi satu fungsi `getDisplayType()` bersama, dipakai konsisten di Riwayat & Kalender
   (Dashboard aman karena memang sengaja hanya menampilkan income/expense murni).
5. **Bug integritas data:** menyusul temuan #4, baris `saving_transfer`/`debt_transfer` di Riwayat
   sekarang dikunci dari edit lewat sheet transaksi umum — sebelumnya kalau user tap toggle
   Pemasukan/Pengeluaran di baris itu, `type`-nya bisa "berubah" jadi transaksi biasa dan lolos
   dari pengecualian income/expense, merusak perhitungan.
6. **Bug reaktivitas (paling luas dampaknya):** pola `$: if (open) {...}` di **9 komponen sheet**
   (semua form tambah/edit) re-run setiap ada perubahan pada *variabel apapun* yang dibaca di
   dalamnya — bukan cuma saat sheet dibuka. Karena beberapa sheet membaca `$wallets`/`$savingBuckets`
   di situ, form bisa **diam-diam ke-reset** saat user sedang mengetik, kalau ada data masuk dari
   sync real-time device lain. Diperbaiki dengan guard `wasOpen` di semua 9 komponen supaya reset
   hanya terjadi sekali saat sheet benar-benar baru dibuka.
7. **Config tidak berbahaya tapi salah:** `darkMode` di `tailwind.config.ts` pakai syntax lama
   (`'class'`) padahal Tailwind 3.4+ butuh keyword `'selector'` untuk custom selector. Tidak
   berdampak sekarang (tidak ada komponen yang pakai utility `dark:`, semuanya lewat CSS variable),
   tapi diperbaiki untuk jaga-jaga.

## Update-first PWA & versioning

- **Update-first:** service worker selalu cek versi baru di background begitu online (`registerType: 'prompt'`), tapi tidak langsung apply — muncul banner "🔄 Update tersedia" di app, dan versi baru baru aktif setelah user tap "Muat Ulang". Ini disengaja: auto-reload diam-diam bisa motong transaksi yang lagi diketik user.
- **Versioning satu sumber:** ganti angka versi cukup di `package.json` (`"version": "0.1.0"` → `"0.2.0"`, dst). Otomatis muncul di:
  - Footer halaman `/settings` ("My Finance · v0.2.0")
  - Prefix nama cache Workbox di DevTools → Application → Cache Storage (`my-finance-v0.2.0-precache-...`), jadi gampang lihat versi mana yang lagi aktif saat debug
- **Deteksi update sendiri** tidak bergantung pada nomor versi ini — Workbox pakai content-hash per file, jadi perubahan kode sekecil apapun (walau lupa bump versi) tetap otomatis kedeteksi sebagai versi baru. Nomor versi di atas murni buat kemudahan tracking manusia, bukan mekanisme cache-busting-nya sendiri.

## Menjalankan

```bash
npm install
cp .env.example .env      # isi dengan URL + anon key project Supabase kamu
npm run dev
```

## Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka SQL Editor → jalankan isi `supabase/schema.sql`
3. Aktifkan Auth provider yang mau dipakai (Email/Password atau Magic Link) di
   Authentication → Providers
4. Salin `Project URL` dan `anon public key` dari Settings → API ke `.env`

## Perbaikan pasca-Sprint 6: konflik versi Svelte

`npm install` sebelumnya gagal dengan `ERESOLVE` karena `package.json` mem-pin
`@sveltejs/vite-plugin-svelte@^4.0.0` (yang mewajibkan Svelte 5 sebagai peer dependency) bersamaan
dengan `svelte@^4.2.19` — kombinasi yang tidak konsisten dari saya sendiri. **Sudah diperbaiki**:
`svelte` di-bump ke `^5.0.0`.

Tidak ada kode `.svelte` yang perlu diubah — Svelte 5 backward-compatible penuh dengan syntax lama
(`export let`, `$:`, `on:click`, `<slot>`, modifier seperti `|preventDefault`/`|stopPropagation`)
selama tidak memakai runes (`$state`, `$props`, dst), yang sifatnya opt-in per komponen. Jadi
`svelte-migrate` CLI tidak diperlukan untuk saat ini. Kalau nanti mau migrasi ke syntax runes yang
lebih baru, itu bisa dilakukan bertahap kapan saja tanpa mendesak.

## Belum dikerjakan (menyusul di sprint berikutnya)

- **Sprint 9**: testing menyeluruh & deploy (Vercel/Netlify + Supabase project production), plus
  generate ikon PNG resmi (lihat catatan keterbatasan Sprint 8 di atas)

Catatan: `npm run check` belum sempat dijalankan di lingkungan pembuatan (tidak ada akses
internet untuk `npm install` di sana) — jalankan itu setelah `npm install` di lokal untuk
menangkap kalau ada type error kecil di TypeScript sebelum lanjut Sprint 9.

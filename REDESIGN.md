# Redesign My Finance — catatan perubahan

Logika data (Dexie, Supabase, sync, asisten AI) TIDAK diubah. Yang berubah hanya tampilan.

- `src/app.css` — token warna baru (3 tema + mode gelap), border tebal + bayangan keras, latar titik-titik,
  utilitas layout (`page-wrap`, `page-narrow`, `span-all`), semua keyframes animasi. Animasi selalu jalan
  (aturan `prefers-reduced-motion` dihapus sesuai permintaan).
- Layout responsif: mobile = bottom nav melayang dengan pil yang meluncur; desktop (>=900px) = `Sidebar.svelte`
  + grid beberapa kolom. Bottom sheet jadi dialog di desktop.
- Komponen baru: `Icon.svelte` (ikon SVG, menggantikan emoji UI), `Sidebar.svelte`,
  `actions/countUp.ts` (angka menghitung naik), `fx/confetti.ts` (confetti saat aksi sukses).
- Emoji kategori & dompet tetap emoji. Emoji di teks toast otomatis dibuang (diganti ikon).
- Dashboard ditulis ulang (hero + mini chart 7 hari, ring savings rate, koin interaktif).
- Halaman lain mengikuti lewat token + class container; ikon tombol diganti `<Icon />`.
- Font: Bricolage Grotesque (ganti Sora) — lihat `src/app.html` dan `tailwind.config.ts`.

Belum diverifikasi lewat `npm run build` (tidak ada akses jaringan di sini): jalankan
`npm install && npm run check && npm run build` lalu cek tiap halaman di HP dan desktop.

## Revisi ronde 2
- Mode gelap diperhalus: garis & bayangan keras pakai `--line` (abu-indigo lembut, bukan putih menyala), latar lebih gelap,
  blob/dot latar diredam, hero tidak menyilaukan.
- Tombol + (FAB): animasi denyut kuning dihapus.
- Semua halaman diseragamkan: judul seksi & judul sheet lebih tegas, tombol aksi utama (primary/expense/info) di semua sheet
  memakai gaya sticker yang sama, keadaan kosong jadi kotak putus-putus, Modal & bubble asisten ikut tema,
  ubin ikon kategori berwarna per kategori (`lib/data/catColor.ts`), halaman Lainnya memakai ubin ikon.

## Revisi ronde 3
- Asisten AI: layar chat penuh tanpa navbar bawah; chatbox selalu di atas keyboard (tinggi mengikuti visual viewport,
  plus `interactive-widget=resizes-content`), input & tombol kirim ikut tema.
- Chart bulanan, donut, dan batang harian ikut tema (warna dari token, garis & bayangan senada, angka total di tengah donut).
- Ikon online/offline di header disamakan dengan tombol lain; judul halaman dipersingkat supaya tidak terpotong di HP.
- Pengaturan: kartu profil di atas, judul seksi dengan ubin ikon, tombol baris bergaya sticker, zona berbahaya diberi tint merah.

## Audit performa
- `stores/data.ts`: live query memakai `filter()` langsung (tanpa salinan array penuh), emisi duplikat dilewati
  (id + updated_at sama), dan `keepAlive()` di layout menjaga query tetap hidup antar halaman (tidak baca ulang tabel tiap pindah halaman).
- `sync/engine.ts`: `applyRemoteRows` kini 1 transaksi + `bulkGet/bulkPut` (dulu 1 get + 1 put per baris, tiap put memicu
  refresh UI); `pullAll` paralel antar tabel; interval safety-net berhenti saat tab tersembunyi.
- Riwayat: pencarian di-debounce 160ms, peta dompet/kategori dibuat sekali (bukan dicari per baris), daftar dirender bertahap 40 per langkah.
- Dashboard: sparkline 7 hari dihitung satu kali lewat, bukan 7 kali.
- CSS: hapus `backdrop-filter`, hapus animasi latar tanpa henti, hapus selector `:has()` (diganti class `.bar-track`),
  animasi masuk hanya 8 elemen pertama, confetti 24 keping. Splash 800ms → 550ms.

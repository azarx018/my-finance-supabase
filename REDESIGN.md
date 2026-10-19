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

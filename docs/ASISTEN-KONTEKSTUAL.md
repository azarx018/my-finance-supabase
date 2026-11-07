# Asisten AI kontekstual (panel di halaman lain)

Asisten tidak hanya di halaman `/asisten`. Halaman lain bisa menampilkan kartu masuk yang membuka panel chat dari bawah,
tanpa pindah halaman. Saat ini terpasang di **Budget**.

## Komponen
| File | Fungsi |
|---|---|
| `lib/components/AssistantChat.svelte` | Seluruh logika chat (kirim, kartu usulan, terapkan, riwayat). Dipakai halaman penuh dan panel. Props: `embedded`, `screen`, `initialPrompt`, `suggestions`. |
| `lib/components/AssistantSheet.svelte` | Panel bawah (`BottomSheet`) berisi `AssistantChat embedded`. Chat dibuat baru tiap dibuka, dibuang saat ditutup. |
| `lib/components/AssistantEntry.svelte` | Kartu masuk (kolom "Tanya…" + chip). Otomatis tersembunyi kalau `PUBLIC_AI_WORKER_URL` kosong. |
| `routes/(app)/asisten/+page.svelte` | Hanya membungkus `AssistantChat` (halaman penuh). |

## Halaman yang sudah terpasang
| Halaman | Preset (`lib/ai/screens.ts`) | Bentuk |
|---|---|---|
| Dashboard | `dashboard` | **Catat cepat**: kolom ketik sungguhan di bawah kartu hero. Enter → panel terbuka dan kalimatnya langsung terkirim → kartu konfirmasi |
| Budget | `budget` | Kartu + chip (disembunyikan saat melihat bulan lalu) |
| Tabungan | `tabungan` | Kartu + chip, di bawah ringkasan total tabungan |
| Riwayat | `riwayat` | Kartu + chip, di bawah filter |
| Analitik | `analitik` | Kartu + chip, di bawah kartu ringkasan |

## Memasang di halaman baru (3 langkah)
1. Tambah entri preset di `lib/ai/screens.ts` (teks kartu, chip, saran). Chip hanya boleh berisi hal yang bisa dikerjakan asisten dengan data yang ia punya.
2. Tambah satu baris petunjuk di `SCREEN_HINT` (`cloudflare/ai-worker/src/assistant.ts`). Nama kunci harus sama dengan preset.
3. Taruh `<AssistantDock screen="..." />` di halaman (dan `hidden={...}` kalau kartu perlu disembunyikan pada kondisi tertentu).
   `AssistantDock` = kartu masuk + panel chat; tidak menambah elemen pembungkus sehingga `span-all` di grid halaman tetap bekerja.

## Perilaku
- Chip mengirim kalimatnya otomatis begitu panel terbuka; kolom "Tanya…" membuka panel kosong dengan saran.
- Kartu usulan (budget, kantong, transaksi, dll.) tetap butuh tap **Terapkan** — tidak ada yang tersimpan otomatis.
- Karena panel dan halaman membaca store yang sama, hasil "Terapkan" langsung terlihat di halaman di belakang panel.
- Kartu Budget tidak tampil saat melihat bulan lalu (read-only).
- Batasan saat ini: asisten belum bisa *mencari* transaksi tertentu (belum ada tool baca lokal) dan belum bisa setor/tarik ke kantong yang sudah ada. Chip sengaja tidak menjanjikan itu.

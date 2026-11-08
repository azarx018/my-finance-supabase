# Audit Asisten AI — kenapa jawabannya tidak nyambung dengan data app

## Temuan
1. **Saldo & posisi keuangan tidak pernah dikirim ke asisten.** Halaman `/asisten` menghitung `walletBalances`, tapi nilainya tidak
   dimasukkan ke request. Worker hanya menerima daftar dompet `{id, name}`, kategori, ringkasan pengeluaran, dan hutang aktif.
   Akibatnya pertanyaan seperti "saldo gue berapa", "tabungan gue berapa", "total hutang", atau "pemasukan bulan ini" dijawab dengan
   tebakan / angka 0 / "belum ada data".
2. **Sanitizer worker membuang field yang tidak ia kenal** (`cloudflare/ai-worker/src/shared/assistantInput.ts`). Jadi walaupun app
   mengirim saldo di `wallets`, `idNameOptions()` hanya menyimpan `id` dan `name`.
3. **Tidak ada pemasukan bulan ini/lalu, tabungan per kantong, piutang/hutang total, atau pemakaian budget** di konteks — hanya total
   pengeluaran per kategori.
4. **Riwayat chat tidak memberi tahu status kartu usulan.** Kartu yang belum ditekan "Terapkan" dikirim ke model sebagai kalimat biasa
   ("Usulan transaksi …"), sehingga model menganggap transaksinya sudah tercatat dan menjawab lain dari isi app.
5. Prompt tidak punya aturan "jawab dari data yang ada, jangan 0 / jangan menebak", jadi model bebas mengarang saat data kosong.

## Perbaikan
| Lapisan | File | Perubahan |
|---|---|---|
| App | `src/lib/ai/assistantSnapshot.ts` (baru) | `buildAssistantSnapshot()` — saldo tiap dompet + total, saldo tiap kantong tabungan + total, hutang & piutang aktif, pemasukan/pengeluaran bulan ini & lalu, pemakaian budget. Memakai fungsi yang sama dengan layar app (`computeWalletStats`, `getBucketBalance`, `getActiveDebts`, `getSpendingSummary`). |
| App | `src/lib/ai/assistant.ts` | `AssistantContext.snapshot` |
| App | `src/routes/(app)/asisten/+page.svelte` | Snapshot dikirim di tiap pesan; riwayat ditandai `[SUDAH/BELUM diterapkan]` |
| Worker | `shared/assistantInput.ts` | `financeSnapshot()` meneruskan snapshot (divalidasi, nilai rusak jadi 0, tanpa snapshot → `null`) |
| Worker | `assistant.ts` | Bagian **POSISI KEUANGAN SAAT INI** di prompt, saldo di daftar dompet, **ATURAN ANGKA** (15–19), `buildSystemInstruction` diekspor untuk tes |
| Tes | `scripts/test-assistant.mjs` | `npm run test:assistant` — data app → snapshot → sanitizer → prompt (24 pengecekan; gagal bila sanitizer lama dipakai) |

## Aturan ke depan
- Setiap menambah angka baru yang boleh dijawab asisten: tambahkan di `AssistantSnapshot` (app) **dan** `financeSnapshot()` (sanitizer)
  **dan** `formatSnapshot()` (prompt) **dan** tes. Melewatkan salah satunya membuat angka hilang diam-diam.
- Hanya angka ringkasan yang dikirim; transaksi mentah tidak keluar dari device.
- Worker harus di-deploy ulang (manual) agar prompt dan sanitizer baru aktif; app dan worker harus versi yang sama.

## Batasan yang masih ada
- Asisten belum bisa mencari transaksi tertentu atau setor/tarik ke kantong yang sudah ada.
- "Total kekayaan" sengaja tidak dihitung otomatis: app versi ini memisahkan saldo dompet dan tabungan; asisten menyebut keduanya.

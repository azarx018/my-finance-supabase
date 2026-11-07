# Aturan logika keuangan (jangan dilanggar saat menambah fitur)

## Satu uang, satu tempat
- Saldo **dompet** = initial_balance + income − expense ± transfer ± saving_transfer ± debt_transfer.
- Saldo **kantong tabungan** = setoran − penarikan (`saving_txs`).
- **Total kekayaan** = dompet + kantong tabungan + piutang − hutang (`getNetWorth`, `data/saving.ts`). Menabung hanya memindahkan uang;
  meminjam menambah dompet tapi juga hutang sebesar sama, jadi tidak mengubah kekayaan. Hanya hutang/piutang yang punya dompet
  (`wallet_id`) yang dihitung, karena hanya itu yang kasnya tercatat (`getDebtPosition`, `data/debt.ts`).
- Tabungan & hutang BUKAN pemasukan/pengeluaran, jadi tidak masuk savings rate / budget.

## Tabungan = dua tabel yang selalu berpasangan
Setiap setoran/penarikan menulis `saving_txs` + cermin `transactions` (`type: saving_transfer`) dalam SATU transaksi atomic.
Semua jalur (sheet Tabungan, Asisten AI, hapus kantong) wajib lewat `src/lib/db/savingOps.ts`.
Validasi: saldo dompet/kantong dicek pada tanggal transaksi DAN saat ini.
`Tabungan → Cek kecocokan data tabungan` mendeteksi pasangan yang putus (mis. salah satu gagal sync) dan memperbaikinya.

## Savings rate sadar "sisa bulan lalu" (`data/cashflow.ts`)
- Pemasukan ≥ pengeluaran → rumus lama: (pemasukan − pengeluaran) / pemasukan.
- Pengeluaran > pemasukan → selisihnya dibayar dulu dari **sisa bulan lalu** (pemasukan + tarik tabungan − pengeluaran − setor tabungan
  bulan sebelumnya, maksimal sebesar saldo dompet di awal periode). Hanya kelebihannya yang dihitung defisit.
- Dipakai di Dashboard & Analitik (semua periode: bulan ini, 3/6 bulan, tahun).

## Kategori sistem
`savings`, `saving_transfer`, `debt_transfer` disembunyikan dari input manual dan dari daftar kategori untuk AI
(`SYSTEM_CAT_IDS`, `getPickableCats`). Pakai menu Tabungan / Hutang.

## Budget
Budget disimpan per bulan (`YYYY-MM`). Halaman Budget bisa menjelajah bulan (read-only untuk bulan lalu, boleh
merencanakan 1 bulan ke depan) dan "Salin budget" dari bulan sebelumnya.

## "Dihitung untuk bulan" (transactions.for_month)
Pemasukan boleh ditandai untuk bulan lain (mis. gajian 28 Okt → November). Saldo dompet & Riwayat tetap memakai tanggal asli;
angka ANALISIS (savings rate, pemasukan bulanan, grafik) memakai `toAnalysisView()` (`data/analytics.ts`) yang memindahkan
pemasukan itu ke tanggal 1 bulan tujuannya. Kolom hanya dikirim ke server kalau dipakai. Butuh migrasi `supabase/migration_for_month_and_rollover.sql`.

## Rollover budget (budgets.rollover)
Budget bulan ini yang ditandai rollover mendapat tambahan sisa limit bulan lalu (`effectiveBudget()`, `data/budget.ts`),
berantai selama tiap bulan punya budget kategori itu dan ditandai rollover. Overspend tidak jadi minus.

## Backup / impor (`db/backup.ts`)
- Ekspor menyertakan `meta` (schema + jumlah baris per tabel) untuk mendeteksi file terpotong.
- Impor: transaksi cermin tabungan/hutang yang kantong/hutangnya tidak ada DILEWATI (tidak lagi dikosongkan relasinya,
  yang dulu membuat uang hilang dari dompet). Setelah impor, pasangan `saving_txs` ↔ cermin yang putus dilengkapi otomatis.

## Tes
`npm run test:logic` menjalankan tes logika murni (`tests/logic/*.test.ts`): savings rate/sisa bulan lalu, tabungan, budget rollover,
total kekayaan + hutang, for_month. Jalankan setiap mengubah `src/lib/data/*`.

## Asisten AI membaca angka yang sama dengan layar app (`data/snapshot.ts`)
Tiap pesan dikirim, app menghitung `FinanceSnapshot` dari data terbaru memakai fungsi yang sama dengan Dashboard/Budget/Analitik
(`computeWalletStats`, `getNetWorth`, `summarizePeriod`, `effectiveBudget`): saldo tiap dompet (termasuk saldo bawaan), tabungan per kantong,
piutang/hutang, total kekayaan, ringkasan bulan ini & bulan lalu (termasuk status "dibayar dari sisa bulan lalu"), dan budget terpakai.
Worker (`ai-worker/src/assistant.ts`) memasukkannya ke prompt sebagai SUMBER KEBENARAN + "ATURAN ANGKA" (mis. dilarang menjawab saldo 0
hanya karena belum ada pemasukan). Setiap kali menambah angka baru di app, tambahkan juga ke snapshot supaya asisten tidak berbeda dari layar.
Penerapan kartu transaksi memakai aturan yang sama dengan form manual (pengeluaran dari dompet kosong ditolak).

-- ================================================
-- MIGRATION v2.3: dua kolom opsional
--   transactions.for_month  → pemasukan "dihitung untuk bulan lain" (mis. gajian 28 Okt dihitung untuk Nov)
--   budgets.rollover        → sisa budget kategori dilanjutkan ke bulan berikutnya
-- ================================================
-- Idempotent (aman dijalankan berulang). Jalankan di Supabase → SQL Editor SEBELUM memakai fitur barunya.
-- App tidak mengirim kolom ini kecuali fiturnya dipakai, jadi transaksi/budget biasa tetap aman
-- walau migrasi ini belum dijalankan.

alter table public.transactions
  add column if not exists for_month text;

alter table public.transactions
  drop constraint if exists transactions_for_month_format;
alter table public.transactions
  add constraint transactions_for_month_format
  check (for_month is null or for_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.budgets
  add column if not exists rollover boolean not null default false;

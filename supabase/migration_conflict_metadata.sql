-- Conflict metadata (audit item #6).
--
-- This app intentionally keeps last-write-wins conflict handling based
-- on `updated_at` — see repo.ts's upsertRecord() doc comment. These two
-- columns don't change that behavior; they're observability only:
--   version     — a running edit counter, so you can tell at a glance
--                 whether a row has been touched once or fifty times.
--   updated_by  — which DEVICE (not which user — that's already
--                 `user_id`) made the last edit. Lets a future UI say
--                 "this was last changed from your other device" for
--                 someone using the app on both their phone and laptop.
--
-- Run this once against your Supabase project (SQL Editor, or via the
-- CLI: `supabase db execute -f supabase/migration_conflict_metadata.sql`).

alter table public.wallets           add column if not exists version integer not null default 1;
alter table public.wallets           add column if not exists updated_by text;

alter table public.custom_categories add column if not exists version integer not null default 1;
alter table public.custom_categories add column if not exists updated_by text;

alter table public.saving_buckets    add column if not exists version integer not null default 1;
alter table public.saving_buckets    add column if not exists updated_by text;

alter table public.saving_txs        add column if not exists version integer not null default 1;
alter table public.saving_txs        add column if not exists updated_by text;

alter table public.goals             add column if not exists version integer not null default 1;
alter table public.goals             add column if not exists updated_by text;

alter table public.debts             add column if not exists version integer not null default 1;
alter table public.debts             add column if not exists updated_by text;

alter table public.debt_payments     add column if not exists version integer not null default 1;
alter table public.debt_payments     add column if not exists updated_by text;

alter table public.budgets           add column if not exists version integer not null default 1;
alter table public.budgets           add column if not exists updated_by text;

alter table public.reminders         add column if not exists version integer not null default 1;
alter table public.reminders         add column if not exists updated_by text;

alter table public.transactions      add column if not exists version integer not null default 1;
alter table public.transactions      add column if not exists updated_by text;

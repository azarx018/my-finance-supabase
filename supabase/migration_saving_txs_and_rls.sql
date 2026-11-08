-- ================================================
-- MIGRATION: add missing saving_txs table + verify RLS
-- ================================================
-- Run this if you already executed the old schema.sql. That version
-- referenced `public.saving_txs` (in an index, an updated_at trigger,
-- and an RLS policy loop) without ever creating the table. Because
-- Supabase's SQL editor runs a pasted script as one transaction, the
-- very first broken reference likely aborted the whole script partway
-- through — which means, depending on exactly where it failed, some or
-- all of your OTHER tables may currently have no RLS policies at all
-- (any authenticated user could read/write any other user's rows).
--
-- This script is idempotent (safe to run more than once) and:
--   1. Creates saving_txs if it doesn't exist yet.
--   2. Re-applies the updated_at trigger + RLS policies to EVERY
--      table, not just saving_txs, in case the original script's
--      failure left others without them.
--
-- After running this, check Database → Tables in the Supabase
-- dashboard: every table listed below should show a lock icon (RLS
-- enabled). If any don't, something else is off and worth a closer
-- look.

create table if not exists public.saving_txs (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  bucket_id   uuid not null references public.saving_buckets(id) on delete cascade,
  wallet_id   uuid references public.wallets(id) on delete set null,
  type        text not null check (type in ('deposit', 'withdraw')),
  amount      numeric not null,
  date        date not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_saving_txs_sync   on public.saving_txs (user_id, updated_at);
create index if not exists idx_saving_txs_bucket on public.saving_txs (bucket_id);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'wallets','custom_categories','saving_buckets','saving_txs','goals',
    'debts','debt_payments','budgets','reminders','transactions'
  ]
  loop
    execute format(
      'drop trigger if exists trg_touch_updated_at on public.%I;
       create trigger trg_touch_updated_at
       before update on public.%I
       for each row execute function public.touch_updated_at();',
      t, t
    );

    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "own_rows_select" on public.%I;', t);
    execute format('drop policy if exists "own_rows_insert" on public.%I;', t);
    execute format('drop policy if exists "own_rows_update" on public.%I;', t);
    execute format('drop policy if exists "own_rows_delete" on public.%I;', t);

    execute format(
      'create policy "own_rows_select" on public.%I for select using (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_rows_insert" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_rows_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_rows_delete" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

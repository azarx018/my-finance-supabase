-- ================================================
-- MY FINANCE — Supabase schema (Sprint 0)
-- Fresh start: no migration from the old IndexedDB blob format.
-- Every table follows the same sync-friendly shape:
--   id          uuid, client-generated (so offline inserts already
--               have a stable id before ever reaching the server)
--   user_id     uuid, owner — enforced by RLS below
--   updated_at  timestamptz — used by the sync engine for
--               last-write-wins conflict resolution AND for
--               incremental pulls ("give me everything changed
--               since my last sync")
--   deleted_at  timestamptz null — soft delete. Offline-first apps
--               can't hard-delete: another device may have an
--               offline edit in flight for a row that was deleted
--               elsewhere, and the sync engine needs a tombstone to
--               reconcile that instead of the row just vanishing.
-- ================================================

create extension if not exists "pgcrypto";

-- ===================== WALLETS =====================
create table if not exists public.wallets (
  id               uuid primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  emoji            text not null default '👛',
  initial_balance  numeric not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- ===================== CUSTOM CATEGORIES =====================
create table if not exists public.custom_categories (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text not null,
  type        text not null check (type in ('income', 'expense')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ===================== SAVING BUCKETS (Tabungan) =====================
create table if not exists public.saving_buckets (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text not null default '🎯',
  target      numeric not null default 0,
  status      text not null default 'active' check (status in ('active', 'completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ===================== SAVING TXS (deposit/withdraw ke kantong tabungan) =====================
-- BUGFIX: this table was referenced by the index below, the updated_at
-- trigger loop, and the RLS policy loop further down — but the
-- `create table` itself was missing. Since Supabase's SQL editor runs a
-- pasted script as one transaction, the very first reference to a
-- nonexistent `public.saving_txs` (the index a few lines down) would
-- abort the whole script, meaning EVERY table after that point —
-- including the updated_at triggers and, critically, the RLS policies
-- for every table — never actually got created. Adding the table here
-- fixes both the missing-table bug and un-blocks the rest of the script.
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

-- ===================== SAVING GOALS (legacy "goals" feature) =====================
create table if not exists public.goals (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  target      numeric not null default 0,
  saved       numeric not null default 0,
  deadline    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ===================== DEBTS (Hutang/Piutang) =====================
create table if not exists public.debts (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  amount       numeric not null,
  due_date     date,
  note         text,
  dtype        text not null check (dtype in ('borrowed', 'lent')),
  wallet_id    uuid references public.wallets(id) on delete set null,
  paid         boolean not null default false,
  paid_date    date,
  paid_amount  numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Debt payments used to live as a JSON sub-array on the debt object
-- (`debt.payments[]`). Normalized into its own table so partial payments
-- sync as independent rows instead of requiring the whole debt row to be
-- rewritten (and risk clobbering a concurrent edit) on every payment.
create table if not exists public.debt_payments (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  debt_id     uuid not null references public.debts(id) on delete cascade,
  amount      numeric not null,
  date        date not null,
  note        text,
  wallet_id   uuid references public.wallets(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ===================== BUDGETS =====================
create table if not exists public.budgets (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  cat_id       text not null,
  limit_amount numeric not null,
  month        text not null, -- 'YYYY-MM'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (user_id, cat_id, month)
);

-- ===================== REMINDERS =====================
create table if not exists public.reminders (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  title       text not null,
  amount      numeric not null default 0,
  cat         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ===================== TRANSACTIONS =====================
-- The central table. type='income'|'expense' are real cash flow;
-- 'transfer'|'saving_transfer'|'debt_transfer' move money between
-- wallets/buckets/debts and are excluded from income/expense totals
-- (same rule as the original app — see wallet.js / debt.js comments).
create table if not exists public.transactions (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  type           text not null check (
                   type in ('income', 'expense', 'transfer', 'saving_transfer', 'debt_transfer')
                 ),
  amount         numeric not null,
  cat_id         text,
  description    text,
  note           text,
  date           date not null,
  photo          text, -- base64 thumbnail or storage URL, kept small
  wallet_id      uuid references public.wallets(id) on delete set null,
  to_wallet_id   uuid references public.wallets(id) on delete set null, -- 'transfer' only
  direction      text, -- 'in'/'out' (debt_transfer) or 'deposit'/'withdraw' (saving_transfer)
  bucket_id      uuid references public.saving_buckets(id) on delete set null, -- saving_transfer
  debt_ref       uuid references public.debts(id) on delete set null, -- debt_transfer
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- ===================== INDEXES =====================
-- Every table gets a (user_id, updated_at) index: this is the exact shape
-- of the sync engine's pull query — "rows I own, changed since my last
-- checkpoint" — for every table, every sync cycle.
create index if not exists idx_wallets_sync           on public.wallets           (user_id, updated_at);
create index if not exists idx_custom_categories_sync  on public.custom_categories (user_id, updated_at);
create index if not exists idx_saving_buckets_sync     on public.saving_buckets    (user_id, updated_at);
create index if not exists idx_saving_txs_sync          on public.saving_txs        (user_id, updated_at);
create index if not exists idx_saving_txs_bucket        on public.saving_txs        (bucket_id);
create index if not exists idx_goals_sync              on public.goals             (user_id, updated_at);
create index if not exists idx_debts_sync              on public.debts             (user_id, updated_at);
create index if not exists idx_debt_payments_sync      on public.debt_payments     (user_id, updated_at);
create index if not exists idx_budgets_sync            on public.budgets           (user_id, updated_at);
create index if not exists idx_reminders_sync          on public.reminders         (user_id, updated_at);
create index if not exists idx_transactions_sync       on public.transactions      (user_id, updated_at);
create index if not exists idx_transactions_wallet     on public.transactions      (wallet_id);
create index if not exists idx_transactions_date       on public.transactions      (user_id, date);

-- ===================== updated_at AUTO-TOUCH =====================
-- Belt-and-suspenders: even if a client forgets to bump updated_at itself,
-- the server always sets it on every UPDATE, so last-write-wins never
-- compares against a stale timestamp.
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
  end loop;
end $$;

-- ===================== ROW LEVEL SECURITY =====================
-- Every table: a user can only ever see/write their own rows.
-- Soft-deleted rows are NOT filtered out here — the client decides
-- whether to show them (the sync engine needs to see tombstones to
-- remove them from local Dexie too).
do $$
declare
  t text;
begin
  foreach t in array array[
    'wallets','custom_categories','saving_buckets','saving_txs','goals',
    'debts','debt_payments','budgets','reminders','transactions'
  ]
  loop
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

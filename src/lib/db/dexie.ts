import Dexie, { type Table } from 'dexie';

// Deliberate choice: local Dexie records use the EXACT same field names
// (snake_case) as the Supabase columns — wallet_id, cat_id, debt_ref, etc.
// This means push/pull never need a key-mapping step; a row read from
// Supabase can be `.put()` into Dexie as-is, and vice versa. The cost is
// that app code reads `record.wallet_id` instead of `record.walletId`;
// that's a small price for removing an entire class of mapping bugs.

export interface SyncableRecord {
  id: string;
  user_id: string;
  updated_at: string; // ISO string
  deleted_at: string | null;
  [key: string]: unknown;
}

export interface QueueEntry {
  qid?: number; // Dexie auto-increment primary key
  table: SyncTable;
  recordId: string;
  payload: SyncableRecord;
  ts: number;
}

export interface SyncMeta {
  table: SyncTable; // primary key
  lastPulledAt: string; // ISO string checkpoint for incremental pulls
}

// Single source of truth for which tables sync. Adding a new synced
// table later means: add it here, add a Dexie store for it below, add
// the matching Postgres table in supabase/schema.sql. Nothing else in
// the sync engine or repo layer needs to change.
export const SYNC_TABLES = [
  'wallets',
  'custom_categories',
  'saving_buckets',
  'saving_txs',
  'goals',
  'debts',
  'debt_payments',
  'budgets',
  'reminders',
  'transactions'
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

class MyFinanceDB extends Dexie {
  wallets!: Table<SyncableRecord, string>;
  custom_categories!: Table<SyncableRecord, string>;
  saving_buckets!: Table<SyncableRecord, string>;
  saving_txs!: Table<SyncableRecord, string>;
  goals!: Table<SyncableRecord, string>;
  debts!: Table<SyncableRecord, string>;
  debt_payments!: Table<SyncableRecord, string>;
  budgets!: Table<SyncableRecord, string>;
  reminders!: Table<SyncableRecord, string>;
  transactions!: Table<SyncableRecord, string>;
  syncQueue!: Table<QueueEntry, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('MyFinanceDB');
    this.version(1).stores({
      wallets: 'id, updated_at, deleted_at',
      custom_categories: 'id, updated_at, deleted_at, type',
      saving_buckets: 'id, updated_at, deleted_at, status',
      goals: 'id, updated_at, deleted_at',
      debts: 'id, updated_at, deleted_at, dtype, wallet_id',
      debt_payments: 'id, updated_at, deleted_at, debt_id',
      budgets: 'id, updated_at, deleted_at, [cat_id+month]',
      reminders: 'id, updated_at, deleted_at, date',
      transactions: 'id, updated_at, deleted_at, wallet_id, date, type, bucket_id, debt_ref',
      // ++qid = auto-increment key. Indexed on table+ts so the sync
      // engine can drain in FIFO order per table if needed later.
      syncQueue: '++qid, table, recordId, ts',
      syncMeta: 'table'
    });
  }
}

export const db = new MyFinanceDB();

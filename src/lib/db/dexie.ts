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
  // Conflict metadata (audit #6) — observability only, does NOT change
  // this app's last-write-wins behavior. See repo.ts's upsertRecord().
  version?: number;
  updated_by?: string; // device id from stores/device.ts
  [key: string]: unknown;
}

export interface QueueEntry {
  qid?: number; // Dexie auto-increment primary key
  table: SyncTable;
  recordId: string;
  payload: SyncableRecord;
  ts: number;
}

// Where a queue entry lands after `flushQueue` gives up on it because
// Postgres rejected it for a reason retrying can never fix (bad FK,
// unique violation, etc — see sync/engine.ts isPermanentError()). Without
// this, that one entry sat at the front of `syncQueue` forever and
// silently blocked every other mutation queued behind it, since the old
// flushQueue() always stopped at the first failure with no way to skip
// or discard it. Keeping the full original entry plus the error lets
// Settings show *what* got stuck and *why*, instead of just a generic
// "gagal sync" banner.
export interface FailedQueueEntry {
  fid?: number; // Dexie auto-increment primary key
  table: SyncTable;
  recordId: string;
  payload: SyncableRecord;
  error: string;
  failedAt: number;
}

export interface SyncMeta {
  table: SyncTable; // primary key
  lastPulledAt: string; // ISO string checkpoint for incremental pulls
}

// A queued receipt photo waiting to reach Supabase Storage. Kept
// separate from `syncQueue` on purpose: syncQueue carries small JSON
// row payloads that go straight to a Postgres upsert, while this holds
// an actual compressed image Blob bound for Storage — different
// destination, different upload call, no reason to force them through
// the same queue/shape.
export interface PendingPhotoUpload {
  id?: number; // Dexie auto-increment key
  transactionId: string;
  userId: string;
  blob: Blob;
  ext: 'webp' | 'jpg';
  createdAt: number;
}

// The Asisten AI chat's rolling local history (Level A memory — see
// the "asisten mengingat kita" design discussion). Deliberately LOCAL
// ONLY, never synced — unlike assistant_memory below, a raw chat
// transcript isn't something that needs to follow you to another
// device, and keeping it device-local avoids sending conversational
// text to Supabase at all. `actionJson` preserves enough of a
// propose_* action to redraw its confirmation card (including whether
// it was already applied) after a reload — see asisten/+page.svelte.
//
// `id`/`batchId` are app-assigned UUIDs (via repo.ts's newId()), NOT
// Dexie auto-increment numbers — that lets the chat UI put a message
// on screen immediately and know its permanent id synchronously,
// without waiting on a round-trip to IndexedDB just to find out what
// id got assigned.
export interface LocalChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  text: string;
  actionJson: string | null;
  batchId: string | null;
  createdAt: number;
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
  'transactions',
  'assistant_memory'
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
  assistant_memory!: Table<SyncableRecord, string>;
  syncQueue!: Table<QueueEntry, number>;
  failedQueue!: Table<FailedQueueEntry, number>;
  syncMeta!: Table<SyncMeta, string>;
  pendingPhotoUploads!: Table<PendingPhotoUpload, number>;
  chatMessages!: Table<LocalChatMessage, string>;

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

    // BUGFIX (v2): `saving_txs` was declared as a class property above and
    // used all over the app (backup.ts, stores/data.ts, saving.ts, the
    // tabungan page) but was NEVER registered in version(1).stores(). That
    // left `db.saving_txs` `undefined` at runtime, which is exactly why
    // JSON export threw "Cannot read properties of undefined (reading
    // 'toArray')" — the export loop hit this table and blew up. Adding a
    // new version (rather than editing version(1) in place) is required
    // so Dexie runs a real schema migration for people who already have
    // v1 installed in their browser; editing v1 directly would silently
    // do nothing for anyone with an existing IndexedDB database.
    this.version(2).stores({
      saving_txs: 'id, updated_at, deleted_at, bucket_id'
    });

    // v3: receipt-photo upload queue (see PendingPhotoUpload above).
    this.version(3).stores({
      pendingPhotoUploads: '++id, transactionId, userId, createdAt'
    });

    // v4: dead-letter queue for permanently-failed pushes (see
    // FailedQueueEntry above) — lets flushQueue() evict a poisoned entry
    // instead of retrying it forever and blocking everything queued
    // behind it.
    this.version(4).stores({
      failedQueue: '++fid, table, recordId, failedAt'
    });

    // v5: assistant_memory (synced — see migration_assistant_memory.sql)
    // and chatMessages (local-only rolling chat history, Level A memory).
    this.version(5).stores({
      assistant_memory: 'id, updated_at, deleted_at',
      chatMessages: 'id, userId, createdAt'
    });
  }
}

export const db = new MyFinanceDB();

/**
 * BUGFIX (P0 security/privacy audit): `signOut()` used to only call
 * Supabase's own signOut — it never touched the local Dexie mirror.
 * Since IndexedDB is shared per BROWSER, not per logged-in user, User
 * A's rows (transactions, wallets, sync queue, dead-letter queue,
 * pending photo uploads — everything) stayed physically present after
 * logout. If User B then logged in on the same device, every unscoped
 * query in the app (dashboard totals, export, the sync queue drain,
 * etc.) would read/act on BOTH users' rows mixed together — a real
 * cross-account data leak, not a theoretical one (see the audit doc's
 * P0 item #1 for the exact scenario). Wiping every table here, called
 * from signOut(), is the single fix that closes this everywhere at
 * once instead of needing every single query site to remember to
 * filter by user_id individually.
 *
 * Deliberately wipes `syncMeta` too — that table's `lastPulledAt`
 * checkpoints are NOT user-scoped (its primary key is just the table
 * name). Leaving a previous user's checkpoint in place would make the
 * NEXT user's first pull only fetch rows updated after that stale
 * timestamp, silently missing everything older — a second, subtler
 * bug the wipe also happens to prevent.
 */
export async function wipeLocalDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    [
      ...SYNC_TABLES.map((t) => db[t]),
      db.syncQueue,
      db.failedQueue,
      db.syncMeta,
      db.pendingPhotoUploads,
      db.chatMessages
    ],
    async () => {
      for (const table of SYNC_TABLES) await db[table].clear();
      await db.syncQueue.clear();
      await db.failedQueue.clear();
      await db.syncMeta.clear();
      await db.pendingPhotoUploads.clear();
      await db.chatMessages.clear();
    }
  );
}

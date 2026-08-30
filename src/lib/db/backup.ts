import { db, SYNC_TABLES, type SyncTable } from '$lib/db/dexie';
import { upsertRecord } from './repo';
import { todayStr } from '$lib/data/format';

const APP_VERSION = 'sveltekit-1';

function dlBlob(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bundles every table's active (non-deleted) rows into one JSON file.
 * Unlike the original's exportJSON(), this reads from Dexie (the local
 * mirror) rather than a single in-memory APP object — but the shape is
 * otherwise the same idea: one portable snapshot per table.
 */
export async function exportJSON(): Promise<void> {
  const data: Record<string, unknown> = {
    app: 'My Finance',
    version: APP_VERSION,
    exported: new Date().toISOString()
  };
  for (const table of SYNC_TABLES) {
    const rows = await db[table].toArray();
    data[table] = rows.filter((r) => !r.deleted_at);
  }
  dlBlob(JSON.stringify(data, null, 2), `my-finance-backup-${todayStr()}.json`, 'application/json');
}

export async function exportCSV(): Promise<void> {
  const rows = (await db.transactions.toArray()).filter((r) => !r.deleted_at);
  if (rows.length === 0) throw new Error('Tidak ada transaksi untuk diekspor');
  const lines = rows.map((t) =>
    [
      t.id,
      t.type,
      t.amount,
      `"${((t.description as string) || '').replace(/"/g, '""')}"`,
      t.date,
      t.wallet_id || '',
      t.cat_id || '',
      `"${((t.note as string) || '').replace(/"/g, '""')}"`
    ].join(',')
  );
  const csv = ['ID,Tipe,Nominal,Deskripsi,Tanggal,Dompet,Kategori,Catatan', ...lines].join('\n');
  // BOM prefix so Excel opens the UTF-8 file with correct encoding.
  dlBlob('\uFEFF' + csv, `my-finance-${todayStr()}.csv`, 'text/csv;charset=utf-8;');
}

export interface ImportResult {
  counts: Record<string, number>;
  total: number;
  sanitized: number; // rows whose dangling FK was nulled out instead of dropping the row
  skipped: number; // rows dropped entirely (NOT NULL FK pointed nowhere)
}

// Fields from the ORIGINAL vanilla (pre-Supabase) app that never got
// renamed to match this schema. Their mere presence — with the matching
// snake_case field absent — is a reliable signature that the file
// predates the Supabase migration, since a real export from this app
// version would never contain them.
const LEGACY_FIELD_MAP: Record<string, string> = {
  walletId: 'wallet_id',
  toWalletId: 'to_wallet_id',
  catId: 'cat_id',
  bucketId: 'bucket_id',
  debtId: 'debt_id',
  debtRef: 'debt_ref'
};

function looksLikeLegacyFormat(data: Record<string, unknown>): boolean {
  for (const table of SYNC_TABLES as readonly SyncTable[]) {
    const rows = data[table];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      for (const [legacyKey, modernKey] of Object.entries(LEGACY_FIELD_MAP)) {
        if (legacyKey in row && !(modernKey in row)) return true;
      }
    }
  }
  return false;
}

// Every FK column among the synced tables, and which table it points to.
// `required: true` means the column is NOT NULL in Postgres (see
// supabase/schema.sql) — a dangling reference there can't be repaired by
// nulling it out, the whole row has to be dropped instead.
const FK_COLUMNS: Partial<
  Record<SyncTable, Array<{ field: string; refTable: SyncTable; required?: boolean }>>
> = {
  transactions: [
    { field: 'wallet_id', refTable: 'wallets' },
    { field: 'to_wallet_id', refTable: 'wallets' },
    { field: 'bucket_id', refTable: 'saving_buckets' },
    { field: 'debt_ref', refTable: 'debts' }
  ],
  saving_txs: [
    { field: 'bucket_id', refTable: 'saving_buckets', required: true },
    { field: 'wallet_id', refTable: 'wallets' }
  ],
  debts: [{ field: 'wallet_id', refTable: 'wallets' }],
  debt_payments: [
    { field: 'debt_id', refTable: 'debts', required: true },
    { field: 'wallet_id', refTable: 'wallets' }
  ]
};

/**
 * Imports a JSON backup produced by exportJSON() above.
 *
 * A MERGE, not a wholesale replace: each row is upserted by its original
 * id (new id → inserted, existing id → overwritten with the imported
 * version). A wholesale replace would also queue a destructive overwrite
 * to Supabase and every other synced device, so merge is the safer
 * default for a synced, multi-device app.
 *
 * Uses `{ restore: true }` so importing can bring back a row you'd
 * since deleted locally — the export only ever contains active rows, so
 * if an id in the file matches a soft-deleted local row, the import is
 * clearly an intentional "put this back" action, not an accidental
 * resurrection.
 *
 * BUGFIX: this used to blindly upsert + enqueue every row, with no check
 * that a row's foreign key (wallet_id, bucket_id, debt_ref, ...) actually
 * pointed at something real. Importing an old pre-Supabase backup (whose
 * field names don't line up 1:1, e.g. `walletId` never mapped to
 * `wallet_id`) or a hand-edited/partial file could queue a transaction
 * referencing a wallet that was never created — and because the sync
 * queue processes strictly in order and stops at the first failure, that
 * ONE bad row was enough to silently block EVERY future sync forever,
 * not just the bad import. Now: (1) an old-format file is rejected up
 * front with a clear message instead of getting partially, silently
 * mis-imported, and (2) every FK is checked against rows already local
 * or earlier in this same import — a dangling *nullable* FK is cleared
 * instead of left dangling, a dangling *required* FK causes that single
 * row to be skipped, but the rest of the import still proceeds.
 */
export async function importJSON(file: File): Promise<ImportResult> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    throw new Error('Format file tidak dikenali (backup array lama tidak didukung)');
  }
  if (looksLikeLegacyFormat(data)) {
    throw new Error(
      'File ini berasal dari versi lama (sebelum sinkronisasi Supabase) dan formatnya tidak kompatibel. Backup dari versi ini tidak bisa diimpor.'
    );
  }

  // Seed each referencable table's known-id set with what's already
  // local, then grow it as we import — so a wallet imported earlier in
  // this same file already counts as "exists" for a transaction imported
  // right after it, without needing a live round-trip to Supabase.
  const knownIds: Record<string, Set<string>> = {};
  for (const table of SYNC_TABLES as readonly SyncTable[]) {
    knownIds[table] = new Set((await db[table].toArray()).map((r) => r.id));
  }

  const counts: Record<string, number> = {};
  let total = 0;
  let sanitized = 0;
  let skipped = 0;

  for (const table of SYNC_TABLES as readonly SyncTable[]) {
    const rows = data[table];
    if (!Array.isArray(rows)) continue;
    const fkSpec = FK_COLUMNS[table];
    let imported = 0;

    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string') continue;

      if (fkSpec) {
        let dropRow = false;
        for (const { field, refTable, required } of fkSpec) {
          const value = row[field];
          if (value == null) continue; // already null — nothing to check
          if (knownIds[refTable].has(value)) continue; // valid reference

          if (required) {
            dropRow = true;
            break;
          }
          row[field] = null; // nullable FK: repair instead of dropping the row
          sanitized++;
        }
        if (dropRow) {
          skipped++;
          continue;
        }
      }

      await upsertRecord(table, row, { restore: true });
      knownIds[table].add(row.id);
      imported++;
      total++;
    }
    counts[table] = imported;
  }
  if (total === 0) throw new Error('Tidak ada data yang bisa diimpor dari file ini');
  return { counts, total, sanitized, skipped };
}

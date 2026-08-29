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
}

/**
 * Imports a JSON backup produced by exportJSON() above.
 *
 * Deliberately a MERGE, not a replace: each row is upserted by its
 * original id (new id → inserted, existing id → overwritten with the
 * imported version). The original vanilla app's importJSON() wiped
 * every table and replaced it wholesale — safe there, since it was the
 * only copy of the data. Here, a wholesale replace would also queue a
 * destructive overwrite to Supabase and every other synced device, so a
 * merge is the safer default for a synced, multi-device app.
 *
 * Known gap: only understands this app's own export format (snake_case
 * fields matching the Supabase schema). Importing a backup from the
 * original vanilla app (camelCase fields like `walletId`, `catId`) isn't
 * supported yet — the field names don't line up.
 */
export async function importJSON(file: File): Promise<ImportResult> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    throw new Error('Format file tidak dikenali (backup array lama tidak didukung)');
  }

  const counts: Record<string, number> = {};
  let total = 0;
  for (const table of SYNC_TABLES as readonly SyncTable[]) {
    const rows = data[table];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      await upsertRecord(table, row);
      total++;
    }
    counts[table] = rows.length;
  }
  if (total === 0) throw new Error('Tidak ada data yang bisa diimpor dari file ini');
  return { counts, total };
}

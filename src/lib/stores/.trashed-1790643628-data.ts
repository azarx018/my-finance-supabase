import { readable, type Readable } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db, type SyncableRecord, type SyncTable } from '$lib/db/dexie';

/**
 * Wraps a Dexie liveQuery as a Svelte store. This is what replaces the
 * old app's manual `refreshPages('dompet','dashboard')` calls after every
 * mutation — since every page subscribes to the same live query, writing
 * through `upsertRecord()` (Sprint 1) automatically re-renders every
 * screen that shows that data, with no explicit "refresh this page" call
 * anywhere in feature code.
 */
function liveTable(table: SyncTable): Readable<SyncableRecord[]> {
  return readable<SyncableRecord[]>([], (set) => {
    const sub = liveQuery(() => db[table].toArray().then((rows) => rows.filter((r) => !r.deleted_at))).subscribe(
      {
        next: (rows) => set(rows),
        error: (e) => console.error(`[data] liveQuery(${table}) error:`, e)
      }
    );
    return () => sub.unsubscribe();
  });
}

export const wallets = liveTable('wallets');
export const transactions = liveTable('transactions');
export const customCategories = liveTable('custom_categories');
export const budgets = liveTable('budgets');
export const savingBuckets = liveTable('saving_buckets');
export const savingTxs = liveTable('saving_txs');
export const debts = liveTable('debts');
export const debtPayments = liveTable('debt_payments');
export const reminders = liveTable('reminders');

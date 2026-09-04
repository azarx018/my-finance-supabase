import { readable, type Readable } from 'svelte/store';
import { liveQuery, type Subscription } from 'dexie';
import { db, type SyncableRecord, type SyncTable } from '$lib/db/dexie';
import { session } from './session';

/**
 * Wraps a Dexie liveQuery as a Svelte store. This is what replaces the
 * old app's manual `refreshPages('dompet','dashboard')` calls after every
 * mutation — since every page subscribes to the same live query, writing
 * through `upsertRecord()` (Sprint 1) automatically re-renders every
 * screen that shows that data, with no explicit "refresh this page" call
 * anywhere in feature code.
 *
 * BUGFIX (P0 security/privacy audit): this used to query `db[table]`
 * with no `user_id` filter at all. `wipeLocalDatabase()` (see
 * db/dexie.ts) now clears the mirror on logout, which is the main fix —
 * but this filter stays as a second layer: it re-subscribes scoped to
 * whichever user is CURRENTLY signed in every time `session` changes,
 * and clears the store to `[]` immediately on logout rather than
 * waiting for the (async) wipe to finish. Belt-and-suspenders, not
 * redundant — a bug in the wipe path shouldn't be able to leak another
 * user's rows into the UI on its own.
 */
function liveTable(table: SyncTable): Readable<SyncableRecord[]> {
  return readable<SyncableRecord[]>([], (set) => {
    let inner: Subscription | null = null;

    const sessionSub = session.subscribe((s) => {
      inner?.unsubscribe();
      const userId = s?.user.id ?? null;
      if (!userId) {
        set([]); // logged out — never show stale/leftover data
        return;
      }
      inner = liveQuery(() =>
        db[table].toArray().then((rows) => rows.filter((r) => !r.deleted_at && r.user_id === userId))
      ).subscribe({
        next: (rows) => set(rows),
        error: (e) => console.error(`[data] liveQuery(${table}) error:`, e)
      });
    });

    return () => {
      inner?.unsubscribe();
      sessionSub();
    };
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
export const assistantMemory = liveTable('assistant_memory');

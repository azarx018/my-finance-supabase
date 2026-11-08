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
function sameRows(a: SyncableRecord[], b: SyncableRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].updated_at !== b[i].updated_at) return false;
  }
  return true;
}

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
      let prev: SyncableRecord[] = [];
      inner = liveQuery(() =>
        // filter() langsung di Dexie: tidak membuat salinan array penuh dulu.
        db[table].filter((r) => !r.deleted_at && r.user_id === userId).toArray()
      ).subscribe({
        next: (rows) => {
          // Lewati jika isinya sama persis (id + updated_at): mencegah seluruh
          // halaman menghitung ulang dan render ulang tanpa ada perubahan nyata.
          if (sameRows(prev, rows)) return;
          prev = rows;
          set(rows);
        },
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

/**
 * Menjaga semua live query tetap hidup selama app dibuka. Tanpa ini, setiap
 * pindah halaman membuat query Dexie dimatikan lalu dibuat ulang (baca ulang
 * seluruh tabel). Dengan keepAlive, pindah halaman instan karena data sudah di memori.
 */
export function keepAlive(): () => void {
  const stores = [
    wallets,
    transactions,
    customCategories,
    budgets,
    savingBuckets,
    savingTxs,
    debts,
    debtPayments,
    reminders,
    assistantMemory
  ];
  const unsubs = stores.map((st) => st.subscribe(() => {}));
  return () => unsubs.forEach((u) => u());
}

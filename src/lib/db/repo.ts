import { db, SYNC_TABLES, type SyncTable, type SyncableRecord } from './dexie';
import { getUserId } from '$lib/stores/session';
import { getDeviceId } from '$lib/stores/device';
import { supabase } from '$lib/supabase/client';

function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

async function enqueue(table: SyncTable, record: SyncableRecord): Promise<void> {
  await db.syncQueue.add({ table, recordId: record.id, payload: record, ts: Date.now() });
}

/**
 * Wraps a group of related mutations (upsertRecord/softDeleteRecord
 * calls) in a single Dexie transaction — either ALL of them land, or
 * NONE do. Fixes the "operasi multi-record belum atomic" audit finding:
 * a wallet transfer, saving deposit/withdrawal, or debt payment each
 * touch 2-3 tables (e.g. saving_txs + transactions), and without this,
 * an interruption between those writes (closed tab, crashed browser,
 * IndexedDB quota error mid-way) could leave one half written and the
 * other not — e.g. a saving_txs deposit recorded with no matching
 * transactions row, silently double-counting that money in both the
 * bucket AND the wallet balance.
 *
 * Safe to use here because upsertRecord/softDeleteRecord/enqueue only
 * ever touch Dexie tables — never `fetch`/Supabase directly — so there's
 * nothing inside the callback that could suspend on network I/O, which
 * is the one thing Dexie transactions don't tolerate.
 */
export async function atomic<T>(tables: SyncTable[], fn: () => Promise<T>): Promise<T> {
  // syncQueue is always included, not just the tables the caller names —
  // every upsertRecord/softDeleteRecord call inside `fn` also writes to
  // syncQueue via enqueue(), and Dexie requires every table a
  // transaction will touch to be declared up front.
  return db.transaction('rw', [...tables.map((t) => db[t]), db.syncQueue], fn);
}

/**
 * Create or update a record. Writes to Dexie FIRST — the caller's UI
 * update is instant and works fully offline — then queues the same
 * payload for the sync engine to push whenever the network allows.
 * Never calls Supabase directly; that separation is what makes every
 * feature automatically offline-first without each feature needing its
 * own online/offline branching logic.
 *
 * CONFLICT METADATA (audit #6): this app deliberately does NOT do
 * anything smarter than last-write-wins on `updated_at` when two
 * devices edit the same row (see the sync engine's push/pull — whoever
 * has the newer `updated_at` at pull time simply overwrites the other).
 * `version` and `updated_by` below don't change that behavior — they
 * exist purely as observability: `version` is a running edit counter
 * (lets you tell "has this row been touched multiple times" at a
 * glance), and `updated_by` (see stores/device.ts) records WHICH
 * device made the last edit, which `user_id` alone can't answer since
 * the same person can be signed in on more than one device. A future
 * UI could use these to show "last edited from your other device" —
 * today, nothing reads them back, they're just recorded for when that's
 * worth building.
 */
export async function upsertRecord<T extends Record<string, unknown>>(
  table: SyncTable,
  patch: Partial<T> & { id?: string },
  opts: { restore?: boolean } = {}
): Promise<SyncableRecord> {
  const userId = getUserId();
  if (!userId) throw new Error(`upsertRecord('${table}') called with no signed-in user`);

  const existing = patch.id ? await db[table].get(patch.id) : undefined;
  const record: SyncableRecord = {
    ...(existing ?? {}),
    ...patch,
    id: patch.id ?? newId(),
    user_id: userId,
    updated_at: nowIso(),
    version: ((existing?.version as number) ?? 0) + 1,
    updated_by: getDeviceId(),
    // BUGFIX: this used to always be `existing?.deleted_at ?? null`, which
    // meant a soft-deleted row could NEVER be brought back through a
    // normal upsert — including restoring from a JSON backup. That's the
    // right default for everyday edits (nobody expects editing a live
    // record to accidentally resurrect an unrelated deleted one), but
    // `importJSON()` needs an explicit escape hatch: `{ restore: true }`
    // clears the tombstone instead of preserving it.
    deleted_at: opts.restore ? null : (existing?.deleted_at ?? null)
  } as SyncableRecord;

  await db[table].put(record);
  await enqueue(table, record);
  return record;
}

/**
 * Soft delete: sets deleted_at instead of removing the row, locally AND
 * on the server (see supabase/schema.sql). A hard delete would lose the
 * tombstone another device needs to know "this was removed" rather than
 * "I've just never heard of it yet".
 */
export async function softDeleteRecord(table: SyncTable, id: string): Promise<void> {
  const existing = await db[table].get(id);
  if (!existing) return;
  const record: SyncableRecord = {
    ...existing,
    deleted_at: nowIso(),
    updated_at: nowIso(),
    version: ((existing.version as number) ?? 0) + 1,
    updated_by: getDeviceId()
  };
  await db[table].put(record);
  await enqueue(table, record);
}

/** Everything in a table that hasn't been soft-deleted, scoped to the
 *  currently signed-in user (see stores/data.ts's liveTable() doc
 *  comment for why this filter matters even with wipeLocalDatabase()
 *  in place — defense in depth, not redundant). */
export async function listActive(table: SyncTable): Promise<SyncableRecord[]> {
  const userId = getUserId();
  const all = await db[table].toArray();
  return all.filter((r) => !r.deleted_at && r.user_id === userId);
}

/**
 * "Hapus Semua Data": soft-deletes every row in every synced table for
 * the current user, so the wipe itself propagates to Supabase and any
 * other signed-in device via the normal sync queue — a hard local wipe
 * would just come back on the next sync. Doesn't touch the account
 * itself (sign-in stays valid); it only empties the ledger.
 *
 * Note: soft-delete does NOT shrink the Supabase database — every row
 * is still physically there, just marked with deleted_at and filtered
 * out of every query. See purgeAllDataPermanently() below for an
 * option that actually removes the rows.
 */
export async function wipeAllData(): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error('wipeAllData() called with no signed-in user');

  for (const table of SYNC_TABLES) {
    const rows = await listActive(table);
    for (const row of rows) {
      await softDeleteRecord(table, row.id);
    }
  }
}

/**
 * True hard-delete: removes every row for the current user from
 * Supabase AND the local Dexie mirror, instead of leaving a tombstone.
 *
 * This is deliberately a separate, rarer action from wipeAllData() — a
 * tombstone (soft delete) is what lets a *different* signed-in device
 * find out a row was removed and clean up its own local copy. Skip the
 * tombstone and a device that's offline right now will simply never
 * learn these rows are gone: on its next sync it has nothing to compare
 * against, so the row just stays there, un-deleted, forever, and if
 * that device edits it later the edit will even get pushed back up as
 * a "new" row. So this only makes sense when the caller can reasonably
 * promise there's no other device with a stale offline copy waiting to
 * sync — the UI surfaces that warning before calling this.
 *
 * Deletes on the server first, then mirrors locally, so a mid-flight
 * failure never leaves the local app looking emptier than the account
 * actually is.
 */
export async function purgeAllDataPermanently(): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error('purgeAllDataPermanently() called with no signed-in user');

  for (const table of SYNC_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`Gagal menghapus "${table}" di server: ${error.message}`);
  }

  // Receipt photos live in Storage, not a regular table, so the loop
  // above never touches them — without this they'd be the one thing
  // "Hapus Permanen" doesn't actually make permanent.
  //
  // BUGFIX (audit #5): `.list()` used to be called once and trusted to
  // return every file. Supabase Storage's `list()` defaults to (and
  // caps at) 100 results per call — it does NOT auto-paginate. Anyone
  // with more than 100 receipt photos would silently keep the 101st+
  // file forever: wasted storage, and worse, exactly the kind of
  // leftover personal data "Hapus Permanen" is supposed to guarantee is
  // gone. Loop with limit/offset until a page comes back short of the
  // limit (the standard "that was the last page" signal), collecting
  // every file across all pages before removing any of them.
  const PAGE_SIZE = 100;
  const allFiles: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error: listError } = await supabase.storage
      .from('receipts')
      .list(userId, { limit: PAGE_SIZE, offset });
    if (listError) throw new Error(`Gagal membaca daftar foto struk: ${listError.message}`);
    if (!page || page.length === 0) break;
    allFiles.push(...page.map((f) => `${userId}/${f.name}`));
    if (page.length < PAGE_SIZE) break; // short page = last page, no need to ask for more
  }
  // Storage's remove() also has its own per-call batch limit — chunk the
  // deletes too rather than assuming one call handles an arbitrarily
  // large list.
  for (let i = 0; i < allFiles.length; i += PAGE_SIZE) {
    const chunk = allFiles.slice(i, i + PAGE_SIZE);
    const { error: removeError } = await supabase.storage.from('receipts').remove(chunk);
    if (removeError) throw new Error(`Gagal menghapus foto struk: ${removeError.message}`);
  }

  for (const table of SYNC_TABLES) {
    // BUGFIX: `.where('user_id')` requires `user_id` to be an indexed
    // field, but no local table indexes it (the local Dexie DB is only
    // ever populated with the signed-in user's own rows in the first
    // place, so nothing else needed that index) — this threw "keypath
    // user_id on object store X is not indexed". `.filter()` does a
    // plain linear scan instead, which needs no index and is plenty
    // fast for a wipe-everything action that isn't performance-critical.
    await db[table].filter((r) => r.user_id === userId).delete();
  }
  await db.pendingPhotoUploads.where('userId').equals(userId).delete();
  // Drop any still-queued mutations for these tables — pushing them now
  // would just resurrect rows we deliberately just removed.
  // BUGFIX: this used to delete every queued entry for these tables
  // regardless of whose it was — on a shared device, that could
  // silently destroy a DIFFERENT signed-in user's still-unsynced
  // pending work. `payload.user_id` is what each entry actually
  // belongs to (see repo.ts's enqueue()), so filter on that instead of
  // just the table name.
  await db.syncQueue
    .filter((entry) => SYNC_TABLES.includes(entry.table) && entry.payload.user_id === userId)
    .delete();
}

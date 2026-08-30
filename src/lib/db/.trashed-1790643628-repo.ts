import { db, SYNC_TABLES, type SyncTable, type SyncableRecord } from './dexie';
import { getUserId } from '$lib/stores/session';
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
 * Create or update a record. Writes to Dexie FIRST — the caller's UI
 * update is instant and works fully offline — then queues the same
 * payload for the sync engine to push whenever the network allows.
 * Never calls Supabase directly; that separation is what makes every
 * feature automatically offline-first without each feature needing its
 * own online/offline branching logic.
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
  const record: SyncableRecord = { ...existing, deleted_at: nowIso(), updated_at: nowIso() };
  await db[table].put(record);
  await enqueue(table, record);
}

/** Everything in a table that hasn't been soft-deleted. */
export async function listActive(table: SyncTable): Promise<SyncableRecord[]> {
  const all = await db[table].toArray();
  return all.filter((r) => !r.deleted_at);
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
  const { data: files } = await supabase.storage.from('receipts').list(userId);
  if (files && files.length > 0) {
    await supabase.storage.from('receipts').remove(files.map((f) => `${userId}/${f.name}`));
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
  await db.syncQueue.where('table').anyOf(SYNC_TABLES as unknown as string[]).delete();
}

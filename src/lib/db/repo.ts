import { db, type SyncTable, type SyncableRecord } from './dexie';
import { getUserId } from '$lib/stores/session';

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
  patch: Partial<T> & { id?: string }
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
    deleted_at: existing?.deleted_at ?? null
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

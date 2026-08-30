import { writable } from 'svelte/store';
import { db, SYNC_TABLES, type SyncTable, type SyncableRecord } from '$lib/db/dexie';
import { supabase } from '$lib/supabase/client';
import { flushPhotoQueue } from '$lib/media/photoUpload';
import type { RealtimeChannel } from '@supabase/supabase-js';

let realtimeChannels: RealtimeChannel[] = [];
let flushing = false;
let safetyNetInterval: ReturnType<typeof setInterval> | null = null;
let onlineListenerAttached = false;

// Surfaced in Settings so a failed push/pull is never silent again.
// Previously flushQueue()/pullTable() only did console.warn() on
// failure — invisible to anyone not watching devtools, which is
// exactly how someone could believe their data was synced to Supabase
// for weeks while it silently never left the device.
export const lastSyncError = writable<string | null>(null);
export const lastSyncedAt = writable<string | null>(null);

/**
 * PUSH — drain the local mutation queue to Supabase, in the order
 * mutations were made. Stops (rather than skips) at the first failure so
 * a transient network drop can't push entry #5 before entry #3, which
 * would let last-write-wins pick the wrong winner on another device.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return; // never run two drains concurrently
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  flushing = true;
  try {
    const entries = await db.syncQueue.orderBy('ts').toArray();
    for (const entry of entries) {
      try {
        const { error } = await supabase.from(entry.table).upsert(entry.payload);
        if (error) {
          console.warn(`[sync] push failed for ${entry.table}/${entry.recordId}:`, error.message);
          lastSyncError.set(`Gagal kirim ${entry.table}: ${error.message}`);
          break; // preserve order — retry this same entry first next time
        }
        await db.syncQueue.delete(entry.qid!);
        lastSyncError.set(null);
      } catch (e) {
        console.warn('[sync] push errored (likely offline):', e);
        lastSyncError.set(e instanceof Error ? e.message : 'Gagal push (kemungkinan offline)');
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

/**
 * Last-write-wins merge: only overwrite the local row if the incoming
 * one is not older. A local row that's newer means there's still a
 * queued push in flight for it — applying a stale remote copy over it
 * would silently discard an unsent local edit.
 */
async function applyRemoteRows(table: SyncTable, rows: SyncableRecord[]): Promise<void> {
  for (const row of rows) {
    const local = await db[table].get(row.id);
    if (!local || new Date(row.updated_at as string) >= new Date(local.updated_at as string)) {
      await db[table].put(row);
    }
  }
}

/** PULL one table — everything changed since the last checkpoint. */
async function pullTable(table: SyncTable, userId: string): Promise<void> {
  const meta = await db.syncMeta.get(table);
  const since = meta?.lastPulledAt ?? '1970-01-01T00:00:00Z';

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', since)
    .order('updated_at', { ascending: true });

  if (error) {
    console.warn(`[sync] pull failed for ${table}:`, error.message);
    lastSyncError.set(`Gagal ambil data ${table}: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) return;

  await applyRemoteRows(table, data as SyncableRecord[]);
  await db.syncMeta.put({ table, lastPulledAt: data[data.length - 1].updated_at as string });
}

/** PULL everything — used on login and whenever connectivity returns. */
export async function pullAll(userId: string): Promise<void> {
  for (const table of SYNC_TABLES) {
    await pullTable(table, userId);
  }
  lastSyncedAt.set(new Date().toISOString());
}

/**
 * REALTIME — live push from Supabase whenever another device (or this
 * one, in another tab) changes a row. This is what makes multi-device
 * sync feel instant instead of "eventually, on next pull".
 */
export function subscribeRealtime(userId: string): void {
  unsubscribeRealtime();
  for (const table of SYNC_TABLES) {
    const channel = supabase
      .channel(`sync:${table}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as SyncableRecord | undefined;
          if (row) void applyRemoteRows(table, [row]);
        }
      )
      .subscribe();
    realtimeChannels.push(channel);
  }
}

export function unsubscribeRealtime(): void {
  realtimeChannels.forEach((ch) => supabase.removeChannel(ch));
  realtimeChannels = [];
}

/**
 * LIFECYCLE — call once after a user session becomes available.
 * Order matters: pull catch-up first (so we have the latest remote
 * state), then flush anything queued while offline, then go live.
 */
export async function startSync(userId: string): Promise<void> {
  await pullAll(userId);
  await flushQueue();
  void flushPhotoQueue();
  subscribeRealtime(userId);

  if (!onlineListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      void flushQueue();
      void flushPhotoQueue();
      void pullAll(userId);
    });
    onlineListenerAttached = true;
  }

  // Safety net: some browsers fire 'online' unreliably, and a push can
  // fail silently (e.g. RLS misconfigured) without the queue ever being
  // told to retry otherwise. This just re-attempts on a fixed interval.
  if (safetyNetInterval) clearInterval(safetyNetInterval);
  safetyNetInterval = setInterval(() => {
    void flushQueue();
    void flushPhotoQueue();
  }, 15000);
}

export function stopSync(): void {
  unsubscribeRealtime();
  if (safetyNetInterval) {
    clearInterval(safetyNetInterval);
    safetyNetInterval = null;
  }
}

/** Reactive count of unsynced local mutations, for a "pending" UI badge. */
export function pendingCount(): Promise<number> {
  return db.syncQueue.count();
}

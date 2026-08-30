import type { SyncableRecord } from '$lib/db/dexie';

export function getBucketBalance(bucketId: string, savingTxs: SyncableRecord[]): number {
  const dep = savingTxs
    .filter((t) => t.bucket_id === bucketId && t.type === 'deposit')
    .reduce((s, t) => s + (t.amount as number), 0);
  const wit = savingTxs
    .filter((t) => t.bucket_id === bucketId && t.type === 'withdraw')
    .reduce((s, t) => s + (t.amount as number), 0);
  return dep - wit;
}

export function getSavingTotal(buckets: SyncableRecord[], savingTxs: SyncableRecord[]): number {
  return buckets.reduce((s, b) => s + getBucketBalance(b.id, savingTxs), 0);
}

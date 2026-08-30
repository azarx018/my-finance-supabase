import { db } from '$lib/db/dexie';
import { supabase } from '$lib/supabase/client';
import { upsertRecord } from '$lib/db/repo';
import { getUserId } from '$lib/stores/session';
import type { CompressedImage } from './compressImage';

const BUCKET = 'receipts';
// Private bucket, so display needs a signed URL rather than a public
// one — an hour is plenty for one viewing of a form/edit sheet without
// re-signing on every re-render.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

let flushing = false;

/**
 * Queues an already-compressed photo for upload. Takes a pre-compressed
 * {blob, ext} (from compressImage.ts) rather than the original File —
 * the caller (TxSheet) needs to compress immediately anyway to show a
 * preview, so this avoids compressing the same image twice.
 */
export async function queuePhotoUpload(transactionId: string, image: CompressedImage): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error('queuePhotoUpload() called with no signed-in user');

  await db.pendingPhotoUploads.add({
    transactionId,
    userId,
    blob: image.blob,
    ext: image.ext,
    createdAt: Date.now()
  });
  void flushPhotoQueue();
}

/**
 * PUSH — drains the local photo queue to Supabase Storage, then patches
 * the owning transaction's `photo` column with the resulting path.
 * Mirrors sync/engine.ts's flushQueue() shape (stop-on-first-failure to
 * preserve order, safe to call repeatedly/concurrently-guarded) but
 * targets Storage instead of a table upsert.
 */
export async function flushPhotoQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  flushing = true;
  try {
    const entries = await db.pendingPhotoUploads.orderBy('createdAt').toArray();
    for (const entry of entries) {
      try {
        const path = `${entry.userId}/${entry.transactionId}.${entry.ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, entry.blob, {
            contentType: entry.ext === 'webp' ? 'image/webp' : 'image/jpeg',
            upsert: true
          });
        if (uploadError) {
          console.warn('[photo-sync] upload failed:', uploadError.message);
          break; // preserve order, retry this one first next time
        }
        await upsertRecord('transactions', { id: entry.transactionId, photo: path });
        await db.pendingPhotoUploads.delete(entry.id!);
      } catch (e) {
        console.warn('[photo-sync] upload errored (likely offline):', e);
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

/** True while a transaction's photo is still sitting in the local queue, not yet on Storage. */
export async function hasPendingUpload(transactionId: string): Promise<boolean> {
  const count = await db.pendingPhotoUploads.where('transactionId').equals(transactionId).count();
  return count > 0;
}

/**
 * Signed URL for an already-uploaded photo. `photo` on the transaction
 * row is just the Storage path (e.g. "userId/txId.webp"), never a
 * public URL — keeping receipts private is the whole point of RLS on
 * this bucket, so every view re-signs rather than baking in a
 * permanent link.
 */
export async function getPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn('[photo-sync] could not sign photo URL:', error.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Removes a photo — best-effort. If offline, the Storage file is
 * orphaned until the next time this runs successfully; that's an
 * acceptable trade-off for keeping "remove photo" instant rather than
 * needing its own offline queue for what's a rare, low-stakes action.
 */
export async function deletePhoto(transactionId: string, path: string | null): Promise<void> {
  await db.pendingPhotoUploads.where('transactionId').equals(transactionId).delete();
  if (path) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) console.warn('[photo-sync] could not delete photo from storage:', error.message);
  }
  await upsertRecord('transactions', { id: transactionId, photo: null });
}

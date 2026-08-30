import { PUBLIC_SCAN_RECEIPT_URL } from '$env/static/public';
import type { CompressedImage } from '$lib/media/compressImage';

export interface ReceiptCategoryOption {
  id: string;
  name: string;
}

export interface ScanReceiptResult {
  isReceipt: boolean;
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  description: string | null;
  merchantName: string | null;
  categoryId: string | null;
}

/** True if a scan-receipt Worker URL has been configured — lets the UI
 *  hide the "🪄 Baca Struk Otomatis" button entirely rather than show a
 *  button that always fails when self-hosters skip this optional setup. */
export function isReceiptScanConfigured(): boolean {
  return Boolean(PUBLIC_SCAN_RECEIPT_URL);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is "data:<mime>;base64,<data>" — Gemini's
      // inline_data field wants just the base64 payload.
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file foto'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends a (already-compressed) receipt photo to the scan-receipt Worker
 * and returns the parsed fields, or null if the photo doesn't look like
 * a receipt. Throws on network/server failure — callers should catch
 * and fall back to plain manual entry, never block on this.
 */
export async function scanReceipt(
  photo: CompressedImage,
  categories: ReceiptCategoryOption[],
  accessToken: string
): Promise<ScanReceiptResult | null> {
  if (!PUBLIC_SCAN_RECEIPT_URL) {
    throw new Error('Fitur baca struk belum dikonfigurasi (PUBLIC_SCAN_RECEIPT_URL kosong)');
  }
  const mimeType = photo.ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const imageBase64 = await blobToBase64(photo.blob);

  const res = await fetch(PUBLIC_SCAN_RECEIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType, categories })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Gagal membaca struk (${res.status})`);
  }

  const data = await res.json();
  if (!data.is_receipt) return null;

  return {
    isReceipt: true,
    amount: typeof data.amount === 'number' && data.amount > 0 ? data.amount : null,
    date: typeof data.date === 'string' && data.date ? data.date : null,
    description: typeof data.description === 'string' && data.description ? data.description : null,
    merchantName: typeof data.merchant_name === 'string' && data.merchant_name ? data.merchant_name : null,
    categoryId: typeof data.category_id === 'string' && data.category_id ? data.category_id : null
  };
}

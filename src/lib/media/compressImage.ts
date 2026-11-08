const MAX_DIMENSION = 1280; // long edge, in px — plenty to read a receipt, way less to store than a raw phone photo
const WEBP_QUALITY = 0.75;
const JPEG_QUALITY = 0.75; // fallback for the rare browser without WebP encode support

export interface CompressedImage {
  blob: Blob;
  ext: 'webp' | 'jpg';
}

/**
 * Downscales + re-encodes a photo (WebP first, JPEG fallback) entirely
 * on-device via <canvas> — no network call, so this step works fully
 * offline. A typical 3-5 MB phone photo comes out well under 200 KB,
 * which is what keeps Supabase Storage usage and sync bandwidth small
 * even if the user attaches a receipt to every transaction.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context tidak tersedia di browser ini');
    ctx.drawImage(bitmap, 0, 0, w, h);

    const webp = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
    if (webp) return { blob: webp, ext: 'webp' };

    // Fallback for the handful of old/odd browsers that can decode WebP
    // but not encode it (canvas.toBlob silently returns null there).
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    if (jpeg) return { blob: jpeg, ext: 'jpg' };

    throw new Error('Gagal mengompres foto (format tidak didukung browser ini)');
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

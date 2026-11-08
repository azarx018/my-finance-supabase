import { verifyAuth } from './shared/auth';
import { corsHeaders, json } from './shared/http';
import { sanitizeAssistantBody } from './shared/assistantInput';
import { handleScanReceipt } from './scanReceipt';
import { handleAssistant } from './assistant';

// Bentuk minimal dari binding Rate Limiting Cloudflare. Binding-nya
// OPSIONAL: kalau belum dipasang di wrangler.toml, rate limit dilewati
// (Worker tetap jalan seperti sebelumnya). Lihat catatan di PR/README
// untuk cara memasangnya.
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  GEMINI_API_KEY: string; // secret — `wrangler secret put GEMINI_API_KEY`
  SUPABASE_URL: string; // var — same value as the app's PUBLIC_SUPABASE_URL
  ALLOWED_ORIGINS: string; // var — comma-separated
  // 🔧 See shared/gemini.ts for what this does and how to set it —
  // comma-separated model names, tried in order, falls through to the
  // next on quota exhaustion (429).
  GEMINI_MODELS: string | undefined;
  // Opsional — rate limit per user (key = Supabase user id).
  RATE_LIMITER?: RateLimiter;
}

// This Worker intentionally hosts BOTH the OCR receipt-scanner and the
// AI assistant behind one deployment — they share identical JWT/CORS
// logic, so splitting them into two Workers would just mean maintaining
// that boilerplate twice. See cloudflare/ai-worker/README.md for the
// reasoning. Add a new `case` here (and a new handler file) for any
// future AI-backed endpoint the app needs.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    const auth = await verifyAuth(request, env.SUPABASE_URL);
    if (!auth) return json({ error: 'Sesi login tidak valid atau kedaluwarsa' }, 401, cors);

    // Rate limit per user. Fail-open: kalau binding belum dipasang atau
    // layanannya error, request tetap diproses (jangan sampai fitur mati
    // hanya karena limiter-nya bermasalah).
    if (env.RATE_LIMITER) {
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: auth.userId });
        if (!success) {
          return json(
            { error: 'Terlalu banyak permintaan, coba lagi sebentar lagi' },
            429,
            { ...cors, 'Retry-After': '60' }
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[rate-limit] gagal cek limiter, lanjut tanpa limit: ${message}`);
      }
    }

    const path = new URL(request.url).pathname;
    switch (path) {
      case '/scan-receipt':
        return handleScanReceipt(request, env, cors);
      case '/assistant': {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: 'Body request tidak valid' }, 400, cors);
        }
        const result = sanitizeAssistantBody(raw);
        if (!result.ok) return json({ error: result.error }, 400, cors);

        // Teruskan body yang sudah dibersihkan ke handler lewat Request
        // baru. content-length dibuang karena panjang body-nya berubah.
        const headers = new Headers(request.headers);
        headers.delete('content-length');
        const sanitizedRequest = new Request(request.url, {
          method: request.method,
          headers,
          body: JSON.stringify(result.body)
        });
        return handleAssistant(sanitizedRequest, env, cors);
      }
      default:
        return json({ error: 'Endpoint tidak ditemukan' }, 404, cors);
    }
  }
};

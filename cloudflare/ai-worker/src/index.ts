import { verifyAuth } from './shared/auth';
import { corsHeaders, json } from './shared/http';
import { handleScanReceipt } from './scanReceipt';
import { handleAssistant } from './assistant';

export interface Env {
  GEMINI_API_KEY: string; // secret — `wrangler secret put GEMINI_API_KEY`
  SUPABASE_URL: string; // var — same value as the app's PUBLIC_SUPABASE_URL
  ALLOWED_ORIGINS: string; // var — comma-separated
  // 🔧 See shared/gemini.ts for what this does and how to set it —
  // comma-separated model names, tried in order, falls through to the
  // next on quota exhaustion (429).
  GEMINI_MODELS: string | undefined;
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

    const authed = await verifyAuth(request, env.SUPABASE_URL);
    if (!authed) return json({ error: 'Sesi login tidak valid atau kedaluwarsa' }, 401, cors);

    const path = new URL(request.url).pathname;
    switch (path) {
      case '/scan-receipt':
        return handleScanReceipt(request, env, cors);
      case '/assistant':
        return handleAssistant(request, env, cors);
      default:
        return json({ error: 'Endpoint tidak ditemukan' }, 404, cors);
    }
  }
};

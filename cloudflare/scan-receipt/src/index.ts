import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface Env {
  GEMINI_API_KEY: string; // secret — `wrangler secret put GEMINI_API_KEY`
  SUPABASE_URL: string; // var — same value as the app's PUBLIC_SUPABASE_URL
  ALLOWED_ORIGINS: string; // var — comma-separated
}

interface CategoryOption {
  id: string;
  name: string;
}

interface ScanRequestBody {
  image_base64: string;
  mime_type: string; // 'image/webp' | 'image/jpeg'
  categories: CategoryOption[]; // this user's active expense categories
}

// One JWKS client per Worker instance, reused across requests (cheap —
// `jose` caches the actual key fetch internally too). Built lazily since
// it needs `env.SUPABASE_URL`, which isn't available at module load time.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksForUrl = '';

function getJwks(supabaseUrl: string) {
  if (!jwks || jwksForUrl !== supabaseUrl) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksForUrl = supabaseUrl;
  }
  return jwks;
}

function corsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin'
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

/**
 * Builds the JSON schema Gemini must return, constrained to this user's
 * actual categories — the model can only pick from `categories`, or
 * return null, it can never invent a category id that doesn't exist in
 * this account. That's what makes category_id safe to write straight to
 * `transactions.cat_id` without a separate validation pass.
 */
function buildResponseSchema(categories: CategoryOption[]) {
  return {
    type: 'OBJECT',
    properties: {
      is_receipt: { type: 'BOOLEAN' },
      amount: { type: 'NUMBER' },
      date: { type: 'STRING' }, // YYYY-MM-DD
      description: { type: 'STRING' },
      merchant_name: { type: 'STRING' },
      category_id: {
        type: 'STRING',
        enum: [...categories.map((c) => c.id), '']
      }
    },
    required: ['is_receipt']
  };
}

const SYSTEM_PROMPT = `Kamu membaca foto struk belanja Indonesia untuk aplikasi keuangan pribadi.

Aturan HARUS diikuti:
- "is_receipt": false kalau foto ini BUKAN struk/nota belanja yang jelas terbaca. Kalau false, abaikan field lain.
- "amount": TOTAL akhir yang dibayar (bukan subtotal sebelum pajak/diskon), dalam Rupiah, angka bulat tanpa titik/koma.
- "date": tanggal transaksi di struk, format YYYY-MM-DD. Kalau tidak terbaca jelas, kosongkan ("").
- "description": ringkasan barang/jasa yang dibeli (CONTOH: "Indomie, telur, kecap" atau "Isi bensin Pertamax" atau "Token listrik"). JANGAN isi dengan nama toko. Kalau daftar item tidak terbaca jelas (buram/terpotong), kosongkan ("") — jangan menebak/generic seperti "Belanja".
- "merchant_name": nama toko/merchant, dipakai sebagai catatan terpisah, BUKAN untuk description.
- "category_id": pilih SATU id dari daftar kategori yang diberikan yang paling cocok dengan jenis belanja ini. Kalau tidak ada yang cocok, kosongkan ("").

Jangan mengarang angka atau teks yang tidak benar-benar terlihat di foto.`;

async function callGemini(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  categories: CategoryOption[]
): Promise<Record<string, unknown>> {
  const categoryList = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${SYSTEM_PROMPT}\n\nDaftar kategori yang boleh dipilih:\n${categoryList}` },
            { inline_data: { mime_type: mimeType, data: imageBase64 } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(categories),
        temperature: 0.1
      }
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini tidak mengembalikan hasil');
  return JSON.parse(rawText);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    // 1. Verify the caller is actually logged in to THIS Supabase project.
    // Without this, anyone who found this Worker's URL could burn your
    // free Gemini quota — the Worker never trusts a request just because
    // it arrived, it always checks the token's signature against
    // Supabase's own public keys.
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Belum login' }, 401, cors);

    try {
      await jwtVerify(token, getJwks(env.SUPABASE_URL), {
        issuer: `${env.SUPABASE_URL}/auth/v1`
      });
    } catch {
      return json({ error: 'Sesi login tidak valid atau kedaluwarsa' }, 401, cors);
    }

    // 2. Parse + sanity-check the body before spending a Gemini call on it.
    let body: ScanRequestBody;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body request tidak valid' }, 400, cors);
    }
    if (!body.image_base64 || !body.mime_type) {
      return json({ error: 'Foto tidak disertakan' }, 400, cors);
    }
    // Rough cap so a mistakenly-uncompressed photo can't blow up token
    // usage — the app always sends the compressed version, so a payload
    // this large signals something's wrong upstream, not a receipt that
    // needs more resolution.
    if (body.image_base64.length > 2_000_000) {
      return json({ error: 'Ukuran foto terlalu besar' }, 400, cors);
    }
    const categories = Array.isArray(body.categories) ? body.categories : [];

    // 3. Ask Gemini.
 try {
  const result = await callGemini(
    env.GEMINI_API_KEY,
    body.image_base64,
    body.mime_type,
    categories
  );

  return json(result, 200, cors);
} catch (err) {
  const errorMessage = err instanceof Error
    ? err.message
    : String(err);

  console.error(`[scan-receipt] Gemini call failed: ${errorMessage}`);

  return json(
    { error: `Gemini error: ${errorMessage}` },
    502,
    cors
  );
 }
   }
};

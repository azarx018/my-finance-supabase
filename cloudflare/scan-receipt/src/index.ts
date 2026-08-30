import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface Env {
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  ALLOWED_ORIGINS: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface ScanRequestBody {
  image_base64: string;
  mime_type: string;
  categories: CategoryOption[];
}

// One JWKS client per Worker instance, reused across requests.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksForUrl = '';

function getJwks(supabaseUrl: string) {
  if (!jwks || jwksForUrl !== supabaseUrl) {
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    );
    jwksForUrl = supabaseUrl;
  }

  return jwks;
}

function corsHeaders(
  origin: string | null,
  allowedOrigins: string[]
): Record<string, string> {
  const allowOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0] ?? '';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin'
  };
}

function json(
  body: unknown,
  status: number,
  cors: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors
    }
  });
}

/**
 * Builds the JSON schema Gemini must return.
 *
 * category_id:
 * - Must be one of the user's actual category IDs, or
 * - null if there is no suitable category.
 *
 * Empty strings are deliberately NOT used in enum because Gemini
 * rejects empty strings inside enum values.
 */
function buildResponseSchema(categories: CategoryOption[]) {
  const categoryIds = categories
    .map((category) => category.id)
    .filter(
      (id): id is string =>
        typeof id === 'string' && id.trim().length > 0
    );

  const categorySchema =
    categoryIds.length > 0
      ? {
          anyOf: [
            {
              type: 'STRING',
              enum: categoryIds
            },
            {
              type: 'NULL'
            }
          ]
        }
      : {
          type: 'NULL'
        };

  return {
    type: 'OBJECT',
    properties: {
      is_receipt: {
        type: 'BOOLEAN'
      },

      amount: {
        type: 'NUMBER'
      },

      date: {
        type: 'STRING'
      },

      description: {
        type: 'STRING'
      },

      merchant_name: {
        type: 'STRING'
      },

      category_id: categorySchema
    },

    required: [
      'is_receipt',
      'amount',
      'date',
      'description',
      'merchant_name',
      'category_id'
    ]
  };
}

const SYSTEM_PROMPT = `Kamu membaca foto struk atau nota belanja Indonesia untuk aplikasi keuangan pribadi.

Aturan HARUS diikuti:

- "is_receipt": false jika foto BUKAN struk atau nota belanja yang jelas terbaca.

- "amount": TOTAL AKHIR yang benar-benar dibayar.
  Bukan subtotal sebelum pajak.
  Bukan total sebelum diskon.
  Dalam Rupiah sebagai angka bulat tanpa titik atau koma.
  Jangan menebak.
  Jika total tidak terbaca dengan jelas, gunakan 0.

- "date": tanggal transaksi pada struk dalam format YYYY-MM-DD.
  Jika tidak terbaca dengan jelas, gunakan "".

- "description": ringkasan barang atau jasa yang dibeli.
  Contoh: "Indomie, telur, kecap", "Isi bensin Pertamax", atau "Token listrik".
  Jika ada lebih dari 3 produk belanjaan bikin menjadi 1 rangkuman, misal ada "nasi goreng, ayam geprek, tempe, tahu" jadi "beli makanan".
  JANGAN isi dengan nama toko.
  Jika daftar item tidak terbaca jelas, gunakan "".
  Jangan menggunakan generic seperti "Belanja" jika isi struk tidak diketahui.

- "merchant_name": nama toko atau merchant.
  Jika tidak terbaca dengan jelas, gunakan "".

- "category_id": pilih SATU ID dari daftar kategori yang diberikan yang paling cocok dengan jenis transaksi.
  Jika tidak ada kategori yang cocok atau daftar kategori kosong, gunakan null.
  Jangan membuat ID kategori sendiri.

- Jangan mengarang angka, tanggal, nama toko, barang, atau informasi lain yang tidak benar-benar terlihat pada foto.

- Jika informasi tidak terbaca, gunakan nilai kosong ("") atau null sesuai tipe field.

- Hanya gunakan category_id yang benar-benar ada di daftar kategori yang diberikan.`;

async function callGemini(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  categories: CategoryOption[]
): Promise<Record<string, unknown>> {
  const categoryList =
    categories.length > 0
      ? categories
          .map((category) => `- ${category.id}: ${category.name}`)
          .join('\n')
      : '(Tidak ada kategori yang tersedia)';

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const responseSchema = buildResponseSchema(categories);

  const res = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      contents: [
        {
          role: 'user',

          parts: [
            {
              text:
                `${SYSTEM_PROMPT}\n\n` +
                `Daftar kategori yang boleh dipilih:\n` +
                categoryList
            },

            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ],

      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1
      }
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    throw new Error(
      `Gemini error ${res.status}: ${text.slice(0, 1000)}`
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };

      finishReason?: string;
    }>;

    promptFeedback?: {
      blockReason?: string;
    };
  };

  const candidate = data.candidates?.[0];

  if (!candidate) {
    throw new Error(
      `Gemini tidak mengembalikan candidate. ` +
      `blockReason=${data.promptFeedback?.blockReason ?? 'unknown'}`
    );
  }

  const rawText = candidate.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error(
      `Gemini tidak mengembalikan hasil. ` +
      `finishReason=${candidate.finishReason ?? 'unknown'}`
    );
  }

  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Response Gemini bukan JSON valid: ${rawText.slice(0, 500)}`
    );
  }
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const allowedOrigins = env.ALLOWED_ORIGINS
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const origin = request.headers.get('Origin');

    const cors = corsHeaders(
      origin,
      allowedOrigins
    );

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    // Only POST is allowed
    if (request.method !== 'POST') {
      return json(
        {
          error: 'Method not allowed'
        },
        405,
        cors
      );
    }

    // ------------------------------------------------------------
    // 1. Verify Supabase JWT
    // ------------------------------------------------------------

    const authHeader =
      request.headers.get('Authorization') ?? '';

    const token =
      authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return json(
        {
          error: 'Belum login'
        },
        401,
        cors
      );
    }

    try {
      await jwtVerify(
        token,
        getJwks(env.SUPABASE_URL),
        {
          issuer: `${env.SUPABASE_URL}/auth/v1`
        }
      );
    } catch (err) {
      console.error(
        '[scan-receipt] JWT verification failed:',
        err instanceof Error ? err.message : String(err)
      );

      return json(
        {
          error:
            'Sesi login tidak valid atau kedaluwarsa'
        },
        401,
        cors
      );
    }

    // ------------------------------------------------------------
    // 2. Parse request body
    // ------------------------------------------------------------

    let body: ScanRequestBody;

    try {
      body =
        (await request.json()) as ScanRequestBody;
    } catch {
      return json(
        {
          error: 'Body request tidak valid'
        },
        400,
        cors
      );
    }

    if (
      !body.image_base64 ||
      !body.mime_type
    ) {
      return json(
        {
          error: 'Foto tidak disertakan'
        },
        400,
        cors
      );
    }

    // ------------------------------------------------------------
    // 3. Validate image
    // ------------------------------------------------------------

    const allowedMimeTypes = [
      'image/jpeg',
      'image/webp',
      'image/png'
    ];

    if (!allowedMimeTypes.includes(body.mime_type)) {
      return json(
        {
          error:
            'Format foto tidak didukung. Gunakan JPEG, WebP, atau PNG.'
        },
        400,
        cors
      );
    }

    // Rough payload cap.
    //
    // Base64 is roughly 4/3 the size of the original binary.
    // 2,000,000 characters is approximately 1.5 MB binary.
    if (
      body.image_base64.length >
      2_000_000
    ) {
      return json(
        {
          error:
            'Ukuran foto terlalu besar'
        },
        400,
        cors
      );
    }

    // ------------------------------------------------------------
    // 4. Sanitize categories
    // ------------------------------------------------------------

    const categories: CategoryOption[] =
      Array.isArray(body.categories)
        ? body.categories
            .filter(
              (category): category is CategoryOption =>
                category &&
                typeof category.id === 'string' &&
                typeof category.name === 'string'
            )
            .map((category) => ({
              id: category.id.trim(),
              name: category.name.trim()
            }))
            .filter(
              (category) =>
                category.id.length > 0 &&
                category.name.length > 0
            )
        : [];

    // ------------------------------------------------------------
    // 5. Ask Gemini
    // ------------------------------------------------------------

    try {
      const result = await callGemini(
        env.GEMINI_API_KEY,
        body.image_base64,
        body.mime_type,
        categories
      );

      return json(
        result,
        200,
        cors
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : String(err);

      console.error(
        `[scan-receipt] Gemini call failed: ${errorMessage}`
      );

      return json(
        {
          error:
            `Gemini error: ${errorMessage}`
        },
        502,
        cors
      );
    }
  }
};

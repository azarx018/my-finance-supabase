import type { Env } from './index';
import { json } from './shared/http';
import { callGeminiWithFallback, extractText, getConfiguredModels } from './shared/gemini';

interface CategoryOption {
  id: string;
  name: string;
}

interface ScanRequestBody {
  image_base64: string;
  mime_type: string; // 'image/webp' | 'image/jpeg'
  categories: CategoryOption[]; // this user's active expense categories
}

/**
 * Builds the JSON schema Gemini must return, constrained to this user's
 * actual categories — the model can only pick from `categories`, or
 * null, it can never invent a category id that doesn't exist in this
 * account. That's what makes category_id safe to write straight to
 * `transactions.cat_id` without a separate validation pass.
 *
 * BUGFIX: every "optional" field here used to allow `""` (empty string)
 * as the "no value" sentinel instead of `null`. Gemini's structured
 * output sometimes rejected/errored on that — `nullable: true` +
 * telling the model explicitly to use `null` is the correct way to
 * represent "not present" for a STRING field, not an empty string.
 */
function buildResponseSchema(categories: CategoryOption[]) {
  return {
    type: 'OBJECT',
    properties: {
      is_receipt: { type: 'BOOLEAN' },
      amount: { type: 'NUMBER', nullable: true },
      date: { type: 'STRING', nullable: true },
      description: { type: 'STRING', nullable: true },
      merchant_name: { type: 'STRING', nullable: true },
      category_id: {
        type: 'STRING',
        enum: categories.map((c) => c.id),
        nullable: true
      }
    },
    required: ['is_receipt']
  };
}

const SYSTEM_PROMPT = `Kamu membaca foto struk belanja Indonesia untuk aplikasi keuangan pribadi.

Aturan HARUS diikuti:
- "is_receipt": false kalau foto ini BUKAN struk/nota belanja yang jelas terbaca. Kalau false, isi field lain dengan null.
- "amount": TOTAL akhir yang dibayar (bukan subtotal sebelum pajak/diskon), dalam Rupiah, angka bulat tanpa titik/koma.
- "date": tanggal transaksi di struk, format YYYY-MM-DD. Kalau tidak terbaca jelas, isi null (JANGAN string kosong "").
- "description": ringkasan barang/jasa yang dibeli (CONTOH: "Indomie, telur, kecap" atau "Isi bensin Pertamax" atau "Token listrik"). JANGAN isi dengan nama toko. Kalau daftar item tidak terbaca jelas (buram/terpotong), isi null (JANGAN string kosong "" dan JANGAN menebak/generic seperti "Belanja").
- "merchant_name": nama toko/merchant, dipakai sebagai catatan terpisah, BUKAN untuk description. Kalau tidak terbaca, isi null.
- "category_id": pilih SATU id dari daftar kategori yang diberikan yang paling cocok dengan jenis belanja ini. Kalau tidak ada yang cocok, isi null (JANGAN string kosong "").

Jangan mengarang angka atau teks yang tidak benar-benar terlihat di foto. Untuk field yang tidak ada nilainya, SELALU pakai null, JANGAN PERNAH pakai string kosong ("").`;

export async function handleScanReceipt(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
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
  const categoryList = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');

  try {
    const models = getConfiguredModels(env.GEMINI_MODELS);
    const response = await callGeminiWithFallback(env.GEMINI_API_KEY, models, {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${SYSTEM_PROMPT}\n\nDaftar kategori yang boleh dipilih:\n${categoryList}` },
            { inline_data: { mime_type: body.mime_type, data: body.image_base64 } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(categories),
        temperature: 0.1
      }
    });

    const rawText = extractText(response);
    if (!rawText) throw new Error('Gemini tidak mengembalikan hasil');
    return json(JSON.parse(rawText), 200, cors);
  } catch (err) {
    console.error('[scan-receipt] Gemini call failed:', err);
    return json({ error: 'Gagal membaca struk, coba lagi' }, 502, cors);
  }
}

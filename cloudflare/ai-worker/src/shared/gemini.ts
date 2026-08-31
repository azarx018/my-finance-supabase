export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

export interface GeminiRawResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

/**
 * 🔧 ROTASI MODEL GEMINI — edit di sini kalau mau ganti/nambah model.
 *
 * Ini dipakai sebagai FALLBACK BAWAAN kalau secret/var `GEMINI_MODELS`
 * belum di-set di Cloudflare. Cara yang lebih gampang buat ubah model
 * TANPA edit kode ini: set env var `GEMINI_MODELS` di `wrangler.toml`
 * (lihat `[vars]`), isinya daftar model dipisah koma, urutan = urutan
 * coba. Kuota gratis Gemini dihitung TERPISAH per model, jadi kalau
 * model pertama kena limit harian, Worker otomatis lanjut ke model
 * berikutnya di daftar ini — bukan langsung gagal.
 *
 * Cuma masukkan model yang beneran perlu di sini kalau MENDUKUNG
 * function calling (dipakai fitur Asisten AI) — per Agustus 2026 yang
 * dikonfirmasi mendukung: gemini-2.5-flash, gemini-2.0-flash,
 * gemini-3.1-flash-lite. Cek dokumentasi Gemini kalau mau nambah model
 * lain, jangan asal tempel nama model baru.
 */
export const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.1-flash-lite'];

/**
 * Calls Gemini, trying each model in `models` in order. Only advances to
 * the next model on HTTP 429 (quota/rate-limit exhausted for that
 * specific model) — any other error means the request itself is the
 * problem, so it's reported immediately instead of retried uselessly
 * against 2-3 more models.
 */
export async function callGeminiWithFallback(
  apiKey: string,
  models: string[],
  requestBody: Record<string, unknown>
): Promise<GeminiRawResponse> {
  let lastError: Error | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (res.ok) {
      console.log(`[gemini] dijawab oleh model: ${model}`);
      return (await res.json()) as GeminiRawResponse;
    }

    if (res.status !== 429) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini (${model}) error ${res.status}: ${text.slice(0, 300)}`);
    }

    console.warn(`[gemini] ${model} kena limit kuota (429) — coba model berikutnya di rotasi...`);
    lastError = new Error(`Semua model di rotasi kena limit kuota (terakhir dicoba: ${model})`);
  }

  throw lastError ?? new Error('Daftar model Gemini kosong');
}

export function getConfiguredModels(envValue: string | undefined): string[] {
  const parsed = (envValue ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_GEMINI_MODELS;
}

export function extractText(response: GeminiRawResponse): string | null {
  return response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? null;
}

/**
 * Returns EVERY function call in the response, not just the first.
 * Gemini can decide a single turn needs more than one action — e.g.
 * "bikinin budget dari gaji, sisihkan juga buat tabungan" naturally
 * wants both propose_budget AND propose_saving called together, rather
 * than forcing the person to ask twice.
 */
export function extractFunctionCalls(response: GeminiRawResponse): Array<{ name: string; args: Record<string, unknown> }> {
  return (response.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.functionCall)
    .filter((fc): fc is { name: string; args: Record<string, unknown> } => Boolean(fc));
}

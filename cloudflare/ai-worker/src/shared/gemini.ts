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
    // Extended-thinking models (name contains "thinking") generate
    // hidden reasoning tokens before answering, which is what makes them
    // noticeably slower for a chat that just needs quick tool calls or
    // short replies — not a bug, just a mode this app doesn't need.
    // `thinkingBudget: 0` turns that off. Scoped to ONLY models whose
    // name says "thinking" rather than applied to every model in the
    // rotation: `thinkingConfig` isn't a field every Gemini model
    // recognizes, and sending it to one that doesn't could 400 the
    // whole request — the exact same class of bug as the empty-enum
    // issue fixed in assistant.ts, so it gets the same "only add it
    // where it's actually meaningful" treatment.
    const body = model.includes('thinking')
      ? {
          ...requestBody,
          generationConfig: {
            ...((requestBody.generationConfig as Record<string, unknown>) ?? {}),
            thinkingConfig: { thinkingBudget: 0 }
          }
        }
      : requestBody;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      console.log(`[gemini] dijawab oleh model: ${model}`);
      return (await res.json()) as GeminiRawResponse;
    }

    // Fallback untuk error yang sifatnya sementara / quota.
    // 429 = rate limit / quota
    // 503 = model sedang unavailable / high demand
    if (res.status !== 429 && res.status !== 503) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini (${model}) error ${res.status}: ${text.slice(0, 300)}`);
    }

    const reason = res.status === 429
      ? 'kena limit kuota (429)'
      : 'sedang unavailable/high demand (503)';

    console.warn(
      `[gemini] ${model} ${reason} — coba model berikutnya di rotasi...`
    );

    lastError = new Error(
      `Semua model di rotasi gagal (terakhir dicoba: ${model}, status: ${res.status})`
    );
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

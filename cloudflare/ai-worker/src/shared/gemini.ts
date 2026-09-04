export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

export interface GeminiRawResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

/**
 * 🔧 ROTASI MODEL GEMINI
 */
export const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite'
];

/**
 * ⚡ FALLBACK PERFORMANCE RULES
 *
 * 429  → fallback langsung
 * 503  → tunggu maksimal MODEL_TIMEOUT_MS, lalu fallback
 * timeout → fallback
 * network error → fallback
 *
 * Error konfigurasi (400/401/403/404) → langsung throw.
 *
 * TOTAL_TIMEOUT_MS mencegah seluruh rotasi terlalu lama
 * sampai Cloudflare berpotensi mengembalikan 524.
 */
const MODEL_TIMEOUT_MS = 7_000;
const TOTAL_TIMEOUT_MS = 20_000;

export async function callGeminiWithFallback(
  apiKey: string,
  models: string[],
  requestBody: Record<string, unknown>
): Promise<GeminiRawResponse> {
  let lastError: Error | null = null;

  // Jangan izinkan daftar model kosong menjalankan loop.
  if (models.length === 0) {
    throw new Error('Daftar model Gemini kosong');
  }

  const startedAt = Date.now();

  for (const model of models) {
    const elapsed = Date.now() - startedAt;
    const remaining = TOTAL_TIMEOUT_MS - elapsed;

    // Total budget sudah habis.
    if (remaining <= 0) {
      console.warn(
        `[gemini] total fallback budget habis (${TOTAL_TIMEOUT_MS}ms)`
      );
      break;
    }

    // Model terakhir tidak perlu dipaksa mengikuti timeout global
    // kalau waktu tersisa lebih pendek.
    const timeoutMs = Math.min(MODEL_TIMEOUT_MS, remaining);

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}` +
      `:generateContent?key=${apiKey}`;

    const body = model.includes('thinking')
      ? {
          ...requestBody,
          generationConfig: {
            ...((requestBody.generationConfig as Record<string, unknown>) ?? {}),
            thinkingConfig: { thinkingBudget: 0 }
          }
        }
      : requestBody;

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      console.log(
        `[gemini] mencoba ${model} (timeout ${timeoutMs}ms)`
      );

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        console.log(
          `[gemini] dijawab oleh model: ${model} ` +
          `(${Date.now() - startedAt}ms total)`
        );

        return (await res.json()) as GeminiRawResponse;
      }

      /*
       * FALLBACK ERRORS
       *
       * 429 = rate limit / quota
       * 503 = temporarily unavailable / high demand
       */
      if (res.status === 429 || res.status === 503) {
        const reason =
          res.status === 429
            ? 'rate limit / quota (429)'
            : 'temporarily unavailable / high demand (503)';

        console.warn(
          `[gemini] ${model} → ${reason}, fallback ke model berikutnya`
        );

        lastError = new Error(
          `Gemini ${model} returned ${res.status}`
        );

        continue;
      }

      /*
       * ERROR PERMANEN / REQUEST ERROR
       *
       * Jangan buang waktu mencoba model lain kalau request-nya
       * sendiri yang salah.
       */
      const text = await res.text().catch(() => '');

      throw new Error(
        `Gemini (${model}) error ${res.status}: ${text.slice(0, 300)}`
      );

    } catch (error) {
      clearTimeout(timeoutId);

      const isAbort =
        error instanceof Error &&
        error.name === 'AbortError';

      /*
       * Timeout → fallback.
       */
      if (isAbort) {
        console.warn(
          `[gemini] ${model} timeout setelah ${timeoutMs}ms → fallback`
        );

        lastError = new Error(
          `Gemini ${model} timeout setelah ${timeoutMs}ms`
        );

        continue;
      }

      /*
       * Network / fetch error → fallback.
       *
       * Tapi error yang sengaja kita throw di atas (400/401/etc)
       * harus tetap diteruskan, bukan dianggap network error.
       */
      if (error instanceof Error) {
        const message = error.message;

        if (message.startsWith('Gemini (')) {
          throw error;
        }

        console.warn(
          `[gemini] ${model} network error → fallback: ${message}`
        );

        lastError = error;
        continue;
      }

      lastError = new Error(
        `Gemini ${model} gagal dengan error tidak dikenal`
      );
    }
  }

  const totalTime = Date.now() - startedAt;

  console.error(
    `[gemini] semua model gagal setelah ${totalTime}ms`
  );

  throw lastError ?? new Error(
    'Semua model Gemini dalam rotasi gagal'
  );
}

export function getConfiguredModels(
  envValue: string | undefined
): string[] {
  const parsed = (envValue ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  return parsed.length > 0
    ? parsed
    : DEFAULT_GEMINI_MODELS;
}

export function extractText(
  response: GeminiRawResponse
): string | null {
  return (
    response.candidates?.[0]?.content?.parts
      ?.find((p) => p.text)
      ?.text ?? null
  );
}

/**
 * Returns EVERY function call in the response.
 */
export function extractFunctionCalls(
  response: GeminiRawResponse
): Array<{
  name: string;
  args: Record<string, unknown>;
}> {
  return (
    response.candidates?.[0]?.content?.parts ?? []
  )
    .map((p) => p.functionCall)
    .filter(
      (
        fc
      ): fc is {
        name: string;
        args: Record<string, unknown>;
      } => Boolean(fc)
    );
}
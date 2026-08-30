import type { Env } from './index';
import { json } from './shared/http';
import { callGeminiWithFallback, extractFunctionCall, extractText, getConfiguredModels } from './shared/gemini';

interface CategoryOption {
  id: string;
  name: string;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

interface SalaryTransaction {
  amount: number;
  date: string; // YYYY-MM-DD
}

interface AssistantRequestBody {
  message: string;
  history: ChatTurn[]; // prior turns this session, oldest first — NOT persisted server-side (see Fase B/C notes)
  current_month: string; // YYYY-MM
  categories: CategoryOption[]; // expense categories only — budgets only ever target expenses
  salary_transaction: SalaryTransaction | null; // most recent cat_id:'salary' income tx this app already found locally
  avg_spending_last_3mo: Record<string, number>; // cat_id -> average monthly amount
  existing_budget_this_month: Record<string, number>; // cat_id -> limit_amount already set for current_month
}

/**
 * The ONE tool for this first phase (Fase A/D from the design chat).
 * Its arguments ARE the final answer — no second round-trip needed,
 * unlike a "fetch data" tool would require. Adding more tools later
 * (get_spending_summary, propose_savings_goal, ...) means adding more
 * entries to this array; the calling loop in handleAssistant() doesn't
 * need to change since it already just returns whatever function call
 * came back.
 */
function buildTools(categories: CategoryOption[]) {
  return [
    {
      functionDeclarations: [
        {
          name: 'propose_budget',
          description:
            'Usulkan alokasi budget bulanan per kategori. HANYA panggil ini setelah nominal pemasukan/dana yang tersedia jelas dan sudah dikonfirmasi user di percakapan ini — jangan panggil kalau masih menebak-nebak nominalnya.',
          parameters: {
            type: 'OBJECT',
            properties: {
              month: { type: 'STRING', description: 'Format YYYY-MM' },
              reasoning: { type: 'STRING', description: '1-2 kalimat alasan singkat alokasi ini, Bahasa Indonesia' },
              allocations: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    category_id: { type: 'STRING', enum: categories.map((c) => c.id) },
                    amount: { type: 'NUMBER' }
                  },
                  required: ['category_id', 'amount']
                }
              }
            },
            required: ['month', 'allocations', 'reasoning']
          }
        }
      ]
    }
  ];
}

function buildSystemInstruction(body: AssistantRequestBody): string {
  const categoryList = body.categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const avgList =
    Object.entries(body.avg_spending_last_3mo)
      .map(([id, amt]) => `- ${id}: rata-rata Rp${amt.toLocaleString('id-ID')}/bulan (3 bulan terakhir)`)
      .join('\n') || '(belum ada cukup data histori)';
  const existingList =
    Object.entries(body.existing_budget_this_month)
      .map(([id, amt]) => `- ${id}: sudah ada budget Rp${amt.toLocaleString('id-ID')}`)
      .join('\n') || '(belum ada budget di bulan ini)';
  const salaryLine = body.salary_transaction
    ? `Ada transaksi pemasukan berkategori Gaji bulan ini: Rp${body.salary_transaction.amount.toLocaleString('id-ID')} (tanggal ${body.salary_transaction.date}).`
    : 'Tidak ditemukan transaksi pemasukan berkategori Gaji bulan ini.';

  return `Kamu adalah asisten keuangan pribadi di aplikasi "My Finance". Jawab dengan Bahasa Indonesia santai, ringkas (ini chat di HP, bukan esai), dan ramah.

Bulan yang sedang dibahas: ${body.current_month}

${salaryLine}

Daftar kategori pengeluaran yang BOLEH dipakai (jangan pernah pakai id di luar ini):
${categoryList}

Rata-rata pengeluaran per kategori (3 bulan terakhir):
${avgList}

Budget yang sudah ada bulan ini:
${existingList}

ATURAN PENTING soal bikin budget:
1. JANGAN pernah panggil tool "propose_budget" sebelum nominal dana yang tersedia (gaji/pemasukan) itu JELAS dan sudah dikonfirmasi user di percakapan ini.
2. Kalau ada transaksi Gaji yang ditemukan (lihat di atas) dan user belum pernah konfirmasi di percakapan ini, TANYA/KONFIRMASI dulu lewat teks biasa — misal: "Gaji bulan ini tercatat Rp8.000.000 tanggal 1 Sept, mau saya pakai ini sebagai dasar budget?" — JANGAN langsung panggil tool.
3. Kalau tidak ada transaksi Gaji ditemukan DAN user juga belum menyebutkan angka sendiri, TANYA nominalnya langsung lewat teks biasa. Jangan menebak angka.
4. Begitu nominal sudah jelas (baik dari konfirmasi user atas data Gaji, atau user sebut sendiri), baru boleh panggil "propose_budget".
5. Total alokasi sebaiknya mendekati (tidak jauh melebihi) nominal yang tersedia.
6. Kalau user cuma nanya hal lain (bukan minta dibuatkan/diubah budget), jawab biasa pakai teks, jangan panggil tool apapun.
7. Jangan mengarang angka yang tidak ada dasarnya dari data di atas atau dari yang disebut user sendiri.`;
}

export async function handleAssistant(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: AssistantRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body request tidak valid' }, 400, cors);
  }
  if (!body.message || typeof body.message !== 'string') {
    return json({ error: 'Pesan kosong' }, 400, cors);
  }
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const history = Array.isArray(body.history) ? body.history : [];
  // Rough cap on conversation length sent per request — keeps token use
  // (and thus quota burn across the rotation list) bounded even if a
  // chat session runs long. History is client-side/session-only anyway
  // (see Fase B/C design notes), so this just trims what gets *sent*,
  // it doesn't delete anything the person sees in their chat.
  const trimmedHistory = history.slice(-20);

  const contents = [
    ...trimmedHistory.map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }]
    })),
    { role: 'user', parts: [{ text: body.message }] }
  ];

  try {
    const models = getConfiguredModels(env.GEMINI_MODELS);
    const response = await callGeminiWithFallback(env.GEMINI_API_KEY, models, {
      systemInstruction: { parts: [{ text: buildSystemInstruction(body) }] },
      contents,
      tools: buildTools(categories),
      generationConfig: { temperature: 0.3 }
    });

    const functionCall = extractFunctionCall(response);
    if (functionCall) {
      return json({ type: 'action', action: functionCall.name, args: functionCall.args }, 200, cors);
    }
    const text = extractText(response);
    if (!text) throw new Error('Gemini tidak mengembalikan jawaban');
    return json({ type: 'text', text }, 200, cors);
  } catch (err) {
    console.error('[assistant] Gemini call failed:', err);
    return json({ error: 'Asisten lagi nggak bisa diakses, coba lagi nanti' }, 502, cors);
  }
}

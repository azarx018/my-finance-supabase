import type { Env } from './index';
import { json } from './shared/http';
import { callGeminiWithFallback, extractFunctionCalls, extractText, getConfiguredModels } from './shared/gemini';

interface CategoryOption {
  id: string;
  name: string;
}

interface WalletOption {
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
  wallet_id: string | null;
}

interface CategorySpend {
  cat_id: string;
  amount: number;
}

interface SpendingSummary {
  total: number;
  by_category: CategorySpend[]; // sorted highest first
}

interface AssistantRequestBody {
  message: string;
  history: ChatTurn[]; // prior turns this session, oldest first — NOT persisted server-side (see Fase B/C notes)
  current_month: string; // YYYY-MM
  categories: CategoryOption[]; // expense categories — budgets only ever target expenses
  wallets: WalletOption[]; // needed so propose_saving can pick a source wallet by id
  salary_transaction: SalaryTransaction | null; // most recent cat_id:'salary' income tx this app already found locally
  avg_spending_last_3mo: Record<string, number>; // cat_id -> average monthly amount
  existing_budget_this_month: Record<string, number>; // cat_id -> limit_amount already set for current_month
  spending_this_month: SpendingSummary; // "get_spending_summary" capability — see analytics.ts's getSpendingSummary
  spending_last_month: SpendingSummary; // for "kenapa pengeluaran gue naik?"-type questions
}

// The built-in "Tabungan" expense category (categories.ts — id:
// 'savings'). BUGFIX: this used to be a normal pickable option for
// propose_budget, so the model would "allocate a budget" to it — which
// just wrote a spending LIMIT row, not an actual savings goal. Real
// savings belong in propose_saving instead (a saving_buckets goal + an
// actual deposit from a wallet, same as the app's own Tabungan screen).
// Filtering it out here means the model literally cannot pick it for a
// budget line, even by mistake.
const SAVINGS_CATEGORY_ID = 'savings';

/**
 * Two tools now (Fase E): propose_budget (unchanged) and the new
 * propose_saving. Both are "final answer" tools — their arguments ARE
 * the confirmation card, no second round-trip needed. Gemini supports
 * calling more than one tool in a single turn (see
 * extractFunctionCalls), which is exactly what "bikinin budget dari
 * gaji, sisihkan juga buat tabungan" needs: one call to each.
 */
function buildTools(categories: CategoryOption[], wallets: WalletOption[]) {
  const budgetCategoryIds = categories.map((c) => c.id).filter((id) => id !== SAVINGS_CATEGORY_ID);
  const walletIds = wallets.map((w) => w.id);

  return [
    {
      functionDeclarations: [
        {
          name: 'propose_budget',
          description:
            'Usulkan alokasi budget bulanan per kategori PENGELUARAN. HANYA panggil ini setelah nominal pemasukan/dana yang tersedia jelas dan sudah dikonfirmasi user di percakapan ini. JANGAN pernah masukkan porsi tabungan ke sini — pakai tool propose_saving terpisah untuk itu.',
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
                    category_id: { type: 'STRING', enum: budgetCategoryIds },
                    amount: { type: 'NUMBER' }
                  },
                  required: ['category_id', 'amount']
                }
              }
            },
            required: ['month', 'allocations', 'reasoning']
          }
        },
        {
          name: 'propose_saving',
          description:
            'Usulkan MENYISIHKAN sebagian dana ke kantong tabungan baru (bukan budget). Panggil ini kalau user minta disisihkan/ditabung sebagian dari pemasukannya. Ini akan membuat kantong tabungan aktif dan langsung memindahkan dana dari sebuah dompet ke kantong itu — bukan sekadar batas pengeluaran.',
          parameters: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'Nama kantong tabungan, misal "Tabungan gaji bulan ini"' },
              amount: { type: 'NUMBER' },
              reasoning: { type: 'STRING', description: '1 kalimat alasan singkat, Bahasa Indonesia' },
              wallet_id: {
                type: 'STRING',
                description:
                  'Dompet SUMBER dananya. Kalau ada info dompet gaji di konteks, pakai itu. Kalau tidak yakin, boleh null biar user pilih sendiri.',
                enum: walletIds,
                nullable: true
              }
            },
            required: ['name', 'amount', 'reasoning']
          }
        }
      ]
    }
  ];
}

function formatCategorySpend(list: CategorySpend[]): string {
  if (!list.length) return '(tidak ada pengeluaran)';
  return list.map((c) => `- ${c.cat_id}: Rp${c.amount.toLocaleString('id-ID')}`).join('\n');
}

function buildSystemInstruction(body: AssistantRequestBody): string {
  const categoryList = body.categories
    .filter((c) => c.id !== SAVINGS_CATEGORY_ID)
    .map((c) => `- ${c.id}: ${c.name}`)
    .join('\n');
  const walletList = body.wallets.map((w) => `- ${w.id}: ${w.name}`).join('\n') || '(tidak ada dompet)';
  const avgList =
    Object.entries(body.avg_spending_last_3mo)
      .map(([id, amt]) => `- ${id}: rata-rata Rp${amt.toLocaleString('id-ID')}/bulan (3 bulan terakhir)`)
      .join('\n') || '(belum ada cukup data histori)';
  const existingList =
    Object.entries(body.existing_budget_this_month)
      .map(([id, amt]) => `- ${id}: sudah ada budget Rp${amt.toLocaleString('id-ID')}`)
      .join('\n') || '(belum ada budget di bulan ini)';
  const salaryLine = body.salary_transaction
    ? `Ada transaksi pemasukan berkategori Gaji bulan ini: Rp${body.salary_transaction.amount.toLocaleString('id-ID')} (tanggal ${body.salary_transaction.date}), masuk ke dompet id "${body.salary_transaction.wallet_id ?? 'tidak diketahui'}".`
    : 'Tidak ditemukan transaksi pemasukan berkategori Gaji bulan ini.';
  const spendingChangePct =
    body.spending_last_month.total > 0
      ? Math.round(((body.spending_this_month.total - body.spending_last_month.total) / body.spending_last_month.total) * 100)
      : null;

  return `Kamu adalah asisten keuangan pribadi di aplikasi "My Finance". Jawab dengan Bahasa Indonesia santai, ringkas (ini chat di HP, bukan esai), dan ramah.

Bulan yang sedang dibahas: ${body.current_month}

${salaryLine}

Daftar kategori PENGELUARAN yang boleh dipakai untuk propose_budget (jangan pernah pakai id di luar ini, dan JANGAN PERNAH bikin alokasi budget untuk "tabungan" — itu bukan bagian dari daftar ini):
${categoryList}

Daftar dompet yang ada (untuk propose_saving):
${walletList}

Rata-rata pengeluaran per kategori (3 bulan terakhir):
${avgList}

Budget yang sudah ada bulan ini:
${existingList}

RINGKASAN PENGELUARAN bulan ini (total Rp${body.spending_this_month.total.toLocaleString('id-ID')}), per kategori dari yang terbesar:
${formatCategorySpend(body.spending_this_month.by_category)}

RINGKASAN PENGELUARAN bulan lalu (total Rp${body.spending_last_month.total.toLocaleString('id-ID')}), per kategori dari yang terbesar:
${formatCategorySpend(body.spending_last_month.by_category)}
${spendingChangePct !== null ? `Perubahan total pengeluaran vs bulan lalu: ${spendingChangePct > 0 ? '+' : ''}${spendingChangePct}%.` : ''}

ATURAN PENTING:
1. JANGAN pernah panggil tool apapun sebelum nominal dana yang tersedia (gaji/pemasukan) itu JELAS dan sudah dikonfirmasi user di percakapan ini.
2. Kalau ada transaksi Gaji yang ditemukan (lihat di atas) dan user belum pernah konfirmasi di percakapan ini, TANYA/KONFIRMASI dulu lewat teks biasa — misal: "Gaji bulan ini tercatat Rp8.000.000 tanggal 1 Sept, mau saya pakai ini sebagai dasar budget?" — JANGAN langsung panggil tool.
3. Kalau tidak ada transaksi Gaji ditemukan DAN user juga belum menyebutkan angka sendiri, TANYA nominalnya langsung lewat teks biasa. Jangan menebak angka.
4. Begitu nominal sudah jelas, baru boleh panggil tool.
5. Kalau user minta "budget" yang TERMASUK porsi tabungan/menyisihkan uang, pisahkan: porsi pengeluaran lewat propose_budget, porsi tabungan lewat propose_saving — BOLEH panggil KEDUANYA dalam satu balasan yang sama kalau memang diperlukan.
6. Untuk propose_saving, kalau ada dompet gaji di konteks, gunakan wallet_id itu sebagai dompet sumber secara default.
7. Total alokasi (budget + saving) sebaiknya mendekati (tidak jauh melebihi) nominal yang tersedia.
8. Kalau user tanya soal pengeluaran ("pengeluaran terbesar apa?", "kenapa boros/naik?", "abis berapa bulan ini?") — JAWAB LANGSUNG pakai data RINGKASAN PENGELUARAN di atas, JANGAN panggil tool apapun, dan JANGAN bilang kamu tidak punya datanya karena datanya sudah ada di atas.
9. Kalau user tanya "budget gue masuk akal nggak?" atau semacamnya — bandingkan tiap "budget yang sudah ada bulan ini" dengan "rata-rata pengeluaran per kategori" yang relevan, kasih pendapat jujur (misal: budget makanan Rp600rb tapi rata-rata 3 bulan Rp850rb → kemungkinan terlalu rendah). Jawab pakai teks biasa, jangan panggil tool.
10. Kalau user cuma nanya hal lain di luar semua itu, jawab biasa pakai teks, jangan panggil tool apapun.
11. Jangan mengarang angka yang tidak ada dasarnya dari data di atas atau dari yang disebut user sendiri.`;
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
  const wallets = Array.isArray(body.wallets) ? body.wallets : [];
  const history = Array.isArray(body.history) ? body.history : [];
  const emptySummary: SpendingSummary = { total: 0, by_category: [] };
  body.spending_this_month = body.spending_this_month ?? emptySummary;
  body.spending_last_month = body.spending_last_month ?? emptySummary;
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
      tools: buildTools(categories, wallets),
      generationConfig: { temperature: 0.3 }
    });

    const functionCalls = extractFunctionCalls(response);
    if (functionCalls.length > 0) {
      return json(
        { type: 'actions', actions: functionCalls.map((fc) => ({ action: fc.name, args: fc.args })) },
        200,
        cors
      );
    }
    const text = extractText(response);
    if (!text) throw new Error('Gemini tidak mengembalikan jawaban');
    return json({ type: 'text', text }, 200, cors);
  } catch (err) {
    console.error('[assistant] Gemini call failed:', err);
    return json({ error: 'Asisten lagi nggak bisa diakses, coba lagi nanti' }, 502, cors);
  }
}

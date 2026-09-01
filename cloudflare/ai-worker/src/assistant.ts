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

interface DebtOption {
  id: string;
  name: string;
  dtype: 'borrowed' | 'lent';
  remaining: number;
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
  today: string; // YYYY-MM-DD — so the model can resolve "kemarin"/"tadi pagi" against a real date
  current_month: string; // YYYY-MM
  expense_categories: CategoryOption[]; // for propose_budget + expense-type propose_transaction
  income_categories: CategoryOption[]; // for income-type propose_transaction
  wallets: WalletOption[];
  debts: DebtOption[]; // active (unpaid) debts/receivables — for propose_debt_payment's fuzzy name match
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
 * Six tools total now. All of them are "final answer" tools — their
 * arguments ARE the confirmation card, no second round-trip needed.
 * Gemini supports calling more than one in a single turn (see
 * extractFunctionCalls) — used for things like "bikinin budget dari
 * gaji, sisihkan juga buat tabungan" (one call each) or "catetin: makan
 * 20rb, ngopi 15rb" (propose_transaction called twice).
 *
 * propose_wallet/propose_transaction/propose_debt/propose_debt_payment
 * all require an id from `wallets` (or `debts`) — none of them accept
 * null and defer the choice to the confirmation card. That's
 * deliberate: per the design discussion, when there's more than one
 * wallet and the person didn't say which one, the model is supposed to
 * ASK in plain text before calling the tool at all, not guess and let
 * the card sort it out. See buildSystemInstruction's wallet-priority
 * rules for the full flow (including "0 wallets" and "1 wallet").
 */
function buildTools(
  expenseCategories: CategoryOption[],
  incomeCategories: CategoryOption[],
  wallets: WalletOption[],
  debts: DebtOption[]
) {
  const budgetCategoryIds = expenseCategories.map((c) => c.id).filter((id) => id !== SAVINGS_CATEGORY_ID);
  const allCategoryIds = [...expenseCategories, ...incomeCategories].map((c) => c.id);
  const walletIds = wallets.map((w) => w.id);
  const debtIds = debts.map((d) => d.id);

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
        },
        {
          name: 'propose_wallet',
          description:
            'Bikin dompet baru. Panggil ini kalau user minta bikin/tambah dompet, ATAU kalau user minta aksi lain (transaksi/hutang) yang butuh dompet TAPI belum ada dompet sama sekali — lihat aturan prioritas dompet.',
          parameters: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'Nama dompet, misal "BCA", "Cash", "GoPay"' },
              initial_balance: { type: 'NUMBER', description: 'Saldo awal, 0 kalau tidak disebutkan' },
              reasoning: { type: 'STRING', description: '1 kalimat singkat, Bahasa Indonesia' }
            },
            required: ['name', 'initial_balance', 'reasoning']
          }
        },
        {
          name: 'propose_transaction',
          description:
            'Catat SATU transaksi pemasukan/pengeluaran dari kalimat bebas user. Kalau user menyebut beberapa transaksi sekaligus dalam satu pesan, panggil tool ini BERKALI-KALI (sekali per transaksi) dalam balasan yang sama.',
          parameters: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING', enum: ['income', 'expense'] },
              amount: { type: 'NUMBER' },
              description: { type: 'STRING', description: 'Ringkasan singkat, misal "Makan siang", "Isi bensin"' },
              category_id: { type: 'STRING', enum: allCategoryIds },
              date: { type: 'STRING', description: 'Format YYYY-MM-DD, resolve "kemarin"/"tadi" dari tanggal hari ini yang diberikan' },
              wallet_id: {
                type: 'STRING',
                enum: walletIds,
                description: 'WAJIB sudah jelas sebelum memanggil tool ini — lihat aturan prioritas dompet'
              }
            },
            required: ['type', 'amount', 'description', 'date', 'wallet_id']
          }
        },
        {
          name: 'propose_debt',
          description: 'Catat hutang baru (user meminjam) atau piutang baru (user meminjamkan).',
          parameters: {
            type: 'OBJECT',
            properties: {
              dtype: { type: 'STRING', enum: ['borrowed', 'lent'], description: 'borrowed = user pinjam, lent = user meminjamkan' },
              name: { type: 'STRING', description: 'Nama orang/pihak terkait' },
              amount: { type: 'NUMBER' },
              due_date: { type: 'STRING', nullable: true, description: 'Format YYYY-MM-DD, null kalau tidak disebutkan' },
              wallet_id: {
                type: 'STRING',
                enum: walletIds,
                description: 'WAJIB sudah jelas sebelum memanggil tool ini — lihat aturan prioritas dompet'
              },
              reasoning: { type: 'STRING', description: '1 kalimat singkat, Bahasa Indonesia' }
            },
            required: ['dtype', 'name', 'amount', 'wallet_id', 'reasoning']
          }
        },
        {
          name: 'propose_debt_payment',
          description:
            'Catat pembayaran/pelunasan (sebagian atau penuh) atas hutang/piutang yang SUDAH ADA. Cocokkan nama yang disebut user ke salah satu id di daftar hutang aktif — kalau ada lebih dari satu yang mirip/ambigu, JANGAN panggil tool ini, tanya dulu lewat teks biasa untuk klarifikasi.',
          parameters: {
            type: 'OBJECT',
            properties: {
              debt_id: { type: 'STRING', enum: debtIds },
              amount: { type: 'NUMBER' },
              wallet_id: {
                type: 'STRING',
                enum: walletIds,
                description: 'WAJIB sudah jelas sebelum memanggil tool ini — lihat aturan prioritas dompet'
              },
              reasoning: { type: 'STRING', description: '1 kalimat singkat, Bahasa Indonesia' }
            },
            required: ['debt_id', 'amount', 'wallet_id', 'reasoning']
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
  const expenseCategoryList = body.expense_categories
    .filter((c) => c.id !== SAVINGS_CATEGORY_ID)
    .map((c) => `- ${c.id}: ${c.name}`)
    .join('\n');
  const incomeCategoryList = body.income_categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const walletList = body.wallets.map((w) => `- ${w.id}: ${w.name}`).join('\n') || '(tidak ada dompet sama sekali)';
  const debtList =
    body.debts.map((d) => `- ${d.id}: ${d.name} (${d.dtype === 'borrowed' ? 'hutang' : 'piutang'}, sisa Rp${d.remaining.toLocaleString('id-ID')})`).join('\n') ||
    '(tidak ada hutang/piutang aktif)';
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

Hari ini tanggal: ${body.today}. Bulan yang sedang dibahas: ${body.current_month}.

${salaryLine}

Daftar kategori PENGELUARAN (untuk propose_budget dan propose_transaction bertipe expense; JANGAN PERNAH pakai untuk alokasi "tabungan" di propose_budget — itu bukan bagian dari daftar ini):
${expenseCategoryList}

Daftar kategori PEMASUKAN (untuk propose_transaction bertipe income):
${incomeCategoryList}

Daftar dompet yang ada:
${walletList}

Daftar hutang/piutang AKTIF (belum lunas) — untuk propose_debt_payment:
${debtList}

Rata-rata pengeluaran per kategori (3 bulan terakhir):
${avgList}

Budget yang sudah ada bulan ini:
${existingList}

RINGKASAN PENGELUARAN bulan ini (total Rp${body.spending_this_month.total.toLocaleString('id-ID')}), per kategori dari yang terbesar:
${formatCategorySpend(body.spending_this_month.by_category)}

RINGKASAN PENGELUARAN bulan lalu (total Rp${body.spending_last_month.total.toLocaleString('id-ID')}), per kategori dari yang terbesar:
${formatCategorySpend(body.spending_last_month.by_category)}
${spendingChangePct !== null ? `Perubahan total pengeluaran vs bulan lalu: ${spendingChangePct > 0 ? '+' : ''}${spendingChangePct}%.` : ''}

ATURAN PRIORITAS DOMPET (berlaku untuk propose_transaction, propose_debt, propose_debt_payment — semua butuh wallet_id yang sudah pasti, tool-nya TIDAK menerima null):
1. Kalau TIDAK ADA dompet sama sekali ("tidak ada dompet sama sekali" di atas): untuk giliran ini HANYA panggil propose_wallet saja, JANGAN panggil tool lain bersamaan meski user memintanya dalam kalimat yang sama (wallet_id belum ada sampai user menekan "Terapkan" di kartu itu). Jelaskan lewat teks bahwa setelah dompetnya dibuat, user tinggal minta lagi aksi berikutnya.
2. Kalau CUMA ADA 1 dompet: pakai otomatis, JANGAN tanya — nanya di sini cuma buang waktu karena tidak ada pilihan lain.
3. Kalau ada 2+ dompet DAN user tidak menyebutkan dompet mana: TANYA dulu lewat teks biasa ("mau pakai dompet yang mana, BCA atau Cash?"), JANGAN menebak salah satu, JANGAN panggil tool dulu.
4. Kalau ada 2+ dompet DAN user menyebutkan dengan jelas ("dari BCA", "pakai Cash"): langsung pakai itu, tidak perlu konfirmasi ulang.

ATURAN PENCARIAN HUTANG (propose_debt_payment):
- Cocokkan nama yang disebut user ke salah satu id di "Daftar hutang/piutang AKTIF" di atas.
- Kalau ada lebih dari satu yang cocok/mirip (misal dua-duanya atas nama "Andi"), JANGAN panggil tool — tanya dulu lewat teks, sebutkan perbedaannya (nominal/tanggal) supaya user bisa pilih.
- Kalau tidak ada yang cocok sama sekali, bilang lewat teks bahwa tidak ketemu hutang dengan nama itu, jangan panggil tool.

ATURAN LAIN:
1. JANGAN pernah panggil propose_budget/propose_saving sebelum nominal dana yang tersedia (gaji/pemasukan) itu JELAS dan sudah dikonfirmasi user di percakapan ini.
2. Kalau ada transaksi Gaji yang ditemukan dan user belum pernah konfirmasi di percakapan ini, TANYA/KONFIRMASI dulu lewat teks biasa — JANGAN langsung panggil tool.
3. Kalau tidak ada transaksi Gaji ditemukan DAN user juga belum menyebutkan angka sendiri, TANYA nominalnya langsung lewat teks biasa. Jangan menebak angka.
4. Kalau user minta "budget" yang TERMASUK porsi tabungan/menyisihkan uang, pisahkan: porsi pengeluaran lewat propose_budget, porsi tabungan lewat propose_saving — BOLEH panggil KEDUANYA dalam satu balasan yang sama kalau memang diperlukan.
5. Untuk propose_saving, kalau ada dompet gaji di konteks, gunakan wallet_id itu sebagai dompet sumber secara default (tetap ikuti aturan prioritas dompet di atas kalau dompet gaji itu tidak jelas/tidak ada).
6. Kalau user menyebut BEBERAPA transaksi dalam satu pesan ("catetin: makan 20rb, ngopi 15rb, bensin 50rb"), panggil propose_transaction beberapa kali dalam balasan yang sama, satu per transaksi.
7. Kalau user tanya soal pengeluaran ("pengeluaran terbesar apa?", "kenapa boros/naik?") — JAWAB LANGSUNG pakai data RINGKASAN PENGELUARAN di atas, JANGAN panggil tool apapun.
8. Kalau user tanya "budget gue masuk akal nggak?" — bandingkan "budget yang sudah ada bulan ini" dengan "rata-rata pengeluaran per kategori", kasih pendapat jujur lewat teks, jangan panggil tool.
9. Kalau user cuma nanya hal lain di luar semua itu, jawab biasa pakai teks, jangan panggil tool apapun.
10. Jangan mengarang angka/tanggal/nama yang tidak ada dasarnya dari data di atas atau dari yang disebut user sendiri.`;
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
  const expenseCategories = Array.isArray(body.expense_categories) ? body.expense_categories : [];
  const incomeCategories = Array.isArray(body.income_categories) ? body.income_categories : [];
  const wallets = Array.isArray(body.wallets) ? body.wallets : [];
  const debts = Array.isArray(body.debts) ? body.debts : [];
  const history = Array.isArray(body.history) ? body.history : [];
  const emptySummary: SpendingSummary = { total: 0, by_category: [] };
  body.spending_this_month = body.spending_this_month ?? emptySummary;
  body.spending_last_month = body.spending_last_month ?? emptySummary;
  body.expense_categories = expenseCategories;
  body.income_categories = incomeCategories;
  body.wallets = wallets;
  body.debts = debts;
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
      tools: buildTools(expenseCategories, incomeCategories, wallets, debts),
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

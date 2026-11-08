/**
 * Membersihkan & memvalidasi body request /assistant SEBELUM masuk ke
 * handleAssistant.
 *
 * Kenapa ada: field-field konteks (avg_spending_last_3mo,
 * existing_budget_this_month, spending_*.by_category, dst) dipakai
 * langsung di buildSystemInstruction. Kalau client mengirim tanpa field
 * itu (atau bentuknya salah), Object.entries(undefined) / .length pada
 * undefined melempar TypeError → user hanya melihat 502 "Asisten lagi
 * nggak bisa diakses" yang menyesatkan. Di sini field yang hilang diberi
 * default aman, item yang bentuknya salah dibuang, dan hanya field yang
 * benar-benar wajib (today, current_month) yang menghasilkan 400.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

type Rec = Record<string, unknown>;

function isRecord(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function idNameOptions(v: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ id: string; name: string }> = [];
  for (const item of v) {
    if (isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string') {
      out.push({ id: item.id, name: item.name });
    }
  }
  return out;
}

function debtOptions(v: unknown) {
  if (!Array.isArray(v)) return [];
  const out: Array<{ id: string; name: string; dtype: 'borrowed' | 'lent'; remaining: number }> = [];
  for (const item of v) {
    if (
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      (item.dtype === 'borrowed' || item.dtype === 'lent') &&
      isFiniteNumber(item.remaining)
    ) {
      out.push({ id: item.id, name: item.name, dtype: item.dtype, remaining: item.remaining });
    }
  }
  return out;
}

function chatHistory(v: unknown) {
  if (!Array.isArray(v)) return [];
  const out: Array<{ role: 'user' | 'assistant'; text: string }> = [];
  for (const item of v) {
    if (isRecord(item) && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string') {
      out.push({ role: item.role, text: item.text });
    }
  }
  return out;
}

function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function numberRecord(v: unknown): Record<string, number> {
  if (!isRecord(v)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(v)) {
    if (isFiniteNumber(value)) out[key] = value;
  }
  return out;
}

function spendingSummary(v: unknown) {
  const byCategory: Array<{ cat_id: string; amount: number }> = [];
  if (!isRecord(v)) return { total: 0, by_category: byCategory };
  if (Array.isArray(v.by_category)) {
    for (const item of v.by_category) {
      if (isRecord(item) && typeof item.cat_id === 'string' && isFiniteNumber(item.amount)) {
        byCategory.push({ cat_id: item.cat_id, amount: item.amount });
      }
    }
  }
  return { total: isFiniteNumber(v.total) ? v.total : 0, by_category: byCategory };
}

function salaryTransaction(v: unknown) {
  if (!isRecord(v) || !isFiniteNumber(v.amount) || typeof v.date !== 'string') return null;
  return {
    amount: v.amount,
    date: v.date,
    wallet_id: typeof v.wallet_id === 'string' ? v.wallet_id : null
  };
}

function num(v: unknown): number {
  return isFiniteNumber(v) ? v : 0;
}

function periodTotals(v: unknown) {
  return isRecord(v) ? { income: num(v.income), expense: num(v.expense) } : { income: 0, expense: 0 };
}

/**
 * `snapshot` = posisi keuangan dari app (saldo dompet, tabungan, hutang/piutang, bulan ini/lalu, budget terpakai).
 * PENTING: sanitizer membuang field yang tidak ia kenal — dulu saldo dompet hilang di sini sehingga asisten
 * menjawab saldo 0. Kalau menambah field di AssistantSnapshot (app), tambahkan juga di sini.
 * Mengembalikan null kalau app tidak mengirim snapshot (model diberi tahu "tidak tersedia", bukan angka 0).
 */
function financeSnapshot(v: unknown) {
  if (!isRecord(v)) return null;
  const list = (x: unknown) => (Array.isArray(x) ? x.filter(isRecord) : []);
  const wallets = list(v.wallets)
    .filter((w) => typeof w.id === 'string' && typeof w.name === 'string')
    .map((w) => ({ id: w.id as string, name: w.name as string, balance: num(w.balance) }));
  const buckets = list(v.savings_buckets)
    .filter((b) => typeof b.name === 'string')
    .map((b) => ({
      id: typeof b.id === 'string' ? b.id : '',
      name: b.name as string,
      balance: num(b.balance),
      target: num(b.target),
      status: typeof b.status === 'string' ? b.status.slice(0, 16) : 'active'
    }));
  const budgets = list(v.budgets_this_month)
    .filter((b) => typeof b.cat_id === 'string')
    .map((b) => ({ cat_id: b.cat_id as string, limit: num(b.limit), used: num(b.used), remaining: num(b.remaining) }));
  return {
    wallets,
    wallets_total: num(v.wallets_total),
    savings_buckets: buckets,
    savings_total: num(v.savings_total),
    receivable: num(v.receivable),
    payable: num(v.payable),
    this_month: periodTotals(v.this_month),
    last_month: periodTotals(v.last_month),
    budgets_this_month: budgets
  };
}

export type SanitizeResult =
  | { ok: true; body: Rec }
  | { ok: false; error: string };

export function sanitizeAssistantBody(raw: unknown): SanitizeResult {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Body request tidak valid' };
  }

  if (typeof raw.today !== 'string' || !DATE_RE.test(raw.today)) {
    return { ok: false, error: 'Field "today" wajib diisi dengan format YYYY-MM-DD' };
  }
  if (typeof raw.current_month !== 'string' || !MONTH_RE.test(raw.current_month)) {
    return { ok: false, error: 'Field "current_month" wajib diisi dengan format YYYY-MM' };
  }

  return {
    ok: true,
    body: {
      // Kalau bukan string, jadikan '' — handleAssistant akan membalas
      // 400 "Pesan kosong" seperti biasa.
      message: typeof raw.message === 'string' ? raw.message : '',
      history: chatHistory(raw.history),
      today: raw.today,
      current_month: raw.current_month,
      expense_categories: idNameOptions(raw.expense_categories),
      income_categories: idNameOptions(raw.income_categories),
      wallets: idNameOptions(raw.wallets),
      debts: debtOptions(raw.debts),
      memory: stringList(raw.memory),
      salary_transaction: salaryTransaction(raw.salary_transaction),
      avg_spending_last_3mo: numberRecord(raw.avg_spending_last_3mo),
      existing_budget_this_month: numberRecord(raw.existing_budget_this_month),
      spending_this_month: spendingSummary(raw.spending_this_month),
      spending_last_month: spendingSummary(raw.spending_last_month),
      snapshot: financeSnapshot(raw.snapshot)
    }
  };
}

// Tes jalur asisten: data app → buildAssistantSnapshot → sanitizeAssistantBody → buildSystemInstruction.
// Dibuat karena asisten pernah menjawab tidak nyambung (saldo 0 / tidak tahu) akibat saldo dompet tidak dikirim
// dan field baru dibuang sanitizer. Jalankan: npm run test:assistant  (Node >= 22.6)
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'fm-assistant-'));
const strip = (src) => stripTypeScriptTypes(readFileSync(src, 'utf8')).replace(/^import .*$/gm, '');
const load = (code, name) => {
  const f = join(dir, name);
  writeFileSync(f, code);
  return import(f);
};

// Modul app (client): digabung jadi satu file supaya alias $lib tidak perlu di-resolve.
const clientCode =
  ['src/lib/data/wallets.ts', 'src/lib/data/saving.ts', 'src/lib/data/analytics.ts', 'src/lib/ai/assistantSnapshot.ts']
    .map(strip)
    .join('\n');
const { buildAssistantSnapshot } = await load(clientCode, 'client.mjs');
const { sanitizeAssistantBody } = await load(strip('cloudflare/ai-worker/src/shared/assistantInput.ts'), 'input.mjs');
const { buildSystemInstruction } = await load(strip('cloudflare/ai-worker/src/assistant.ts'), 'assistant.mjs');

let n = 0;
const ok = (cond, msg) => {
  n++;
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
};

// ---- data contoh (bentuk record Dexie) ----
const wallets = [
  { id: 'w1', name: 'BCA', initial_balance: 1000000 },
  { id: 'w2', name: 'Cash', initial_balance: 0 }
];
const transactions = [
  { id: 't1', type: 'income', amount: 5000000, date: '2026-11-02', wallet_id: 'w1', cat_id: 'salary' },
  { id: 't2', type: 'expense', amount: 200000, date: '2026-11-03', wallet_id: 'w1', cat_id: 'food' },
  { id: 't3', type: 'expense', amount: 800000, date: '2026-10-20', wallet_id: 'w1', cat_id: 'food' },
  { id: 't4', type: 'income', amount: 4000000, date: '2026-10-01', wallet_id: 'w1', cat_id: 'salary' },
  { id: 't5', type: 'transfer', amount: 300000, date: '2026-11-04', wallet_id: 'w1', to_wallet_id: 'w2' },
  { id: 't6', type: 'saving_transfer', amount: 500000, date: '2026-11-05', wallet_id: 'w1', direction: 'deposit' },
  { id: 't7', type: 'debt_transfer', amount: 100000, date: '2026-11-06', wallet_id: 'w2', direction: 'in' }
];
const savingBuckets = [{ id: 'b1', name: 'Dana Darurat', target: 5000000, status: 'active' }];
const savingTxs = [
  { id: 's1', bucket_id: 'b1', type: 'deposit', amount: 500000 },
  { id: 's2', bucket_id: 'b1', type: 'deposit', amount: 200000 },
  { id: 's3', bucket_id: 'b1', type: 'withdraw', amount: 100000 }
];
const debts = [
  { id: 'd1', name: 'Andi', dtype: 'borrowed', amount: 1000000, paid_amount: 400000, paid: false },
  { id: 'd2', name: 'Budi', dtype: 'lent', amount: 300000, paid_amount: 0, paid: false },
  { id: 'd3', name: 'Lunas', dtype: 'borrowed', amount: 50000, paid_amount: 50000, paid: true }
];
const budgets = [
  { id: 'g1', month: '2026-11', cat_id: 'food', limit_amount: 150000 },
  { id: 'g2', month: '2026-10', cat_id: 'food', limit_amount: 999 }
];

// ---- 1. snapshot dari app ----
const snap = buildAssistantSnapshot({ wallets, transactions, savingBuckets, savingTxs, debts, budgets, month: '2026-11' });
const bca = snap.wallets.find((w) => w.id === 'w1').balance;
const cash = snap.wallets.find((w) => w.id === 'w2').balance;
ok(bca === 1000000 + 5000000 - 200000 - 800000 + 4000000 - 300000 - 500000, `saldo BCA salah: ${bca}`);
ok(cash === 300000 + 100000, `saldo Cash salah: ${cash}`);
ok(snap.wallets_total === bca + cash, 'total dompet salah');
ok(snap.savings_buckets[0].balance === 600000 && snap.savings_total === 600000, 'saldo kantong tabungan salah');
ok(snap.payable === 600000, `hutang aktif salah: ${snap.payable}`);
ok(snap.receivable === 300000, `piutang aktif salah: ${snap.receivable}`);
ok(snap.this_month.income === 5000000 && snap.this_month.expense === 200000, 'ringkasan bulan ini salah');
ok(snap.last_month.income === 4000000 && snap.last_month.expense === 800000, 'ringkasan bulan lalu salah');
ok(snap.budgets_this_month.length === 1 && snap.budgets_this_month[0].used === 200000 && snap.budgets_this_month[0].remaining === -50000, 'pemakaian budget salah');

// ---- 2. request persis seperti yang dikirim app → sanitizer → prompt ----
const request = {
  message: 'saldo gue berapa',
  history: [],
  today: '2026-11-08',
  current_month: '2026-11',
  expense_categories: [{ id: 'food', name: 'Makanan' }],
  income_categories: [{ id: 'salary', name: 'Gaji' }],
  wallets: wallets.map((w) => ({ id: w.id, name: w.name })),
  debts: [],
  memory: [],
  salary_transaction: null,
  avg_spending_last_3mo: {},
  existing_budget_this_month: {},
  spending_this_month: { total: 200000, by_category: [{ cat_id: 'food', amount: 200000 }] },
  spending_last_month: { total: 800000, by_category: [{ cat_id: 'food', amount: 800000 }] },
  snapshot: snap
};
const res = sanitizeAssistantBody(request);
ok(res.ok, 'sanitizer menolak request valid');
ok(res.body.snapshot && res.body.snapshot.wallets_total === snap.wallets_total, 'sanitizer MEMBUANG snapshot / saldo dompet');
ok(res.body.snapshot.savings_total === 600000 && res.body.snapshot.payable === 600000, 'sanitizer merusak tabungan/hutang');
ok(res.body.snapshot.budgets_this_month[0].remaining === -50000, 'sanitizer merusak budget');

const prompt = buildSystemInstruction(res.body);
const fmt = (n) => `Rp${n.toLocaleString('id-ID')}`;
ok(prompt.includes('POSISI KEUANGAN SAAT INI'), 'prompt tanpa bagian posisi keuangan');
ok(prompt.includes(fmt(bca)) && prompt.includes(fmt(cash)), 'prompt tanpa saldo dompet');
ok(prompt.includes(fmt(snap.wallets_total)), 'prompt tanpa total dompet');
ok(prompt.includes('Dana Darurat') && prompt.includes(fmt(600000)), 'prompt tanpa tabungan');
ok(prompt.includes('SUDAH LEWAT'), 'prompt tidak menandai budget yang lewat');
ok(prompt.includes(`saldo ${fmt(bca)}`), 'daftar dompet di prompt tanpa saldo');
ok(prompt.includes('ATURAN ANGKA'), 'prompt tanpa aturan angka');

// ---- 3. tanpa snapshot: tidak boleh jadi "0", harus jujur tidak tersedia ----
const { snapshot: _drop, ...noSnap } = request;
const res2 = sanitizeAssistantBody(noSnap);
ok(res2.ok && res2.body.snapshot === null, 'tanpa snapshot harus null');
ok(buildSystemInstruction(res2.body).includes('TIDAK TERSEDIA'), 'prompt tanpa snapshot harus bilang TIDAK TERSEDIA');

// ---- 4. snapshot rusak tidak membuat worker crash ----
const res3 = sanitizeAssistantBody({ ...request, snapshot: { wallets: [{ id: 1 }, null, { id: 'x', name: 'Y', balance: 'abc' }], savings_buckets: 'oops', this_month: 5 } });
ok(res3.ok && res3.body.snapshot.wallets.length === 1 && res3.body.snapshot.wallets[0].balance === 0, 'snapshot rusak tidak dibersihkan dengan benar');
ok(typeof buildSystemInstruction(res3.body) === 'string', 'prompt gagal dibuat dari snapshot rusak');

console.log(`semua ${n} tes asisten lolos`);

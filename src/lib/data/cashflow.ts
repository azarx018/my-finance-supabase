import type { SyncableRecord } from '$lib/db/dexie';
import { computeWalletStats } from './wallets';
import { getPreviousMonth, toAnalysisView } from './analytics';

/**
 * RINGKASAN ARUS KAS SEBUAH PERIODE (bulan / beberapa bulan) — dengan "sisa bulan lalu".
 *
 * Masalah lama: savings rate & "net tabungan" = pemasukan − pengeluaran di bulan kalender
 * yang sama. Orang yang gajian di akhir bulan sebelumnya akan kelihatan DEFISIT di bulan
 * berikutnya (pemasukan 0, pengeluaran > 0) padahal uangnya memang sisa dari gaji bulan lalu.
 *
 * Aturan sekarang:
 *  1. Kalau pemasukan >= pengeluaran → sama persis dengan hitungan lama (tidak ada yang berubah).
 *  2. Kalau pengeluaran > pemasukan, selisihnya (gap) pertama-tama dianggap dibayar dari
 *     "sisa bulan lalu" (carry): uang dari pemasukan bulan sebelumnya yang belum terpakai
 *     dan belum ditabung — dibatasi tidak boleh lebih besar dari saldo dompet saat periode mulai.
 *  3. Hanya gap yang melebihi carry yang dihitung defisit sungguhan.
 *
 * Uang yang dipindah ke kantong tabungan TIDAK dihitung sebagai pengeluaran (dan memang
 * mengurangi carry, karena uangnya sudah dikunci di kantong).
 */
export type PeriodStatus = 'empty' | 'surplus' | 'covered' | 'deficit';

export interface PeriodSummary {
  income: number;
  expense: number;
  /** Selisih murni tanpa penyesuaian: pemasukan − pengeluaran (bisa negatif). */
  cashNet: number;
  /** Sisa bulan lalu yang tersedia di awal periode. */
  carry: number;
  /** Bagian defisit yang ditutup dari sisa bulan lalu. */
  covered: number;
  /** Sisa bulan lalu setelah dipakai periode ini. */
  carryLeft: number;
  /** Defisit sungguhan (di luar sisa bulan lalu). */
  deficit: number;
  /** Hasil bersih setelah penyesuaian: pemasukan − pengeluaran + covered. */
  net: number;
  /** Savings rate (%) setelah penyesuaian. Bisa negatif hanya jika defisit sungguhan. */
  rate: number;
  status: PeriodStatus;
  /** Setoran & penarikan tabungan dalam periode. */
  deposited: number;
  withdrawn: number;
}

const isLive = (t: SyncableRecord) => !t.deleted_at;

/** Sisa uang dari satu bulan: pemasukan + tarik tabungan − pengeluaran − setor tabungan. */
export function monthLeftover(transactions: SyncableRecord[], month: string): number {
  let v = 0;
  for (const t of transactions) {
    if (!isLive(t) || !(t.date as string).startsWith(month)) continue;
    const a = t.amount as number;
    if (t.type === 'income') v += a;
    else if (t.type === 'expense') v -= a;
    else if (t.type === 'saving_transfer') v += t.direction === 'withdraw' ? a : -a;
  }
  return v;
}

/** Total saldo semua dompet tepat sebelum tanggal `from` (eksklusif). */
export function openingBalance(
  wallets: SyncableRecord[],
  transactions: SyncableRecord[],
  from: string
): number {
  const before = transactions.filter((t) => isLive(t) && (t.date as string) < from);
  const stats = computeWalletStats(wallets, before);
  return wallets.reduce((s, w) => s + (stats[w.id]?.balance ?? 0), 0);
}

export function summarizePeriod(
  wallets: SyncableRecord[],
  transactions: SyncableRecord[],
  from: string,
  to: string
): PeriodSummary {
  // Pemasukan yang ditandai "untuk bulan lain" dihitung di bulan tujuannya (toAnalysisView);
  // saldo dompet tetap pakai tanggal asli.
  const view = toAnalysisView(transactions);
  let income = 0;
  let expense = 0;
  let deposited = 0;
  let withdrawn = 0;
  for (const t of view) {
    if (!isLive(t)) continue;
    const d = t.date as string;
    if (d < from || d > to) continue;
    const a = t.amount as number;
    if (t.type === 'income') income += a;
    else if (t.type === 'expense') expense += a;
    else if (t.type === 'saving_transfer') {
      if (t.direction === 'withdraw') withdrawn += a;
      else deposited += a;
    }
  }

  const prev = getPreviousMonth(from.slice(0, 7));
  const leftover = monthLeftover(view, prev);
  const opening = openingBalance(wallets, transactions, from);
  const carry = Math.max(0, Math.min(leftover, Math.max(0, opening)));

  const gap = Math.max(0, expense - income);
  const covered = Math.min(gap, carry);
  const deficit = gap - covered;
  const net = income - expense + covered;
  const denom = income + covered;
  const rate = denom > 0 ? Math.round((net / denom) * 100) : 0;

  const status: PeriodStatus =
    income === 0 && expense === 0 ? 'empty' : deficit > 0 ? 'deficit' : covered > 0 ? 'covered' : 'surplus';

  return {
    income,
    expense,
    cashNet: income - expense,
    carry,
    covered,
    carryLeft: carry - covered,
    deficit,
    net,
    rate,
    status,
    deposited,
    withdrawn
  };
}

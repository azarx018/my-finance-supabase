export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Posisi hutang-piutang untuk Total Kekayaan.
 *  - piutang (dtype 'lent')    = uang yang masih harus dikembalikan KE kamu → aset
 *  - hutang  (dtype 'borrowed') = uang yang masih harus kamu kembalikan    → kewajiban
 * Hanya hutang yang punya dompet (wallet_id) yang dihitung: itu yang pergerakan kasnya tercatat di dompet
 * (dompet naik saat meminjam / turun saat meminjamkan), jadi pasangannya di sini membuat totalnya impas.
 * Hutang tanpa dompet hanya catatan pengingat dan tidak mengubah kekayaan.
 */
export function getDebtPosition(debts: { dtype?: unknown; amount?: unknown; paid_amount?: unknown; paid?: unknown; wallet_id?: unknown; deleted_at?: unknown }[]): {
  receivable: number;
  payable: number;
} {
  let receivable = 0;
  let payable = 0;
  for (const d of debts) {
    if (d.deleted_at || d.paid === true || !d.wallet_id) continue;
    const remaining = Math.max(0, ((d.amount as number) || 0) - ((d.paid_amount as number) || 0));
    if (d.dtype === 'lent') receivable += remaining;
    else if (d.dtype === 'borrowed') payable += remaining;
  }
  return { receivable, payable };
}

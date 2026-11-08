export function getBudgetMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function getBudgetMonthLabel(): string {
  const n = new Date();
  return `${MONTH_NAMES[n.getMonth()]} ${n.getFullYear()}`;
}

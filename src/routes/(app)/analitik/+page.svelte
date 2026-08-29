<script lang="ts">
  import { transactions, customCategories } from '$lib/stores/data';
  import { getCatList, type Cat } from '$lib/data/categories';
  import {
    getDateRange,
    calcTotals,
    getAvgMonthly,
    getMonthlyData,
    getCategoryBreakdown,
    getDayOfWeekData,
    type DateFilter
  } from '$lib/data/analytics';
  import { formatRp, formatRpC, formatDateShort } from '$lib/data/format';
  import BarChart from '$lib/components/BarChart.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';

  let period: DateFilter = 'month';

  $: expenseCustom = $customCategories.filter((c) => c.type === 'expense') as unknown as Cat[];
  $: r = getDateRange(period);
  $: list = $transactions.filter(
    (t) => (!r || ((t.date as string) >= r.from && (t.date as string) <= r.to)) && t.type !== 'transfer'
  );
  $: totals = calcTotals(list);
  $: avgInc = getAvgMonthly($transactions, 'income', 3);
  $: avgExp = getAvgMonthly($transactions, 'expense', 3);
  $: savRate = totals.income > 0 ? Math.round((totals.saldo / totals.income) * 100) : 0;
  $: allTxs = $transactions.filter((t) => !r || ((t.date as string) >= r.from && (t.date as string) <= r.to));

  $: periodLabel =
    period === 'month' ? 'Bulan Ini' : period === '3month' ? '3 Bulan Terakhir' : period === '6month' ? '6 Bulan Terakhir' : 'Tahun Ini';

  // This month vs last month expense comparison
  $: cmp = (() => {
    const now = new Date();
    const last = new Date();
    last.setDate(1); // avoid rollover when today is the 29th-31st
    last.setMonth(last.getMonth() - 1);
    const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
    const thisMExp = $transactions
      .filter((t) => t.type === 'expense' && (t.date as string).startsWith(thisKey))
      .reduce((s, t) => s + (t.amount as number), 0);
    const lastMExp = $transactions
      .filter((t) => t.type === 'expense' && (t.date as string).startsWith(lastKey))
      .reduce((s, t) => s + (t.amount as number), 0);
    const chg = lastMExp ? Math.round(((thisMExp - lastMExp) / lastMExp) * 100) : 0;
    return {
      text: chg > 0 ? `▲ ${chg}% vs bulan lalu` : chg < 0 ? `▼ ${Math.abs(chg)}% vs bulan lalu` : 'Sama dgn bulan lalu',
      color: chg > 0 ? 'var(--expense)' : chg < 0 ? 'var(--income)' : 'var(--txt-secondary)'
    };
  })();

  $: months = period === 'year' ? 12 : period === '6month' ? 6 : period === '3month' ? 3 : 6;
  $: monthlyData = getMonthlyData($transactions, months);
  $: catBreakdown = getCategoryBreakdown($transactions, period, expenseCustom);
  $: dayData = getDayOfWeekData($transactions, period);
  $: maxDay = Math.max(...dayData, 1);
  $: topExpenses = [...allTxs].filter((t) => t.type === 'expense').sort((a, b) => (b.amount as number) - (a.amount as number)).slice(0, 5);

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const rEmoji = (rate: number) => (rate >= 30 ? '🚀' : rate >= 15 ? '✅' : rate >= 0 ? '⚠️' : '❌');
  const rDesc = (rate: number) =>
    rate >= 30
      ? 'Luar biasa! Kamu menabung dengan sangat baik.'
      : rate >= 15
        ? 'Bagus! Terus pertahankan.'
        : rate >= 0
          ? 'Perlu ditingkatkan lagi.'
          : 'Pengeluaran melebihi pemasukan!';
  const rColor = (rate: number) => (rate >= 15 ? 'var(--income)' : rate >= 0 ? 'var(--warn)' : 'var(--expense)');
</script>

<div class="p-4 flex flex-col gap-4 max-w-md mx-auto">
  <div class="flex gap-2 overflow-x-auto pb-1">
    {#each [{ id: 'month', label: 'Bulan Ini' }, { id: '3month', label: '3 Bulan' }, { id: '6month', label: '6 Bulan' }, { id: 'year', label: 'Tahun Ini' }] as p (p.id)}
      <button
        on:click={() => (period = p.id as DateFilter)}
        class="px-3 py-1.5 rounded-full text-xs font-medium border shrink-0"
        style="border-color: {period === p.id
          ? 'var(--primary)'
          : 'var(--border)'}; background: {period === p.id ? 'var(--primary-bg)' : 'var(--bg-card)'}; color: {period ===
        p.id
          ? 'var(--primary)'
          : 'var(--txt-secondary)'}"
      >
        {p.label}
      </button>
    {/each}
  </div>

  <section class="rounded-xl p-5 text-white shadow-lg" style="background: linear-gradient(135deg, var(--primary), var(--primary-light))">
    <p class="text-sm opacity-80">{periodLabel}</p>
    <div class="flex justify-between items-end mt-1">
      <p class="text-2xl font-semibold">{formatRpC(totals.saldo)}</p>
      <div class="text-right text-xs opacity-90">
        <p>Savings rate: {savRate}%</p>
        <p>{allTxs.length} transaksi</p>
      </div>
    </div>
  </section>

  <section class="grid grid-cols-2 gap-3">
    <div class="bg-base-card rounded-lg p-3 border border-border">
      <p class="text-[10px] text-txt-secondary">Pemasukan</p>
      <p class="text-sm font-semibold mt-1" style="color: var(--income)">{formatRpC(totals.income)}</p>
      <p class="text-[10px] text-txt-secondary mt-0.5">periode dipilih</p>
    </div>
    <div class="bg-base-card rounded-lg p-3 border border-border">
      <p class="text-[10px] text-txt-secondary">Pengeluaran</p>
      <p class="text-sm font-semibold mt-1" style="color: var(--expense)">{formatRpC(totals.expense)}</p>
      <p class="text-[10px] mt-0.5" style="color: {cmp.color}">{cmp.text}</p>
    </div>
    <div class="bg-base-card rounded-lg p-3 border border-border">
      <p class="text-[10px] text-txt-secondary">Net Tabungan</p>
      <p class="text-sm font-semibold mt-1" style="color: {totals.saldo >= 0 ? 'var(--income)' : 'var(--expense)'}">
        {formatRpC(totals.saldo)}
      </p>
      <p class="text-[10px] text-txt-secondary mt-0.5">pemasukan − pengeluaran</p>
    </div>
    <div class="bg-base-card rounded-lg p-3 border border-border">
      <p class="text-[10px] text-txt-secondary">Rata-rata Pemasukan</p>
      <p class="text-sm font-semibold mt-1">{formatRpC(avgInc)}</p>
      <p class="text-[10px] text-txt-secondary mt-0.5">per bulan (3 bln)</p>
    </div>
  </section>

  <section class="bg-base-card rounded-lg p-4 border border-border flex gap-3 items-start">
    <span class="text-2xl">{rEmoji(savRate)}</span>
    <div class="flex-1 min-w-0">
      <p class="text-xs text-txt-secondary">Tingkat Tabungan (Savings Rate)</p>
      <p class="text-lg font-semibold" style="color: {rColor(savRate)}">{savRate}%</p>
      <p class="text-xs text-txt-secondary">{rDesc(savRate)}</p>
      <div class="h-1.5 rounded-full bg-base-card2 overflow-hidden mt-2">
        <div
          class="h-full rounded-full"
          style="width: {Math.max(0, Math.min(100, savRate))}%; background: {rColor(savRate)}"
        ></div>
      </div>
    </div>
  </section>

  <section class="bg-base-card rounded-lg p-4 border border-border">
    <p class="text-xs font-medium text-txt-secondary mb-3">Tren Bulanan ({months} bulan terakhir)</p>
    <BarChart data={monthlyData} />
  </section>

  <section class="bg-base-card rounded-lg p-4 border border-border">
    <p class="text-xs font-medium text-txt-secondary mb-3">Kategori Pengeluaran</p>
    <DonutChart data={catBreakdown.slice(0, 8)} />
  </section>

  <section class="bg-base-card rounded-lg p-4 border border-border">
    <p class="text-xs font-medium text-txt-secondary mb-3">Pengeluaran per Hari</p>
    <div class="flex justify-between items-end gap-1 h-24">
      {#each dayNames as d, i (d)}
        {@const pct = Math.max(4, (dayData[i] / maxDay) * 100)}
        {@const isMax = dayData[i] === Math.max(...dayData) && dayData[i] > 0}
        <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <div class="w-full rounded-t-sm" style="height: {pct}%; background: {isMax ? 'var(--primary)' : 'var(--primary-bg)'}"></div>
          <span class="text-[9px] text-txt-secondary">{d}</span>
        </div>
      {/each}
    </div>
  </section>

  <section>
    <p class="text-xs font-medium text-txt-secondary mb-2">Top 5 Pengeluaran</p>
    {#if topExpenses.length === 0}
      <p class="text-xs text-txt-muted text-center py-6">Belum ada pengeluaran</p>
    {/if}
    <div class="flex flex-col gap-2">
      {#each topExpenses as t, i (t.id)}
        <div class="flex items-center gap-3 bg-base-card rounded-lg p-3 border border-border">
          <span class="text-xs font-semibold text-txt-muted w-5">#{i + 1}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-txt-primary truncate">{t.desc}</p>
            <p class="text-xs text-txt-secondary">{formatDateShort(t.date as string)}</p>
          </div>
          <p class="text-sm font-semibold shrink-0" style="color: var(--expense)">{formatRp(t.amount as number)}</p>
        </div>
      {/each}
    </div>
  </section>
</div>

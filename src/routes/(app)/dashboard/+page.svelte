<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { wallets, transactions, customCategories } from '$lib/stores/data';
  import { computeWalletStats } from '$lib/data/wallets';
  import { getDateRange, calcTotals, getDisplayType } from '$lib/data/analytics';
  import { formatRp, formatRpC, formatDateShort } from '$lib/data/format';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { fabHandler } from '$lib/stores/fab';
  import TxSheet from '$lib/components/TxSheet.svelte';
  import type { SyncableRecord } from '$lib/db/dexie';

  // Dashboard's FAB is the fastest path to "catat transaksi" — tap it
  // and go straight to the add-transaction sheet without navigating
  // away from Home first.
  let sheetOpen = false;
  function openAdd() {
    sheetOpen = true;
  }
  onMount(() => fabHandler.set(openAdd));
  onDestroy(() => fabHandler.set(null));

  $: stats = computeWalletStats($wallets, $transactions);
  $: netWorth = $wallets.reduce((s, w) => s + (stats[w.id]?.balance ?? 0), 0);

  $: range = getDateRange('month');
  $: monthList = $transactions.filter(
    (t) =>
      (!range || ((t.date as string) >= range.from && (t.date as string) <= range.to)) &&
      t.type !== 'transfer'
  );
  $: totals = calcTotals(monthList);
  $: savings = totals.income - totals.expense;
  $: savRate = totals.income > 0 ? Math.round((savings / totals.income) * 100) : 0;

  // Includes debt_transfer/saving_transfer too — cash moving in/out from
  // paying off a debt or tapping a savings bucket is still real activity
  // in the wallet and belongs in "Transaksi Terbaru", not just plain
  // income/expense. getDisplayType() gives each the correct +/- reading.
  $: recent = [...$transactions]
    .filter((t) => t.type === 'income' || t.type === 'expense' || t.type === 'debt_transfer' || t.type === 'saving_transfer')
    .sort((a, b) => (b.date as string).localeCompare(a.date as string) || b.id.localeCompare(a.id))
    .slice(0, 5);

  function catOf(t: SyncableRecord) {
    const dt = getDisplayType(t);
    const custom = $customCategories.filter((c) => c.type === dt) as unknown as Cat[];
    return getCatList(dt, custom).find((c) => c.id === t.cat_id);
  }
</script>

<div class="p-4 flex flex-col gap-4 max-w-md mx-auto">
  <section
    class="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg"
    style="background: linear-gradient(135deg, var(--primary), var(--primary-light))"
  >
    <div class="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none"></div>
    <div class="absolute -right-2 bottom-[-2.5rem] w-24 h-24 rounded-full bg-white/10 pointer-events-none"></div>
    <p class="text-sm opacity-80 relative">Total Kekayaan</p>
    <p class="text-3xl font-semibold mt-1 tracking-tight relative">{formatRp(netWorth)}</p>
    <p class="text-xs opacity-70 mt-3 relative">{$wallets.length} dompet</p>
  </section>

  <section class="grid grid-cols-2 gap-3">
    <div class="rounded-lg p-4" style="background: var(--income-bg)">
      <p class="text-xs text-txt-secondary">Pemasukan bulan ini</p>
      <p class="text-lg font-semibold mt-1" style="color: var(--income)">{formatRpC(totals.income)}</p>
    </div>
    <div class="rounded-lg p-4" style="background: var(--expense-bg)">
      <p class="text-xs text-txt-secondary">Pengeluaran bulan ini</p>
      <p class="text-lg font-semibold mt-1" style="color: var(--expense)">{formatRpC(totals.expense)}</p>
    </div>
  </section>

  <section class="bg-base-card rounded-xl shadow-sm p-4 border border-border flex items-center justify-between gap-3">
    <div>
      <p class="text-xs text-txt-secondary">Savings rate bulan ini</p>
      <p
        class="text-lg font-semibold mt-1"
        style="color: {savRate >= 30 ? 'var(--income)' : savRate >= 10 ? 'var(--warn)' : 'var(--expense)'}"
      >
        {savRate}%
      </p>
    </div>
    <p class="text-xs text-txt-secondary max-w-[140px] text-right">
      {savRate >= 30 ? 'Bagus! Pertahankan 💪' : savRate >= 10 ? 'Lumayan, bisa lebih baik' : 'Perlu perhatian lebih'}
    </p>
  </section>

  {#if $wallets.length > 0}
    <section>
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs font-medium text-txt-secondary">Dompet</p>
        <button on:click={() => goto('/dompet')} class="text-xs" style="color: var(--primary)">
          Lihat semua
        </button>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each $wallets as w (w.id)}
          <div class="shrink-0 bg-base-card border border-border rounded-lg px-3 py-2 min-w-[120px]">
            <p class="text-xs text-txt-secondary truncate">{w.emoji} {w.name}</p>
            <p class="text-sm font-semibold mt-0.5">{formatRpC(stats[w.id]?.balance ?? 0)}</p>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section>
    <div class="flex items-center justify-between mb-2">
      <p class="text-xs font-medium text-txt-secondary">Transaksi Terbaru</p>
      <button on:click={() => goto('/riwayat')} class="text-xs" style="color: var(--primary)">
        Lihat semua
      </button>
    </div>
    {#if recent.length === 0}
      <p class="text-xs text-txt-secondary text-center py-10">
        Belum ada transaksi. Tap tab Transaksi untuk mulai mencatat.
      </p>
    {/if}
    <div class="flex flex-col gap-2">
      {#each recent as t (t.id)}
        {@const cat = catOf(t)}
        {@const dt = getDisplayType(t)}
        <div class="flex items-center gap-3 bg-base-card rounded-xl shadow-sm p-3 border border-border">
          <span class="text-xl">{cat?.emoji ?? '💸'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-txt-primary truncate">{t.description}</p>
            <p class="text-xs text-txt-secondary">{formatDateShort(t.date as string)}</p>
          </div>
          <p class="text-sm font-semibold shrink-0" style="color: {dt === 'income' ? 'var(--income)' : 'var(--expense)'}">
            {dt === 'income' ? '+' : '-'}{formatRpC(t.amount as number)}
          </p>
        </div>
      {/each}
    </div>
  </section>
</div>

<TxSheet open={sheetOpen} editing={null} onClose={() => (sheetOpen = false)} />

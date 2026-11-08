<script lang="ts">
  import { catColor } from '$lib/data/catColor';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { wallets, transactions, customCategories } from '$lib/stores/data';
  import { computeWalletStats } from '$lib/data/wallets';
  import { getDateRange, calcTotals, getDisplayType } from '$lib/data/analytics';
  import { formatRp, formatRpC, formatDateShort } from '$lib/data/format';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { fabHandler } from '$lib/stores/fab';
  import TxSheet from '$lib/components/TxSheet.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { countUp } from '$lib/actions/countUp';
  import { confetti } from '$lib/fx/confetti';
  import { showToast } from '$lib/stores/toast';
  import type { SyncableRecord } from '$lib/db/dexie';

  // Dashboard's FAB is the fastest path to "catat transaksi" — tap it
  // and go straight to the add-transaction sheet without navigating
  // away from Home first.
  let sheetOpen = false;
  function openAdd() {
    sheetOpen = true;
  }
  let mounted = false;
  onMount(() => {
    fabHandler.set(openAdd);
    // Ring "savings rate" baru terisi setelah mount supaya animasinya kelihatan.
    requestAnimationFrame(() => (mounted = true));
  });
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

  // Includes debt_transfer/saving_transfer/transfer too — cash moving
  // in/out from paying off a debt, tapping a savings bucket, or moving
  // between your own wallets is still real activity and belongs in
  // "Transaksi Terbaru", not just plain income/expense. getDisplayType()
  // gives income/expense the correct +/- reading; transfer is rendered
  // neutrally below since it's neither a gain nor a loss.
  $: recent = [...$transactions]
    .filter(
      (t) =>
        t.type === 'income' ||
        t.type === 'expense' ||
        t.type === 'debt_transfer' ||
        t.type === 'saving_transfer' ||
        t.type === 'transfer'
    )
    .sort((a, b) => (b.date as string).localeCompare(a.date as string) || b.id.localeCompare(a.id))
    .slice(0, 5);

  // Pengeluaran 7 hari terakhir (hari ini paling kanan) untuk mini chart di hero.
  const p2 = (n: number) => String(n).padStart(2, '0');
  function lastDays(n: number): string[] {
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
    }
    return out;
  }
  $: spark = (() => {
    const days = lastDays(7);
    const sums = new Map<string, number>(days.map((d) => [d, 0]));
    for (const t of $transactions) {
      if (t.type === 'expense' && sums.has(t.date as string)) {
        sums.set(t.date as string, (sums.get(t.date as string) ?? 0) + (t.amount as number));
      }
    }
    return days.map((d) => sums.get(d) ?? 0);
  })();
  $: maxSpark = Math.max(...spark, 1);

  // Ring savings rate: keliling lingkaran r=32 → 201.
  const CIRC = 201;
  $: ringOffset = CIRC * (1 - Math.min(100, Math.max(2, savRate)) / 100);

  let flip = false;
  const quips = [
    'Dompet lu lagi sehat',
    'Jangan jajan boba dulu ya',
    'Cuan itu dicatat, bukan dikira-kira',
    'Satu koin hari ini, satu mimpi besok'
  ];
  function popCoin(e: MouseEvent) {
    flip = false;
    requestAnimationFrame(() => (flip = true));
    confetti(e.clientX, e.clientY);
    showToast(quips[Math.floor(Math.random() * quips.length)], 'info');
  }

  function walletOf(id: string) {
    return $wallets.find((w) => w.id === id);
  }

  function catOf(t: SyncableRecord) {
    const dt = getDisplayType(t);
    const custom = $customCategories.filter((c) => c.type === dt) as unknown as Cat[];
    return getCatList(dt, custom).find((c) => c.id === t.cat_id);
  }
</script>

<div class="page-wrap">
  <!-- Hero: total kekayaan + mini chart pengeluaran 7 hari -->
  <section class="hero-card span-all relative overflow-hidden rounded-2xl p-6" style="border: 2px solid var(--line); box-shadow: var(--shadow-lg)">
    <button
      on:click={popCoin}
      aria-label="Koin"
      class="coin-btn absolute right-4 top-3 {flip ? 'coin-flip' : ''}"
    >
      <Icon name="coin" size={60} />
    </button>
    <p class="text-sm font-semibold">Total kekayaan</p>
    <p class="text-4xl font-extrabold mt-1 tabular-nums" style="letter-spacing: -0.04em" use:countUp={{ value: netWorth, format: formatRp }}></p>
    <p class="text-sm font-semibold mt-2">{$wallets.length} dompet · pengeluaran 7 hari terakhir</p>
    <div class="flex items-end gap-1.5 h-12 mt-3" aria-hidden="true">
      {#each spark as v, i}
        <i
          class="spark-bar flex-1 rounded-t-md"
          style="height: {Math.max(8, (v / maxSpark) * 100)}%; background: {i === 6 ? 'var(--coin)' : 'color-mix(in srgb, currentColor 45%, transparent)'}; animation-delay: {i * 70}ms"
        ></i>
      {/each}
    </div>
  </section>

  <section class="grid grid-cols-2 gap-3">
    <div class="rounded-xl p-4 shadow-sm" style="background: var(--income-bg); border: 2px solid var(--line)">
      <p class="text-xs font-semibold flex items-center gap-1.5" style="color: var(--income)"><Icon name="down" size={14} /> Pemasukan</p>
      <p class="text-lg font-extrabold mt-1 tabular-nums" style="color: var(--income)" use:countUp={{ value: totals.income, format: formatRpC }}></p>
      <p class="text-[11px] text-txt-secondary">bulan ini</p>
    </div>
    <div class="rounded-xl p-4 shadow-sm" style="background: var(--expense-bg); border: 2px solid var(--line)">
      <p class="text-xs font-semibold flex items-center gap-1.5" style="color: var(--expense)"><Icon name="up" size={14} /> Pengeluaran</p>
      <p class="text-lg font-extrabold mt-1 tabular-nums" style="color: var(--expense)" use:countUp={{ value: totals.expense, format: formatRpC }}></p>
      <p class="text-[11px] text-txt-secondary">bulan ini</p>
    </div>
  </section>

  <!-- Savings rate sebagai ring yang terisi pelan-pelan -->
  <section class="bg-base-card rounded-xl shadow-sm p-4 border border-border flex items-center gap-4">
    <svg viewBox="0 0 80 80" class="w-24 h-24 shrink-0" style="transform: rotate(-90deg)" aria-hidden="true">
      <circle cx="40" cy="40" r="32" fill="none" stroke="var(--bg-card2)" stroke-width="12" />
      <circle
        class="ring-fill"
        cx="40"
        cy="40"
        r="32"
        fill="none"
        stroke={savRate >= 30 ? 'var(--income)' : savRate >= 10 ? 'var(--warn)' : 'var(--expense)'}
        stroke-width="12"
        stroke-dasharray={CIRC}
        stroke-dashoffset={mounted ? ringOffset : CIRC}
      />
    </svg>
    <div>
      <p class="text-xs font-semibold text-txt-secondary">Savings rate bulan ini</p>
      <p class="text-4xl font-extrabold tabular-nums" style="letter-spacing: -0.04em; color: {savRate >= 30 ? 'var(--income)' : savRate >= 10 ? 'var(--warn)' : 'var(--expense)'}">
        {savRate}%
      </p>
      <p class="text-sm text-txt-secondary">
        {savRate >= 30 ? 'Bagus! Dompet lu lagi sehat banget' : savRate >= 10 ? 'Lumayan, masih bisa lebih hemat' : 'Waduh, rem dikit ya'}
      </p>
    </div>
  </section>

  {#if $wallets.length > 0}
    <section class="bg-base-card rounded-xl shadow-sm p-4 border border-border">
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm font-extrabold text-txt-primary">Dompet</p>
        <button
          on:click={() => goto('/dompet')}
          class="text-xs font-semibold px-3 py-1.5 rounded-full"
          style="border: 2px solid var(--line); background: var(--bg-card)"
        >
          Lihat semua
        </button>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each $wallets as w (w.id)}
          <div class="shrink-0 rounded-lg px-3 py-2 min-w-[124px]" style="background: var(--bg-card2); border: 2px solid var(--line)">
            <p class="text-xs text-txt-secondary truncate">{w.emoji} {w.name}</p>
            <p class="text-sm font-extrabold mt-0.5">{formatRpC(stats[w.id]?.balance ?? 0)}</p>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section class="bg-base-card rounded-xl shadow-sm p-4 border border-border">
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-extrabold text-txt-primary">Transaksi terbaru</p>
      <button
        on:click={() => goto('/riwayat')}
        class="text-xs font-semibold px-3 py-1.5 rounded-full"
        style="border: 2px solid var(--line); background: var(--bg-card)"
      >
        Lihat semua
      </button>
    </div>
    {#if recent.length === 0}
      <p class="text-sm text-txt-secondary text-center py-8 span-all">
        Belum ada transaksi. Tap tombol + untuk mulai mencatat.
      </p>
    {/if}
    <div class="flex flex-col gap-3">
      {#each recent as t (t.id)}
        {@const cat = catOf(t)}
        {@const dt = getDisplayType(t)}
        {@const isTransfer = t.type === 'transfer'}
        <div class="flex items-center gap-3">
          <span class="em-tile" style="--k: {catColor(isTransfer ? 'transfer' : cat?.id)}">
            {#if isTransfer}<Icon name="swap" size={20} />{:else}{cat?.emoji ?? '💸'}{/if}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-txt-primary truncate">
              {isTransfer
                ? `${walletOf(t.wallet_id as string)?.name ?? ''} → ${walletOf(t.to_wallet_id as string)?.name ?? ''}`
                : t.description}
            </p>
            <p class="text-xs text-txt-secondary">{formatDateShort(t.date as string)}</p>
          </div>
          {#if isTransfer}
            <p class="text-sm font-extrabold shrink-0 text-txt-secondary tabular-nums">{formatRpC(t.amount as number)}</p>
          {:else}
            <p class="text-sm font-extrabold shrink-0 tabular-nums" style="color: {dt === 'income' ? 'var(--income)' : 'var(--expense)'}">
              {dt === 'income' ? '+' : '-'}{formatRpC(t.amount as number)}
            </p>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</div>

<TxSheet open={sheetOpen} editing={null} onClose={() => (sheetOpen = false)} />

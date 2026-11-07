<script lang="ts">
  import AssistantDock from '$lib/components/AssistantDock.svelte';
  import { catColor } from '$lib/data/catColor';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { wallets, transactions, customCategories, savingBuckets, savingTxs, debts } from '$lib/stores/data';
  import { computeWalletStats } from '$lib/data/wallets';
  import { getDateRange, calcTotals, getDisplayType, toAnalysisView } from '$lib/data/analytics';
  import { summarizePeriod } from '$lib/data/cashflow';
  import { getNetWorth } from '$lib/data/saving';
  import { formatRp, formatRpC, formatDateShort, todayStr } from '$lib/data/format';
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
  // Total kekayaan = dompet + isi kantong tabungan (menabung hanya memindahkan uang, bukan mengurangi kekayaan).
  $: worth = getNetWorth($wallets, $transactions, $savingBuckets, $savingTxs, $debts);
  $: netWorth = worth.total;

  $: range = getDateRange('month');
  // Angka pemasukan/pengeluaran memakai tampilan analisis (pemasukan "untuk bulan depan" dihitung di bulannya).
  $: analysisTxs = toAnalysisView($transactions);
  $: monthList = analysisTxs.filter(
    (t) =>
      (!range || ((t.date as string) >= range.from && (t.date as string) <= range.to)) &&
      t.type !== 'transfer'
  );
  $: totals = calcTotals(monthList);
  // Savings rate sadar "sisa bulan lalu" (lihat lib/data/cashflow.ts): pengeluaran yang dibayar dari
  // gaji bulan lalu tidak lagi dianggap defisit. Kalau pemasukan >= pengeluaran, hasilnya sama seperti dulu.
  $: sum = range
    ? summarizePeriod($wallets, $transactions, range.from, range.to)
    : summarizePeriod($wallets, $transactions, todayStr().slice(0, 8) + '01', todayStr());
  $: savRate = Math.max(0, sum.rate);
  // Persen yang mengisi ring: savings rate, atau sisa dana bulan lalu yang belum terpakai.
  $: ringPct =
    sum.status === 'covered'
      ? Math.round((sum.carryLeft / Math.max(1, sum.carry)) * 100)
      : sum.status === 'deficit'
        ? 0
        : savRate;
  $: ringColor = ringPct >= 30 ? 'var(--income)' : ringPct >= 10 ? 'var(--warn)' : 'var(--expense)';

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
  $: ringOffset = CIRC * (1 - Math.min(100, Math.max(2, ringPct)) / 100);

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
    <p class="text-sm font-semibold mt-2">Dompet {formatRpC(worth.wallets)} · Tabungan {formatRpC(worth.savings)}</p>
    {#if worth.receivable > 0 || worth.payable > 0}
      <p class="text-xs mt-0.5 opacity-90">
        {#if worth.receivable > 0}Piutang +{formatRpC(worth.receivable)}{/if}{#if worth.receivable > 0 && worth.payable > 0} · {/if}{#if worth.payable > 0}Hutang −{formatRpC(worth.payable)}{/if}
      </p>
    {/if}
    <p class="text-xs mt-0.5 opacity-80">pengeluaran 7 hari terakhir</p>
    <div class="flex items-end gap-1.5 h-12 mt-3" aria-hidden="true">
      {#each spark as v, i}
        <i
          class="spark-bar flex-1 rounded-t-md"
          style="height: {Math.max(8, (v / maxSpark) * 100)}%; background: {i === 6 ? 'var(--coin)' : 'color-mix(in srgb, currentColor 45%, transparent)'}; animation-delay: {i * 70}ms"
        ></i>
      {/each}
    </div>
  </section>

  <AssistantDock screen="dashboard" />

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
        stroke={ringColor}
        stroke-width="12"
        stroke-dasharray={CIRC}
        stroke-dashoffset={mounted ? ringOffset : CIRC}
      />
    </svg>
    <div>
      <p class="text-xs font-semibold text-txt-secondary">
        {sum.status === 'covered' ? 'Sisa dana dari bulan lalu' : sum.status === 'deficit' ? 'Pengeluaran melebihi dana' : 'Savings rate bulan ini'}
      </p>
      <p class="text-4xl font-extrabold tabular-nums" style="letter-spacing: -0.04em; color: {ringColor}">
        {#if sum.status === 'covered'}{formatRpC(sum.carryLeft)}{:else if sum.status === 'deficit'}-{formatRpC(sum.deficit)}{:else}{savRate}%{/if}
      </p>
      <p class="text-sm text-txt-secondary">
        {#if sum.status === 'covered'}
          Dipakai {formatRpC(sum.covered)} dari sisa bulan lalu {formatRpC(sum.carry)}. Aman, belum ada pemasukan baru.
        {:else if sum.status === 'deficit'}
          Sisa bulan lalu {formatRpC(sum.carry)} sudah habis, kurang {formatRpC(sum.deficit)}. Rem dikit ya
        {:else}
          {savRate >= 30 ? 'Bagus! Dompet lu lagi sehat banget' : savRate >= 10 ? 'Lumayan, masih bisa lebih hemat' : 'Waduh, rem dikit ya'}
        {/if}
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
        <button
          on:click={() => goto('/tabungan')}
          class="shrink-0 rounded-lg px-3 py-2 min-w-[124px] text-left"
          style="background: var(--bg-card2); border: 2px solid var(--line)"
        >
          <p class="text-xs text-txt-secondary truncate">🐷 Tabungan</p>
          <p class="text-sm font-extrabold mt-0.5">{formatRpC(worth.savings)}</p>
        </button>
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

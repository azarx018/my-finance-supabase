<script lang="ts">
  import AssistantDock from '$lib/components/AssistantDock.svelte';
  import { reveal } from '$lib/actions/reveal';
  import { catColor } from '$lib/data/catColor';
  import Icon from '$lib/components/Icon.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { budgets, transactions, customCategories } from '$lib/stores/data';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { getBudgetMonth, shiftMonth, monthLabelOf, effectiveBudget } from '$lib/data/budget';
  import { formatRpC } from '$lib/data/format';
  import { fabHandler } from '$lib/stores/fab';
  import { softDeleteRecord, upsertRecord, atomic } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import BudgetSheet from '$lib/components/BudgetSheet.svelte';
  import type { SyncableRecord } from '$lib/db/dexie';

  let sheetOpen = false;
  let editing: SyncableRecord | null = null;

  function openAdd() {
    if (isPast) {
      showToast('Budget bulan lalu hanya bisa dilihat', 'info');
      return;
    }
    editing = null;
    sheetOpen = true;
  }
  function openEdit(b: SyncableRecord) {
    editing = b;
    sheetOpen = true;
  }

  onMount(() => fabHandler.set(openAdd));
  onDestroy(() => fabHandler.set(null));

  // Navigasi bulan: bisa melihat bulan-bulan sebelumnya (read-only) dan merencanakan 1 bulan ke depan.
  const currentMonth = getBudgetMonth();
  const nextMonth = shiftMonth(currentMonth, 1);
  let month = currentMonth;
  $: isPast = month < currentMonth;
  $: isFuture = month > currentMonth;
  $: monthLabel = monthLabelOf(month);
  // Batas mundur: bulan paling awal yang punya budget atau pengeluaran (maksimal 24 bulan).
  $: earliest = (() => {
    let e = currentMonth;
    for (const b of $budgets) if ((b.month as string) < e) e = b.month as string;
    for (const t of $transactions) if (t.type === 'expense' && (t.date as string).slice(0, 7) < e) e = (t.date as string).slice(0, 7);
    const floor = shiftMonth(currentMonth, -24);
    return e < floor ? floor : e;
  })();
  $: canPrev = month > earliest;
  $: canNext = month < nextMonth;
  function go(delta: number) {
    month = shiftMonth(month, delta);
  }

  $: prevMonth = shiftMonth(month, -1);
  $: prevBudgets = $budgets.filter((b) => b.month === prevMonth);
  $: prevTxs = $transactions.filter((t) => (t.date as string).startsWith(prevMonth) && t.type === 'expense');
  /** Pemakaian kategori di bulan sebelumnya; null kalau bulan itu tidak ada pengeluaran sama sekali di kategori ini. */
  function prevMonthUsed(catId: string): number | null {
    const v = prevUsedFor(catId);
    return v > 0 || prevBudgets.some((b) => b.cat_id === catId) ? v : null;
  }
  function prevUsedFor(catId: string) {
    return prevTxs.filter((t) => t.cat_id === catId).reduce((s, t) => s + (t.amount as number), 0);
  }
  $: prevLimit = prevBudgets.reduce((s, b) => s + effectiveBudget($budgets, $transactions, b.cat_id as string, prevMonth).limit, 0);
  $: prevUsed = prevBudgets.reduce((s, b) => s + prevUsedFor(b.cat_id as string), 0);
  $: prevPct = prevLimit > 0 ? Math.round((prevUsed / prevLimit) * 100) : 0;

  $: monthBudgets = $budgets.filter((b) => b.month === month);
  $: monthTxs = $transactions.filter((t) => (t.date as string).startsWith(month) && t.type === 'expense');
  $: expenseCustom = $customCategories.filter((c) => c.type === 'expense') as unknown as Cat[];

  function catOf(id: string) {
    return getCatList('expense', expenseCustom).find((c) => c.id === id) ?? { id, name: id, emoji: '💸' };
  }
  function usedFor(catId: string) {
    return monthTxs.filter((t) => t.cat_id === catId).reduce((s, t) => s + (t.amount as number), 0);
  }

  // Limit efektif = limit + sisa bulan lalu (kalau rollover aktif) — lihat effectiveBudget() di lib/data/budget.ts.
  $: totalLimit = monthBudgets.reduce((s, b) => s + effectiveBudget($budgets, $transactions, b.cat_id as string, month).limit, 0);
  $: totalActualUsed = monthBudgets.reduce((s, b) => s + usedFor(b.cat_id as string), 0);
  $: totalRemain = totalLimit - totalActualUsed;
  $: pct = totalLimit > 0 ? Math.round((totalActualUsed / totalLimit) * 100) : 0;
  $: pctColor = pct >= 90 ? 'var(--expense)' : pct >= 70 ? 'var(--warn)' : 'var(--income)';
  $: tips =
    pct >= 90
      ? '⚠️ Budget hampir habis! Hemat pengeluaran.'
      : pct >= 70
        ? '💡 Sudah lebih dari 70%, perhatikan pengeluaran.'
        : '✅ Budget masih aman, terus pertahankan!';

  $: budgetedCatIds = monthBudgets.map((b) => b.cat_id as string);
  $: untracked = (() => {
    const map: Record<string, { name: string; emoji: string; total: number }> = {};
    monthTxs
      .filter((t) => !budgetedCatIds.includes(t.cat_id as string))
      .forEach((t) => {
        const cat = catOf(t.cat_id as string);
        const key = t.cat_id as string;
        if (!map[key]) map[key] = { name: cat.name, emoji: cat.emoji, total: 0 };
        map[key].total += t.amount as number;
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // Salin limit budget bulan sebelumnya ke bulan yang sedang dibuka (kategori yang sudah ada dilewati).
  $: copyable = prevBudgets.filter((b) => !monthBudgets.some((m) => m.cat_id === b.cat_id));
  async function copyFromPrev() {
    if (isPast || copyable.length === 0) return;
    await atomic(['budgets'], async () => {
      for (const b of copyable) {
        await upsertRecord('budgets', {
          cat_id: b.cat_id,
          limit_amount: b.limit_amount,
          month,
          ...(b.rollover === true ? { rollover: true } : {})
        });
      }
    });
    showToast(`${copyable.length} budget disalin dari ${monthLabelOf(prevMonth)}`);
  }

  async function removeBudget(id: string) {
    if (isPast) return;
    await softDeleteRecord('budgets', id);
    showToast('Budget dihapus', 'info');
  }
</script>

<div class="p-4 flex flex-col gap-4 page-wrap">
  <div class="flex items-center justify-between span-all">
    <button
      on:click={() => go(-1)}
      disabled={!canPrev}
      aria-label="Bulan sebelumnya"
      class="w-9 h-9 rounded-full border border-border bg-base-card text-lg leading-none disabled:opacity-30"
    >‹</button>
    <div class="text-center">
      <p class="text-sm font-extrabold text-txt-primary">{monthLabel}</p>
      {#if isPast}
        <p class="text-[10px] text-txt-secondary">Bulan lalu · hanya lihat</p>
      {:else if isFuture}
        <p class="text-[10px] text-txt-secondary">Rencana bulan depan</p>
      {:else}
        <p class="text-[10px] text-txt-secondary">Bulan ini</p>
      {/if}
    </div>
    <button
      on:click={() => go(1)}
      disabled={!canNext}
      aria-label="Bulan berikutnya"
      class="w-9 h-9 rounded-full border border-border bg-base-card text-lg leading-none disabled:opacity-30"
    >›</button>
  </div>

  {#if !isPast && prevBudgets.length > 0}
    <section class="bg-base-card rounded-xl shadow-sm p-3 border border-border span-all flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-txt-primary">{monthLabelOf(prevMonth)}</p>
        <p class="text-[11px] text-txt-secondary">
          Terpakai {formatRpC(prevUsed)} dari {formatRpC(prevLimit)} ({prevPct}%)
        </p>
      </div>
      <button on:click={() => go(-1)} class="text-[11px] underline text-txt-secondary shrink-0">Lihat detail</button>
      {#if copyable.length > 0}
        <button
          on:click={copyFromPrev}
          class="text-[11px] font-semibold px-3 py-1.5 rounded-full shrink-0"
          style="border: 2px solid var(--line); background: var(--coin); color: #12151f"
        >
          Salin budget
        </button>
      {/if}
    </section>
  {/if}

  <section class="grid grid-cols-3 gap-2 span-all">
    <div class="bg-base-card rounded-xl shadow-sm p-3 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Total Budget</p>
      <p class="text-sm font-semibold mt-1">{formatRpC(totalLimit)}</p>
    </div>
    <div class="bg-base-card rounded-xl shadow-sm p-3 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Terpakai</p>
      <p class="text-sm font-semibold mt-1">{formatRpC(totalActualUsed)}</p>
    </div>
    <div class="bg-base-card rounded-xl shadow-sm p-3 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Sisa</p>
      <p class="text-sm font-semibold mt-1" style="color: {totalRemain < 0 ? 'var(--expense)' : 'var(--income)'}">
        {formatRpC(Math.max(0, totalRemain))}
      </p>
    </div>
  </section>

  {#if monthBudgets.length > 0}
    <section class="bg-base-card rounded-xl shadow-sm p-4 border border-border span-all">
      <div class="flex items-center justify-between text-xs mb-2">
        <span class="text-txt-secondary">Total terpakai {pct}%</span>
        <span style="color: {pctColor}">{formatRpC(totalActualUsed)} / {formatRpC(totalLimit)}</span>
      </div>
      <div class="bar-track rounded-full overflow-hidden">
        <div class="h-full rounded-full" style="width: {Math.min(pct, 100)}%; background: {pctColor}"></div>
      </div>
      <p class="text-xs text-txt-secondary mt-2">{tips}</p>
    </section>
  {/if}

  <AssistantDock screen="budget" hidden={isPast} />

  {#if monthBudgets.length === 0}
    <p class="text-xs text-txt-secondary text-center py-12 span-all">
      {isPast ? 'Tidak ada budget di bulan ini.' : 'Belum ada budget. Tap + untuk mulai, atau salin dari bulan lalu.'}
    </p>
  {/if}

  <section class="grid grid-cols-1 min-[700px]:grid-cols-2 gap-3 span-all">
    {#each monthBudgets as b (b.id)}
      {@const cat = catOf(b.cat_id as string)}
      {@const used = usedFor(b.cat_id as string)}
      {@const eff = effectiveBudget($budgets, $transactions, b.cat_id as string, month)}
      {@const remain = eff.limit - used}
      {@const bpct = eff.limit > 0 ? Math.round((used / eff.limit) * 100) : 0}
      {@const bColor = bpct >= 90 ? 'var(--expense)' : bpct >= 70 ? 'var(--warn)' : 'var(--income)'}
      <div use:reveal class="bg-base-card rounded-xl shadow-sm p-4 border border-border">
        <div class="flex items-center gap-3">
          <span class="em-tile" style="--k: {catColor(cat?.id)}">{cat.emoji}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-txt-primary">{cat.name}</p>
            <p class="text-xs text-txt-secondary">
              {formatRpC(used)} dari {formatRpC(eff.limit)}{#if eff.carried > 0} <span class="text-[10px]">(+{formatRpC(eff.carried)} sisa bulan lalu)</span>{/if}
            </p>
            {#if prevMonthUsed(b.cat_id as string) !== null}
              <p class="text-[10px] text-txt-muted">{monthLabelOf(prevMonth).split(' ')[0]}: {formatRpC(prevMonthUsed(b.cat_id as string) ?? 0)}</p>
            {/if}
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-semibold" style="color: {remain < 0 ? 'var(--expense)' : 'var(--txt-primary)'}">
              {remain < 0 ? '-' : ''}{formatRpC(Math.abs(remain))}
            </p>
            <p class="text-[10px]" style="color: {bColor}">
              {bpct >= 100 ? 'OVER BUDGET' : bpct >= 70 ? 'Hampir Habis' : 'Aman'}
            </p>
          </div>
        </div>
        <div class="bar-track rounded-full overflow-hidden mt-3">
          <div class="h-full rounded-full" style="width: {Math.min(bpct, 100)}%; background: {bColor}"></div>
        </div>
        {#if !isPast}
        <div class="flex gap-2 mt-3">
          <button
            on:click={() => openEdit(b)}
            class="flex-1 text-xs py-2 rounded-lg border border-border text-txt-secondary"
          >
            <Icon name="edit" /> Edit
          </button>
          <button
            on:click={() => removeBudget(b.id)}
            class="flex-1 text-xs py-2 rounded-lg border border-border"
            style="color: var(--expense)"
          >
            <Icon name="trash" /> Hapus
          </button>
        </div>
        {/if}
      </div>
    {/each}
  </section>

  {#if untracked.length > 0}
    <section class="span-all">
      <p class="text-sm font-extrabold text-txt-primary mb-2">Pengeluaran Tanpa Budget</p>
      <div class="flex flex-col gap-2">
        {#each untracked as c}
          <div class="flex items-center gap-3 bg-base-card rounded-xl shadow-sm p-3 border border-border">
            <span class="text-lg">{c.emoji}</span>
            <p class="flex-1 text-sm text-txt-primary">{c.name}</p>
            <p class="text-sm font-semibold" style="color: var(--warn)">{formatRpC(c.total)}</p>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<BudgetSheet open={sheetOpen} {editing} {month} onClose={() => (sheetOpen = false)} />


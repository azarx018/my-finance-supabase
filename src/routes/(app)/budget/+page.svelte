<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { budgets, transactions, customCategories } from '$lib/stores/data';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { getBudgetMonth, getBudgetMonthLabel } from '$lib/data/budget';
  import { formatRpC } from '$lib/data/format';
  import { fabHandler } from '$lib/stores/fab';
  import { softDeleteRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import BudgetSheet from '$lib/components/BudgetSheet.svelte';
  import type { SyncableRecord } from '$lib/db/dexie';

  let sheetOpen = false;
  let editing: SyncableRecord | null = null;

  function openAdd() {
    editing = null;
    sheetOpen = true;
  }
  function openEdit(b: SyncableRecord) {
    editing = b;
    sheetOpen = true;
  }

  onMount(() => fabHandler.set(openAdd));
  onDestroy(() => fabHandler.set(null));

  $: month = getBudgetMonth();
  $: monthLabel = getBudgetMonthLabel();
  $: monthBudgets = $budgets.filter((b) => b.month === month);
  $: monthTxs = $transactions.filter((t) => (t.date as string).startsWith(month) && t.type === 'expense');
  $: expenseCustom = $customCategories.filter((c) => c.type === 'expense') as unknown as Cat[];

  function catOf(id: string) {
    return getCatList('expense', expenseCustom).find((c) => c.id === id) ?? { id, name: id, emoji: '💸' };
  }
  function usedFor(catId: string) {
    return monthTxs.filter((t) => t.cat_id === catId).reduce((s, t) => s + (t.amount as number), 0);
  }

  $: totalLimit = monthBudgets.reduce((s, b) => s + (b.limit_amount as number), 0);
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

  async function removeBudget(id: string) {
    await softDeleteRecord('budgets', id);
    showToast('Budget dihapus', 'info');
  }
</script>

<div class="p-4 flex flex-col gap-4 max-w-md mx-auto">
  <p class="text-xs text-txt-secondary text-center -mb-2">{monthLabel}</p>

  <section class="grid grid-cols-3 gap-2">
    <div class="bg-base-card rounded-lg p-3 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Total Budget</p>
      <p class="text-sm font-semibold mt-1">{formatRpC(totalLimit)}</p>
    </div>
    <div class="bg-base-card rounded-lg p-3 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Terpakai</p>
      <p class="text-sm font-semibold mt-1">{formatRpC(totalActualUsed)}</p>
    </div>
    <div class="bg-base-card rounded-lg p-3 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Sisa</p>
      <p class="text-sm font-semibold mt-1" style="color: {totalRemain < 0 ? 'var(--expense)' : 'var(--income)'}">
        {formatRpC(Math.max(0, totalRemain))}
      </p>
    </div>
  </section>

  {#if monthBudgets.length > 0}
    <section class="bg-base-card rounded-lg p-4 border border-border">
      <div class="flex items-center justify-between text-xs mb-2">
        <span class="text-txt-secondary">Total terpakai {pct}%</span>
        <span style="color: {pctColor}">{formatRpC(totalActualUsed)} / {formatRpC(totalLimit)}</span>
      </div>
      <div class="h-2 rounded-full bg-base-card2 overflow-hidden">
        <div class="h-full rounded-full" style="width: {Math.min(pct, 100)}%; background: {pctColor}"></div>
      </div>
      <p class="text-xs text-txt-secondary mt-2">{tips}</p>
    </section>
  {/if}

  {#if monthBudgets.length === 0}
    <p class="text-xs text-txt-secondary text-center py-12">Belum ada budget. Tap + untuk mulai.</p>
  {/if}

  <section class="flex flex-col gap-3">
    {#each monthBudgets as b (b.id)}
      {@const cat = catOf(b.cat_id as string)}
      {@const used = usedFor(b.cat_id as string)}
      {@const remain = (b.limit_amount as number) - used}
      {@const bpct = (b.limit_amount as number) > 0 ? Math.round((used / (b.limit_amount as number)) * 100) : 0}
      {@const bColor = bpct >= 90 ? 'var(--expense)' : bpct >= 70 ? 'var(--warn)' : 'var(--income)'}
      <div class="bg-base-card rounded-lg p-4 border border-border">
        <div class="flex items-center gap-3">
          <span class="text-xl">{cat.emoji}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-txt-primary">{cat.name}</p>
            <p class="text-xs text-txt-secondary">{formatRpC(used)} dari {formatRpC(b.limit_amount as number)}</p>
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
        <div class="h-1.5 rounded-full bg-base-card2 overflow-hidden mt-3">
          <div class="h-full rounded-full" style="width: {Math.min(bpct, 100)}%; background: {bColor}"></div>
        </div>
        <div class="flex gap-2 mt-3">
          <button
            on:click={() => openEdit(b)}
            class="flex-1 text-xs py-2 rounded-lg border border-border text-txt-secondary"
          >
            ✏️ Edit
          </button>
          <button
            on:click={() => removeBudget(b.id)}
            class="flex-1 text-xs py-2 rounded-lg border border-border"
            style="color: var(--expense)"
          >
            🗑️ Hapus
          </button>
        </div>
      </div>
    {/each}
  </section>

  {#if untracked.length > 0}
    <section>
      <p class="text-xs font-medium text-txt-secondary mb-2">Pengeluaran Tanpa Budget</p>
      <div class="flex flex-col gap-2">
        {#each untracked as c}
          <div class="flex items-center gap-3 bg-base-card rounded-lg p-3 border border-border">
            <span class="text-lg">{c.emoji}</span>
            <p class="flex-1 text-sm text-txt-primary">{c.name}</p>
            <p class="text-sm font-semibold" style="color: var(--warn)">{formatRpC(c.total)}</p>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<BudgetSheet open={sheetOpen} {editing} onClose={() => (sheetOpen = false)} />

<script lang="ts">
  import { findCat, type Cat } from '$lib/data/categories';
  import { parseAmt, formatRpC } from '$lib/data/format';
  import type { ProposeBudgetArgs } from '$lib/ai/assistant';

  export let args: ProposeBudgetArgs;
  export let categories: Cat[] = []; // custom expense categories, for name/emoji lookup
  export let availableIncome: number | null = null;
  export let applied = false;
  export let onApply: (allocations: Array<{ category_id: string; amount: number }>) => void;
  export let onDismiss: () => void;

  // Own copy so edits here don't mutate the chat history's record of
  // what the AI actually proposed — matches the same "review before
  // apply" principle as TxSheet's OCR autofill.
  let allocations = args.allocations.map((a) => ({ ...a }));

  $: total = allocations.reduce((s, a) => s + (a.amount || 0), 0);
  $: remaining = availableIncome != null ? availableIncome - total : null;

  function onAmountInput(i: number, e: Event) {
    allocations[i].amount = parseAmt((e.target as HTMLInputElement).value);
    allocations = allocations;
  }

  function monthLabel(m: string): string {
    const [y, mm] = m.split('-').map(Number);
    if (!y || !mm) return m;
    return new Date(y, mm - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }
</script>

<div class="rounded-xl border p-3 flex flex-col gap-2 bg-base-card max-w-[90%]" style="border-color: var(--primary)">
  <p class="text-xs font-semibold text-txt-primary">🤖 Usulan Budget — {monthLabel(args.month)}</p>
  {#if args.reasoning}
    <p class="text-xs text-txt-secondary">{args.reasoning}</p>
  {/if}

  <div class="flex flex-col gap-1.5 mt-1">
    {#each allocations as a, i (a.category_id)}
      {@const cat = findCat(a.category_id, 'expense', categories)}
      <div class="flex items-center gap-2">
        <span class="text-xs flex-1 text-txt-primary">{cat?.emoji ?? '💸'} {cat?.name ?? a.category_id}</span>
        <input
          value={a.amount.toLocaleString('id-ID')}
          on:input={(e) => onAmountInput(i, e)}
          inputmode="numeric"
          disabled={applied}
          class="w-28 text-right text-xs rounded-md border border-border bg-base-input px-2 py-1.5 text-txt-primary disabled:opacity-60"
        />
      </div>
    {/each}
  </div>

  <div class="flex justify-between text-xs pt-2 mt-1 border-t border-border">
    <span class="text-txt-secondary">Total dialokasikan</span>
    <span class="font-semibold text-txt-primary">{formatRpC(total)}</span>
  </div>
  {#if remaining != null}
    <div class="flex justify-between text-xs">
      <span class="text-txt-secondary">Sisa belum dialokasikan</span>
      <span class="font-semibold" style="color: {remaining < 0 ? 'var(--expense)' : 'var(--txt-secondary)'}">
        {formatRpC(remaining)}
      </span>
    </div>
  {/if}

  {#if applied}
    <p class="text-xs text-center py-1.5 font-medium" style="color: var(--income)">✅ Sudah diterapkan</p>
  {:else}
    <div class="flex gap-2 pt-1">
      <button on:click={onDismiss} class="flex-1 text-xs py-2 rounded-lg border border-border text-txt-secondary">
        Batalkan
      </button>
      <button
        on:click={() => onApply(allocations)}
        class="flex-1 text-xs py-2 rounded-lg text-white font-medium"
        style="background: var(--primary)"
      >
        Terapkan Budget
      </button>
    </div>
  {/if}
</div>

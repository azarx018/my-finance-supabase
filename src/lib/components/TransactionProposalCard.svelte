<script lang="ts">
  import { findCat, type Cat } from '$lib/data/categories';
  import { parseAmt, formatRpC } from '$lib/data/format';
  import type { ProposeTransactionArgs } from '$lib/ai/assistant';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let args: ProposeTransactionArgs;
  export let expenseCategories: Cat[] = [];
  export let incomeCategories: Cat[] = [];
  export let wallets: SyncableRecord[] = [];
  export let walletBalances: Record<string, number> = {};
  // Kombo #2: budget-overrun warning. Both keyed by cat_id, both already
  // computed for the chat's own context — passed straight through
  // rather than recomputed, so the warning always matches what the
  // assistant itself was reasoning from.
  export let existingBudget: Record<string, number> = {};
  export let spentThisMonth: Record<string, number> = {};
  export let applied = false;
  export let onApply: (data: {
    type: 'income' | 'expense';
    amount: number;
    description: string;
    categoryId: string;
    date: string;
    walletId: string;
  }) => void;
  export let onDismiss: () => void;

  let type = args.type;
  let amountStr = args.amount.toLocaleString('id-ID');
  let description = args.description;
  let categoryId = args.category_id;
  let date = args.date;
  let walletId = wallets.some((w) => w.id === args.wallet_id) ? args.wallet_id : (wallets[0]?.id ?? '');

  $: catList = type === 'income' ? incomeCategories : expenseCategories;
  // Category picked for one type might not exist in the other's list —
  // reset to the first available whenever the type toggle changes.
  $: if (!catList.some((c) => c.id === categoryId)) categoryId = catList[0]?.id ?? '';

  $: amount = parseAmt(amountStr);
  $: selectedBalance = walletBalances[walletId] ?? 0;
  $: insufficientFunds = type === 'expense' && amount > 0 && amount > selectedBalance;

  $: budgetLimit = existingBudget[categoryId];
  $: alreadySpent = spentThisMonth[categoryId] ?? 0;
  $: overBudget =
    type === 'expense' && budgetLimit != null && amount > 0 && alreadySpent + amount > budgetLimit;

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  function handleApply() {
    if (!description.trim() || !amount || !categoryId || !walletId) return;
    onApply({ type, amount, description: description.trim(), categoryId, date, walletId });
  }
</script>

<div class="rounded-xl border p-3 flex flex-col gap-2 bg-base-card max-w-[90%]" style="border-color: var(--primary)">
  <p class="text-xs font-semibold text-txt-primary">
    {type === 'income' ? '💰' : '🧾'} Usulan Transaksi {type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
  </p>

  <div class="flex gap-2">
    <button
      type="button"
      on:click={() => (type = 'income')}
      disabled={applied}
      class="flex-1 text-xs py-1.5 rounded-lg border disabled:opacity-60"
      style="border-color: {type === 'income' ? 'var(--income)' : 'var(--border)'}; background: {type === 'income'
        ? 'var(--income-bg, rgba(22,163,74,0.1))'
        : 'var(--bg-card)'}; color: {type === 'income' ? 'var(--income)' : 'var(--txt-secondary)'}"
    >
      Pemasukan
    </button>
    <button
      type="button"
      on:click={() => (type = 'expense')}
      disabled={applied}
      class="flex-1 text-xs py-1.5 rounded-lg border disabled:opacity-60"
      style="border-color: {type === 'expense' ? 'var(--expense)' : 'var(--border)'}; background: {type === 'expense'
        ? 'var(--expense-bg, rgba(220,38,38,0.1))'
        : 'var(--bg-card)'}; color: {type === 'expense' ? 'var(--expense)' : 'var(--txt-secondary)'}"
    >
      Pengeluaran
    </button>
  </div>

  <input
    value={amountStr}
    on:input={onAmountInput}
    inputmode="numeric"
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />
  <input
    bind:value={description}
    disabled={applied}
    placeholder="Deskripsi"
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  <select
    bind:value={categoryId}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  >
    {#each catList as c (c.id)}
      <option value={c.id}>{c.emoji} {c.name}</option>
    {/each}
  </select>

  <select
    bind:value={walletId}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  >
    {#each wallets as w (w.id)}
      <option value={w.id}>{w.emoji} {w.name} — saldo {formatRpC(walletBalances[w.id] ?? 0)}</option>
    {/each}
  </select>

  <input
    type="date"
    bind:value={date}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  {#if insufficientFunds && !applied}
    <p class="text-[10px]" style="color: var(--expense)">Saldo dompet ini tidak cukup untuk jumlah segini.</p>
  {/if}
  {#if overBudget && !applied}
    {@const cat = findCat(categoryId, 'expense', expenseCategories)}
    <p class="text-[10px]" style="color: var(--warn, #eab308)">
      ⚠️ Ini bakal bikin {cat?.name ?? categoryId} tembus budget ({formatRpC(alreadySpent + amount)} dari limit {formatRpC(
        budgetLimit ?? 0
      )})
    </p>
  {/if}

  {#if applied}
    <p class="text-xs text-center py-1.5 font-medium" style="color: var(--income)">✅ Sudah diterapkan</p>
  {:else}
    <div class="flex gap-2 pt-1">
      <button on:click={onDismiss} class="flex-1 text-xs py-2 rounded-lg border border-border text-txt-secondary">
        Batalkan
      </button>
      <button
        on:click={handleApply}
        disabled={insufficientFunds || !description.trim() || !amount || !categoryId || !walletId}
        class="flex-1 text-xs py-2 rounded-lg text-white font-medium disabled:opacity-40"
        style="background: var(--primary)"
      >
        Simpan Transaksi
      </button>
    </div>
  {/if}
</div>

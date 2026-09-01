<script lang="ts">
  import { parseAmt, formatRpC } from '$lib/data/format';
  import type { ProposeDebtArgs } from '$lib/ai/assistant';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let args: ProposeDebtArgs;
  export let wallets: SyncableRecord[] = [];
  export let walletBalances: Record<string, number> = {};
  export let applied = false;
  export let onApply: (data: {
    dtype: 'borrowed' | 'lent';
    name: string;
    amount: number;
    dueDate: string;
    walletId: string;
  }) => void;
  export let onDismiss: () => void;

  let dtype = args.dtype;
  let name = args.name;
  let amountStr = args.amount.toLocaleString('id-ID');
  let dueDate = args.due_date ?? '';
  let walletId = wallets.some((w) => w.id === args.wallet_id) ? args.wallet_id : (wallets[0]?.id ?? '');

  $: amount = parseAmt(amountStr);

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  function handleApply() {
    if (!name.trim() || !amount || !dueDate || !walletId) return;
    onApply({ dtype, name: name.trim(), amount, dueDate, walletId });
  }
</script>

<div class="rounded-xl border p-3 flex flex-col gap-2 bg-base-card max-w-[90%]" style="border-color: var(--primary)">
  <p class="text-xs font-semibold text-txt-primary">💳 Usulan {dtype === 'borrowed' ? 'Hutang' : 'Piutang'} Baru</p>
  {#if args.reasoning}
    <p class="text-xs text-txt-secondary">{args.reasoning}</p>
  {/if}

  <div class="flex gap-2">
    <button
      type="button"
      on:click={() => (dtype = 'borrowed')}
      disabled={applied}
      class="flex-1 text-xs py-1.5 rounded-lg border disabled:opacity-60"
      style="border-color: {dtype === 'borrowed' ? 'var(--primary)' : 'var(--border)'}; background: {dtype === 'borrowed'
        ? 'var(--primary-bg)'
        : 'var(--bg-card)'}; color: {dtype === 'borrowed' ? 'var(--primary)' : 'var(--txt-secondary)'}"
    >
      Hutang (saya pinjam)
    </button>
    <button
      type="button"
      on:click={() => (dtype = 'lent')}
      disabled={applied}
      class="flex-1 text-xs py-1.5 rounded-lg border disabled:opacity-60"
      style="border-color: {dtype === 'lent' ? 'var(--info)' : 'var(--border)'}; background: {dtype === 'lent'
        ? 'var(--info-bg)'
        : 'var(--bg-card)'}; color: {dtype === 'lent' ? 'var(--info)' : 'var(--txt-secondary)'}"
    >
      Piutang (saya pinjamkan)
    </button>
  </div>

  <label class="text-[10px] text-txt-secondary" for="debt-c-name">{dtype === 'borrowed' ? 'Hutang dari' : 'Dipinjamkan ke'}</label>
  <input
    id="debt-c-name"
    bind:value={name}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  <label class="text-[10px] text-txt-secondary" for="debt-c-amount">Jumlah</label>
  <input
    id="debt-c-amount"
    value={amountStr}
    on:input={onAmountInput}
    inputmode="numeric"
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  <label class="text-[10px] text-txt-secondary" for="debt-c-due">Jatuh tempo</label>
  <input
    id="debt-c-due"
    type="date"
    bind:value={dueDate}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  <label class="text-[10px] text-txt-secondary" for="debt-c-wallet">
    {dtype === 'borrowed' ? 'Dompet penerima (saldo masuk)' : 'Dompet sumber (saldo keluar)'}
  </label>
  <select
    id="debt-c-wallet"
    bind:value={walletId}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  >
    {#each wallets as w (w.id)}
      <option value={w.id}>{w.emoji} {w.name} — saldo {formatRpC(walletBalances[w.id] ?? 0)}</option>
    {/each}
  </select>

  {#if applied}
    <p class="text-xs text-center py-1.5 font-medium" style="color: var(--income)">✅ Sudah diterapkan</p>
  {:else}
    <div class="flex gap-2 pt-1">
      <button on:click={onDismiss} class="flex-1 text-xs py-2 rounded-lg border border-border text-txt-secondary">
        Batalkan
      </button>
      <button
        on:click={handleApply}
        disabled={!name.trim() || !amount || !dueDate || !walletId}
        class="flex-1 text-xs py-2 rounded-lg text-white font-medium disabled:opacity-40"
        style="background: {dtype === 'borrowed' ? 'var(--primary)' : 'var(--info)'}"
      >
        Simpan {dtype === 'borrowed' ? 'Hutang' : 'Piutang'}
      </button>
    </div>
  {/if}
</div>

<script lang="ts">
  import { parseAmt, formatRpC } from '$lib/data/format';
  import type { ProposeDebtPaymentArgs } from '$lib/ai/assistant';
  import type { ActiveDebtInfo } from '$lib/data/analytics';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let args: ProposeDebtPaymentArgs;
  export let debts: ActiveDebtInfo[] = [];
  export let wallets: SyncableRecord[] = [];
  export let walletBalances: Record<string, number> = {};
  export let applied = false;
  export let onApply: (data: { amount: number; walletId: string }) => void;
  export let onDismiss: () => void;

  $: debt = debts.find((d) => d.id === args.debt_id);

  let amountStr = args.amount.toLocaleString('id-ID');
  let walletId = wallets.some((w) => w.id === args.wallet_id) ? args.wallet_id : (wallets[0]?.id ?? '');

  $: amount = parseAmt(amountStr);
  $: overpaying = debt != null && amount > debt.remaining;

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  function handleApply() {
    if (!amount || !walletId) return;
    onApply({ amount, walletId });
  }
</script>

<div class="rounded-xl border p-3 flex flex-col gap-2 bg-base-card max-w-[90%]" style="border-color: var(--primary)">
  <p class="text-xs font-semibold text-txt-primary">
    💸 Usulan {debt?.dtype === 'lent' ? 'Terima Pembayaran' : 'Bayar Hutang'}
  </p>
  {#if args.reasoning}
    <p class="text-xs text-txt-secondary">{args.reasoning}</p>
  {/if}

  {#if !debt}
    <p class="text-xs" style="color: var(--expense)">Hutang ini sudah tidak ditemukan (mungkin sudah lunas/dihapus).</p>
  {:else}
    <div class="rounded-lg border border-border p-2 text-xs">
      <p class="font-medium text-txt-primary">{debt.name}</p>
      <p class="text-txt-secondary">Sisa: {formatRpC(debt.remaining)}</p>
    </div>

    <label class="text-[10px] text-txt-secondary" for="debtpay-amount">Jumlah bayar</label>
    <input
      id="debtpay-amount"
      value={amountStr}
      on:input={onAmountInput}
      inputmode="numeric"
      disabled={applied}
      class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
    />

    <label class="text-[10px] text-txt-secondary" for="debtpay-wallet">
      {debt.dtype === 'lent' ? 'Dompet penerima' : 'Dompet sumber'}
    </label>
    <select
      id="debtpay-wallet"
      bind:value={walletId}
      disabled={applied}
      class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
    >
      {#each wallets as w (w.id)}
        <option value={w.id}>{w.emoji} {w.name} — saldo {formatRpC(walletBalances[w.id] ?? 0)}</option>
      {/each}
    </select>

    {#if overpaying && !applied}
      <p class="text-[10px]" style="color: var(--warn, #eab308)">
        Jumlah ini lebih besar dari sisa hutang ({formatRpC(debt.remaining)}).
      </p>
    {/if}
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
        disabled={!debt || !amount || !walletId}
        class="flex-1 text-xs py-2 rounded-lg text-white font-medium disabled:opacity-40"
        style="background: var(--primary)"
      >
        Simpan Pembayaran
      </button>
    </div>
  {/if}
</div>

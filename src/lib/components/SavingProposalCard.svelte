<script lang="ts">
  import { parseAmt, formatRpC } from '$lib/data/format';
  import type { ProposeSavingArgs } from '$lib/ai/assistant';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let args: ProposeSavingArgs;
  export let wallets: SyncableRecord[] = [];
  export let walletBalances: Record<string, number> = {}; // id -> current balance, for the picker + insufficient-funds check
  export let applied = false;
  export let onApply: (data: { name: string; amount: number; walletId: string }) => void;
  export let onDismiss: () => void;

  // Own editable copy — same "review before apply" principle as the
  // budget card and TxSheet's OCR autofill.
  let name = args.name;
  let amountStr = args.amount.toLocaleString('id-ID');
  let walletId = args.wallet_id && wallets.some((w) => w.id === args.wallet_id) ? args.wallet_id : (wallets[0]?.id ?? '');

  $: amount = parseAmt(amountStr);
  $: selectedBalance = walletBalances[walletId] ?? 0;
  $: insufficientFunds = amount > 0 && amount > selectedBalance;

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  function handleApply() {
    if (!name.trim() || !amount || !walletId) return;
    onApply({ name: name.trim(), amount, walletId });
  }
</script>

<div class="rounded-xl border p-3 flex flex-col gap-2 bg-base-card max-w-[90%]" style="border-color: var(--primary)">
  <p class="text-xs font-semibold text-txt-primary">🐷 Usulan Tabungan Baru</p>
  {#if args.reasoning}
    <p class="text-xs text-txt-secondary">{args.reasoning}</p>
  {/if}

  <label class="text-[10px] text-txt-secondary" for="saving-name">Nama kantong</label>
  <input
    id="saving-name"
    bind:value={name}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  <label class="text-[10px] text-txt-secondary" for="saving-amount">Nominal</label>
  <input
    id="saving-amount"
    value={amountStr}
    on:input={onAmountInput}
    inputmode="numeric"
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  <label class="text-[10px] text-txt-secondary" for="saving-wallet">Ambil dari dompet</label>
  <select
    id="saving-wallet"
    bind:value={walletId}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  >
    {#each wallets as w (w.id)}
      <option value={w.id}>{w.emoji} {w.name} — saldo {formatRpC(walletBalances[w.id] ?? 0)}</option>
    {/each}
  </select>

  {#if insufficientFunds && !applied}
    <p class="text-[10px]" style="color: var(--expense)">Saldo dompet ini tidak cukup untuk jumlah segini.</p>
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
        disabled={insufficientFunds || !name.trim() || !amount || !walletId}
        class="flex-1 text-xs py-2 rounded-lg text-white font-medium disabled:opacity-40"
        style="background: var(--primary)"
      >
        Buat Tabungan
      </button>
    </div>
  {/if}
</div>

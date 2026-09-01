<script lang="ts">
  import { WALLET_EMOJIS } from '$lib/data/categories';
  import { parseAmt } from '$lib/data/format';
  import type { ProposeWalletArgs } from '$lib/ai/assistant';

  export let args: ProposeWalletArgs;
  export let applied = false;
  export let onApply: (data: { name: string; emoji: string; initialBalance: number }) => void;
  export let onDismiss: () => void;

  let name = args.name;
  let emoji = WALLET_EMOJIS[0];
  let balanceStr = args.initial_balance > 0 ? args.initial_balance.toLocaleString('id-ID') : '';

  function onBalanceInput(e: Event) {
    balanceStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  function handleApply() {
    if (!name.trim()) return;
    onApply({ name: name.trim(), emoji, initialBalance: parseAmt(balanceStr) });
  }
</script>

<div class="rounded-xl border p-3 flex flex-col gap-2 bg-base-card max-w-[90%]" style="border-color: var(--primary)">
  <p class="text-xs font-semibold text-txt-primary">👛 Usulan Dompet Baru</p>
  {#if args.reasoning}
    <p class="text-xs text-txt-secondary">{args.reasoning}</p>
  {/if}

  <div class="flex gap-2 overflow-x-auto pb-1">
    {#each WALLET_EMOJIS as e}
      <button
        type="button"
        on:click={() => (emoji = e)}
        disabled={applied}
        class="w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center text-base disabled:opacity-60"
        style="border-color: {emoji === e ? 'var(--primary)' : 'var(--border)'}; background: {emoji === e
          ? 'var(--primary-bg)'
          : 'var(--bg-card)'}"
      >
        {e}
      </button>
    {/each}
  </div>

  <label class="text-[10px] text-txt-secondary" for="wallet-name">Nama dompet</label>
  <input
    id="wallet-name"
    bind:value={name}
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  <label class="text-[10px] text-txt-secondary" for="wallet-balance">Saldo awal (opsional)</label>
  <input
    id="wallet-balance"
    value={balanceStr}
    on:input={onBalanceInput}
    inputmode="numeric"
    placeholder="Rp 0"
    disabled={applied}
    class="w-full rounded-md border border-border bg-base-input px-2.5 py-2 text-xs text-txt-primary disabled:opacity-60"
  />

  {#if applied}
    <p class="text-xs text-center py-1.5 font-medium" style="color: var(--income)">✅ Sudah diterapkan</p>
  {:else}
    <div class="flex gap-2 pt-1">
      <button on:click={onDismiss} class="flex-1 text-xs py-2 rounded-lg border border-border text-txt-secondary">
        Batalkan
      </button>
      <button
        on:click={handleApply}
        disabled={!name.trim()}
        class="flex-1 text-xs py-2 rounded-lg text-white font-medium disabled:opacity-40"
        style="background: var(--primary)"
      >
        Buat Dompet
      </button>
    </div>
  {/if}
</div>

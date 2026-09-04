<script lang="ts">
  import type { RememberFactArgs } from '$lib/ai/assistant';

  export let args: RememberFactArgs;
  export let applied = false;
  export let onApply: () => void;
  export let onDismiss: () => void;
</script>

<div class="rounded-xl border p-3 flex flex-col gap-2 bg-base-card max-w-[90%]" style="border-color: var(--primary)">
  <p class="text-xs font-semibold text-txt-primary">🧠 Inget ini?</p>
  <p class="text-xs text-txt-secondary">"{args.content}"</p>

  {#if applied}
    <p class="text-xs text-center py-1 font-medium" style="color: var(--income)">✅ Sudah diinget</p>
  {:else}
    <div class="flex gap-2">
      <button on:click={onDismiss} class="flex-1 text-xs py-1.5 rounded-lg border border-border text-txt-secondary">
        Nggak usah
      </button>
      <button
        on:click={onApply}
        class="flex-1 text-xs py-1.5 rounded-lg text-white font-medium"
        style="background: var(--primary)"
      >
        Ya, inget
      </button>
    </div>
  {/if}
</div>

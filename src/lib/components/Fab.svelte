<script lang="ts">
  import { FAB_VISIBLE_PAGES, FAB_VARIANT } from '$lib/nav/config';

  export let pageId: string;
  export let onClick: () => void = () => {};

  $: visible = FAB_VISIBLE_PAGES.includes(pageId);
  $: variant = FAB_VARIANT[pageId] ?? 'default';

  const bg: Record<string, string> = {
    default: 'var(--primary)',
    wallet: 'var(--info)',
    expense: 'var(--expense)'
  };
</script>

{#if visible}
  <button
    on:click={onClick}
    aria-label="Tambah"
    class="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-30"
    style="background: {bg[variant]}"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-6 h-6">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </button>
{/if}

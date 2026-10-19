<script lang="ts">
  import { FAB_VISIBLE_PAGES, FAB_VARIANT } from '$lib/nav/config';

  export let pageId: string;
  export let onClick: () => void = () => {};

  $: visible = FAB_VISIBLE_PAGES.includes(pageId);
  $: variant = FAB_VARIANT[pageId] ?? 'default';

  const bg: Record<string, string> = {
    default: 'var(--coin)',
    wallet: 'var(--info)',
    expense: 'var(--expense)'
  };
  const fg: Record<string, string> = {
    default: '#12151f',
    wallet: '#ffffff',
    expense: '#ffffff'
  };
</script>

{#if visible}
  <button
    on:click={onClick}
    aria-label="Tambah"
    class="fab"
    style="background: {bg[variant]}; color: {fg[variant]}"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="w-7 h-7">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </button>
{/if}

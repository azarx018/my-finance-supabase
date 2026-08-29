<script lang="ts">
  import { goto } from '$app/navigation';
  import { NAV_ITEMS } from '$lib/nav/config';

  export let pageId: string;
</script>

<nav
  class="h-16 border-t border-border bg-base-nav/95 backdrop-blur flex items-stretch fixed bottom-0 inset-x-0 z-20"
>
  {#each NAV_ITEMS as item (item.id)}
    <button
      on:click={() => goto(item.path)}
      class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
      style={pageId === item.id ? 'color: var(--primary)' : 'color: var(--txt-secondary)'}
    >
      <span
        class="flex items-center justify-center w-9 h-6 rounded-full transition-colors"
        style={pageId === item.id ? 'background: var(--primary-bg)' : 'background: transparent'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          {@html item.iconPath}
        </svg>
      </span>
      <span>{item.label}</span>
    </button>
  {/each}
</nav>

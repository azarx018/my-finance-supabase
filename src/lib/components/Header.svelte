<script lang="ts">
  import { goto } from '$app/navigation';
  import { PAGE_TITLES } from '$lib/nav/config';
  import { darkMode } from '$lib/stores/ui';

  export let pageId: string;
  export let isSubPage: boolean;
</script>

<header
  class="h-14 flex items-center justify-between px-4 border-b border-border bg-base-nav sticky top-0 z-20"
>
  <div class="flex items-center gap-2 min-w-0">
    {#if isSubPage}
      <button
        on:click={() => history.back()}
        aria-label="Kembali"
        class="w-8 h-8 flex items-center justify-center text-txt-secondary shrink-0"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    {:else}
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style="background: linear-gradient(135deg, var(--primary), var(--primary-light))"
      >
        <div class="w-2.5 h-2.5 rounded-full bg-white/90"></div>
      </div>
    {/if}
    <span class="text-sm font-semibold truncate">{PAGE_TITLES[pageId] ?? ''}</span>
  </div>

  <div class="flex items-center gap-1 shrink-0">
    <button
      on:click={() => goto('/lainnya')}
      aria-label="Menu lainnya"
      class="w-9 h-9 flex items-center justify-center text-txt-secondary"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
    <button
      on:click={() => darkMode.update((v) => !v)}
      aria-label="Ganti mode gelap/terang"
      class="w-9 h-9 flex items-center justify-center text-txt-secondary text-base"
    >
      {$darkMode ? '☀️' : '🌙'}
    </button>
  </div>
</header>

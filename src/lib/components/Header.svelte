<script lang="ts">
  import { goto } from '$app/navigation';
  import { PAGE_TITLES } from '$lib/nav/config';
  import { darkMode } from '$lib/stores/ui';
  import { onMount } from 'svelte';

  export let pageId: string;
  export let isSubPage: boolean;

  // Moved out of a top-of-screen banner (too intrusive/annoying per
  // feedback) and into a small status icon next to the "⋯" menu:
  // a plain signal icon when online, a slashed one when offline.
  let online = true;
  onMount(() => {
    online = navigator.onLine;
    const goOnline = () => (online = true);
    const goOffline = () => (online = false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  });
</script>

<header
  class="h-16 flex items-center justify-between px-5 min-[900px]:px-8 sticky top-0 z-20 backdrop-blur"
  style="background: color-mix(in srgb, var(--bg-base) 85%, transparent)"
>
  <div class="flex items-center gap-2 min-w-0">
    {#if isSubPage}
      <button
        on:click={() => history.back()}
        aria-label="Kembali"
        class="w-10 h-10 grid place-items-center shrink-0 rounded-xl"
        style="border: 2px solid var(--ink); background: var(--bg-card)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="w-5 h-5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    {/if}
    <h1 class="text-2xl min-[900px]:text-3xl font-extrabold tracking-tight truncate" style="letter-spacing: -0.04em">
      {PAGE_TITLES[pageId] ?? ''}
    </h1>
  </div>

  <div class="flex items-center gap-2 shrink-0">
    <div
      class="w-10 h-10 grid place-items-center"
      style="color: {online ? 'var(--txt-muted)' : 'var(--warn)'}"
      title={online ? 'Online — tersinkron otomatis' : 'Offline — perubahan tersimpan lokal'}
      aria-label={online ? 'Status: online' : 'Status: offline'}
    >
      {#if online}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-[18px] h-[18px]">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-[18px] h-[18px]">
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <path d="M1.42 9a16 16 0 0 1 4.35-2.6" />
          <path d="M19.23 6.4A16 16 0 0 1 22.58 9" />
          <path d="M5 12.55a11 11 0 0 1 5.17-2.9" />
          <path d="M10.71 5.05A16 16 0 0 1 19 6.4" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      {/if}
    </div>
    <!-- Di desktop, Asisten AI & Lainnya sudah ada di sidebar. -->
    <button
      on:click={() => goto('/asisten')}
      disabled={pageId === 'asisten'}
      aria-label="Asisten AI"
      class="min-[900px]:hidden w-11 h-11 grid place-items-center rounded-xl disabled:opacity-40 disabled:pointer-events-none"
      style="border: 2px solid var(--ink); background: var(--bg-card)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
        <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      </svg>
    </button>
    <button
      on:click={() => goto('/lainnya')}
      aria-label="Menu lainnya"
      class="min-[900px]:hidden w-11 h-11 grid place-items-center rounded-xl"
      style="border: 2px solid var(--ink); background: var(--bg-card)"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
    <button
      on:click={() => darkMode.update((v) => !v)}
      aria-label="Ganti mode gelap/terang"
      class="w-11 h-11 grid place-items-center rounded-xl"
      style="border: 2px solid var(--ink); background: var(--bg-card)"
    >
      {#if $darkMode}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-5 h-5">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-5 h-5">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      {/if}
    </button>
  </div>
</header>

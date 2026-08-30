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
  class="h-14 flex items-center justify-between px-4 border-b border-border bg-base-nav/90 backdrop-blur sticky top-0 z-20"
>
  <div class="flex items-center gap-2 min-w-0">
    {#if isSubPage}
      <button
        on:click={() => history.back()}
        aria-label="Kembali"
        class="w-8 h-8 flex items-center justify-center text-txt-secondary shrink-0 active:scale-90 transition-transform"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    {:else}
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
        style="background: linear-gradient(135deg, var(--primary), var(--primary-light))"
      >
        <div class="w-2.5 h-2.5 rounded-full bg-white/90"></div>
      </div>
    {/if}
    <span class="text-sm font-semibold truncate">{PAGE_TITLES[pageId] ?? ''}</span>
  </div>

  <div class="flex items-center gap-1 shrink-0">
    <div
      class="w-9 h-9 flex items-center justify-center"
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
    <button
      on:click={() => goto('/asisten')}
      disabled={pageId === 'asisten'}
      aria-label="Asisten AI"
      class="w-9 h-9 flex items-center justify-center text-txt-secondary active:scale-90 transition-transform disabled:opacity-40 disabled:pointer-events-none"
    >
      <!-- Sparkles — same stroke-based style as the other header icons
           (fill="none", stroke-width 2), just like online/dark-mode. -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-[18px] h-[18px]">
        <path
          d="M9.94 15.5a2 2 0 00-1.44-1.44L2.36 12.48a.5.5 0 010-.96l6.14-1.58A2 2 0 009.94 8.5l1.58-6.14a.5.5 0 01.96 0L14.06 8.5a2 2 0 001.44 1.44l6.14 1.58a.5.5 0 010 .96l-6.14 1.58a2 2 0 00-1.44 1.44l-1.58 6.14a.5.5 0 01-.96 0z"
        />
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
        <path d="M4 17v2" />
        <path d="M5 18H3" />
      </svg>
    </button>
    <button
      on:click={() => goto('/lainnya')}
      aria-label="Menu lainnya"
      class="w-9 h-9 flex items-center justify-center text-txt-secondary active:scale-90 transition-transform"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
    <button
      on:click={() => darkMode.update((v) => !v)}
      aria-label="Ganti mode gelap/terang"
      class="w-9 h-9 flex items-center justify-center text-txt-secondary active:scale-90 transition-transform"
    >
      {#if $darkMode}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-[18px] h-[18px]">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-[18px] h-[18px]">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      {/if}
    </button>
  </div>
</header>

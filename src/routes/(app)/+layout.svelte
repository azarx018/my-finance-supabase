<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Fab from '$lib/components/Fab.svelte';
  import Splash from '$lib/components/Splash.svelte';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import UpdateBanner from '$lib/components/UpdateBanner.svelte';
  import { SUB_PAGES } from '$lib/nav/config';
  import { fabHandler } from '$lib/stores/fab';

  let showSplash = true;
  onMount(() => {
    // Sprint 2: splash is just a boot animation. Once real data
    // hydration exists (wallets/transactions loading from Dexie on
    // startup), this will wait on that instead of a fixed timer.
    const t = setTimeout(() => (showSplash = false), 800);
    return () => clearTimeout(t);
  });

  $: pageId = $page.url.pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  $: isSubPage = SUB_PAGES.includes(pageId);
</script>

{#if showSplash}
  <Splash />
{:else}
  <div class="min-h-screen flex flex-col bg-base-bg font-main text-txt-primary">
    <Header {pageId} {isSubPage} />
    <main class="flex-1 pb-24">
      <slot />
    </main>
    <Fab {pageId} onClick={() => $fabHandler?.()} />
    <BottomNav {pageId} />
  </div>
  <ToastHost />
  <UpdateBanner />
{/if}

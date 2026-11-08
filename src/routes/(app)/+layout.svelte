<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Fab from '$lib/components/Fab.svelte';
  import Splash from '$lib/components/Splash.svelte';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import UpdateBanner from '$lib/components/UpdateBanner.svelte';
  import { SUB_PAGES } from '$lib/nav/config';
  import { fabHandler } from '$lib/stores/fab';
  import { keepAlive } from '$lib/stores/data';

  let showSplash = true;
  onMount(() => {
    // Sprint 2: splash is just a boot animation. Once real data
    // hydration exists (wallets/transactions loading from Dexie on
    // startup), this will wait on that instead of a fixed timer.
    const t = setTimeout(() => (showSplash = false), 550);
    const stopKeepAlive = keepAlive(); // data tetap di memori antar halaman
    return () => {
      clearTimeout(t);
      stopKeepAlive();
    };
  });

  $: pageId = $page.url.pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  $: isSubPage = SUB_PAGES.includes(pageId);
  // Asisten = layar chat penuh (seperti WhatsApp): tanpa navbar bawah.
  $: hideNav = pageId === 'asisten';
</script>

{#if showSplash}
  <Splash />
{:else}
  <div class="min-h-screen flex font-main text-txt-primary">
    <Sidebar {pageId} />
    <div class="flex-1 min-w-0 flex flex-col">
      <Header {pageId} {isSubPage} />
      <main class="flex-1 {hideNav ? 'pb-0' : 'pb-36'} min-[900px]:pb-12">
        <!-- {#key}: halaman baru di-mount ulang sehingga animasi masuknya selalu jalan -->
        {#key pageId}
          <div class="page-in"><slot /></div>
        {/key}
      </main>
    </div>
    <Fab {pageId} onClick={() => $fabHandler?.()} />
    {#if !hideNav}<BottomNav {pageId} />{/if}
  </div>
  <ToastHost />
  <UpdateBanner />
{/if}

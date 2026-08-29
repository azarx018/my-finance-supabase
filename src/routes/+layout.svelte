<script lang="ts">
  import '../app.css';
  import '$lib/stores/ui'; // side-effect import: keeps <body> theme/dark-mode attrs live
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { session, authReady, initAuth } from '$lib/stores/auth';
  import { initPwa } from '$lib/pwa/register';
  import { listenInstallPrompt } from '$lib/pwa/install';

  onMount(() => {
    initAuth();
    initPwa();
    listenInstallPrompt();
  });

  // Route guard: no session → /login. Signed in but sitting on /login →
  // bounce into the app. Runs only once authReady is true so we never
  // redirect based on a not-yet-resolved session check.
  $: if ($authReady) {
    const onLoginPage = $page.url.pathname === '/login';
    if (!$session && !onLoginPage) goto('/login');
    if ($session && onLoginPage) goto('/dashboard');
  }
</script>

{#if !$authReady}
  <div class="min-h-screen flex items-center justify-center text-txt-secondary font-main text-sm">
    Memuat…
  </div>
{:else}
  <slot />
{/if}

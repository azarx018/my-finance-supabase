<script lang="ts">
  import '../app.css';
  import '$lib/stores/ui'; // side-effect import: keeps <body> theme/dark-mode attrs live
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { session, authReady, initAuth, passwordRecovery } from '$lib/stores/auth';
  import { initPwa } from '$lib/pwa/register';
  import { listenInstallPrompt } from '$lib/pwa/install';

  onMount(() => {
    initAuth();
    initPwa();
    listenInstallPrompt();
  });

  // Route guard: no session → /login. Signed in but sitting on /login →
  // bounce into the app. /reset-password is a special case: a recovery
  // session counts as "signed in" for Supabase's purposes, but the user
  // must land on the reset form, not skip straight into the app.
  $: if ($authReady) {
    const path = $page.url.pathname;
    const onLoginPage = path === '/login';
    const onResetPage = path === '/reset-password';
    if ($passwordRecovery) {
      if (!onResetPage) goto('/reset-password');
    } else {
      if (!$session && !onLoginPage) goto('/login');
      if ($session && (onLoginPage || onResetPage)) goto('/dashboard');
    }
  }
</script>

{#if !$authReady}
  <div class="min-h-screen flex items-center justify-center text-txt-secondary font-main text-sm">
    Memuat…
  </div>
{:else}
  <slot />
{/if}

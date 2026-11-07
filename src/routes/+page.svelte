<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // NOTE: a full page load of "/" is the public landing page, served by
  // vercel.json (static/landing.html) — it never reaches this SPA route.
  // This only runs when "/" is reached by client-side navigation inside
  // the app; in that case just forward into the app.
  onMount(() => {
    goto('/dashboard', { replaceState: true });
  });
</script>

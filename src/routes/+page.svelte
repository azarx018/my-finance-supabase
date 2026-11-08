<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // "/" is the app entry point; forward into the app.
  // (The public landing page is a separate static site.)
  onMount(() => {
    goto('/dashboard', { replaceState: true });
  });
</script>

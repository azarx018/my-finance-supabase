<script lang="ts">
  import { onMount } from 'svelte';

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

{#if !online}
  <div class="text-center text-xs py-1.5 text-white" style="background: var(--warn)">
    📴 Offline — perubahan tersimpan lokal & otomatis sinkron saat online kembali
  </div>
{/if}

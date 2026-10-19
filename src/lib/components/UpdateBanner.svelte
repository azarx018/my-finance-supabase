<script lang="ts">
  import { updateAvailable, applyUpdate } from '$lib/pwa/register';
  import Icon from '$lib/components/Icon.svelte';

  let applying = false;

  async function reload() {
    applying = true;
    await applyUpdate();
  }
</script>

{#if $updateAvailable}
  <div class="fixed inset-x-0 z-40 flex justify-center px-4" style="bottom: calc(100px + env(safe-area-inset-bottom, 0px))">
    <div class="bg-base-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-full">
      <span class="text-sm font-semibold text-txt-primary flex-1 flex items-center gap-2"><Icon name="refresh" size={16} /> Update baru tersedia</span>
      <button
        on:click={reload}
        disabled={applying}
        class="text-xs font-medium px-3 py-1.5 rounded-lg text-white shrink-0 disabled:opacity-60"
        style="background: var(--primary)"
      >
        {applying ? 'Memuat…' : 'Muat Ulang'}
      </button>
    </div>
  </div>
{/if}

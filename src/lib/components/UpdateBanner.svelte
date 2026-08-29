<script lang="ts">
  import { updateAvailable, applyUpdate } from '$lib/pwa/register';

  let applying = false;

  async function reload() {
    applying = true;
    await applyUpdate();
  }
</script>

{#if $updateAvailable}
  <div class="fixed bottom-20 inset-x-0 z-40 flex justify-center px-4">
    <div class="bg-base-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-full">
      <span class="text-xs text-txt-primary flex-1">🔄 Update baru tersedia</span>
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

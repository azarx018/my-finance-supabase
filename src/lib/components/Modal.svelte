<script lang="ts">
  export let open = false;
  export let onClose: () => void = () => {};
</script>

{#if open}
  <button
    class="fixed inset-0 bg-black/40 z-40 appearance-none border-0 p-0 cursor-default"
    on:click={onClose}
    aria-label="Tutup"
  ></button>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
    <div
      class="bg-base-card rounded-xl p-5 w-full max-w-sm pointer-events-auto"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      on:keydown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <slot />
    </div>
  </div>
{/if}

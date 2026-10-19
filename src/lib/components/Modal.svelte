<script lang="ts">
  export let open = false;
  export let onClose: () => void = () => {};
</script>

{#if open}
  <button
    class="fade-in fixed inset-0 z-40 appearance-none border-0 p-0 cursor-default"
    style="background: rgba(10, 12, 20, 0.55)"
    on:click={onClose}
    aria-label="Tutup"
  ></button>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
    <div
      class="toast-in bg-base-card rounded-2xl p-5 w-full max-w-sm pointer-events-auto border border-border shadow-lg"
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

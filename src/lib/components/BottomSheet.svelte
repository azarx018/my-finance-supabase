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
  <div
    class="fixed left-0 right-0 bottom-0 z-50 bg-base-sheet rounded-t-2xl p-5 max-h-[88vh] overflow-y-auto"
  >
    <div class="w-10 h-1 rounded-full bg-border mx-auto mb-4"></div>
    <slot />
  </div>
{/if}

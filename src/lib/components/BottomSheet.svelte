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
  <!-- HP: sheet menempel di bawah. Desktop: jadi dialog di tengah-bawah. -->
  <div
    class="sheet-in fixed inset-x-0 bottom-0 mx-auto w-full max-w-[560px] z-50 bg-base-sheet p-5 max-h-[88vh] overflow-y-auto min-[900px]:bottom-8 min-[900px]:rounded-[26px]"
    style="border: 2px solid var(--ink); border-radius: 26px 26px 0 0; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px))"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-10 h-1.5 rounded-full mx-auto mb-4 min-[900px]:hidden" style="background: var(--ink); opacity: 0.25"></div>
    <slot />
  </div>
{/if}

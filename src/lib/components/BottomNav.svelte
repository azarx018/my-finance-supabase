<script lang="ts">
  import { goto } from '$app/navigation';
  import { NAV_ITEMS } from '$lib/nav/config';

  export let pageId: string;

  // Indikator (pil) meluncur ke tab aktif. Komponen ini tidak di-remount saat
  // pindah halaman, jadi perubahan transform otomatis dianimasikan CSS.
  $: idx = NAV_ITEMS.findIndex((i) => i.id === pageId);
</script>

<nav
  class="fixed inset-x-3.5 mx-auto z-20 flex p-1.5 max-w-[520px] min-[900px]:hidden"
  style="bottom: calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--bg-card); border: 2px solid var(--line); border-radius: 26px; box-shadow: var(--shadow-sm)"
  aria-label="Navigasi utama"
>
  <i
    class="absolute top-1.5 bottom-1.5 left-1.5 pointer-events-none"
    style="width: calc((100% - 12px) / {NAV_ITEMS.length}); transform: translateX({Math.max(idx, 0) * 100}%); opacity: {idx < 0
      ? 0
      : 1}; background: var(--primary); border: 2px solid var(--line); border-radius: 20px; transition: transform 0.5s cubic-bezier(0.3, 1.5, 0.5, 1), opacity 0.2s"
  ></i>
  {#each NAV_ITEMS as item (item.id)}
    {@const active = pageId === item.id}
    <button
      on:click={() => goto(item.path)}
      aria-current={active ? 'page' : undefined}
      class="relative z-10 flex-1 min-h-[58px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
      style="color: {active ? 'var(--on-primary)' : 'var(--txt-secondary)'}"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-5 h-5"
        style="transition: transform 0.25s; transform: {active ? 'scale(1.14) translateY(-1px)' : 'none'}"
      >
        {@html item.iconPath}
      </svg>
      <span>{item.label}</span>
    </button>
  {/each}
</nav>

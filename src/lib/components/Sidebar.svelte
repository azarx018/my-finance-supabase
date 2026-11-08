<script lang="ts">
  import { goto } from '$app/navigation';
  import { SIDEBAR_ITEMS } from '$lib/nav/config';

  export let pageId: string;
</script>

<!-- Hanya tampil di layar lebar (desktop/tablet). Di HP navigasi pakai BottomNav. -->
<aside
  class="hidden min-[900px]:flex sticky top-0 h-screen w-60 shrink-0 flex-col gap-1 px-3 py-6 overflow-y-auto"
  style="border-right: 2px solid var(--line); background: color-mix(in srgb, var(--bg-card) 70%, transparent)"
  aria-label="Navigasi utama"
>
  <div class="flex items-center gap-2.5 px-2.5 pb-5 text-xl font-extrabold tracking-tight">
    <span
      class="w-9 h-9 rounded-full grid place-items-center coin-spin"
      style="background: var(--coin); border: 2px solid var(--line); color: #12151f"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="w-5 h-5">
        <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" />
      </svg>
    </span>
    My Finance
  </div>

  {#each SIDEBAR_ITEMS as item (item.id)}
    {@const active = pageId === item.id}
    <button
      on:click={() => goto(item.path)}
      aria-current={active ? 'page' : undefined}
      class="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold text-left w-full border-2"
      style="border-color: {active ? 'var(--line)' : 'transparent'}; background: {active ? 'var(--bg-card)' : 'transparent'}; color: {active
        ? 'var(--txt-primary)'
        : 'var(--txt-secondary)'}; box-shadow: {active ? 'var(--shadow-sm)' : 'none'}"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 shrink-0" style={active ? 'stroke: var(--primary)' : ''}>
        {@html item.iconPath}
      </svg>
      {item.label}
    </button>
  {/each}
</aside>

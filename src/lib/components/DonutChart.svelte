<script lang="ts">
  import type { CatBreakdown } from '$lib/data/analytics';

  export let data: CatBreakdown[] = [];

  const COLORS = ['#22c55e', '#f43f5e', '#60a5fa', '#f97316', '#a855f7', '#14b8a6', '#fbbf24', '#e879f9'];
  const R = 40;
  const CIRC = 2 * Math.PI * R;

  $: total = data.reduce((s, c) => s + c.value, 0);
  $: segments = (() => {
    let offset = 0;
    return data.map((c, i) => {
      const frac = total > 0 ? c.value / total : 0;
      const seg = { ...c, color: COLORS[i % COLORS.length], dash: frac * CIRC, offset };
      offset += frac * CIRC;
      return seg;
    });
  })();
</script>

{#if total === 0}
  <p class="text-xs text-txt-muted text-center py-6">Belum ada pengeluaran</p>
{:else}
  <div class="flex items-center gap-4">
    <svg width="100" height="100" viewBox="0 0 100 100" class="shrink-0 -rotate-90">
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-card2)" stroke-width="14" />
      {#each segments as s (s.id)}
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={s.color}
          stroke-width="14"
          stroke-dasharray="{s.dash} {CIRC - s.dash}"
          stroke-dashoffset={-s.offset}
        />
      {/each}
    </svg>
    <div class="flex-1 flex flex-col gap-1.5 min-w-0">
      {#each segments.slice(0, 8) as s (s.id)}
        <div class="flex items-center gap-2 text-xs">
          <span class="w-2 h-2 rounded-full shrink-0" style="background: {s.color}"></span>
          <span class="text-txt-primary truncate flex-1">{s.emoji} {s.name}</span>
          <span class="text-txt-secondary shrink-0">{total ? Math.round((s.value / total) * 100) : 0}%</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

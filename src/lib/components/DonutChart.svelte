<script lang="ts">
  import { formatRpC } from '$lib/data/format';
  import type { CatBreakdown } from '$lib/data/analytics';

  export let data: CatBreakdown[] = [];

  // Palet mengikuti tema (warna utama + warna semantik), sisanya aksen tetap.
  const COLORS = [
    'var(--primary)',
    'var(--coin)',
    'var(--info)',
    'var(--expense)',
    '#6b4df0',
    '#0ca5b0',
    '#ff8a3d',
    '#e879f9'
  ];
  const R = 40;
  const CIRC = 2 * Math.PI * R;
  const GAP = 3; // jarak antar potongan

  $: total = data.reduce((s, c) => s + c.value, 0);
  $: segments = (() => {
    let offset = 0;
    return data.map((c, i) => {
      const frac = total > 0 ? c.value / total : 0;
      const len = frac * CIRC;
      const seg = {
        ...c,
        color: COLORS[i % COLORS.length],
        dash: data.length > 1 ? Math.max(len - GAP, 0.5) : len,
        offset: -(offset + (data.length > 1 ? GAP / 2 : 0)),
        pct: total ? Math.round(frac * 100) : 0
      };
      offset += len;
      return seg;
    });
  })();
</script>

{#if total === 0}
  <p class="text-sm font-semibold text-txt-muted text-center py-6">Belum ada pengeluaran</p>
{:else}
  <div class="flex items-center gap-5 flex-wrap justify-center">
    <svg viewBox="0 0 120 120" class="w-40 h-40 shrink-0" role="img" aria-label="Diagram pengeluaran per kategori">
      <g transform="rotate(-90 60 60)">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--bg-card2)" stroke-width="18" />
        {#each segments as s, i (s.id)}
          <circle
            class="seg-in"
            style="animation-delay: {i * 90}ms"
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={s.color}
            stroke-width="18"
            stroke-dasharray="{s.dash} {CIRC - s.dash}"
            stroke-dashoffset={s.offset}
          />
        {/each}
        <!-- garis tepi luar & dalam supaya senada dengan kartu lain -->
        <circle cx="60" cy="60" r={R + 10} fill="none" stroke="var(--line)" stroke-width="2" />
        <circle cx="60" cy="60" r={R - 10} fill="none" stroke="var(--line)" stroke-width="2" />
      </g>
      <text x="60" y="58" text-anchor="middle" font-size="11" font-weight="800" fill="var(--txt-primary)">{formatRpC(total)}</text>
      <text x="60" y="71" text-anchor="middle" font-size="8" font-weight="700" fill="var(--txt-secondary)">total keluar</text>
    </svg>
    <div class="flex-1 min-w-[160px] flex flex-col gap-2">
      {#each segments.slice(0, 8) as s (s.id)}
        <div class="flex items-center gap-2 text-sm">
          <span class="w-3.5 h-3.5 rounded-md shrink-0" style="background: {s.color}; border: 2px solid var(--line)"></span>
          <span class="text-txt-primary font-semibold truncate flex-1">{s.emoji} {s.name}</span>
          <span class="shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-full" style="background: var(--bg-card2); border: 2px solid var(--line)">{s.pct}%</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

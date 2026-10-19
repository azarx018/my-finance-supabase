<script lang="ts">
  import type { MonthlyPoint } from '$lib/data/analytics';

  export let data: MonthlyPoint[] = [];

  $: maxV = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const H = 150;
  const barW = 15;
  const pair = barW * 2 + 4;
  const step = pair + 22;
  $: W = Math.max(data.length * step + 12, 280);
  const bh = (v: number, max: number) => (v > 0 ? Math.max(4, (v / max) * H) : 0);
</script>

<svg viewBox="0 0 {W} {H + 30}" class="w-full block" role="img" aria-label="Grafik pemasukan dan pengeluaran per bulan">
  <!-- garis bantu putus-putus -->
  {#each [0.25, 0.5, 0.75, 1] as g}
    <line x1="0" x2={W} y1={H - H * g} y2={H - H * g} stroke="var(--line)" stroke-opacity="0.18" stroke-dasharray="4 5" />
  {/each}
  {#each data as d, i (d.month)}
    {@const x = i * step + (step - pair) / 2 + 6}
    {@const inc = bh(d.income, maxV)}
    {@const exp = bh(d.expense, maxV)}
    {#if inc > 0}
      <rect class="bar-rise" style="animation-delay: {i * 70}ms" x={x} y={H - inc} width={barW} height={inc} rx="6" fill="var(--income)" stroke="var(--line)" stroke-width="2" />
    {/if}
    {#if exp > 0}
      <rect class="bar-rise" style="animation-delay: {i * 70 + 40}ms" x={x + barW + 4} y={H - exp} width={barW} height={exp} rx="6" fill="var(--expense)" stroke="var(--line)" stroke-width="2" />
    {/if}
    <text x={x + pair / 2} y={H + 20} font-size="11" font-weight="700" text-anchor="middle" fill="var(--txt-secondary)">{d.label}</text>
  {/each}
  <!-- garis dasar -->
  <line x1="0" x2={W} y1={H + 1} y2={H + 1} stroke="var(--line)" stroke-width="2" />
</svg>

<div class="flex gap-2 justify-center mt-3 text-xs font-bold">
  <span class="flex items-center gap-1.5 px-3 py-1 rounded-full" style="border: 2px solid var(--line); background: var(--income-bg)">
    <span class="w-2.5 h-2.5 rounded-full" style="background: var(--income); border: 1.5px solid var(--line)"></span>Pemasukan
  </span>
  <span class="flex items-center gap-1.5 px-3 py-1 rounded-full" style="border: 2px solid var(--line); background: var(--expense-bg)">
    <span class="w-2.5 h-2.5 rounded-full" style="background: var(--expense); border: 1.5px solid var(--line)"></span>Pengeluaran
  </span>
</div>

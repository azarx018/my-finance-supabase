<script lang="ts">
  import { formatRpC } from '$lib/data/format';
  import type { MonthlyPoint } from '$lib/data/analytics';

  export let data: MonthlyPoint[] = [];

  $: maxV = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const H = 140;
  const barW = 10;
  const gap = 8;
</script>

<div class="overflow-x-auto">
  <svg width={Math.max(data.length * (barW * 2 + gap + 16), 280)} height={H + 24} class="block">
    {#each data as d, i (d.month)}
      {@const x = i * (barW * 2 + gap + 16) + 12}
      {@const incH = (d.income / maxV) * H}
      {@const expH = (d.expense / maxV) * H}
      <rect x={x} y={H - incH} width={barW} height={incH} rx="2" fill="var(--income)" />
      <rect x={x + barW + 2} y={H - expH} width={barW} height={expH} rx="2" fill="var(--expense)" />
      <text x={x + barW} y={H + 16} font-size="9" text-anchor="middle" fill="var(--txt-secondary)">{d.label}</text>
    {/each}
  </svg>
</div>
<div class="flex gap-4 justify-center mt-2 text-[10px] text-txt-secondary">
  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background: var(--income)"></span>Pemasukan</span>
  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background: var(--expense)"></span>Pengeluaran</span>
</div>

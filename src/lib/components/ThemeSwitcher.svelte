<script lang="ts">
  import { theme, darkMode } from '$lib/stores/ui';

  const options: { id: 'emerald' | 'pink' | 'ocean'; label: string; swatch: string }[] = [
    { id: 'emerald', label: 'Emerald', swatch: '#16a34a' },
    { id: 'pink', label: 'Cherry Blossom', swatch: '#ec6fa0' },
    { id: 'ocean', label: 'Ocean Blue', swatch: '#0284c7' }
  ];
</script>

<div class="flex flex-col gap-3">
  <div class="flex gap-3">
    {#each options as t (t.id)}
      <button
        on:click={() => theme.set(t.id)}
        class="flex-1 rounded-lg py-3 flex flex-col items-center gap-2 border transition-colors"
        style="border-color: {$theme === t.id ? 'var(--primary)' : 'var(--border)'}; background: {$theme === t.id
          ? 'var(--primary-bg)'
          : 'var(--bg-card)'}"
      >
        <span class="w-6 h-6 rounded-full" style="background:{t.swatch}"></span>
        <span class="text-xs text-txt-secondary">{t.label}</span>
      </button>
    {/each}
  </div>
  <label class="flex items-center justify-between rounded-lg bg-base-card px-4 py-3 border border-border">
    <span class="text-sm text-txt-primary">Mode Gelap</span>
    <input type="checkbox" bind:checked={$darkMode} />
  </label>
</div>

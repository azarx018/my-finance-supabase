<script lang="ts">
  import { theme, darkMode } from '$lib/stores/ui';

  const options: { id: 'emerald' | 'pink' | 'ocean'; label: string; swatch: string }[] = [
    { id: 'emerald', label: 'Emerald', swatch: '#12a15f' },
    { id: 'pink', label: 'Cherry Blossom', swatch: '#ff7db0' },
    { id: 'ocean', label: 'Ocean Blue', swatch: '#0c72bd' }
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
        <span class="w-7 h-7 rounded-full" style="background:{t.swatch}; border: 2px solid var(--line)"></span>
        <span class="text-xs font-semibold text-txt-primary">{t.label}</span>
      </button>
    {/each}
  </div>
  <label class="flex items-center justify-between rounded-lg bg-base-card px-4 py-3 border border-border">
    <span class="text-sm text-txt-primary">Mode Gelap</span>
    <input type="checkbox" bind:checked={$darkMode} />
  </label>
</div>

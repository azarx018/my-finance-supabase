<script lang="ts">
  export let emoji: string;
  export let label: string;
  export let selected = false;
  export let onClick: () => void = () => {};
</script>

<button
  on:click={onClick}
  class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-colors min-w-[64px] shrink-0"
  style="border-color: {selected ? 'var(--primary)' : 'var(--border)'}; background: {selected
    ? 'var(--primary-bg)'
    : 'var(--bg-card)'}"
>
  <span class="text-xl">{emoji}</span>
  <span class="text-[10px] text-txt-secondary text-center leading-tight">{label}</span>
</button>

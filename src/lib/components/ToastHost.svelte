<script lang="ts">
  import { toasts } from '$lib/stores/toast';
  import Icon from '$lib/components/Icon.svelte';

  const icon = { success: 'check', error: 'alert', info: 'sparkle' } as const;
</script>

<div
  class="fixed inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4"
  style="bottom: calc(168px + env(safe-area-inset-bottom, 0px))"
  aria-live="polite"
>
  {#each $toasts as t (t.id)}
    <div
      class="toast-in flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold max-w-sm text-center"
      style="background: var(--ink); color: var(--bg-base); border: 2px solid var(--ink); box-shadow: 3px 3px 0 {t.kind === 'error'
        ? 'var(--expense)'
        : t.kind === 'info'
          ? 'var(--info)'
          : 'var(--primary)'}"
    >
      <Icon name={icon[t.kind]} size={18} />
      {t.text}
    </div>
  {/each}
</div>

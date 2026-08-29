<script lang="ts">
  import { toasts } from '$lib/stores/toast';
</script>

<div class="fixed bottom-24 inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
  {#each $toasts as t (t.id)}
    <div
      class="px-4 py-2.5 rounded-lg text-xs text-white shadow-lg max-w-xs text-center"
      style="background: {t.kind === 'error' ? 'var(--expense)' : t.kind === 'info' ? 'var(--info)' : 'var(--income)'}"
    >
      {t.text}
    </div>
  {/each}
</div>

<script lang="ts">
  export let title: string;
  export let sprint: string;
</script>

<div class="flex flex-col items-center justify-center text-center gap-2 py-24 px-6">
  <div
    class="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
    style="background: var(--primary-bg)"
  >
    🛠️
  </div>
  <p class="text-sm font-medium text-txt-primary">{title}</p>
  <p class="text-xs text-txt-secondary max-w-[240px]">
    Konten halaman ini dibangun di {sprint}. Navigasi &amp; shell sudah aktif.
  </p>
</div>

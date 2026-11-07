<script lang="ts">
  import AssistantEntry from './AssistantEntry.svelte';
  import AssistantSheet from './AssistantSheet.svelte';
  import { SCREEN_PRESETS, type AssistantScreen } from '$lib/ai/screens';

  /** Halaman asal; menentukan teks kartu, chip, saran, dan petunjuk konteks ke worker. */
  export let screen: AssistantScreen;
  /** Sembunyikan kartu (mis. saat melihat bulan lalu yang read-only). */
  export let hidden = false;

  $: preset = SCREEN_PRESETS[screen];
  let open = false;
  let prompt = '';

  function ask(p: string) {
    prompt = p;
    open = true;
  }
  function close() {
    open = false;
    prompt = '';
  }
</script>

<!-- Kartu masuk + panel chat dalam satu komponen. Tidak menambah elemen pembungkus, jadi kartu tetap
     menjadi anak langsung dari grid halaman (class span-all bekerja). -->
{#if !hidden}
  <AssistantEntry
    title={preset.title}
    subtitle={preset.subtitle}
    placeholder={preset.placeholder}
    chips={preset.chips}
    quick={preset.quick ?? false}
    onAsk={ask}
  />
{/if}

<AssistantSheet
  {open}
  onClose={close}
  title={preset.sheetTitle}
  {screen}
  suggestions={preset.suggestions}
  initialPrompt={prompt}
/>

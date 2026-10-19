<script lang="ts">
  // Satu set ikon garis (stroke) untuk seluruh app, biar gayanya konsisten.
  export let name: string;
  export let size = 16;

  const P: Record<string, string> = {
    coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
    up: 'M12 19V5M6 11l6-6 6 6',
    down: 'M12 5v14M6 13l6 6 6-6',
    swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12l5 5 9-10',
    alert: 'M12 9v4M12 17h.01M10.3 4L2 18h20L13.7 4a2 2 0 00-3.4 0z',
    bell: 'M6 9a6 6 0 0112 0c0 6 3 8 3 8H3s3-2 3-8M10 21h4',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
    unlock: 'M5 11h14v10H5zM8 11V7a4 4 0 017.5-2',
    refresh: 'M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5',
    download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
    chart: 'M6 20v-6M12 20V4M18 20V9',
    phone: 'M7 2h10v20H7zM11 18h2',
    sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
    card: 'M2 5h20v14H2zM2 10h20M6 15h4',
    flag: 'M5 21V4M5 4h13l-2 4 2 4H5',
    clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    wallet: 'M3 6h18v14H3zM3 10h18M16 15h2',
    tool: 'M14.7 6.3a4 4 0 00-5 5L3 18l3 3 6.7-6.7a4 4 0 005-5l-2.4 2.4-2.6-.6-.6-2.6z',
    out: 'M9 4H4v16h5M16 8l4 4-4 4M20 12H9',
    leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8',
    heart: 'M12 20s-8-5-8-11a4.5 4.5 0 018-2 4.5 4.5 0 018 2c0 6-8 11-8 11z',
    wave: 'M2 9c3-3 5 3 10 0s7 3 10 0M2 15c3-3 5 3 10 0s7 3 10 0',
    dot: 'M12 12h.01'
  };
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="inline-block shrink-0 align-[-0.17em] {$$props.class ?? ''}"
  aria-hidden="true"
>
  <path d={P[name] ?? P.dot} />
</svg>

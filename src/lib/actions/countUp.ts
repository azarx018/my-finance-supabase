// Angka yang "menghitung naik" saat muncul atau berubah.
// Pakai: <p use:countUp={{ value: total, format: formatRp }}></p>
export interface CountUpParams {
  value: number;
  format: (n: number) => string;
  duration?: number;
}

export function countUp(node: HTMLElement, params: CountUpParams) {
  let current = 0;
  let raf = 0;

  function run(p: CountUpParams, from: number, dur: number) {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      current = from + (p.value - from) * eased;
      node.textContent = p.format(current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  run(params, 0, params.duration ?? 900);
  return {
    update(next: CountUpParams) {
      run(next, current, next.duration ?? 600);
    },
    destroy() {
      cancelAnimationFrame(raf);
    }
  };
}

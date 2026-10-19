const COLORS = ['#ffc93c', '#12a15f', '#6b4df0', '#ff5c8a', '#2f5bea'];

/** Hujan confetti kecil dari titik (x, y). Aman dipanggil di SSR (tidak melakukan apa-apa). */
export function confetti(x?: number, y?: number, count = 24): void {
  if (typeof document === 'undefined') return;
  const cx = x ?? window.innerWidth / 2;
  const cy = y ?? window.innerHeight * 0.65;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'cf';
    el.style.cssText = `left:${cx}px;top:${cy}px;background:${COLORS[i % COLORS.length]};border-radius:${
      i % 2 ? '50%' : '3px'
    };--x:${(Math.random() - 0.5) * 320}px;--y:${-90 - Math.random() * 230}px;--r:${Math.random() * 540}deg`;
    document.body.append(el);
    setTimeout(() => el.remove(), 1300);
  }
}

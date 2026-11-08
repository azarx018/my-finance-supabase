// Animasi "muncul" untuk baris/kartu pada daftar: dimainkan SAAT elemen masuk layar,
// bukan saat halaman dibuka. Dengan begitu baris di bagian bawah (yang baru kelihatan
// setelah di-scroll) tetap beranimasi sama seperti baris di atas.
let io: IntersectionObserver | null = null;

function observer(): IntersectionObserver {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        let n = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          // Batch awal (yang langsung kelihatan) muncul berurutan dari atas.
          el.style.animationDelay = `${Math.min(n++, 6) * 45}ms`;
          el.classList.add('reveal-in');
          io!.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.04 }
    );
  }
  return io;
}

export function reveal(node: HTMLElement) {
  if (typeof IntersectionObserver === 'undefined') return {};
  node.classList.add('reveal');
  observer().observe(node);
  return {
    destroy() {
      io?.unobserve(node);
    }
  };
}

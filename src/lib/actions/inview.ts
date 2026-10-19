// Memanggil callback saat elemen mendekati layar (untuk memuat daftar panjang bertahap).
export function inview(node: HTMLElement, cb: () => void) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) cb();
    },
    { rootMargin: '400px' }
  );
  io.observe(node);
  return {
    update(next: () => void) {
      cb = next;
    },
    destroy() {
      io.disconnect();
    }
  };
}

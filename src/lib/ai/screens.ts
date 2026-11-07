/**
 * Preset asisten per halaman: teks kartu masuk, chip, dan saran di panel.
 * Halaman baru: tambahkan satu entri di sini + satu baris `SCREEN_HINT` di worker (ai-worker/src/assistant.ts),
 * lalu pasang <AssistantDock screen="..."/> di halamannya.
 * Isi chip HARUS sesuatu yang bisa dikerjakan asisten dengan data yang ia punya (snapshot keuangan + kartu usulan).
 */
export type AssistantScreen = 'budget' | 'tabungan' | 'riwayat' | 'analitik' | 'dashboard';

export interface ScreenPreset {
  title: string;
  subtitle: string; // kosong = disembunyikan
  placeholder: string;
  chips: string[];
  suggestions: string[]; // tampilan kosong di dalam panel
  sheetTitle: string;
  /** true = kolom ketik langsung di halaman (kirim → panel terbuka dan kalimatnya terkirim). */
  quick?: boolean;
}

export const SCREEN_PRESETS: Record<AssistantScreen, ScreenPreset> = {
  budget: {
    title: 'Asisten Budget',
    subtitle: 'Minta bikinin, atau tanya soal budget lu',
    placeholder: 'Tanya asisten tentang budget…',
    chips: ['Bikinin budget dari gaji', 'Budget gue masuk akal nggak?'],
    suggestions: ['Bikinin budget dari gaji bulan ini', 'Budget gue masuk akal nggak?', 'Kategori mana yang paling boros?'],
    sheetTitle: 'Asisten · Budget'
  },
  tabungan: {
    title: 'Asisten Tabungan',
    subtitle: 'Bikin kantong baru, atau cek progres target',
    placeholder: 'Tanya asisten tentang tabungan…',
    chips: ['Bikin kantong tabungan', 'Berapa lagi sampai target?'],
    suggestions: ['Bikin kantong dana darurat', 'Berapa lagi biar target tercapai?', 'Idealnya gue nabung berapa per bulan?'],
    sheetTitle: 'Asisten · Tabungan'
  },
  riwayat: {
    title: 'Asisten Transaksi',
    subtitle: 'Catat pakai kalimat, atau minta ringkasan',
    placeholder: 'Catat atau tanya, mis. kopi 20rb…',
    chips: ['Catat makan siang 25rb', 'Ringkas pengeluaran bulan ini'],
    suggestions: ['Catat kopi 20rb pakai cash', 'Ringkas pengeluaran bulan ini', 'Kategori mana yang paling boros?'],
    sheetTitle: 'Asisten · Transaksi'
  },
  analitik: {
    title: 'Asisten Analitik',
    subtitle: 'Minta penjelasan angka-angka laporan lu',
    placeholder: 'Tanya soal laporan…',
    chips: ['Kenapa pengeluaran gue naik?', 'Ringkas keuangan bulan ini'],
    suggestions: ['Kenapa pengeluaran gue naik?', 'Ringkas keuangan bulan ini', 'Aman nggak bulan ini?'],
    sheetTitle: 'Asisten · Analitik'
  },
  dashboard: {
    title: 'Catat cepat',
    subtitle: '',
    placeholder: 'Contoh: makan siang 25rb',
    chips: ['Sisa duit gue berapa?', 'Aman nggak bulan ini?'],
    suggestions: ['Sisa duit gue berapa?', 'Aman nggak bulan ini?', 'Catat gajian 8jt masuk ke BCA'],
    sheetTitle: 'Asisten AI',
    quick: true
  }
};

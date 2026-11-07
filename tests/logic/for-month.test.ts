import { summarizePeriod } from './data/cashflow.ts';
import { toAnalysisView } from './data/analytics.ts';
let n=0; const eq=(a:any,b:any,m:string)=>{n++; if(JSON.stringify(a)!==JSON.stringify(b)){console.error('FAIL',m,a,b);process.exit(1)}};
const W=[{id:'w1',initial_balance:0}] as any; let id=0; const tx=(o:any)=>({id:'t'+(++id),wallet_id:'w1',...o});
// Gaji 10jt masuk 28 Okt dihitung untuk NOVEMBER. Okt: pengeluaran 4jt. Nov: pengeluaran 5jt.
const T=[tx({type:'income',amount:10_000_000,date:'2026-10-28',for_month:'2026-11'}),tx({type:'expense',amount:4_000_000,date:'2026-10-30'}),tx({type:'expense',amount:5_000_000,date:'2026-11-10'})] as any;
let s=summarizePeriod(W,T,'2026-11-01','2026-11-30');
eq([s.income,s.expense,s.rate,s.status],[10_000_000,5_000_000,50,'surplus'],'Nov memakai gaji yang ditandai untuk Nov');
s=summarizePeriod(W,T,'2026-10-01','2026-10-31');
eq([s.income,s.status],[0,'deficit'],'Okt tidak memuat gaji itu (uang Okt memang belum ada pemasukan untuk Okt)');
// saldo dompet tetap pakai tanggal asli: opening Nov = 10-4 = 6jt (gaji sudah masuk 28 Okt)
eq(toAnalysisView(T)[0].date,'2026-11-01','tanggal analisis');
eq(T[0].date,'2026-10-28','data asli tidak berubah');
// for_month sama dengan bulan tanggal / tanpa for_month -> tidak berubah
const same=[tx({type:'income',amount:1,date:'2026-11-05',for_month:'2026-11'})] as any; eq(toAnalysisView(same)===same,true,'tak ada perubahan -> array sama');
console.log('semua',n,'tes for_month lolos');

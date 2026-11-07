import { summarizePeriod, monthLeftover } from './data/cashflow.ts';
import { getNetWorth, findSavingMismatches, getBucketBalance } from './data/saving.ts';
let n=0; const eq=(a:any,b:any,m:string)=>{n++; if(JSON.stringify(a)!==JSON.stringify(b)){console.error('FAIL',m,a,b);process.exit(1)}};
const W=[{id:'w1',initial_balance:0}] as any;
let id=0; const tx=(o:any)=>({id:'t'+(++id),wallet_id:'w1',...o});
// Skenario user: gajian 28 Okt 10jt, pengeluaran Okt 4jt, nabung 3jt di Okt. Nov: tanpa pemasukan, belanja 2.5jt.
const T=[
 tx({type:'income',amount:10_000_000,date:'2026-10-28',cat_id:'salary'}),
 tx({type:'expense',amount:4_000_000,date:'2026-10-30'}),
 tx({type:'saving_transfer',direction:'deposit',amount:3_000_000,date:'2026-10-31',bucket_id:'b1'}),
 tx({type:'expense',amount:2_500_000,date:'2026-11-03'}),
] as any;
let s=summarizePeriod(W,T,'2026-10-01','2026-10-31');
eq([s.status,s.rate,s.net],['surplus',60,6_000_000],'okt klasik 60%');
s=summarizePeriod(W,T,'2026-11-01','2026-11-30');
eq([s.carry,s.covered,s.deficit,s.net,s.rate,s.status,s.carryLeft],[3_000_000,2_500_000,0,0,0,'covered',500_000],'nov ditutup dari sisa bulan lalu');
eq(s.cashNet,-2_500_000,'cashNet jujur tetap negatif');
// belanja Nov 5jt > carry 3jt -> defisit nyata 2jt
const T2=[...T.slice(0,3),tx({type:'expense',amount:5_000_000,date:'2026-11-03'})] as any;
s=summarizePeriod(W,T2,'2026-11-01','2026-11-30');
eq([s.covered,s.deficit,s.status,s.net],[3_000_000,2_000_000,'deficit',-2_000_000],'defisit sungguhan');
// pemasukan >= pengeluaran: sama dengan rumus lama
const T3=[tx({type:'income',amount:10,date:'2026-11-01'}),tx({type:'expense',amount:7,date:'2026-11-02'})] as any;
s=summarizePeriod(W,T3,'2026-11-01','2026-11-30'); eq([s.rate,s.carry],[30,0],'rumus lama tidak berubah');
// carry dibatasi saldo awal dompet (uang sudah dipakai/dipindah)
const T4=[tx({type:'income',amount:10,date:'2026-10-05'}),tx({type:'transfer',amount:10,date:'2026-10-06',to_wallet_id:'w2'}),tx({type:'expense',amount:3,date:'2026-11-02'})] as any;
s=summarizePeriod([{id:'w1',initial_balance:0},{id:'w2',initial_balance:0}] as any,T4,'2026-11-01','2026-11-30');
eq(s.carry,10,'transfer antar dompet tidak mengurangi total'); 
// rollover Januari -> Desember
const T5=[tx({type:'income',amount:100,date:'2026-12-30'}),tx({type:'expense',amount:40,date:'2027-01-05'})] as any;
s=summarizePeriod(W,T5,'2027-01-01','2027-01-31'); eq([s.carry,s.status],[100,'covered'],'rollover tahun');
// transaksi terhapus tidak dihitung
eq(monthLeftover([tx({type:'income',amount:5,date:'2026-10-01',deleted_at:'x'})] as any,'2026-10'),0,'soft delete');
// net worth: nabung tidak menurunkan total kekayaan
const B=[{id:'b1'}] as any; const ST=[{bucket_id:'b1',type:'deposit',amount:3_000_000,date:'2026-10-31',wallet_id:'w1'}] as any;
const nw=getNetWorth(W,T,B,ST); eq(nw.total,10_000_000-4_000_000-2_500_000,'net worth = dompet + tabungan'); eq(nw.savings,3_000_000,'savings');
// konsistensi
const m=findSavingMismatches(B,ST,T); eq([m.missingMirror.length,m.missingSavingTx.length,m.orphanMirror.length],[0,0,0],'cocok');
const m2=findSavingMismatches(B,ST,T.filter((t:any)=>t.type!=='saving_transfer')); eq(m2.missingMirror.length,1,'mirror hilang');
const m3=findSavingMismatches(B,[],T); eq(m3.missingSavingTx.length,1,'saving_tx hilang');
const m4=findSavingMismatches([],[],T); eq(m4.orphanMirror.length,1,'bucket hilang');
eq(getBucketBalance('b1',[...ST,{bucket_id:'b1',type:'withdraw',amount:1_000_000,date:'2026-11-05'}] as any,'2026-10-31'),3_000_000,'asOf');
console.log('semua',n,'tes lolos');

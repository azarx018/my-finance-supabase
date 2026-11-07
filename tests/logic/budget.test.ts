import { effectiveBudget, shiftMonth } from './data/budget.ts';
let n=0; const eq=(a:any,b:any,m:string)=>{n++; if(JSON.stringify(a)!==JSON.stringify(b)){console.error('FAIL',m,a,b);process.exit(1)}};
const B=(month:string,limit:number,rollover=false)=>({cat_id:'food',month,limit_amount:limit,rollover});
const T=(date:string,amount:number,o:any={})=>({type:'expense',cat_id:'food',date,amount,...o});
// tanpa rollover: limit apa adanya
eq(effectiveBudget([B('2026-11',1000)],[T('2026-10-05',300)],'food','2026-11'),{base:1000,carried:0,limit:1000},'tanpa rollover');
// rollover: sisa Okt (1000-300=700) ditambah ke Nov
eq(effectiveBudget([B('2026-10',1000),B('2026-11',1000,true)],[T('2026-10-05',300)],'food','2026-11'),{base:1000,carried:700,limit:1700},'rollover 1 bulan');
// berantai: Sep 1000 pakai 0 -> Okt rollover: 1000+1000=2000 pakai 500 -> Nov rollover: 1000+1500
eq(effectiveBudget([B('2026-09',1000),B('2026-10',1000,true),B('2026-11',1000,true)],[T('2026-10-05',500)],'food','2026-11').limit,2500,'berantai');
// overspend bulan lalu -> tidak negatif
eq(effectiveBudget([B('2026-10',1000),B('2026-11',1000,true)],[T('2026-10-05',1500)],'food','2026-11').carried,0,'overspend');
// bulan lalu tanpa budget -> tidak ada carry
eq(effectiveBudget([B('2026-11',1000,true)],[],'food','2026-11').carried,0,'rantai putus');
// transaksi terhapus / kategori lain / tipe lain tidak dihitung
eq(effectiveBudget([B('2026-10',1000),B('2026-11',1000,true)],[T('2026-10-05',400,{deleted_at:'x'}),T('2026-10-06',400,{cat_id:'x'}),T('2026-10-07',400,{type:'saving_transfer'})],'food','2026-11').carried,1000,'filter');
// pergantian tahun
eq(effectiveBudget([B('2026-12',1000),B('2027-01',500,true)],[T('2026-12-10',100)],'food','2027-01').limit,1400,'tahun');
eq(shiftMonth('2026-01',-1),'2025-12','shift');
console.log('semua',n,'tes budget lolos');

import { getNetWorth } from './data/saving.ts';
let n=0; const eq=(a:any,b:any,m:string)=>{n++; if(JSON.stringify(a)!==JSON.stringify(b)){console.error('FAIL',m,a,b);process.exit(1)}};
const W=[{id:'w1',initial_balance:1000}] as any;
// pinjam 500 ke dompet: dompet +500, hutang 500 -> total tidak berubah
const T=[{type:'debt_transfer',direction:'in',amount:500,date:'2026-11-01',wallet_id:'w1'}] as any;
const D=[{dtype:'borrowed',amount:500,paid_amount:0,wallet_id:'w1'}] as any;
eq(getNetWorth(W,T,[],[],D).total,1000,'pinjam impas');
// bayar 200: dompet turun 200, sisa hutang 300 -> total tetap 1000
const T2=[...T,{type:'debt_transfer',direction:'out',amount:200,date:'2026-11-02',wallet_id:'w1'}] as any;
eq(getNetWorth(W,T2,[],[],[{...D[0],paid_amount:200}]).total,1000,'bayar sebagian impas');
// meminjamkan 300: dompet -300, piutang 300 -> impas
const T3=[{type:'debt_transfer',direction:'out',amount:300,date:'2026-11-01',wallet_id:'w1'}] as any;
eq(getNetWorth(W,T3,[],[],[{dtype:'lent',amount:300,paid_amount:0,wallet_id:'w1'}]).total,1000,'piutang impas');
// lunas / terhapus / tanpa dompet diabaikan
eq(getNetWorth(W,[],[],[],[{dtype:'borrowed',amount:500,paid_amount:0,paid:true,wallet_id:'w1'},{dtype:'borrowed',amount:500,wallet_id:null},{dtype:'borrowed',amount:500,wallet_id:'w1',deleted_at:'x'}] as any).total,1000,'diabaikan');
console.log('semua',n,'tes networth lolos');

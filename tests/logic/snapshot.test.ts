import { buildFinanceSnapshot } from './data/snapshot.ts';
let n=0; const eq=(a:any,b:any,m:string)=>{n++; if(JSON.stringify(a)!==JSON.stringify(b)){console.error('FAIL',m,a,b);process.exit(1)}};
const base={buckets:[],savingTxs:[],debts:[],budgets:[],today:'2026-11-07'} as any;
// === KASUS USER: akun baru, 1 dompet saldo bawaan 5jt, BELUM ADA pemasukan/transaksi apa pun ===
let s=buildFinanceSnapshot({...base,wallets:[{id:'w1',name:'BCA',initial_balance:5_000_000}],transactions:[]});
eq([s.wallets_total,s.wallets[0].balance,s.net_worth],[5_000_000,5_000_000,5_000_000],'saldo bawaan terbaca, bukan 0');
eq([s.this_month.income,s.this_month.status],[0,'empty'],'belum ada pemasukan tidak berarti saldo 0');
// belanja 200rb tanpa pemasukan: saldo turun, TIDAK defisit palsu
s=buildFinanceSnapshot({...base,wallets:[{id:'w1',name:'BCA',initial_balance:5_000_000}],transactions:[{id:'t1',type:'expense',amount:200_000,date:'2026-11-05',wallet_id:'w1',cat_id:'food'}]});
eq([s.wallets_total,s.this_month.expense],[4_800_000,200_000],'saldo setelah belanja');
// tabungan + hutang + budget
const full=buildFinanceSnapshot({today:'2026-11-07',
 wallets:[{id:'w1',name:'BCA',initial_balance:0},{id:'w2',name:'Cash',initial_balance:100_000}],
 transactions:[{id:'a',type:'income',amount:10_000_000,date:'2026-10-28',wallet_id:'w1',cat_id:'salary'},
  {id:'b',type:'expense',amount:4_000_000,date:'2026-10-30',wallet_id:'w1',cat_id:'food'},
  {id:'c',type:'saving_transfer',direction:'deposit',amount:3_000_000,date:'2026-10-31',wallet_id:'w1',bucket_id:'k1'},
  {id:'d',type:'expense',amount:500_000,date:'2026-11-03',wallet_id:'w1',cat_id:'food'}],
 buckets:[{id:'k1',name:'Dana Darurat',target:10_000_000,status:'active'}],
 savingTxs:[{bucket_id:'k1',type:'deposit',amount:3_000_000,date:'2026-10-31',wallet_id:'w1'}],
 debts:[{dtype:'borrowed',amount:1_000,paid_amount:0,wallet_id:'w1'}],
 budgets:[{cat_id:'food',month:'2026-11',limit_amount:1_000_000}]} as any);
eq([full.wallets_total,full.savings_total],[2_600_000,3_000_000],'dompet 3jt+100rb-500rb; tabungan 3jt');
eq(full.net_worth,2_600_000+3_000_000-1_000,'kekayaan = dompet+tabungan-hutang');
eq([full.this_month.status,full.this_month.carry_from_last_month],['covered',3_000_000],'Nov dibayar dari sisa bulan lalu');
eq(full.last_month.income,10_000_000,'bulan lalu lengkap (sampai tgl 31)');
eq(full.budgets_this_month,[{cat_id:'food',limit:1_000_000,carried:0,used:500_000,remaining:500_000}],'budget terpakai');
// transaksi terhapus diabaikan
s=buildFinanceSnapshot({...base,wallets:[{id:'w1',name:'A',initial_balance:0}],transactions:[{id:'x',type:'income',amount:9,date:'2026-11-01',wallet_id:'w1',deleted_at:'z'}]});
eq(s.wallets_total,0,'deleted'); 
console.log('semua',n,'tes snapshot lolos');

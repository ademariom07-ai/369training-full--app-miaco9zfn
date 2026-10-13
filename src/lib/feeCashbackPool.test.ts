import {expect,it} from 'vitest'
import {calculateFeeCashbackPool as pool,prepareFeeLedgerPool as ledger,calculateFeeFundedMonthlyPreview as monthly,type FeeLedgerRow} from './feeCashbackPool'
const fee:FeeLedgerRow={chargeId:'charge-a',payerId:'student-a',payerType:'student',period:'2026-10',amountCents:10000,refundedCents:0,status:'settled'}
it('38 percent is applied once to both fee sources and rounded only after aggregation',()=>{
 expect(pool(10000000,40000000)).toMatchObject({totalFeeCents:50000000,poolCents:19000000,outsideCashbackCents:31000000,percent:38})
 expect(pool(1,1).poolCents).toBe(1)
 for(const x of [0,1,2,25,Number.MAX_SAFE_INTEGER]){const r=pool(x,0);expect(BigInt(r.poolCents)+BigInt(r.outsideCashbackCents)).toBe(BigInt(x))}
})
it('only settled fees from the selected month enter the prepared pool',()=>{
 const r=ledger('2026-10',[fee,{...fee,chargeId:'b',payerId:'partner',payerType:'partner'},{...fee,chargeId:'c',status:'pending'},{...fee,chargeId:'d',status:'void'},{...fee,chargeId:'e',period:'2026-09'}],true)
 expect(r).toMatchObject({studentFeeCents:10000,partnerFeeCents:10000,poolCents:7600,acceptedRecords:2,excludedRecords:3})
})
it('incomplete snapshots duplicates and unsettled refund treatment fail closed',()=>{
 expect(()=>ledger('2026-10',[fee],false)).toThrow();expect(()=>ledger('2026-10',[fee,fee],true)).toThrow('duplicada')
 expect(()=>ledger('2026-10',[{...fee,refundedCents:1}],true)).toThrow('conciliação')
 expect(()=>ledger('2026-10',[{...fee,refundedCents:10001}],true)).toThrow()
})
it('rejects malformed money periods roles and unsafe totals without coercion',()=>{
 for(const n of [-1,0.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])expect(()=>pool(n,0)).toThrow()
 expect(()=>pool(Number.MAX_SAFE_INTEGER,1)).toThrow()
 for(const change of [{payerType:'admin'},{status:'paid'},{period:'2026-13'},{chargeId:''},{amountCents:'100'}, {refundedCents:undefined}])expect(()=>ledger('2026-10',[{...fee,...change} as FeeLedgerRow],true)).toThrow()
 expect(()=>ledger('bad',[],true)).toThrow();expect(()=>ledger('2026-10',Array(1),true)).toThrow()
})
it('prepared fees flow through Pareto and monthly ESG without a second 38 percent deduction',()=>{
 const ranking=Array.from({length:500},(_,i)=>({simulationOnly:true as const,rulesVersion:'test',rulesKey:'test',eligibleForCashback:true,id:String(i),monthlyPoints:0,totalPoints:500-i,rating:5,joinedAt:'2026-01-01T00:00:00Z'}))
 const r=monthly('2026-10',[{...fee,amountCents:50000000}],true,ranking,ranking.map(row=>({id:row.id,fulfilledProjects:0})))
 expect(r.source.poolCents).toBe(19000000);expect(r.distribution.distributedCents).toBe(19000000)
 expect(r.distribution.topPoolCents).toBe(15200000);expect(r.distribution.remainingPoolCents).toBe(3800000)
 expect(r.distribution.payableCents+r.distribution.reductionCents+r.distribution.unallocatedCents).toBe(19000000)
})
it('free and absent eligible participants leave the funded pool unallocated',()=>{
 expect(monthly('2026-10',[fee],true,[],[]).distribution).toMatchObject({distributedCents:0,unallocatedCents:3800})
 expect(ledger('2026-10',[],true).poolCents).toBe(0)
})

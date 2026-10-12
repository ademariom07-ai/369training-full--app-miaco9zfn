import {expect,it} from 'vitest'
import {calculateWellnessRankingPreview as score} from './rankingRules'
import {calculateLinearMonthlyCashbackPreview as monthly,calculateLinearCashbackPreview as cash,getEsgGuidance as esg,calculateMonthlyEsgPreview as release} from './cashbackLinearPreview'
function rows(n:number){return Array.from({length:n},(_,i)=>score({version:'046-test',referrals:'minimum_one',rating:'rounded'},{id:String(i),multiplier:1,completedEligibleServices:n-i,validatedReferrals:1,rating:5,seniorityMonths:1,previousPoints:0,partnerPro:false,joinedAt:'2026-01-01T00:00:00Z'}))}
it('approved Pareto allocates 80 percent to the upper group and 20 percent to the remainder',()=>{
 const r=cash(100000,rows(4))
 expect(r.participants.map(p=>p.cashbackCents)).toEqual([80000,10000,6667,3333]);expect(r.distributedCents).toBe(100000);expect(r.unallocatedCents).toBe(0)
 expect(r).toMatchObject({eligibleCount:4,topCount:1,topPoolCents:80000,remainingPoolCents:20000})
})

it('free participants retain their global position but receive no allocation',()=>{
 const input=rows(3);input[0].eligibleForCashback=false
 const result=cash(900,input)
 expect(result.participants.map(r=>[r.position,r.cashbackCents])).toEqual([[1,0],[2,720],[3,180]])
})
it('no eligible participants leaves the pool unallocated',()=>{
 const input=rows(2).map(r=>({...r,eligibleForCashback:false}))
 expect(cash(500,input)).toMatchObject({distributedCents:0,unallocatedCents:500})
 expect(cash(500,[])).toMatchObject({distributedCents:0,unallocatedCents:500})
})
it('cent rounding is deterministic descending and reconciled, or explicitly rejects incompatible combinations',()=>{
 for(const n of [1,2,6,7,31,511])for(const pool of [0,1,2,3,99,100000,Number.MAX_SAFE_INTEGER]){
  const input=rows(n),before=JSON.stringify(input)
  try{const r=cash(pool,input),amounts=r.participants.map(p=>p.cashbackCents)
   expect(amounts.reduce((s,p)=>s+BigInt(p),0n)).toBe(BigInt(pool))
   expect(amounts.every((v,i)=>i===0||amounts[i-1]>=v)).toBe(true)
   expect(cash(pool,input)).toEqual(r)
  }catch(e){expect(String(e)).toContain('Distribuição incompatível')}
  expect(JSON.stringify(input)).toBe(before)
 }
})

it('rejects invalid pools duplicate identities and mixed policies',()=>{
 for(const pool of [-1,1.5,NaN,Infinity])expect(()=>cash(pool,rows(1))).toThrow()
 const input=rows(2)
 expect(()=>cash(1,[input[0],input[0]])).toThrow()
 expect(()=>cash(1,[input[0],{...input[1],rulesKey:'other'}])).toThrow()
})
it('ESG guidance uses exact inclusive thresholds and only the confirmed monthly basis',()=>{
 expect([999999,1000000,1499999,1500000,1999999,2000000].map(n=>esg(n,'monthly').projects)).toEqual([0,1,1,2,2,3])
 expect(esg(2000000)).toMatchObject({guidanceOnly:true,basis:'monthly',projects:3})
 expect(()=>esg(-1,'monthly')).toThrow();expect(()=>esg(1,'lifetime' as 'monthly')).toThrow()
})

it('confirmed ESG matrix deducts only 15 percent per unmet required project',()=>{
 for(const [gross,expected] of [[999999,[100,100,100,100]],[1000000,[85,100,100,100]],[1500000,[70,85,100,100]],[2000000,[55,70,85,100]]] as const){
  expect([0,1,2,3].map(n=>release(gross,n).payablePercent)).toEqual(expected)
 }
})
it('ESG threshold depends on gross monthly cashback, not reduced payable',()=>{
 expect(release(1000000,0)).toMatchObject({requiredProjects:1,payableCents:850000,reductionCents:150000})
 expect(release(1500000,1)).toMatchObject({requiredProjects:2,payableCents:1275000,reductionCents:225000})
 expect(release(2000000,0)).toMatchObject({requiredProjects:3,payableCents:1100000,reductionCents:900000})
})
it('ESG rounds the aggregate reduction once and conserves all cents',()=>{
 for(const gross of [0,999999,1000001,1499999,1500001,1999999,2000001,3695850,Number.MAX_SAFE_INTEGER])for(const done of [0,1,2,3]){
  const r=release(gross,done)
  expect(BigInt(r.payableCents)+BigInt(r.reductionCents)).toBe(BigInt(gross))
  expect(r.reductionPercent).toBeLessThanOrEqual(45)
  expect(r.payableCents).toBeGreaterThanOrEqual(0)
 }
 expect(release(3695850,0)).toMatchObject({payableCents:2032717,reductionCents:1663133})
})
it('ESG rejects untrusted numeric shapes instead of coercing or creating negative money',()=>{
 for(const value of [-1,0.5,NaN,Infinity,4])expect(()=>release(2000000,value)).toThrow()
 for(const gross of [-1,0.5,NaN,Infinity])expect(()=>release(gross,0)).toThrow()
})

it('one eligible receives all funds and ceil rounding uses only eligible participants',()=>{
 expect(cash(123,rows(1))).toMatchObject({topPoolCents:123,remainingPoolCents:0,distributedCents:123})
 const input=rows(9);input[0].eligibleForCashback=false;input[4].eligibleForCashback=false
 const r=cash(100000,input);expect(r).toMatchObject({eligibleCount:7,topCount:2})
 expect(r.participants[0]).toMatchObject({position:1,eligiblePosition:0,cashbackCents:0})
 expect(r.participants[1]).toMatchObject({position:2,eligiblePosition:1,group:'top'})
 expect(r.participants[4].cashbackCents).toBe(0)
})

it('approved 200000 BRL with 500 eligible matches the 10x simulation and group budgets',()=>{
 const r=cash(20000000,rows(500));expect(r.rulesVersion).toBe('pareto-80-20-linear-10x-v1')
 expect([0,1,9,24,49,74,99,100,249,399,499].map(i=>r.participants[i].cashbackCents)).toEqual([290909,288264,267107,227438,161322,95207,29091,19950,12519,5037,50])
 expect(r.participants.slice(0,100).reduce((s,p)=>s+p.cashbackCents,0)).toBe(16000000)
 expect(r.participants.slice(100).reduce((s,p)=>s+p.cashbackCents,0)).toBe(4000000)
 expect(r.distributedCents).toBe(20000000);expect(r.unallocatedCents).toBe(0)
})

it('monthly Pareto applies ESG by identity without changing position or redistributing reductions',()=>{
 const input=rows(4),goals=[{id:'3',fulfilledProjects:0},{id:'1',fulfilledProjects:1},{id:'0',fulfilledProjects:0},{id:'2',fulfilledProjects:0}]
 const r=monthly(10000000,input,goals)
 expect(r.participants.map(p=>[p.position,p.cashbackCents,p.esg.requiredProjects,p.esg.payableCents])).toEqual([[1,8000000,3,4400000],[2,1000000,1,1000000],[3,666667,0,666667],[4,333333,0,333333]])
 expect(r.payableCents).toBe(6400000);expect(r.reductionCents).toBe(3600000);expect(r.unallocatedCents).toBe(0)
})

it('monthly integration conserves the pool at boundaries and maximum safe cents',()=>{
 for(const pool of [0,1,1000000,1500000,2000000,Number.MAX_SAFE_INTEGER])for(const done of [0,1,2,3]){
 const input=rows(7),r=monthly(pool,input,input.map(row=>({id:row.id,fulfilledProjects:done})))
 expect(BigInt(r.payableCents)+BigInt(r.reductionCents)+BigInt(r.unallocatedCents)).toBe(BigInt(pool))
 }
})
it('monthly integration keeps free position and leaves an ineligible pool unallocated',()=>{
 const input=rows(2).map(row=>({...row,eligibleForCashback:false})),r=monthly(2000000,input,input.map(row=>({id:row.id,fulfilledProjects:3})))
 expect(r).toMatchObject({payableCents:0,reductionCents:0,unallocatedCents:2000000});expect(r.participants.map(row=>row.position)).toEqual([1,2]);expect(monthly(100,[],[]).unallocatedCents).toBe(100)
})
it('monthly integration rejects missing duplicate unknown and malformed goal records',()=>{
 const input=rows(1)
 for(const goals of [[],[{id:'unknown',fulfilledProjects:0}],[{id:'0',fulfilledProjects:4}],[{id:'0',fulfilledProjects:NaN}],Array(1)])expect(()=>monthly(100,input,goals)).toThrow()
 expect(()=>monthly(100,rows(2),[{id:'0',fulfilledProjects:1},{id:'0',fulfilledProjects:2}])).toThrow()
})

it('incompatible six-person split and tiny-cent boundary are blocked instead of reversing rank payouts',()=>{
 expect(()=>cash(100000,rows(6))).toThrow('Distribuição incompatível')
 expect(()=>cash(3,rows(7))).toThrow('Distribuição incompatível')
 expect(cash(0,rows(6)).distributedCents).toBe(0)
})
it('variable counts and pools preserve group budgets and global eligibility order at realistic scales',()=>{
 for(const n of [2,3,4,5,7,8,9,10,11,19,20,21,99,100,101,500,501,5000])for(const pool of [1000000,20000000,123456789]){
 const r=cash(pool,rows(n));const values=r.participants.map(p=>p.cashbackCents)
 expect(values.every((v,i)=>i===0||values[i-1]>=v)).toBe(true)
 expect(r.topCount).toBe(Math.ceil(n/5));expect(r.topPoolCents+r.remainingPoolCents).toBe(pool)
 expect(r.participants.filter(p=>p.group==='top').reduce((s,p)=>s+p.cashbackCents,0)).toBe(r.topPoolCents)
 expect(r.distributedCents).toBe(pool)
 }
})

import {expect,it} from 'vitest'
import {calculateWellnessRankingPreview as score} from './rankingRules'
import {calculateLinearMonthlyCashbackPreview as monthly,calculateLinearCashbackPreview as cash,getEsgGuidance as esg,calculateMonthlyEsgPreview as release} from './cashbackLinearPreview'
function rows(n:number){return Array.from({length:n},(_,i)=>score({version:'046-test',referrals:'minimum_one',rating:'rounded'},{id:String(i),multiplier:1,completedEligibleServices:n-i,validatedReferrals:1,rating:5,seniorityMonths:1,previousPoints:0,partnerPro:false,joinedAt:'2026-01-01T00:00:00Z'}))}
it('approved linear distribution conserves a pool with uniformly descending weights',()=>{
 const r=cash(100000,rows(4))
 expect(r.participants.map(p=>p.cashbackCents)).toEqual([40000,30000,20000,10000]);expect(r.distributedCents).toBe(100000);expect(r.unallocatedCents).toBe(0)
})
it('free participants retain their global position but receive no allocation',()=>{
 const input=rows(3);input[0].eligibleForCashback=false
 const result=cash(900,input)
 expect(result.participants.map(r=>[r.position,r.cashbackCents])).toEqual([[1,0],[2,600],[3,300]])
})
it('no eligible participants leaves the pool unallocated',()=>{
 const input=rows(2).map(r=>({...r,eligibleForCashback:false}))
 expect(cash(500,input)).toMatchObject({distributedCents:0,unallocatedCents:500})
 expect(cash(500,[])).toMatchObject({distributedCents:0,unallocatedCents:500})
})
it('cent rounding is deterministic descending and reconciled including tiny pools',()=>{
 for(const n of [1,2,7,31,511])for(const pool of [0,1,2,99,100000,Number.MAX_SAFE_INTEGER]){
  const input=rows(n),before=JSON.stringify(input),r=cash(pool,input),amounts=r.participants.map(p=>p.cashbackCents)
  expect(amounts.reduce((s,p)=>s+BigInt(p),0n)).toBe(BigInt(pool))
  expect(amounts.every((v,i)=>i===0||amounts[i-1]>=v)).toBe(true)
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

it('approved 10000 BRL and 20 participants matches the accepted example exactly',()=>{
 const r=cash(1000000,rows(20));expect(r.rulesVersion).toBe('global-linear-v1');expect(r.simulationOnly).toBe(true)
 expect(r.participants.map(p=>p.cashbackCents)).toEqual([95238,90476,85714,80952,76190,71429,66667,61905,57143,52381,47619,42857,38095,33333,28571,23810,19048,14286,9524,4762]);expect(r.distributedCents).toBe(1000000)
})
it('approved 200000 BRL and 500 participants conserves every cent',()=>{
 const r=cash(20000000,rows(500));expect([0,1,2,9,99,249,498,499].map(i=>r.participants[i].cashbackCents)).toEqual([79840,79681,79521,78403,64032,40080,319,160]);expect(r.distributedCents).toBe(20000000);expect(r.unallocatedCents).toBe(0)
})

it('monthly linear preview applies ESG by identity without changing position or redistributing reductions',()=>{
 const input=rows(4),goals=[{id:'3',fulfilledProjects:0},{id:'1',fulfilledProjects:1},{id:'0',fulfilledProjects:3},{id:'2',fulfilledProjects:0}]
 const r=monthly(10000000,input,goals)
 expect(r.participants.map(p=>[p.position,p.cashbackCents,p.esg.requiredProjects,p.esg.payableCents])).toEqual([[1,4000000,3,4000000],[2,3000000,3,2100000],[3,2000000,3,1100000],[4,1000000,1,850000]])
 expect(r.payableCents).toBe(8050000);expect(r.reductionCents).toBe(1950000);expect(r.unallocatedCents).toBe(0)
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

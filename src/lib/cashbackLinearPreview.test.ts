import {expect,it} from 'vitest'
import {calculateWellnessRankingPreview as score} from './rankingRules'
import {calculateLinearCashbackPreview as cash,getEsgGuidance as esg} from './cashbackLinearPreview'
function rows(n:number){return Array.from({length:n},(_,i)=>score({version:'046-test',referrals:'minimum_one',rating:'rounded'},{id:String(i),multiplier:1,completedEligibleServices:n-i,validatedReferrals:1,rating:5,seniorityMonths:1,previousPoints:0,partnerPro:false,joinedAt:'2026-01-01T00:00:00Z'}))}
it('proposed linear distribution conserves a pool with uniformly descending weights',()=>{
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
it('ESG guidance uses exact inclusive thresholds and requires an explicit basis',()=>{
 expect([999999,1000000,1499999,1500000,1999999,2000000].map(n=>esg(n,'monthly').projects)).toEqual([0,1,1,2,2,3])
 expect(esg(2000000,'lifetime')).toMatchObject({guidanceOnly:true,basis:'lifetime',projects:3})
 expect(()=>esg(-1,'monthly')).toThrow();expect(()=>esg(1,undefined as unknown as 'monthly')).toThrow()
})

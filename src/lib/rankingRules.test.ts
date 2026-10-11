import {it,expect} from 'vitest'
import {calculateRankingPreview as calc,orderRankingPreview,countedRankingServices,calculateWellnessRankingPreview,type RankingPolicy} from './rankingRules'
const policy:RankingPolicy={version:'test-v1',referrals:'minimum_one',partnerServices:'actual',rating:'rounded'}
const facts={id:'a',multiplier:2,completedEligibleServices:10,validatedReferrals:3,rating:4.5,seniorityMonths:12,previousPoints:100,partnerPro:false,joinedAt:'2026-01-01T00:00:00Z'}
it('monthly and accumulated points use only supplied validated service/referral counts',()=>{expect(calc(policy,facts)).toMatchObject({monthlyPoints:77,totalPoints:177,simulationOnly:true});expect(calc(policy,{...facts,validatedReferrals:0}).monthlyPoints).toBe(37)})
it('alternative formulas require explicit policy and version',()=>{expect(calc({...policy,referrals:'plus_one'},facts).monthlyPoints).toBe(97);expect(calc({...policy,referrals:'legacy_divisor_18'},facts).monthlyPoints).toBe(40);expect(()=>calc({...policy,version:''},facts)).toThrow()})
it('floor and ceiling 150 remain distinct explicit choices',()=>{const f={...facts,partnerPro:true,validatedReferrals:1};expect(calc({...policy,partnerServices:'floor_150'},f).monthlyPoints).toBe(317);expect(calc({...policy,partnerServices:'cap_150'},f).monthlyPoints).toBe(37);expect(calc({...policy,partnerServices:'cap_150'},{...f,completedEligibleServices:200}).monthlyPoints).toBe(317)})
it('zero rating is kept rather than replaced with five stars',()=>{expect(calc(policy,{...facts,rating:0}).monthlyPoints).toBe(72)})
it('invalid or overflowing facts cannot produce a score',()=>{for(const change of [{rating:6},{multiplier:4},{validatedReferrals:-1},{previousPoints:Infinity},{completedEligibleServices:1.5},{joinedAt:'bad'},{completedEligibleServices:Number.MAX_SAFE_INTEGER}])expect(()=>calc(policy,{...facts,...change})).toThrow()})
it('deterministic ties keep general positions and reject mixed policies or duplicate users',()=>{const a=calc(policy,facts),b=calc(policy,{...facts,id:'b'});expect(orderRankingPreview([b,a]).map(r=>[r.id,r.position])).toEqual([['a',1],['b',2]]);expect(()=>orderRankingPreview([a,a])).toThrow();expect(()=>orderRankingPreview([a,{...b,rulesVersion:'other'}])).toThrow()})

it('approved PRO PARCEIRO counts 0 10 149 150 151 200 with fixed ceiling',()=>{expect([0,10,149,150,151,200].map(n=>countedRankingServices(n,true))).toEqual([0,10,149,150,150,150]);expect(countedRankingServices(200,false)).toBe(200)})
it('approved cap precedes multipliers and does not cap the entire point total',()=>{const p={version:'wellness-cap-150-2026-10-07',referrals:'minimum_one' as const,rating:'rounded' as const};const f={...facts,partnerPro:true,completedEligibleServices:200};expect(calculateWellnessRankingPreview(p,f).monthlyPoints).toBe(916.5);expect(calculateWellnessRankingPreview(p,{...f,completedEligibleServices:10}).monthlyPoints).toBe(76.5);expect(calculateWellnessRankingPreview(p,{...f,partnerPro:false}).monthlyPoints).toBe(1216.5)})

it('exact fractional ratings carry into following months without losing hundredths',()=>{
 const p={...policy,rating:'exact' as const}
 const first=calc(p,{...facts,rating:4.37,previousPoints:100.25})
 expect(first).toMatchObject({monthlyPoints:76.37,totalPoints:176.62})
 const second=calc(p,{...facts,rating:4.37,previousPoints:first.totalPoints})
 expect(second.totalPoints).toBe(252.99)
})
it('accepts fractional averages and rejects invalid or unsafe accumulated totals',()=>{
 for(const previousPoints of [-0.01,NaN,Number.MAX_SAFE_INTEGER/100])expect(()=>calc(policy,{...facts,previousPoints})).toThrow()
 expect(calc({...policy,rating:'exact'},{...facts,rating:4.371}).rating).toBe(4.371)
})
it('same version label cannot combine different referral service or rating policies',()=>{
 const a=calc(policy,facts)
 for(const change of [{referrals:'plus_one' as const},{partnerServices:'cap_150' as const},{rating:'exact' as const}]){
  const b=calc({...policy,...change},{...facts,id:'b'})
  expect(()=>orderRankingPreview([a,b])).toThrow()
 }
})
it('rejects malformed and sparse ranking rows before assigning positions',()=>{
 const a=calc(policy,facts)
 for(const change of [{id:''},{rating:6},{rating:-1},{monthlyPoints:-1},{monthlyPoints:178},{totalPoints:-0.001},{rulesKey:''},{simulationOnly:1}])expect(()=>orderRankingPreview([{...a,...change} as typeof a])).toThrow()
 expect(()=>orderRankingPreview(new Array(2))).toThrow()
 expect(orderRankingPreview([])).toEqual([])
})
it('sorting preserves inputs and uses rating then date then id for ties',()=>{
 const a=calc(policy,{...facts,id:'a'}),b=calc(policy,{...facts,id:'b'}),c=calc(policy,{...facts,id:'c'})
 const rows=[{...c,rating:4,joinedAt:'2025-01-01T00:00:00Z'},{...b,joinedAt:'2025-01-01T00:00:00Z'},a]
 const before=JSON.stringify(rows)
 expect(orderRankingPreview(rows).map(r=>r.id)).toEqual(['b','a','c'])
 expect(JSON.stringify(rows)).toBe(before)
})

it('046 corrected free plan receives rating and seniority but is inactive for cashback',()=>{
 const row=calculateWellnessRankingPreview({version:'046-corrected',referrals:'minimum_one',rating:'exact'},{...facts,multiplier:0,previousPoints:100.25})
 expect(row).toMatchObject({monthlyPoints:16.5,totalPoints:116.75,eligibleForCashback:false})
 expect(orderRankingPreview([row])[0].position).toBe(1)
})
it('046 corrected ranking includes free users by total points with no second position',()=>{
 const free=calc(policy,{...facts,id:'free',multiplier:0,previousPoints:10000})
 const paid=calc(policy,{...facts,id:'paid'})
 expect(orderRankingPreview([paid,free]).map(r=>[r.id,r.position,r.eligibleForCashback])).toEqual([['free',1,false],['paid',2,true]])
 expect(()=>orderRankingPreview([{...paid,eligibleForCashback:undefined} as unknown as typeof paid])).toThrow()
})

it('approved seniority has minimum one and no business ceiling for free and paid plans',()=>{
 for(const months of [0,1,10,11,24,120])for(const multiplier of [0,2]){
 const row=calc(policy,{...facts,multiplier,rating:5,seniorityMonths:months,completedEligibleServices:0,previousPoints:0})
 expect(row.monthlyPoints).toBe(5+Math.max(1,months));expect(row.eligibleForCashback).toBe(multiplier>0)
 }
})
it('free beginner starts with six and real zero rating remains zero',()=>{
 const beginner={...facts,multiplier:0,rating:5,seniorityMonths:0,previousPoints:0}
 expect(calc(policy,beginner)).toMatchObject({monthlyPoints:6,totalPoints:6,eligibleForCashback:false})
 expect(calc(policy,{...beginner,rating:0}).monthlyPoints).toBe(1)
})

it('approved Wellness rating preserves decimal and repeating averages even with an old rounded draft',()=>{
 for(const rating of [3.8,4.2,13/3,0]){
 const row=calculateWellnessRankingPreview({version:'mean-v1',referrals:'minimum_one',rating:'rounded'},{...facts,multiplier:0,rating,seniorityMonths:24,previousPoints:10})
 expect(row.monthlyPoints).toBe(24+rating);expect(row.totalPoints).toBeCloseTo(34+rating,12);expect(row.rating).toBe(rating)
 expect(orderRankingPreview([row])[0].position).toBe(1)
 }
})

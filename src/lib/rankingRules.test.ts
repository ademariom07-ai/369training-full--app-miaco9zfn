import {it,expect} from 'vitest'
import {calculateRankingPreview as calc,orderRankingPreview,countedRankingServices,calculateWellnessRankingPreview,type RankingPolicy} from './rankingRules'
const policy:RankingPolicy={version:'test-v1',referrals:'minimum_one',partnerServices:'actual',rating:'rounded'}
const facts={id:'a',multiplier:2,completedEligibleServices:10,validatedReferrals:3,rating:4.5,seniorityMonths:12,previousPoints:100,partnerPro:false,joinedAt:'2026-01-01T00:00:00Z'}
it('monthly and accumulated points use only supplied validated service/referral counts',()=>{expect(calc(policy,facts)).toMatchObject({monthlyPoints:75,totalPoints:175,simulationOnly:true});expect(calc(policy,{...facts,validatedReferrals:0}).monthlyPoints).toBe(35)})
it('alternative formulas require explicit policy and version',()=>{expect(calc({...policy,referrals:'plus_one'},facts).monthlyPoints).toBe(95);expect(calc({...policy,referrals:'legacy_divisor_18'},facts).monthlyPoints).toBe(38);expect(()=>calc({...policy,version:''},facts)).toThrow()})
it('floor and ceiling 150 remain distinct explicit choices',()=>{const f={...facts,partnerPro:true,validatedReferrals:1};expect(calc({...policy,partnerServices:'floor_150'},f).monthlyPoints).toBe(315);expect(calc({...policy,partnerServices:'cap_150'},f).monthlyPoints).toBe(35);expect(calc({...policy,partnerServices:'cap_150'},{...f,completedEligibleServices:200}).monthlyPoints).toBe(315)})
it('zero rating is kept rather than replaced with five stars',()=>{expect(calc(policy,{...facts,rating:0}).monthlyPoints).toBe(70)})
it('invalid or overflowing facts cannot produce a score',()=>{for(const change of [{rating:6},{multiplier:4},{validatedReferrals:-1},{previousPoints:Infinity},{completedEligibleServices:1.5},{joinedAt:'bad'},{completedEligibleServices:Number.MAX_SAFE_INTEGER}])expect(()=>calc(policy,{...facts,...change})).toThrow()})
it('deterministic ties keep general positions and reject mixed policies or duplicate users',()=>{const a=calc(policy,facts),b=calc(policy,{...facts,id:'b'});expect(orderRankingPreview([b,a]).map(r=>[r.id,r.position])).toEqual([['a',1],['b',2]]);expect(()=>orderRankingPreview([a,a])).toThrow();expect(()=>orderRankingPreview([a,{...b,rulesVersion:'other'}])).toThrow()})

it('approved PRO PARCEIRO counts 0 10 149 150 151 200 with fixed ceiling',()=>{expect([0,10,149,150,151,200].map(n=>countedRankingServices(n,true))).toEqual([0,10,149,150,150,150]);expect(countedRankingServices(200,false)).toBe(200)})
it('approved cap precedes multipliers and does not cap the entire point total',()=>{const p={version:'wellness-cap-150-2026-10-07',referrals:'minimum_one' as const,rating:'rounded' as const};const f={...facts,partnerPro:true,completedEligibleServices:200};expect(calculateWellnessRankingPreview(p,f).monthlyPoints).toBe(915);expect(calculateWellnessRankingPreview(p,{...f,completedEligibleServices:10}).monthlyPoints).toBe(75);expect(calculateWellnessRankingPreview(p,{...f,partnerPro:false}).monthlyPoints).toBe(1215)})

it('exact fractional ratings carry into following months without losing hundredths',()=>{
 const p={...policy,rating:'exact' as const}
 const first=calc(p,{...facts,rating:4.37,previousPoints:100.25})
 expect(first).toMatchObject({monthlyPoints:74.37,totalPoints:174.62})
 const second=calc(p,{...facts,rating:4.37,previousPoints:first.totalPoints})
 expect(second.totalPoints).toBe(248.99)
})
it('rejects sub-hundredth balances and unsafe accumulated totals',()=>{
 for(const previousPoints of [-0.01,0.001,NaN,Number.MAX_SAFE_INTEGER/100])expect(()=>calc(policy,{...facts,previousPoints})).toThrow()
 expect(()=>calc({...policy,rating:'exact'},{...facts,rating:4.371})).toThrow()
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
 for(const change of [{id:''},{rating:6},{rating:-1},{monthlyPoints:-1},{monthlyPoints:176},{totalPoints:0.001},{rulesKey:''},{simulationOnly:1}])expect(()=>orderRankingPreview([{...a,...change} as typeof a])).toThrow()
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

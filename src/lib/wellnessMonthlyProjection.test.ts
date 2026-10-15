import {describe,it,expect} from 'vitest'
import {projectWellnessMonth,type MonthlyParticipant} from './wellnessMonthlyProjection'
import type {ConfirmedFeeEvent} from './wellnessCommercialRules'
const event:ConfirmedFeeEvent={chargeId:'c',payerId:'payer',payerType:'partner',period:'2026-10',amountCents:14900,refundedCents:0,status:'settled',plan:'pro_partner',kind:'monthly',businessId:'invoice',linkedStudent:false,serviceCompleted:false,clientEvaluated:false,professionalEvaluated:false}
const person=(id:string,rating=5):MonthlyParticipant=>({period:'2026-10',kind:'partner',plan:'pro_partner',linkedProfessionalPlan:null,previousStudentPlan:null,fulfilledProjects:0,facts:{id,multiplier:2,completedEligibleServices:10,validatedReferrals:1,rating,seniorityMonths:1,previousPoints:0,partnerPro:true,joinedAt:'2026-01-01'}})
const input={period:'2026-10',complete:true,events:[event],referrals:'minimum_one' as const}
describe('Full monthly projection',()=>{
 it('connects receipts, ranking, eligibility, Pareto and ESG without writes',()=>{const p=person('eligible'),low=person('low',4.8);low.facts.previousPoints=1000;const result=projectWellnessMonth({...input,participants:[p,low]});expect(result.totals.poolCents).toBe(5662);expect(result.totals.eligibleCount).toBe(1);expect(result.participants[0].id).toBe('low');expect(result.participants[0].cashbackCents).toBe(0);expect(result.participants[1].cashbackCents).toBe(5662);expect(result.participants[1].totalPoints).toBe(306);expect(result.participants[1].actualCompletedServices).toBe(10);expect(result.paymentAuthorized).toBe(false);expect(p.facts.completedEligibleServices).toBe(10)})
 it('applies linked paid eligibility but does not invent a student charge',()=>{const p={...person('student'),kind:'student' as const,plan:'free' as const,linkedProfessionalPlan:'premium' as const,scoringChoice:'migrate' as const};const result=projectWellnessMonth({...input,participants:[p]});expect(result.totals.eligibleCount).toBe(1);expect(result.source.studentFeeCents).toBe(0);expect(result.participants[0].totalPoints).toBe(36)})
 it('does not distribute money when everyone is ineligible',()=>{const result=projectWellnessMonth({...input,participants:[person('low',4.8)]});expect(result.totals.distributedCents).toBe(0);expect(result.totals.unallocatedCents).toBe(5662)})
 it('rejects wrong month, duplicate people, missing historical plan and negative actual services',()=>{expect(()=>projectWellnessMonth({...input,participants:[{...person('p'),period:'2026-09'}]})).toThrow();expect(()=>projectWellnessMonth({...input,participants:[person('p'),person('p')]})).toThrow();expect(()=>projectWellnessMonth({...input,participants:[{...person('p'),kind:'student',plan:'free',linkedProfessionalPlan:'pro_partner'}]})).toThrow();const p=person('p');p.facts.completedEligibleServices=-1;expect(()=>projectWellnessMonth({...input,participants:[p]})).toThrow()})
 it('blocks incompatible Pareto combinations instead of reversing payouts',()=>{expect(()=>projectWellnessMonth({...input,participants:Array.from({length:6},(_,i)=>person(String(i)))})).toThrow(/incompatível/)})
 it('retains ESG reductions and reconciles the full pool exactly',()=>{const events=Array.from({length:1000},(_,i)=>({...event,chargeId:'c'+i,businessId:'invoice'+i}));const result=projectWellnessMonth({...input,events,participants:[person('p')]});expect(result.totals.poolCents).toBe(5662000);expect(result.totals.payableCents).toBe(3114100);expect(result.totals.payableCents+result.totals.reductionCents+result.totals.unallocatedCents).toBe(result.totals.poolCents)})
})

 it('uses student own actual services after migrating to PRO PARCEIRO, never fixed 150',()=>{
  const p:MonthlyParticipant={...person('student'),kind:'student',plan:'premium',linkedProfessionalPlan:'pro_partner',scoringChoice:'migrate'}
  const result=projectWellnessMonth({...input,participants:[p]})
  expect(result.participants[0].monthlyPoints).toBe(26)
  expect(result.participants[0].actualCompletedServices).toBe(10)
  expect(result.totals.eligibleCount).toBe(1)
 })
 it('keeps free student scoring at rating plus uncapped age when choice is keep',()=>{
  const p:MonthlyParticipant={...person('student'),kind:'student',plan:'free',linkedProfessionalPlan:'premium',scoringChoice:'keep'}
  p.facts.seniorityMonths=120;p.facts.previousPoints=100;p.facts.rating=4.9
  const result=projectWellnessMonth({...input,participants:[p]})
  expect(result.participants[0].monthlyPoints).toBe(124.9)
  expect(result.participants[0].totalPoints).toBe(224.9)
  expect(result.participants[0].cashbackCents).toBe(0)
 })
 it('rejects absent choice even for a linked non-PRO-PARCEIRO student',()=>{
  expect(()=>projectWellnessMonth({...input,participants:[{...person('student'),kind:'student',plan:'basic',linkedProfessionalPlan:'premium'}]})).toThrow(/escolha/)
 })
 it('keeps original student plan and facts unchanged across projections',()=>{
  const p:MonthlyParticipant={...person('student'),kind:'student',plan:'premium',linkedProfessionalPlan:'pro_partner',scoringChoice:'keep'}
  const before=JSON.stringify(p)
  expect(projectWellnessMonth({...input,participants:[p]}).participants[0].monthlyPoints).toBe(36)
  expect(JSON.stringify(p)).toBe(before)
 })

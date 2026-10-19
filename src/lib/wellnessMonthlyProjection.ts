import {prepareConfirmedFeePool,confirmedRanking,resolveStudentPlan,type ConfirmedFeeEvent,type WellnessPlan} from './wellnessCommercialRules'
import {orderRankingPreview,type RankingFacts,type RankingPolicy} from './rankingRules'
import {calculateLinearMonthlyCashbackPreview,type CashbackPolicy} from './cashbackLinearPreview'

export type MonthlyParticipant={
 period:string;kind:'student'|'partner';plan:WellnessPlan;
 linkedProfessionalPlan:WellnessPlan|null;previousStudentPlan:WellnessPlan|null;
 scoringChoice?:'keep'|'migrate';
 facts:RankingFacts;fulfilledProjects:number
}
/** Read-only orchestration. Authentication, verified receipts, historical snapshots
 * and persistent idempotency belong to the server adapter, not these input flags.
 * This function never closes a month, persists a balance or authorizes a payment.
 */
export function projectWellnessMonth(input:{period:string;complete:boolean;events:ConfirmedFeeEvent[];participants:MonthlyParticipant[];referrals:RankingPolicy['referrals'];cashbackPolicy?:CashbackPolicy}){
 if(!input||!Array.isArray(input.participants)||input.participants.length>500000)throw Error('Participantes inválidos.')
 const source=prepareConfirmedFeePool(input.period,input.events,input.complete)
 const ranking=input.participants.map(participant=>{
  if(!participant||participant.period!==input.period||!['student','partner'].includes(participant.kind)||!participant.facts||!Number.isSafeInteger(participant.facts.completedEligibleServices)||participant.facts.completedEligibleServices<0)throw Error('Dados de ranking inválidos ou de outro mês.')
  if(participant.kind==='partner'&&(participant.linkedProfessionalPlan!==null||participant.previousStudentPlan!==null))throw Error('Vínculo de aluno não se aplica ao parceiro.')
  const plan=participant.kind==='student'?resolveStudentPlan(participant.plan,participant.linkedProfessionalPlan,participant.scoringChoice).effectivePlan:participant.plan
  return confirmedRanking({version:'monthly-projection-v2-choice',referrals:input.referrals},participant.facts,plan)
 })
 const ordered=orderRankingPreview(ranking)
 const distribution=calculateLinearMonthlyCashbackPreview(source.poolCents,ordered,input.participants.map(p=>({id:p.facts.id,fulfilledProjects:p.fulfilledProjects})),input.cashbackPolicy)
 const financialById=new Map(distribution.participants.map(p=>[p.id,p]))
 const factsById=new Map(input.participants.map(p=>[p.facts.id,p.facts]))
 return {
  simulationOnly:true as const,paymentAuthorized:false as const,period:input.period,
  integrationStatus:'adapter-required' as const,source,
  totals:{poolCents:source.poolCents,eligibleCount:distribution.eligibleCount,distributedCents:distribution.distributedCents,payableCents:distribution.payableCents,reductionCents:distribution.reductionCents,unallocatedCents:distribution.unallocatedCents},
  participants:ordered.map(row=>({...row,...financialById.get(row.id)!,actualCompletedServices:factsById.get(row.id)!.completedEligibleServices}))
 }
}

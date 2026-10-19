import {projectServiceEvents,type ServiceEventSnapshot} from './serviceEventsPreview'
import {confirmedRanking,resolveStudentPlan,type WellnessPlan} from './wellnessCommercialRules'
import {orderRankingPreview,type RankingFacts,type RankingPolicy} from './rankingRules'
export type ServiceRankingParticipant={
 kind:'student'|'partner';plan:WellnessPlan;linkedProfessionalPlan:WellnessPlan|null;
 scoringChoice?:'keep'|'migrate';facts:Omit<RankingFacts,'completedEligibleServices'|'multiplier'|'partnerPro'>
}
/** Recomputes a simulation from latest service revisions, never increments stored points.
 * previousPoints must include CLOSED prior months only, never this month's previous projection.
 * Input payment flags are assertions, not receipts. No persistence or financial authority.
 */
export function projectServiceRanking(period:string,events:ServiceEventSnapshot[],participants:ServiceRankingParticipant[],referrals:RankingPolicy['referrals']='minimum_one'){
 if(!Array.isArray(participants)||participants.length>500000)throw Error('Participantes inválidos.')
 const byId=new Map<string,ServiceRankingParticipant>()
 for(const p of participants){
  if(!p||!p.facts||typeof p.facts.id!=='string'||!p.facts.id.trim()||byId.has(p.facts.id)||!['student','partner'].includes(p.kind))throw Error('Participante ausente, duplicado ou inválido.')
  if(p.kind==='partner'&&(p.linkedProfessionalPlan!==null||p.scoringChoice!==undefined))throw Error('Escolha de vínculo exclusiva do aluno.')
  byId.set(p.facts.id,p)
 }
 const replay=projectServiceEvents(period,events)
 for(const service of replay.services){
  if(byId.get(service.studentId)?.kind!=='student'||byId.get(service.partnerId)?.kind!=='partner')throw Error('Serviço exige aluno e profissional identificados na projeção.')
 }
 const counts=new Map(replay.participants.map(p=>[p.id,p.eligibleServices]))
 const rows=participants.map(p=>{
  const plan=p.kind==='student'?resolveStudentPlan(p.plan,p.linkedProfessionalPlan,p.scoringChoice).effectivePlan:p.plan
  const actualCompletedServices=counts.get(p.facts.id)??0
  const points=confirmedRanking({version:'service-replay-v1',referrals},{...p.facts,multiplier:0,partnerPro:false,completedEligibleServices:actualCompletedServices},plan)
  return {...points,actualCompletedServices,scoringServices:plan==='pro_partner'?150:actualCompletedServices}
 })
 const details=new Map(rows.map(p=>[p.id,p]))
 return {simulationOnly:true as const,pointsWriteAuthorized:false as const,paymentAuthorized:false as const,period,duplicateEventsIgnored:replay.duplicateEventsIgnored,services:replay.services,ranking:orderRankingPreview(rows).map(p=>({...p,actualCompletedServices:details.get(p.id)!.actualCompletedServices,scoringServices:details.get(p.id)!.scoringServices}))}
}

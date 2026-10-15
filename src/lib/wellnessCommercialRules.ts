import {prepareFeeLedgerPool, type FeeLedgerRow} from './feeCashbackPool'
import {calculateRankingPreview, type RankingFacts, type RankingPolicy} from './rankingRules'

/** Confirmed 2026-10-13. Pure integration boundary: does not collect or pay money. */
export type WellnessPlan='free'|'basic'|'pro'|'premium'|'pro_partner'
const studentFees={free:0,basic:1000,pro:2000,premium:3000}
const partnerFees={free:0,basic:100,pro:200,premium:300,pro_partner:14900}
const weights={free:0,basic:1,pro:2,premium:3,pro_partner:2}
function validPlan(plan:WellnessPlan){if(!Object.hasOwn(weights,plan))throw Error('Plano inválido.')}
/** Own plan is the preserved historical snapshot, never overwritten by a link.
 * A linked student must have an explicit recorded scoring choice.
 */
export function resolveStudentPlan(own:WellnessPlan,linked:WellnessPlan|null,choice?:'keep'|'migrate'){
 validPlan(own);if(own==='pro_partner')throw Error('Plano exclusivo do profissional.')
 if(linked!==null)validPlan(linked)
 if(choice!==undefined&&!['keep','migrate'].includes(choice))throw Error('Escolha de pontuação inválida.')
 if(linked!==null&&choice===undefined)throw Error('Aluno vinculado exige escolha registrada: manter ou migrar coeficiente.')
 if(linked===null&&choice==='migrate')throw Error('Migração exige vínculo ativo.')
 const selected=choice==='migrate'&&linked!==null?linked:own
 // Same coefficient as PRO, without borrowing professional-only fixed service volume.
 const effectivePlan=selected==='pro_partner'?'pro':selected
 return {effectivePlan,coefficient:weights[effectivePlan],benefitsPlan:linked??own,ownPlanPreserved:own,monthlyFeeCents:linked===null?studentFees[own]:0,monthlyFeeExempt:linked!==null,inheritFixed150Services:false as const}
}
export function cashbackEligibility(plan:WellnessPlan,averageRating:number){
 validPlan(plan)
 if(!Number.isFinite(averageRating)||averageRating<0||averageRating>5)throw Error('Avaliação inválida.')
 return plan!=='free'&&averageRating>4.8
}
export function confirmedRanking(policy:Omit<RankingPolicy,'partnerServices'|'rating'>,facts:RankingFacts,effectivePlan:WellnessPlan){
 validPlan(effectivePlan)
 const normalized={...facts,multiplier:weights[effectivePlan],partnerPro:false,completedEligibleServices:effectivePlan==='pro_partner'?150:facts.completedEligibleServices}
 const row=calculateRankingPreview({...policy,version:policy.version+'-commercial-2026-10-13',partnerServices:'actual',rating:'exact'},normalized)
 return {...row,eligibleForCashback:cashbackEligibility(effectivePlan,facts.rating)}
}
export type ConfirmedFeeEvent=FeeLedgerRow & {
 plan:WellnessPlan;kind:'monthly'|'service';businessId:string;
 linkedStudent:boolean;serviceCompleted:boolean;clientEvaluated:boolean;professionalEvaluated:boolean
}
/** Input must come from an authenticated payment adapter, not browser claims.
 * Business IDs identify the invoice or service, preventing duplicate webhook IDs.
 * Historical plan/link snapshots must represent the charged event, not current profile.
 */
export function prepareConfirmedFeePool(period:string,events:ConfirmedFeeEvent[],complete:boolean){
 if(!Array.isArray(events))throw Error('Eventos inválidos.')
 const seen=new Set<string>()
 for(const event of events){
  if(!event||typeof event.businessId!=='string'||!event.businessId.trim()||!['monthly','service'].includes(event.kind)||[event.linkedStudent,event.serviceCompleted,event.clientEvaluated,event.professionalEvaluated].some(v=>typeof v!=='boolean'))throw Error('Evento incompleto.')
  validPlan(event.plan)
  const key=JSON.stringify([event.payerType,event.payerId,event.kind,event.businessId])
  if(seen.has(key))throw Error('Evento financeiro duplicado.');seen.add(key)
  let expected:number
  if(event.payerType==='student'){
   if(event.kind!=='monthly'||event.plan==='pro_partner')throw Error('Cobrança de aluno inválida.')
   expected=event.linkedStudent?0:studentFees[event.plan]
  }else if(event.payerType==='partner'){
   if(event.linkedStudent)throw Error('Vínculo de aluno não se aplica ao parceiro.')
   if(event.plan==='pro_partner'){
    if(event.kind!=='monthly')throw Error('PRO PARCEIRO não gera tarifa por serviço.')
   }else if(event.kind!=='service'||!event.serviceCompleted||!event.clientEvaluated||!event.professionalEvaluated)throw Error('Serviço deve estar concluído e avaliado por cliente e profissional.')
   expected=partnerFees[event.plan]
  }else throw Error('Tipo de pagador inválido.')
  if(event.amountCents!==expected)throw Error('Valor diverge da tarifa confirmada.')
 }
 return {...prepareFeeLedgerPool(period,events,complete),integrationStatus:'adapter-required' as const}
}

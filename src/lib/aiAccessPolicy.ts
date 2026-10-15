import type {WellnessPlan} from './wellnessCommercialRules'
export type ConsultationLimits=Record<WellnessPlan,number|null>
// null means unlimited. PRO PARCEIRO intentionally requires an administrator decision.
export const CONFIRMED_AI_LIMITS={free:2,basic:5,pro:10,premium:null} as const
export function validateConsultationLimits(input:unknown):ConsultationLimits{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Configuração inválida.')
 const keys=['free','basic','pro','premium','pro_partner'] as const
 if(Object.keys(input).length!==keys.length)throw Error('Informe os cinco planos.')
 const result={} as ConsultationLimits
 for(const key of keys){if(!Object.hasOwn(input,key))throw Error('Plano ausente.');const n=(input as ConsultationLimits)[key];if(n!==null&&(!Number.isSafeInteger(n)||n<0||n>1000000))throw Error('Limite inválido.');result[key]=n}
 return result
}
/** Caller supplies usage from an authorized, atomic server counter for the selected
 * period; this helper is not a quota reservation or permission to charge. */
export function consultationAccess(limits:ConsultationLimits,plan:WellnessPlan,used:number){
 const validated=validateConsultationLimits(limits)
 if(!Object.hasOwn(validated,plan)||!Number.isSafeInteger(used)||used<0)throw Error('Uso inválido.')
 const limit=validated[plan]
 return {canGenerate:limit===null||used<limit,remaining:limit===null?null:Math.max(0,limit-used),canReadPreviouslyAuthorizedPlan:true,chargeAuthorized:false as const}
}
/** Explicit recorded choice. Choosing a coefficient does not inherit the partner's
 * fictional service volume; 150 remains exclusive to the professional's score. */
export function resolveStudentChoice(own:Exclude<WellnessPlan,'pro_partner'>,partner:WellnessPlan|null,choice:'keep'|'migrate'){
 const weights={free:0,basic:1,pro:2,premium:3,pro_partner:2}
 if(!Object.hasOwn(weights,own)||String(own)==='pro_partner'||!['keep','migrate'].includes(choice)||(partner!==null&&!Object.hasOwn(weights,partner)))throw Error('Escolha inválida.')
 if(partner===null&&choice==='migrate')throw Error('Migração exige vínculo ativo.')
 const coefficient=weights[choice==='migrate'&&partner!==null?partner:own]
 return {coefficient,benefitsPlan:partner??own,ownPlanPreserved:own,monthlyFeeExempt:partner!==null,inheritFixed150Services:false as const}
}
export type CareArea='physical_education'|'nutrition'|'physiotherapy'|'psychology'|'martial_arts'
/** Product guardrail, not certification of legal compliance or clinical suitability.
 * Guardian/age/consent verification is server-side and cannot be self-asserted. */
export function generationRoute(input:{area:CareArea;individualized:boolean;riskFlag:boolean;age:number|null;minorFlowVerified:boolean}){
 if(!input||!['physical_education','nutrition','physiotherapy','psychology','martial_arts'].includes(input.area)||[input.individualized,input.riskFlag,input.minorFlowVerified].some(v=>typeof v!=='boolean'))throw Error('Contexto inválido.')
 if(input.age===null)return {route:'age_verification_required' as const}
 if(!Number.isInteger(input.age)||input.age<0||input.age>120)throw Error('Idade inválida.')
 if(input.age<18&&!input.minorFlowVerified)return {route:'minor_flow_required' as const}
 if(input.riskFlag||input.age<18||(input.individualized&&['nutrition','physiotherapy','psychology'].includes(input.area)))return {route:'professional_review_required' as const}
 return {route:'educational_proposal' as const}
}

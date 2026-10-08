/** Explicit simulation policies. No active production policy or ledger writes. */
export const APPROVED_PARTNER_SERVICES='cap_150' as const
export const PARTNER_SERVICE_CAP=150
export function countedRankingServices(completed:number,partnerPro:boolean){integer(completed);if(typeof partnerPro!=='boolean')throw Error('Plano inválido.');return partnerPro?Math.min(completed,PARTNER_SERVICE_CAP):completed}
export type RankingPolicy={version:string;referrals:'minimum_one'|'plus_one'|'legacy_divisor_18';partnerServices:'actual'|'floor_150'|'cap_150';rating:'rounded'|'exact'}
export type RankingFacts={id:string;multiplier:number;completedEligibleServices:number;validatedReferrals:number;rating:number;seniorityMonths:number;previousPoints:number;partnerPro:boolean;joinedAt:string}
function integer(value:number,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('Contagem inválida.');return value}
// Points use integer hundredths so exact ratings can carry into the next month.
function pointHundredths(value:number){
 const scaled=value*100,rounded=Math.round(scaled)
 if(!Number.isFinite(value)||value<0||!Number.isSafeInteger(rounded)||Math.abs(scaled-rounded)>0.000001)throw Error('Pontuação fora dos limites.')
 return rounded
}
function policyKey(policy:RankingPolicy){return JSON.stringify([policy.version,policy.referrals,policy.partnerServices,policy.rating])}
export function calculateRankingPreview(policy:RankingPolicy,facts:RankingFacts){
 if(!policy||typeof policy.version!=='string'||!policy.version.trim()||policy.version.length>80||!['minimum_one','plus_one','legacy_divisor_18'].includes(policy.referrals)||!['actual','floor_150','cap_150'].includes(policy.partnerServices)||!['rounded','exact'].includes(policy.rating))throw Error('Defina uma versão completa das regras.')
 if(!facts||typeof facts.id!=='string'||!facts.id.trim()||!Number.isFinite(Date.parse(facts.joinedAt))||!Number.isFinite(facts.rating)||facts.rating<0||facts.rating>5)throw Error('Participante inválido.')
 const multiplier=integer(facts.multiplier,3),services=integer(facts.completedEligibleServices),referrals=integer(facts.validatedReferrals),age=integer(facts.seniorityMonths),previous=pointHundredths(facts.previousPoints)
 if(typeof facts.partnerPro!=='boolean')throw Error('Plano inválido.')
 const effectiveServices=facts.partnerPro?policy.partnerServices==='floor_150'?Math.max(services,150):policy.partnerServices==='cap_150'?countedRankingServices(services,true):services:services
 const factor=policy.referrals==='minimum_one'?Math.max(referrals,1):policy.referrals==='plus_one'?referrals+1:referrals/18+1
 const rating=policy.rating==='rounded'?Math.round(facts.rating):facts.rating
 const monthly=Math.round(multiplier*effectiveServices*factor)+rating+Math.min(10,Math.max(age,1))
 const monthlyHundredths=pointHundredths(monthly),totalHundredths=previous+monthlyHundredths
 if(!Number.isSafeInteger(totalHundredths))throw Error('Pontuação fora dos limites.')
 return {simulationOnly:true as const,rulesVersion:policy.version,rulesKey:policyKey(policy),eligibleForCashback:multiplier>0,id:facts.id,monthlyPoints:monthlyHundredths/100,totalPoints:totalHundredths/100,rating,joinedAt:facts.joinedAt}
}
export function orderRankingPreview(rows:ReturnType<typeof calculateRankingPreview>[]){
 if(!Array.isArray(rows)||rows.length>500000)throw Error('Ranking inválido ou regras misturadas.')
 const ids=new Set<string>(),versions=new Set<string>(),keys=new Set<string>()
 // Iteration includes sparse entries; Array.some/map would silently skip them.
 for(const row of rows){
  if(!row||row.simulationOnly!==true||typeof row.eligibleForCashback!=='boolean'||typeof row.id!=='string'||!row.id.trim()||ids.has(row.id)||typeof row.rulesVersion!=='string'||!row.rulesVersion.trim()||typeof row.rulesKey!=='string'||!row.rulesKey||!Number.isFinite(row.rating)||row.rating<0||row.rating>5||typeof row.joinedAt!=='string'||!Number.isFinite(Date.parse(row.joinedAt)))throw Error('Ranking inválido ou regras misturadas.')
  const monthly=pointHundredths(row.monthlyPoints),total=pointHundredths(row.totalPoints)
  if(total<monthly)throw Error('Ranking inválido ou regras misturadas.')
  ids.add(row.id);versions.add(row.rulesVersion);keys.add(row.rulesKey)
 }
 if(versions.size>1||keys.size>1)throw Error('Ranking inválido ou regras misturadas.')
 return rows.map(r=>({...r})).sort((a,b)=>b.totalPoints-a.totalPoints||b.rating-a.rating||Date.parse(a.joinedAt)-Date.parse(b.joinedAt)||(a.id<b.id?-1:a.id>b.id?1:0)).map((r,i)=>({...r,position:i+1}))
}

/** Current WELLNESS decision; other policy fields still require explicit selection. */
export function calculateWellnessRankingPreview(policy:Omit<RankingPolicy,'partnerServices'>,facts:RankingFacts){return calculateRankingPreview({...policy,partnerServices:APPROVED_PARTNER_SERVICES},facts)}

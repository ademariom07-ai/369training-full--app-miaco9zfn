/** Explicit simulation policies. No active production policy or ledger writes. */
export type RankingPolicy={version:string;referrals:'minimum_one'|'plus_one'|'legacy_divisor_18';partnerServices:'actual'|'floor_150'|'cap_150';rating:'rounded'|'exact'}
export type RankingFacts={id:string;multiplier:number;completedEligibleServices:number;validatedReferrals:number;rating:number;seniorityMonths:number;previousPoints:number;partnerPro:boolean;joinedAt:string}
function integer(value:number,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('Contagem inválida.');return value}
export function calculateRankingPreview(policy:RankingPolicy,facts:RankingFacts){
 if(!policy||typeof policy.version!=='string'||!policy.version.trim()||policy.version.length>80||!['minimum_one','plus_one','legacy_divisor_18'].includes(policy.referrals)||!['actual','floor_150','cap_150'].includes(policy.partnerServices)||!['rounded','exact'].includes(policy.rating))throw Error('Defina uma versão completa das regras.')
 if(!facts||typeof facts.id!=='string'||!facts.id.trim()||!Number.isFinite(Date.parse(facts.joinedAt))||!Number.isFinite(facts.rating)||facts.rating<0||facts.rating>5)throw Error('Participante inválido.')
 const multiplier=integer(facts.multiplier,3),services=integer(facts.completedEligibleServices),referrals=integer(facts.validatedReferrals),age=integer(facts.seniorityMonths),previous=integer(facts.previousPoints)
 if(typeof facts.partnerPro!=='boolean')throw Error('Plano inválido.')
 const effectiveServices=facts.partnerPro?policy.partnerServices==='floor_150'?Math.max(services,150):policy.partnerServices==='cap_150'?Math.min(services,150):services:services
 const factor=policy.referrals==='minimum_one'?Math.max(referrals,1):policy.referrals==='plus_one'?referrals+1:referrals/18+1
 const rating=policy.rating==='rounded'?Math.round(facts.rating):facts.rating
 const monthly=Math.round(multiplier*effectiveServices*factor)+rating+Math.min(10,Math.max(age,1))
 if(!Number.isFinite(monthly)||Math.abs(monthly*100-Math.round(monthly*100))>0.000001||monthly*100>Number.MAX_SAFE_INTEGER||previous*100+Math.round(monthly*100)>Number.MAX_SAFE_INTEGER)throw Error('Pontuação fora dos limites.')
 return {simulationOnly:true as const,rulesVersion:policy.version,id:facts.id,monthlyPoints:monthly,totalPoints:(previous*100+Math.round(monthly*100))/100,rating,joinedAt:facts.joinedAt}
}
export function orderRankingPreview(rows:ReturnType<typeof calculateRankingPreview>[]){
 if(!Array.isArray(rows)||rows.length>500000||new Set(rows.map(r=>r.id)).size!==rows.length||new Set(rows.map(r=>r.rulesVersion)).size>1||rows.some(r=>!r.simulationOnly||!Number.isFinite(r.totalPoints)||r.totalPoints<0||!Number.isFinite(r.rating)||!Number.isFinite(Date.parse(r.joinedAt))))throw Error('Ranking inválido ou regras misturadas.')
 return rows.map(r=>({...r})).sort((a,b)=>b.totalPoints-a.totalPoints||b.rating-a.rating||Date.parse(a.joinedAt)-Date.parse(b.joinedAt)||(a.id<b.id?-1:a.id>b.id?1:0)).map((r,i)=>({...r,position:i+1}))
}

import {orderRankingPreview,type calculateRankingPreview} from './rankingRules'
type RankingRow=ReturnType<typeof calculateRankingPreview>
/** Proposed global linear equalization, not an active financial policy.
 * The server must supply the authorized pool and verified eligibility at closing.
 * Client flags/points are simulation inputs only and never authorize payments.
 */
export function calculateLinearCashbackPreview(poolCents:number,ranking:RankingRow[]){
 if(!Number.isSafeInteger(poolCents)||poolCents<0)throw Error('Pool inválido: informe centavos inteiros não negativos.')
 const ordered=orderRankingPreview(ranking),n=ordered.length
 const rows=ordered.map(row=>({...row,weight:row.eligibleForCashback?BigInt(n-row.position+1):0n,cashbackCents:0n,remainder:0n}))
 const sum=rows.reduce((s,r)=>s+r.weight,0n),pool=BigInt(poolCents)
 if(sum>0n){
  for(const row of rows){row.cashbackCents=pool*row.weight/sum;row.remainder=pool*row.weight%sum}
  let remaining=pool-rows.reduce((s,r)=>s+r.cashbackCents,0n)
  const priority=rows.filter(r=>r.weight>0n).sort((a,b)=>a.remainder===b.remainder?a.position-b.position:a.remainder>b.remainder?-1:1)
  for(let i=0;remaining>0n;i++,remaining--)priority[i].cashbackCents++
 }
 const distributed=rows.reduce((s,r)=>s+r.cashbackCents,0n)
 return {simulationOnly:true as const,proposalVersion:'global-linear-preview-1',poolCents,distributedCents:Number(distributed),unallocatedCents:Number(pool-distributed),participants:rows.map(({id,position,eligibleForCashback,cashbackCents})=>({id,position,eligibleForCashback,cashbackCents:Number(cashbackCents)}))}
}
/** Confirmed monthly ESG thresholds. Guidance does not approve projects. */
export function getEsgGuidance(cashbackCents:number,basis:'monthly'='monthly'){
 if(!Number.isSafeInteger(cashbackCents)||cashbackCents<0||basis!=='monthly')throw Error('Base ESG inválida.')
 return {guidanceOnly:true as const,basis,cashbackCents,projects:cashbackCents>=2000000?3:cashbackCents>=1500000?2:cashbackCents>=1000000?1:0}
}
/** Confirmed business rule, simulation only: 15 percentage points of gross
 * monthly cashback per unmet required project. No ledger writes or redistribution.
 * Production must derive fulfilledProjects from trusted approval records.
 */
export function calculateMonthlyEsgPreview(grossMonthlyCents:number,fulfilledProjects:number){
 const {projects:requiredProjects}=getEsgGuidance(grossMonthlyCents)
 if(!Number.isSafeInteger(fulfilledProjects)||fulfilledProjects<0||fulfilledProjects>3)throw Error('Quantidade de projetos inválida.')
 const unmetProjects=Math.max(0,requiredProjects-fulfilledProjects),reductionPercent=15*unmetProjects
 // Round the aggregate reduction once; derive payable as the exact remainder.
 const reductionCents=Number((BigInt(grossMonthlyCents)*BigInt(reductionPercent)+50n)/100n)
 return {simulationOnly:true as const,rulesVersion:'wellness-esg-monthly-15-per-missing-v1',basis:'monthly' as const,grossMonthlyCents,requiredProjects,fulfilledProjects,unmetProjects,reductionPercent,payablePercent:100-reductionPercent,reductionCents,payableCents:grossMonthlyCents-reductionCents}
}

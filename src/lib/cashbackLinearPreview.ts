import {calculateMonthlyEsgPreview} from './monthlyEsg'
import {orderRankingPreview,type calculateRankingPreview} from './rankingRules'
type RankingRow=ReturnType<typeof calculateRankingPreview>
export const APPROVED_CASHBACK_POLICY = 'global-linear-v1' as const
/** Global linear equalization approved 2026-10-09. Financial execution is not active.
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
 return {simulationOnly:true as const,rulesVersion:APPROVED_CASHBACK_POLICY,poolCents,distributedCents:Number(distributed),unallocatedCents:Number(pool-distributed),participants:rows.map(({id,position,eligibleForCashback,cashbackCents})=>({id,position,eligibleForCashback,cashbackCents:Number(cashbackCents)}))}
}
export {getEsgGuidance,calculateMonthlyEsgPreview} from './monthlyEsg'

/** Monthly simulation: explicit goals per identity; never derives financial approval
 * from project registration alone. Reduced amounts are not redistributed. */
export function calculateLinearMonthlyCashbackPreview(poolCents:number,ranking:RankingRow[],goals:{id:string;fulfilledProjects:number}[]){
 const distribution=calculateLinearCashbackPreview(poolCents,ranking)
 if(!Array.isArray(goals)||goals.length!==distribution.participants.length)throw Error('Informe metas para cada participante.')
 const byId=new Map<string,number>(),ids=new Set(distribution.participants.map(row=>row.id))
 for(const goal of goals){
  if(!goal||typeof goal.id!=='string'||!ids.has(goal.id)||byId.has(goal.id)||!Number.isSafeInteger(goal.fulfilledProjects)||goal.fulfilledProjects<0||goal.fulfilledProjects>3)throw Error('Metas inválidas, ausentes ou duplicadas.')
  byId.set(goal.id,goal.fulfilledProjects)
 }
 const participants=distribution.participants.map(row=>({...row,esg:calculateMonthlyEsgPreview(row.cashbackCents,byId.get(row.id)!)}))
 const payable=participants.reduce((sum,row)=>sum+BigInt(row.esg.payableCents),0n),reduction=participants.reduce((sum,row)=>sum+BigInt(row.esg.reductionCents),0n)
 return {...distribution,participants,payableCents:Number(payable),reductionCents:Number(reduction)}
}

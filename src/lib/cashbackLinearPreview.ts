import {calculateMonthlyEsgPreview} from './monthlyEsg'
import {orderRankingPreview,type calculateRankingPreview} from './rankingRules'
type RankingRow=ReturnType<typeof calculateRankingPreview>
export const APPROVED_CASHBACK_POLICY = 'pareto-80-20-linear-10x-v1' as const
/** Approved 2026-10-12. Compatibility function names retained for existing callers.
 * Server-authorized pool and eligibility remain required before financial execution.
 * Ranking positions are unchanged; only eligible order defines the Pareto groups.
 */
export function calculateLinearCashbackPreview(poolCents:number,ranking:RankingRow[]){
 if(!Number.isSafeInteger(poolCents)||poolCents<0)throw Error('Pool inválido: informe centavos inteiros não negativos.')
 const ordered=orderRankingPreview(ranking)
 const rows=ordered.map(row=>({...row,eligiblePosition:0,group:'ineligible' as 'ineligible'|'top'|'remaining'|'sole',cashbackCents:0n,remainder:0n,weight:0n}))
 const eligible=rows.filter(row=>row.eligibleForCashback),n=eligible.length,k=Math.ceil(n/5),pool=BigInt(poolCents)
 eligible.forEach((row,i)=>{row.eligiblePosition=i+1})
 // The group split is rounded to the nearest cent; the other group receives the complement.
 const topPool=n===0?0n:n===1?pool:(pool*4n+2n)/5n
 const remainingPool=n>1?pool-topPool:0n
 function allocate(group:typeof rows,amount:bigint){
  const sum=group.reduce((s,row)=>s+row.weight,0n)
  if(sum===0n)return
  for(const row of group){row.cashbackCents=amount*row.weight/sum;row.remainder=amount*row.weight%sum}
  let rest=amount-group.reduce((s,row)=>s+row.cashbackCents,0n)
  const priority=[...group].sort((a,b)=>a.remainder===b.remainder?a.position-b.position:a.remainder>b.remainder?-1:1)
  for(let i=0;rest>0n;i++,rest--)priority[i].cashbackCents++
 }
 const top=eligible.slice(0,k),remaining=eligible.slice(k),m=remaining.length
 top.forEach((row,i)=>{row.group=n===1?'sole':'top';row.weight=k===1?1n:10n*BigInt(k-1)-9n*BigInt(i)})
 remaining.forEach((row,i)=>{row.group='remaining';row.weight=BigInt(m-i)})
 allocate(top,topPool);allocate(remaining,remainingPool)
 // No silent ratio changes or payouts which reverse the approved ranking order.
 if(eligible.some((row,i)=>i>0&&eligible[i-1].cashbackCents<row.cashbackCents))throw Error('Distribuição incompatível: esta combinação de montante e elegíveis inverte valores entre posições. Nenhum pagamento autorizado; revise a configuração.')
 const distributed=rows.reduce((s,row)=>s+row.cashbackCents,0n)
 return {simulationOnly:true as const,rulesVersion:APPROVED_CASHBACK_POLICY,poolCents,eligibleCount:n,topCount:k,topPoolCents:Number(topPool),remainingPoolCents:Number(remainingPool),distributedCents:Number(distributed),unallocatedCents:Number(pool-distributed),participants:rows.map(({id,position,eligiblePosition,group,eligibleForCashback,cashbackCents})=>({id,position,eligiblePosition,group,eligibleForCashback,cashbackCents:Number(cashbackCents)}))}
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

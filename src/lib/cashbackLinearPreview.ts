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
export {getEsgGuidance,calculateMonthlyEsgPreview} from './monthlyEsg'

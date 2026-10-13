import {calculateLinearMonthlyCashbackPreview} from './cashbackLinearPreview'
export const FEE_CASHBACK_POLICY='fees-38-percent-v1' as const
export const FEE_CASHBACK_PERCENT=38 as const
function cents(value:number){if(!Number.isSafeInteger(value)||value<0)throw Error('Tarifa inválida: use centavos inteiros não negativos.');return BigInt(value)}
/** Admin conference only; no authorization to collect fees or issue payments. */
export function calculateFeeCashbackPool(studentFeeCents:number,partnerFeeCents:number){
 const total=cents(studentFeeCents)+cents(partnerFeeCents)
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Total de tarifas fora do limite seguro.')
 const pool=(total*38n+50n)/100n
 return {simulationOnly:true as const,sourcePolicy:FEE_CASHBACK_POLICY,percent:FEE_CASHBACK_PERCENT,studentFeeCents,partnerFeeCents,totalFeeCents:Number(total),poolCents:Number(pool),outsideCashbackCents:Number(total-pool)}
}
export type FeeLedgerRow={chargeId:string;payerId:string;payerType:'student'|'partner';period:string;amountCents:number;refundedCents:number;status:'settled'|'pending'|'void'}
/** Integration contract for a complete, server-authorized monthly ledger snapshot.
 * These flags and objects are NOT trusted proof of payment or administrator access.
 * Provider mapping, settlement evidence, cutoff and authorization belong on the server.
 */
export function prepareFeeLedgerPool(period:string,records:FeeLedgerRow[],complete:boolean){
 const validPeriod=(v:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v)
 if(typeof period!=='string'||!validPeriod(period)||complete!==true||!Array.isArray(records))throw Error('Exija um período válido e todos os lançamentos antes de calcular.')
 const seen=new Set<string>();let student=0n,partner=0n,accepted=0,excluded=0
 for(const row of records){
  if(!row||typeof row.chargeId!=='string'||!row.chargeId.trim()||typeof row.payerId!=='string'||!row.payerId.trim()||!['student','partner'].includes(row.payerType)||typeof row.period!=='string'||!validPeriod(row.period)||!['settled','pending','void'].includes(row.status))throw Error('Lançamento de tarifa inválido.')
  if(seen.has(row.chargeId))throw Error('Cobrança duplicada: concilie a origem dos lançamentos.')
  seen.add(row.chargeId);const amount=cents(row.amountCents),refund=cents(row.refundedCents)
  if(refund>amount)throw Error('Estorno maior que a tarifa.')
  if(row.period!==period||row.status!=='settled'){excluded++;continue}
  if(refund>0n)throw Error('Tarifas com estorno exigem conciliação antes de compor o cashback.')
  if(row.payerType==='student')student+=amount;else partner+=amount
  accepted++
 }
 if(student+partner>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Total de tarifas fora do limite seguro.')
 return {...calculateFeeCashbackPool(Number(student),Number(partner)),period,acceptedRecords:accepted,excludedRecords:excluded}
}
export function calculateFeeFundedMonthlyPreview(period:string,records:FeeLedgerRow[],complete:boolean,ranking:Parameters<typeof calculateLinearMonthlyCashbackPreview>[1],goals:Parameters<typeof calculateLinearMonthlyCashbackPreview>[2]){
 const source=prepareFeeLedgerPool(period,records,complete)
 return {source,distribution:calculateLinearMonthlyCashbackPreview(source.poolCents,ranking,goals)}
}

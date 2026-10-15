import type {WellnessPlan} from './wellnessCommercialRules'
/** Server-side settlement proposal only; caller must authenticate provider receipts,
 * lock the service, persist balanced entries and a unique settlement key atomically.
 * Gateway fee bearer is explicit: never silently select who pays it.
 */
export function previewServiceSettlement(input:{serviceId:string;paymentId:string;plan:WellnessPlan;agreedCents:number;receivedCents:number;gatewayFeeCents:number;gatewayFeeBearer:'partner'|'platform';completed:boolean;clientEvaluated:boolean;professionalEvaluated:boolean;paymentConfirmed:boolean;disputed:boolean;refundedCents:number}){
 const rates={free:0,basic:100,pro:200,premium:300,pro_partner:0}
 if(!input||typeof input.serviceId!=='string'||!input.serviceId.trim()||typeof input.paymentId!=='string'||!input.paymentId.trim()||!Object.hasOwn(rates,input.plan)||!['partner','platform'].includes(input.gatewayFeeBearer))throw Error('Dados de liquidação inválidos.')
 for(const n of [input.agreedCents,input.receivedCents,input.gatewayFeeCents,input.refundedCents])if(!Number.isSafeInteger(n)||n<0)throw Error('Use centavos inteiros não negativos.')
 for(const b of [input.completed,input.clientEvaluated,input.professionalEvaluated,input.paymentConfirmed,input.disputed])if(typeof b!=='boolean')throw Error('Estado inválido.')
 if(input.disputed||input.refundedCents>0)throw Error('Disputa ou estorno exige conciliação antes da liberação.')
 if(!input.paymentConfirmed||!input.completed||!input.clientEvaluated||!input.professionalEvaluated)return {simulationOnly:true as const,paymentAuthorized:false as const,status:'pending_requirements' as const}
 if(input.receivedCents!==input.agreedCents)throw Error('Pagamento não corresponde ao valor total combinado; concilie sinal e saldo.')
 const fee=rates[input.plan],partner=input.receivedCents-fee-(input.gatewayFeeBearer==='partner'?input.gatewayFeeCents:0)
 const platform=fee-(input.gatewayFeeBearer==='platform'?input.gatewayFeeCents:0)
 if(partner<0)throw Error('Valor insuficiente para tarifa e custo de pagamento.')
 return {simulationOnly:true as const,paymentAuthorized:false as const,status:'ready_for_server_transaction' as const,settlementKey:JSON.stringify(['service_settlement',input.serviceId]),paymentId:input.paymentId,grossCents:input.receivedCents,partnerCreditCents:partner,platformTariffCents:fee,gatewayCostCents:input.gatewayFeeCents,platformNetBeforeCashbackCents:platform}
}

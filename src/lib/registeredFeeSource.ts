import {calculateFeeCashbackPool} from './feeCashbackPool'
export type RegisteredFeeSource={period:string;windowFrom:string;windowTo:string;studentFeeCents:number;partnerFeeCents:number;totalFeeCents:number;indicativePoolCents:number;acceptedRecords:number;excludedRecords:number;processedRecords:number}
/** Decode only an indicative administrative inventory, never a payable balance. */
export function validateRegisteredFeeSource(value:unknown,period:string):RegisteredFeeSource{
 const fail=()=>{throw Error('Resposta de tarifas inconsistente.')}
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)||!value||typeof value!=='object'||Array.isArray(value))return fail()
 const r=value as Record<string,unknown>,[year,month]=period.split('-').map(Number)
 const from=period+'-01 03:00:00.000Z',to=(month===12?year+1:year)+'-'+String(month===12?1:month+1).padStart(2,'0')+'-01 03:00:00.000Z'
 if(r.period!==period||r.windowFrom!==from||r.windowTo!==to||r.windowBasis!=='created-UTC-minus-03'||r.source!=='pocketbase-wallet-registered-fees'||r.complete!==true||r.settlementVerified!==false||r.usableForClosing!==false||r.simulationOnly!==true||r.percent!==38)return fail()
 for(const key of ['studentFeeCents','partnerFeeCents','totalFeeCents','indicativePoolCents','acceptedRecords','excludedRecords','processedRecords'])if(typeof r[key]!=='number'||!Number.isSafeInteger(r[key])||Number(r[key])<0)return fail()
 const accepted=r.acceptedRecords as number,excluded=r.excludedRecords as number,processed=r.processedRecords as number
 if(processed>=100000||accepted+excluded!==processed)return fail()
 const student=r.studentFeeCents as number,partner=r.partnerFeeCents as number,expected=calculateFeeCashbackPool(student,partner)
 if(r.totalFeeCents!==expected.totalFeeCents||r.indicativePoolCents!==expected.poolCents||(accepted===0&&expected.totalFeeCents!==0))return fail()
 // Copy only approved aggregates; do not retain unexpected records or personal data.
 return {period,windowFrom:from,windowTo:to,studentFeeCents:student,partnerFeeCents:partner,totalFeeCents:expected.totalFeeCents,indicativePoolCents:expected.poolCents,acceptedRecords:accepted,excludedRecords:excluded,processedRecords:processed}
}

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

/** Strict pt-BR amount without thousands separators; no float parsing. */
export function parseMonthlyCashbackInput(raw:string):number{
 if(typeof raw!=='string'||raw.length>32||!/^\d+(?:,\d{1,2})?$/.test(raw))throw Error('Informe reais sem separador de milhar, por exemplo 20000,00.')
 const [whole,fraction='']=raw.split(',')
 const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))
 if(cents>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Valor acima do limite da simulação.')
 return Number(cents)
}

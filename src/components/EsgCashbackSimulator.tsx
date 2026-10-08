import {useId,useState} from 'react'
import {calculateMonthlyEsgPreview,parseMonthlyCashbackInput} from '../lib/monthlyEsg'
const money=(cents:number)=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function EsgCashbackSimulator({disabled=false}:{disabled?:boolean}){
 const id=useId(),[amount,setAmount]=useState('20000,00'),[fulfilled,setFulfilled]=useState(0)
 let error='',result:ReturnType<typeof calculateMonthlyEsgPreview>|null=null
 try{result=calculateMonthlyEsgPreview(parseMonthlyCashbackInput(amount),fulfilled)}catch(e){error=e instanceof Error?e.message:'Valor inválido.'}
 return <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-xl border border-lime-300 bg-lime-50 p-4">
  <h3 id={`${id}-title`} className="text-lg font-semibold">Conferência de cashback e metas ESG</h3>
  <p>Simulação mensal para um participante elegível. Não altera carteira, não aprova projetos e não libera pagamentos.</p>
  <div className="grid gap-4 sm:grid-cols-2"><label htmlFor={`${id}-amount`}>Cashback bruto mensal (R$)<input id={`${id}-amount`} className="block w-full rounded border bg-white p-2" type="text" inputMode="decimal" maxLength={32} value={amount} disabled={disabled} aria-invalid={!!error} aria-describedby={`${id}-help ${id}-error`} onChange={e=>setAmount(e.target.value)}/></label>
  <label htmlFor={`${id}-fulfilled`}>Metas cumpridas — cenário simulado<select id={`${id}-fulfilled`} className="block w-full rounded border bg-white p-2" value={fulfilled} disabled={disabled} onChange={e=>setFulfilled(Number(e.target.value))}>{[0,1,2,3].map(n=><option value={n} key={n}>{n}</option>)}</select></label></div>
  <p id={`${id}-help`} className="text-sm">Use vírgula nos centavos e não use separador de milhar: 20000,00. Cada meta exigida cumprida acrescenta 15 pontos percentuais, até 100%.</p>
  <p id={`${id}-error`} role={error?'alert':undefined}>{error}</p>
  {result&&<div aria-live="polite" className="space-y-3"><p>Metas exigidas nesta faixa: <strong>{result.requiredProjects}</strong>. Metas cumpridas consideradas: <strong>{Math.min(fulfilled,result.requiredProjects)}</strong>.</p>
   <dl className="grid gap-3 sm:grid-cols-3"><div><dt>Bruto mensal</dt><dd className="font-semibold">{money(result.grossMonthlyCents)}</dd></div><div><dt>Valor após metas ({result.payablePercent}%)</dt><dd className="font-semibold">{money(result.payableCents)}</dd></div><div><dt>Redução por metas pendentes ({result.reductionPercent}%)</dt><dd className="font-semibold">{money(result.reductionCents)}</dd></div></dl>
   <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="text-left font-semibold">Cenários para este mesmo valor bruto</caption><thead><tr><th scope="col">Metas cumpridas</th><th scope="col">Percentual</th><th scope="col">Valor após metas</th></tr></thead><tbody>{Array.from({length:result.requiredProjects+1},(_,n)=>{const r=calculateMonthlyEsgPreview(result!.grossMonthlyCents,n);return <tr key={n}><th scope="row">{n}</th><td>{r.payablePercent}%</td><td>{money(r.payableCents)}</td></tr>})}</tbody></table></div>
  </div>}
  <p className="text-sm">A faixa é definida pelo bruto mensal. A redução é arredondada uma vez; o restante conserva o total. O destino da redução ainda não está definido.</p>
 </section>
}

import {useId,useMemo,useState} from 'react'
import {calculateLinearMonthlyCashbackPreview} from '../lib/cashbackLinearPreview'
import {parseMonthlyCashbackInput} from '../lib/monthlyEsg'
const money=(n:number)=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function LinearCashbackSimulator({disabled=false}:{disabled?:boolean}){
 const id=useId(),[amount,setAmount]=useState('10000,00'),[count,setCount]=useState('20'),[page,setPage]=useState(1),[fulfilled,setFulfilled]=useState(0)
 const calculation=useMemo(()=>{try{
  if(!/^\d{1,4}$/.test(count)||Number(count)<1||Number(count)>5000)throw Error('Informe entre 1 e 5.000 participantes nesta prévia.')
  const n=Number(count),ranking=Array.from({length:n},(_,i)=>({simulationOnly:true as const,rulesVersion:'synthetic-ordered-v1',rulesKey:'synthetic-ordered-v1',eligibleForCashback:true,id:String(i+1),monthlyPoints:0,totalPoints:n-i,rating:0,joinedAt:'2026-01-01T00:00:00Z'}))
  return {result:calculateLinearMonthlyCashbackPreview(parseMonthlyCashbackInput(amount),ranking,ranking.map(row=>({id:row.id,fulfilledProjects:fulfilled}))),error:''}
 }catch(e){return {result:null,error:e instanceof Error?e.message:'Entrada inválida.'}}},[amount,count,fulfilled])
 const result=calculation.result,totalPages=Math.max(1,Math.ceil((result?.participants.length??0)/20)),current=Math.min(page,totalPages)
 function example(value:string,n:string){setAmount(value);setCount(n);setPage(1)}
 return <section aria-labelledby={`${id}-title`} className="space-y-3 rounded-xl border border-lime-400 bg-lime-50 p-4">
  <h3 id={`${id}-title`} className="text-lg font-semibold">Cashback — distribuição linear padrão</h3>
  <p>Regra aprovada: peso = total de posições − posição + 1. O valor disponível é dividido pela soma dos pesos elegíveis. Grátis mantém posição com peso zero.</p>
  <p>Esta conferência usa participantes fictícios, todos elegíveis. Mostra o bruto e o valor após metas ESG para o mês simulado; não credita carteiras. O total informado já é o montante de cashback, sem reaplicar split.</p>
  <div className="flex flex-wrap gap-2"><button type="button" className="rounded border bg-white p-2" disabled={disabled} onClick={()=>example('10000,00','20')}>R$ 10 mil / 20 pessoas</button><button type="button" className="rounded border bg-white p-2" disabled={disabled} onClick={()=>example('200000,00','500')}>R$ 200 mil / 500 pessoas</button><button type="button" className="rounded border bg-white p-2" disabled={disabled} onClick={()=>example('200000,00','10')}>R$ 200 mil / 10 pessoas — ESG</button></div>
  <div className="grid gap-3 sm:grid-cols-2"><label htmlFor={`${id}-pool`}>Total de cashback (R$)<input id={`${id}-pool`} type="text" inputMode="decimal" maxLength={32} className="block w-full rounded border p-2" value={amount} disabled={disabled} onChange={e=>{setAmount(e.target.value);setPage(1)}}/></label><label htmlFor={`${id}-count`}>Participantes elegíveis<input id={`${id}-count`} type="text" inputMode="numeric" maxLength={4} className="block w-full rounded border p-2" value={count} disabled={disabled} onChange={e=>{setCount(e.target.value);setPage(1)}}/></label></div>
  <p className="text-sm">Use 200000,00, sem separador de milhar. Limite desta tela: 5.000 participantes. Populações maiores exigem processamento e validação específicos.</p>
  <label htmlFor={`${id}-goals`} className="block">Metas cumpridas por pessoa — mesmo cenário fictício para todos<select id={`${id}-goals`} className="block rounded border p-2" value={fulfilled} disabled={disabled} onChange={e=>setFulfilled(Number(e.target.value))}>{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  <p className="text-sm">A faixa ESG usa o bruto mensal individual. A redução por metas pendentes não é redistribuída. Aprovações reais deverão ser verificadas no servidor.</p>
  {calculation.error&&<p role="alert">{calculation.error}</p>}
  {result&&<div aria-live="polite" className="space-y-3"><p>Total distribuído: <strong>{money(result.distributedCents)}</strong>. Após metas: {money(result.payableCents)}. Redução ESG: {money(result.reductionCents)}. Não distribuído: {money(result.unallocatedCents)}.</p><table className="w-full text-left"><caption>Prévia da regra padrão — {result.participants.length} posições</caption><thead><tr><th scope="col">Posição</th><th scope="col">Peso</th><th scope="col">Cashback bruto</th><th scope="col">Metas exigidas</th><th scope="col">Redução ESG</th><th scope="col">Após metas</th></tr></thead><tbody>{result.participants.slice((current-1)*20,current*20).map(row=><tr key={row.id}><th scope="row">{row.position}º</th><td>{result.participants.length-row.position+1}</td><td>{money(row.cashbackCents)}</td><td>{row.esg.requiredProjects}</td><td>{money(row.esg.reductionCents)}</td><td>{money(row.esg.payableCents)}</td></tr>)}</tbody></table><div className="flex gap-3"><button type="button" disabled={disabled||current===1} onClick={()=>setPage(current-1)}>Anterior</button><span>Página {current} de {totalPages}</span><button type="button" disabled={disabled||current===totalPages} onClick={()=>setPage(current+1)}>Próxima</button></div></div>}
  <p className="text-sm">Centavos distribuídos pelas maiores sobras, com desempate pela melhor posição. Valores iguais ou zero são possíveis quando o montante é pequeno.</p>
 </section>
}

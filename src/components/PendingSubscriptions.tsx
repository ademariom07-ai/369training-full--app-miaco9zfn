import {useEffect,useRef,useState} from 'react'
import pb from '@/lib/pocketbase/client'
type Summary={pendingCount:number;pendingAmountCents:number;duplicateReferenceCount:number}
export default function PendingSubscriptions(){
 const [period,setPeriod]=useState(()=>new Date(Date.now()-3*3600000).toISOString().slice(0,7)),[summary,setSummary]=useState<Summary|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const sequence=useRef(0)
 useEffect(()=>{const off=pb.authStore.onChange(()=>{sequence.current++;setSummary(null);setError('');setBusy(false)});return()=>{sequence.current++;off()}},[])
 if(!pb.authStore.isValid||pb.authStore.record?.role!=='admin')return null
 async function load(){
  if(busy)return
  const ticket=++sequence.current,token=pb.authStore.token;setBusy(true);setSummary(null);setError('')
  try{
   if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))throw Error('invalid')
   const r=await pb.send('/backend/v1/admin/pending_subscriptions',{method:'POST',body:{period}})
   if(ticket!==sequence.current||token!==pb.authStore.token||pb.authStore.record?.role!=='admin')return
   if(r?.period!==period||r.complete!==true||r.paymentConfirmed!==false||r.activationAllowed!==false||r.cashbackContributionCents!==0||![r.pendingCount,r.pendingAmountCents,r.duplicateReferenceCount].every(n=>Number.isSafeInteger(n)&&n>=0)||r.duplicateReferenceCount>r.pendingCount)throw Error('invalid')
   setSummary({pendingCount:r.pendingCount,pendingAmountCents:r.pendingAmountCents,duplicateReferenceCount:r.duplicateReferenceCount})
  }catch{if(ticket===sequence.current)setError('Consulta indisponível. Nenhum pagamento ou plano foi alterado.')}
  finally{if(ticket===sequence.current)setBusy(false)}
 }
 return <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold">Mensalidades aguardando pagamento</h3><p>Solicitações registradas no mês selecionado, horário de Brasília. Não são receita recebida, saldo disponível ou cashback. A API de pagamentos ainda será conectada.</p><label>Mês <input type="month" value={period} disabled={busy} onChange={e=>{setPeriod(e.target.value);setSummary(null);setError('')}}/></label><button type="button" disabled={busy} className="rounded border bg-white p-2" onClick={()=>void load()}>{busy?'Consultando…':'Conferir pendências'}</button>{error&&<p role="alert">{error}</p>}{summary&&<div aria-live="polite"><p>{summary.pendingCount} solicitações · {(summary.pendingAmountCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} aguardando pagamento.</p><p>Contribuição ao cashback enquanto pendentes: R$ 0,00.</p>{summary.duplicateReferenceCount>0&&<p role="alert">{summary.duplicateReferenceCount} referências repetidas: conferir antes de integrar a cobrança.</p>}</div>}<p>Parceiros Básico, Pro e Premium não têm mensalidade: suas tarifas dependem da validação dos serviços.</p></section>
}

import PendingSubscriptions from './PendingSubscriptions'
import {useEffect,useRef,useState} from 'react'
import pb from '@/lib/pocketbase/client'
import {validateRegisteredFeeSource,type RegisteredFeeSource as Source} from '@/lib/registeredFeeSource'

const money=(cents:number)=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function RegisteredFeeSource(){
 const [period,setPeriod]=useState(()=>new Date().toISOString().slice(0,7)),[result,setResult]=useState<Source|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[,refresh]=useState(0)
 const sequence=useRef(0),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;const off=pb.authStore.onChange(()=>{sequence.current++;setResult(null);setBusy(false);setError('');refresh(n=>n+1)});return()=>{mounted.current=false;sequence.current++;off()}},[])
 if(!pb.authStore.isValid||pb.authStore.record?.role!=='admin')return null
 async function load(){
  if(busy)return
  setResult(null);setError('')
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)){setError('Informe um mês válido.');return}
  const ticket=++sequence.current,token=pb.authStore.token
  setBusy(true)
  try{
   const r=await pb.send('/backend/v1/admin/fee_source',{method:'POST',body:{period}})
   if(!mounted.current||ticket!==sequence.current||token!==pb.authStore.token||pb.authStore.record?.role!=='admin')return
   const validated=validateRegisteredFeeSource(r,period)
   setResult(validated)
  }catch{if(mounted.current&&ticket===sequence.current)setError('Consulta indisponível ou tarifas não conciliadas. Nenhum valor foi importado para distribuição.')}
  finally{if(mounted.current&&ticket===sequence.current)setBusy(false)}
 }
 return <><PendingSubscriptions/><section className="space-y-3 rounded-xl border border-sky-300 bg-sky-50 p-4" aria-label="Tarifas registradas"><h3 className="font-semibold">Conferir tarifas registradas</h3><p>Leitura administrativa da carteira. Os valores não comprovam recebimento e não alimentam pagamentos automaticamente. Janela de consulta: mês pela data de registro, UTC−03.</p><label>Mês <input type="month" value={period} disabled={busy} onChange={e=>{setPeriod(e.target.value);setResult(null);setError('')}}/></label><button type="button" disabled={busy} className="rounded border bg-white p-2" onClick={()=>void load()}>{busy?'Consultando…':'Consultar registros'}</button>{error&&<p role="alert">{error}</p>}{result&&<div aria-live="polite"><p>Alunos: {money(result.studentFeeCents)} · Parceiros: {money(result.partnerFeeCents)}</p><p>Total registrado: {money(result.totalFeeCents)} · 38% indicativos: <strong>{money(result.indicativePoolCents)}</strong></p><p>{result.acceptedRecords} tarifas concluídas; {result.excludedRecords} registros pendentes, cancelados ou estornados excluídos. Liquidação e conciliação de estornos ainda precisam de conferência.</p></div>}</section></>
}

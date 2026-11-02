import {useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {holdMinutes,reserve} from '@/lib/supabase/bookingHoldActions'
import type {BookingQuote} from '@/lib/supabase/bookingQuote'
function useMinutes(owner:string){
 const [minutes,set]=useState<number|null>(null),[error,err]=useState(false),[seq,refresh]=useState(0)
 useEffect(()=>{let live=true;set(null);err(false);void holdMinutes(owner).then(x=>{if(live)set(x)}).catch(()=>{if(live)err(true)});return()=>{live=false}},[owner,seq])
 return {minutes,set,error,reload:()=>refresh(n=>n+1)}
}
export function HoldPolicy({owner,disabled}:{owner:string;disabled:boolean}){
 const p=useMinutes(owner),[draft,edit]=useState(''),[busy,setBusy]=useState(false),[msg,message]=useState('')
 async function save(n:number){
  if(p.minutes===null||busy||!Number.isInteger(n)||n<0||n>1440)return
  setBusy(true);message('')
  try{p.set(await holdMinutes(owner,{expected:p.minutes,minutes:n}));edit('');message(n?'Prazo salvo. Novas reservas usam esse limite.':'Novas reservas pausadas.')}
  catch{message('Não foi possível salvar. Confira o prazo atual antes de tentar novamente.');p.reload()}finally{setBusy(false)}
 }
 return <section className="space-y-3 rounded-lg border bg-white p-4"><h3 className="text-lg font-semibold">Prazo da reserva temporária</h3><p>{p.error?'Falha ao consultar.':p.minutes===null?'Consultando…':p.minutes===0?'Novas reservas pausadas.':'Prazo atual: '+p.minutes+' min.'}</p><p>Este prazo segura o horário no piloto. Não habilita cobranças nem confirma o atendimento. Alterações valem apenas para novas reservas.</p><label>Prazo em minutos (1 a 1.440)<Input type="number" min={1} max={1440} step={1} value={draft} onChange={e=>edit(e.target.value)}/></label><div className="flex flex-wrap gap-2"><Button disabled={disabled||busy||p.minutes===null||!Number.isInteger(Number(draft))||Number(draft)<1||Number(draft)>1440} onClick={()=>void save(Number(draft))}>Aplicar prazo e permitir reservas</Button><Button variant="outline" disabled={disabled||busy||!p.minutes} onClick={()=>void save(0)}>Pausar novas reservas</Button><Button variant="outline" disabled={busy} onClick={p.reload}>Atualizar prazo</Button></div><p role="status">{msg}</p></section>
}
export function HoldRequest({owner,q,disabled}:{owner:string;q:BookingQuote;disabled:boolean}){
 const p=useMinutes(owner),key=useRef(''),lock=useRef(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[msg,message]=useState('')
 async function send(){
  if(lock.current||done||!p.minutes)return
  lock.current=true;setBusy(true)
  try{key.current||=crypto.randomUUID();const row=await reserve(owner,q,key.current);setDone(true);message(row.status==='pending_payment'?'Horário reservado até '+new Date(row.expires_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília). Atendimento ainda não confirmado.':'O pedido anterior já terminou. Confira Minhas reservas.');window.dispatchEvent(new Event('wellness:reservas'))}
  catch(e){message(e instanceof Error?e.message:'Confira Minhas reservas.')}finally{lock.current=false;setBusy(false)}
 }
 return <div className="space-y-2">{p.minutes?<><p>Você pode segurar este horário por até {p.minutes} min, limitado ao início do atendimento. Não haverá cobrança.</p><Button disabled={disabled||busy||done} onClick={()=>void send()}>Reservar horário temporariamente</Button></>:<p>{p.error?'Não foi possível consultar o prazo. Atualize a cotação.':p.minutes===null?'Consultando prazo…':'Novas reservas estão pausadas pelo administrativo.'}</p>}<p role="status">{msg}</p></div>
}

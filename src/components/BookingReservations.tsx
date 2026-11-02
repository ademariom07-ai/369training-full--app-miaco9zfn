import {cancelHold} from '@/lib/supabase/bookingHoldActions'
import {useEffect,useState} from 'react'
import type {OwnProfile} from '@/lib/supabase/profiles'
import {readBookingReservations,type BookingReservation} from '@/lib/supabase/bookingReservations'
import {Button} from '@/components/ui/button'
const labels={pending_payment:'Pendente de pagamento — não confirmado',cancelled:'Cancelada',expired:'Expirada'}
function date(value:string){return new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}
export default function BookingReservations({account,disabled}:{account:OwnProfile;disabled:boolean}){
 const allowed=account.role==='aluno'||account.role==='profissional'&&account.approved
 const [rows,setRows]=useState<BookingReservation[]>([]),[page,setPage]=useState(1),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[owner,setOwner]=useState('')
 useEffect(()=>{let active=true;setRows([]);setOwner('');setError('');setLoading(true);if(!allowed){setLoading(false);return}
 void readBookingReservations(account,page).then(data=>{if(active){setRows(data);setOwner(account.id)}}).catch(()=>{if(active)setError('Não foi possível consultar as reservas. Tente atualizar.')}).finally(()=>{if(active)setLoading(false)})
 return()=>{active=false}
 },[account.id,account.role,allowed,page,reload])
 const [working,setWorking]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{const changed=()=>setReload(n=>n+1);window.addEventListener('wellness:reservas',changed);return()=>window.removeEventListener('wellness:reservas',changed)},[])
 async function cancel(id:string){
  if(working||!window.confirm('Cancelar esta reserva temporária e liberar o horário?'))return
  setWorking(true);setNotice('')
  try{const row=await cancelHold(account.id,account.role,id);setNotice(row.status==='expired'?'Esta reserva já expirou.':'Reserva cancelada.')}
  catch{setNotice('Não foi possível verificar o cancelamento. Confira o estado atualizado.')}finally{setWorking(false);setReload(n=>n+1)}
 }
 if(!allowed)return null
 return <section aria-label="Minhas reservas" className="scroll-mt-6 space-y-3 rounded-lg border bg-white p-4"><h2 className="text-lg font-semibold">Minhas reservas</h2><p>Aqui aparecem suas reservas temporárias. O pagamento e a confirmação do atendimento ainda não estão disponíveis.</p><p role="status">{notice}</p>{loading?<p role="status">Consultando reservas…</p>:error?<p role="alert">{error}</p>:owner===account.id&&<>{rows.length?<ul className="space-y-2">{rows.map(row=><li key={row.id} className="rounded border p-3"><p>{date(row.starts_at)} até {date(row.ends_at)} — Brasília</p><p>{labels[row.status as keyof typeof labels]}</p>{row.status==='pending_payment'&&<div><p>Prazo: {date(row.expires_at)} (Brasília).</p><Button variant="outline" disabled={disabled||working} onClick={()=>void cancel(row.id)}>Cancelar reserva temporária</Button></div>}</li>)}</ul>:<p>Nenhuma reserva registrada nesta página.</p>}</>}<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled||loading||page===1} onClick={()=>setPage(n=>n-1)}>Anterior</Button><span>Página {page}</span><Button variant="outline" disabled={disabled||loading||rows.length<20||page>=10000} onClick={()=>setPage(n=>n+1)}>Próxima</Button><Button variant="outline" disabled={disabled||loading} onClick={()=>setReload(n=>n+1)}>Atualizar reservas</Button></div></section>
}

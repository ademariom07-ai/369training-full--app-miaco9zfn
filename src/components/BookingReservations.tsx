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
 if(!allowed)return null
 return <section aria-label="Minhas reservas" className="scroll-mt-6 space-y-3 rounded-lg border bg-white p-4"><h2 className="text-lg font-semibold">Minhas reservas</h2><p>Área em preparação. A consulta é real; criar reservas e pagar o sinal ainda não estão disponíveis.</p>{loading?<p role="status">Consultando reservas…</p>:error?<p role="alert">{error}</p>:owner===account.id&&<>{rows.length?<ul className="space-y-2">{rows.map(row=><li key={row.id} className="rounded border p-3"><p>{date(row.starts_at)} até {date(row.ends_at)} — Brasília</p><p>{labels[row.status as keyof typeof labels]}</p>{row.status==='pending_payment'&&<p>Prazo registrado: {date(row.expires_at)}. O estado precisa ser revalidado pelo serviço de reservas.</p>}</li>)}</ul>:<p>Nenhuma reserva registrada nesta página.</p>}</>}<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled||loading||page===1} onClick={()=>setPage(n=>n-1)}>Anterior</Button><span>Página {page}</span><Button variant="outline" disabled={disabled||loading||rows.length<20||page>=10000} onClick={()=>setPage(n=>n+1)}>Próxima</Button><Button variant="outline" disabled={disabled||loading} onClick={()=>setReload(n=>n+1)}>Atualizar reservas</Button></div></section>
}

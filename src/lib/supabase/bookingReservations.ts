import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
export type BookingReservation=Database['public']['Tables']['booking_reservations']['Row']
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function validateReservation(row:BookingReservation,owner:string,role:string):BookingReservation{
 if(!row||![row.id,row.request_id,row.student_id,row.professional_id].every(uuid)||!['aluno','profissional'].includes(role)||row[role==='aluno'?'student_id':'professional_id']!==owner||row.student_id===row.professional_id||!['pending_payment','cancelled','expired'].includes(row.status))throw Error('Reserva indisponível.')
 const [start,end,created,expires]=[row.starts_at,row.ends_at,row.created_at,row.expires_at].map(Date.parse)
 if(![start,end,created,expires].every(Number.isFinite)||end-start!==3600000||expires<=created||expires>start)throw Error('Reserva indisponível.')
 return {...row}
}
export async function readBookingReservations(account:{id:string;role:string},page=1,client:SupabaseClient<Database>=getSupabaseClient()){
 const {id,role}=account
 if(!uuid(id)||!['aluno','profissional'].includes(role)||!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Consulta indisponível.')
 const actor=await verifiedIdentity(client);if(actor.id!==id)throw Error('Sessão alterada.')
 const result=await client.from('booking_reservations').select('id,request_id,student_id,professional_id,starts_at,ends_at,status,created_at,expires_at').eq(role==='aluno'?'student_id':'professional_id',id).order('starts_at',{ascending:false}).order('id').range((page-1)*20,page*20-1)
 await assertSessionUnchanged(client,actor)
 if(result.error||!Array.isArray(result.data)||result.data.length>20)throw Error('Não foi possível consultar as reservas.')
 const seen=new Set<string>();return result.data.map(value=>{const row=validateReservation(value,id,role);if(seen.has(row.id))throw Error('Reserva indisponível.');seen.add(row.id);return row})
}

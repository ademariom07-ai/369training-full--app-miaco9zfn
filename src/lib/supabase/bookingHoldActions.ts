import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import {validateReservation,type BookingReservation} from './bookingReservations'
import type {BookingQuote} from './bookingQuote'
async function session(owner:string){
 const c=getSupabaseClient(), actor=await verifiedIdentity(c)
 if(actor.id!==owner) throw Error('Sua sessão mudou. Entre novamente.')
 return {c,actor}
}
export async function holdMinutes(owner:string,update?:{expected:number;minutes:number}){
 const {c,actor}=await session(owner)
 const r=update?await c.rpc('set_booking_hold_minutes',{p_expected:update.expected,p_minutes:update.minutes}):await c.rpc('booking_hold_minutes',{})
 await assertSessionUnchanged(c,actor)
 if(r.error||r.data===null||!Number.isInteger(r.data)||r.data<0||r.data>1440)throw Error('Não foi possível verificar o prazo. Atualize antes de tentar novamente.')
 return r.data
}
export async function reserve(owner:string,q:BookingQuote,request:string){
 const {c,actor}=await session(owner)
 const r=await c.rpc('create_booking_hold',{p_request:request,p_professional:q.professional_id,p_day:q.day,p_hour:q.hour,p_availability:q.availability_version,p_terms:q.terms_id}).single<BookingReservation>()
 await assertSessionUnchanged(c,actor)
 if(r.error||!r.data)throw Error('Confira Minhas reservas. Se o pedido não aparecer, atualize a cotação; o horário ou as condições podem ter mudado.')
 const row=validateReservation(r.data,owner,'aluno')
 if(row.request_id!==request||row.professional_id!==q.professional_id||Date.parse(row.starts_at)!==Date.parse(q.starts_at))throw Error('Confira o resultado em Minhas reservas.')
 return row
}
export async function cancelHold(owner:string,role:string,id:string){
 const {c,actor}=await session(owner)
 const r=await c.rpc('cancel_booking_hold',{p_id:id}).single<BookingReservation>()
 await assertSessionUnchanged(c,actor)
 if(r.error||!r.data)throw Error('Não foi possível verificar o cancelamento. Atualize suas reservas.')
 const row=validateReservation(r.data,owner,role)
 if(row.id!==id||row.status==='pending_payment')throw Error('Atualize suas reservas para verificar o estado.')
 return row
}

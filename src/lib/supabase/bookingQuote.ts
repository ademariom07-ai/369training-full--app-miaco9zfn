import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged,readOwnProfile} from './profiles'
import {calendarDay,saoPauloToday,saoPauloHour} from './availability'
import {depositCents} from './bookingTerms'
type Client=SupabaseClient<Database>
export type BookingQuote=Omit<Database['public']['Functions']['quote_booking_slot']['Returns'][number],'free_cancel_deadline'>&{free_cancel_deadline:string|null}
export type BookingSlot={professionalId:string;day:string;hour:number}
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificação inválida.');return value.toLowerCase()}
function stamp(value:string){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Cotação indisponível.');return Date.parse(value)}
function version(value:number){if(!Number.isSafeInteger(value)||value<1)throw Error('Versão inválida.');return value}
function slot(value:BookingSlot){if(!value||!Number.isInteger(value.hour)||value.hour<5||value.hour>23)throw Error('Horário inválido.');return{professionalId:uuid(value.professionalId),day:calendarDay(value.day),hour:value.hour}}
export async function readBookingQuote(input:BookingSlot,expectedId:string,client:Client=getSupabaseClient()):Promise<BookingQuote>{
 const target=slot(input),owner=uuid(expectedId),identity=await verifiedIdentity(client)
 if(identity.id!==owner)throw Error('Sessão alterada.')
 const profile=await readOwnProfile(client);await assertSessionUnchanged(client,identity)
 if(profile?.id!==owner||profile.role!=='aluno')throw Error('Cotação indisponível.')
 const result=await client.rpc('quote_booking_slot',{p_professional_id:target.professionalId,p_day:target.day,p_hour:target.hour}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Horário ou condições indisponíveis. Atualize a agenda.')
 const row:BookingQuote=result.data,start=stamp(row.starts_at),end=stamp(row.ends_at),quoted=stamp(row.quoted_at)
 if(uuid(row.professional_id)!==target.professionalId||row.day!==target.day||row.hour!==target.hour||saoPauloToday(new Date(start))!==target.day||saoPauloHour(new Date(start))!==target.hour||new Date(start).getUTCMinutes()!==0||new Date(start).getUTCSeconds()!==0||new Date(start).getUTCMilliseconds()!==0||end-start!==3600000||start<=quoted)throw Error('Horário divergente.')
 const deposit=depositCents(row.price_cents,row.deposit_basis_points)
 if(row.deposit_cents!==deposit||row.balance_cents!==row.price_cents-deposit||!Number.isInteger(row.free_cancel_hours)||row.free_cancel_hours<0||row.free_cancel_hours>720||row.no_show_deposit_retained!==true)throw Error('Condições divergentes.')
 if(row.free_cancel_hours===0?row.free_cancel_deadline!==null:row.free_cancel_deadline===null||stamp(row.free_cancel_deadline)!==start-row.free_cancel_hours*3600000)throw Error('Prazo divergente.')
 return{professional_id:target.professionalId,day:target.day,hour:target.hour,availability_version:version(row.availability_version),terms_id:uuid(row.terms_id),terms_version:version(row.terms_version),starts_at:row.starts_at,ends_at:row.ends_at,price_cents:row.price_cents,deposit_basis_points:row.deposit_basis_points,deposit_cents:deposit,balance_cents:row.balance_cents,free_cancel_hours:row.free_cancel_hours,free_cancel_deadline:row.free_cancel_deadline,no_show_deposit_retained:true,quoted_at:row.quoted_at}
}

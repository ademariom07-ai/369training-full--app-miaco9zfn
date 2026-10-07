import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged,readOwnProfile} from './profiles'
type Client=SupabaseClient<Database>
export type AvailabilityDay=Database['public']['Tables']['professional_availability_days']['Row']
export type AvailabilityInput={day:string;expectedVersion:number;hours:number[];released:boolean}
export type ReleasedDay=Database['public']['Functions']['list_released_availability']['Returns'][number]
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificação inválida.');return value.toLowerCase()}
export function calendarDay(value:string){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Data inválida.');const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Data inválida.');return value}
export function saoPauloToday(now=new Date()){const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=(name:string)=>parts.find(p=>p.type===name)!.value;return `${get('year')}-${get('month')}-${get('day')}`}
export function lastAvailabilityDay(today=saoPauloToday()){const d=new Date(calendarDay(today)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+366);return d.toISOString().slice(0,10)}
export function saoPauloHour(now=new Date()){return Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now))}
export function monthDays(month:string){calendarDay(month);if(!month.endsWith('-01'))throw Error('Mês inválido.');const d=new Date(month+'T12:00:00Z'),year=d.getUTCFullYear(),number=d.getUTCMonth();const total=new Date(Date.UTC(year,number+1,0,12)).getUTCDate();return Array.from({length:total},(_,n)=>`${month.slice(0,8)}${String(n+1).padStart(2,'0')}`)}
export function shiftMonth(month:string,offset:number){monthDays(month);if(!Number.isInteger(offset)||Math.abs(offset)>12)throw Error('Mês inválido.');const d=new Date(month+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,8)+'01'}
function hours(value:number[]){if(!Array.isArray(value)||value.length>19||Array.from(value).some(h=>!Number.isInteger(h)||h<5||h>23)||new Set(value).size!==value.length)throw Error('Horários inválidos.');return [...value].sort((a,b)=>a-b)}
export function validateAvailability(input:AvailabilityInput):AvailabilityInput{const day=calendarDay(input.day);if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>=Number.MAX_SAFE_INTEGER||typeof input.released!=='boolean')throw Error('Disponibilidade inválida.');const available=hours(input.hours);if(input.released&&!available.length)throw Error('Escolha horários antes de liberar o dia.');return{day,expectedVersion:input.expectedVersion,hours:available,released:input.released}}
function row(value:AvailabilityDay,owner:string):AvailabilityDay{if(!value||uuid(value.professional_id)!==owner||typeof value.released!=='boolean'||!Number.isSafeInteger(value.version)||value.version<1||typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at)))throw Error('Agenda indisponível.');const available_hours=hours(value.available_hours);if(value.released&&!available_hours.length||JSON.stringify(available_hours)!==JSON.stringify(value.available_hours))throw Error('Agenda indisponível.');return{professional_id:owner,day:calendarDay(value.day),available_hours,released:value.released,version:value.version,updated_at:value.updated_at}}
async function actor(expectedId:string,role:'aluno'|'profissional',client:Client){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');const profile=await readOwnProfile(client);await assertSessionUnchanged(client,identity);if(profile?.id!==id||profile.role!==role||role==='profissional'&&!profile.approved)throw Error('Agenda indisponível.');return identity}
export async function readOwnAvailability(expectedId:string,month:string,client:Client=getSupabaseClient()){
 const days=monthDays(month),identity=await actor(expectedId,'profissional',client)
 const result=await client.from('professional_availability_days').select('professional_id,day,available_hours,released,version,updated_at').eq('professional_id',identity.id).gte('day',days[0]).lte('day',days.at(-1)!).order('day').limit(32)
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>days.length)throw Error('Agenda indisponível.');const seen=new Set<string>();return result.data.map(value=>{const current=row(value,identity.id);if(!days.includes(current.day)||seen.has(current.day))throw Error('Agenda indisponível.');seen.add(current.day);return current})
}
export async function saveOwnAvailability(input:AvailabilityInput,expectedId:string,client:Client=getSupabaseClient()){
 const body=validateAvailability(input),identity=await actor(expectedId,'profissional',client)
 const result=await client.rpc('save_professional_availability',{p_day:body.day,p_expected_version:body.expectedVersion,p_hours:body.hours,p_released:body.released}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível alterar. Atualize a agenda.');const current=row(result.data,identity.id)
 if(current.day!==body.day||current.version!==body.expectedVersion+1||current.released!==body.released||JSON.stringify(current.available_hours)!==JSON.stringify(body.hours))throw Error('Agenda indisponível.')
 return current
}
export async function readReleasedAvailability(professionalId:string,month:string,expectedId:string,client:Client=getSupabaseClient()){
 const target=uuid(professionalId),days=monthDays(month),identity=await actor(expectedId,'aluno',client)
 const result=await client.rpc('list_released_availability',{p_professional_id:target,p_month:month})
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>days.length)throw Error('Horários indisponíveis.');const seen=new Set<string>();return result.data.map(value=>{const day=calendarDay(value.day),available_hours=hours(value.available_hours);if(uuid(value.professional_id)!==target||!days.includes(day)||seen.has(day)||!available_hours.length)throw Error('Horários indisponíveis.');seen.add(day);return{professional_id:target,day,available_hours}})
}

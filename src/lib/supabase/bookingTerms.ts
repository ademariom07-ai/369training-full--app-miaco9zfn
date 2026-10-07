import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged,readOwnProfile} from './profiles'
import {parseWalletAmount} from './wallet'
type Client=SupabaseClient<Database>
export type BookingTerms=Database['public']['Functions']['get_professional_booking_terms']['Returns'][number]
export type BookingTermsInput={expectedVersion:number;priceCents:number;depositBasisPoints:number;freeCancelHours:number}
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificação inválida.');return value.toLowerCase()}
export function depositCents(price:number,basisPoints:number){if(!Number.isSafeInteger(price)||price<1||!Number.isInteger(basisPoints)||basisPoints<1||basisPoints>10000)throw Error('Preço ou percentual inválido.');const deposit=Number((BigInt(price)*BigInt(basisPoints)+5000n)/10000n);if(deposit<1)throw Error('O sinal precisa resultar em pelo menos um centavo.');return deposit}
export function parseDepositPercentage(value:string){const points=parseWalletAmount(value);if(points>10000)throw Error('Informe um percentual entre 0,01 e 100.');return points}
export function validateBookingTerms(input:BookingTermsInput):BookingTermsInput{if(!input||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>=Number.MAX_SAFE_INTEGER||!Number.isInteger(input.freeCancelHours)||input.freeCancelHours<0||input.freeCancelHours>720)throw Error('Condições inválidas.');depositCents(input.priceCents,input.depositBasisPoints);return{expectedVersion:input.expectedVersion,priceCents:input.priceCents,depositBasisPoints:input.depositBasisPoints,freeCancelHours:input.freeCancelHours}}
function quote(value:BookingTerms|Database['public']['Tables']['professional_booking_terms']['Row'],owner:string):BookingTerms{
 if(!value||uuid(value.professional_id)!==owner||!Number.isSafeInteger(value.version)||value.version<1||typeof value.created_at!=='string'||!Number.isFinite(Date.parse(value.created_at))||value.no_show_deposit_retained!==true)throw Error('Condições indisponíveis.')
 const input=validateBookingTerms({expectedVersion:value.version-1,priceCents:value.price_cents,depositBasisPoints:value.deposit_basis_points,freeCancelHours:value.free_cancel_hours}),deposit=depositCents(input.priceCents,input.depositBasisPoints)
 if(value.deposit_cents!==deposit)throw Error('Condições indisponíveis.')
 return{id:uuid(value.id),professional_id:owner,version:value.version,price_cents:input.priceCents,deposit_basis_points:input.depositBasisPoints,deposit_cents:deposit,free_cancel_hours:input.freeCancelHours,no_show_deposit_retained:true,created_at:value.created_at}
}
async function actor(expectedId:string,role:'profissional'|'aluno',client:Client){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');const profile=await readOwnProfile(client);await assertSessionUnchanged(client,identity);if(profile?.id!==id||profile.role!==role||role==='profissional'&&!profile.approved)throw Error('Condições indisponíveis.');return identity}
export async function saveBookingTerms(input:BookingTermsInput,requestId:string,expectedId:string,client:Client=getSupabaseClient()){
 const body=validateBookingTerms(input),key=uuid(requestId),identity=await actor(expectedId,'profissional',client)
 const result=await client.rpc('save_professional_booking_terms',{p_request_id:key,p_expected_version:body.expectedVersion,p_price_cents:body.priceCents,p_deposit_basis_points:body.depositBasisPoints,p_free_cancel_hours:body.freeCancelHours}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data||uuid(result.data.request_id)!==key)throw Error('Não foi possível confirmar as condições.');const current=quote(result.data,identity.id)
 if(current.version!==body.expectedVersion+1||current.price_cents!==body.priceCents||current.deposit_basis_points!==body.depositBasisPoints||current.free_cancel_hours!==body.freeCancelHours)throw Error('Condições indisponíveis.');return current
}
export async function readOwnBookingTerms(expectedId:string,client:Client=getSupabaseClient()){
 const identity=await actor(expectedId,'profissional',client)
 const result=await client.from('professional_booking_terms').select('id,professional_id,version,price_cents,deposit_basis_points,deposit_cents,free_cancel_hours,no_show_deposit_retained,created_at').eq('professional_id',identity.id).order('version',{ascending:false}).limit(1).maybeSingle()
 await assertSessionUnchanged(client,identity)
 if(result.error)throw Error('Condições indisponíveis.');return result.data?quote(result.data,identity.id):null
}
export async function readProfessionalBookingTerms(professionalId:string,expectedId:string,client:Client=getSupabaseClient()){
 const target=uuid(professionalId),identity=await actor(expectedId,'aluno',client)
 const result=await client.rpc('get_professional_booking_terms',{p_professional_id:target}).maybeSingle()
 await assertSessionUnchanged(client,identity)
 if(result.error)throw Error('Condições indisponíveis.');return result.data?quote(result.data,target):null
}

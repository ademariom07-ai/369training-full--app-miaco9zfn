import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
export const specialties={educacao_fisica:'Educação física',nutricao:'Nutrição',fisioterapia:'Fisioterapia',psicologia:'Psicologia',artes_marciais:'Artes marciais'} as const
export type Specialty=keyof typeof specialties
export type Application=Database['public']['Tables']['professional_applications']['Row']
type Client=SupabaseClient<Database>
const fields='applicant_id,applicant_name,specialty,credential,status,version,requested_at,reviewed_at,review_reason'
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Conta inválida.');return value.toLowerCase()}
function text(value:string,max:number){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error('Dados inválidos.');return value.trim()}
async function actor(client:Client,expectedId:string){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');return identity}
function copy(row:Application){
 if(!row||!['pending','approved','rejected'].includes(row.status)||!Object.hasOwn(specialties,row.specialty)||!Number.isSafeInteger(row.version)||row.version<1||!Number.isFinite(Date.parse(row.requested_at)))throw Error('Solicitação indisponível.')
 uuid(row.applicant_id);text(row.applicant_name,160);text(row.credential,160)
 if(row.status==='pending'&&(row.reviewed_at!==null||row.review_reason!==null)||row.status!=='pending'&&(!row.reviewed_at||!Number.isFinite(Date.parse(row.reviewed_at))||!row.review_reason))throw Error('Solicitação indisponível.')
 if(row.review_reason!==null)text(row.review_reason,1000)
 return{applicant_id:row.applicant_id,applicant_name:row.applicant_name,specialty:row.specialty,credential:row.credential,status:row.status,version:row.version,requested_at:row.requested_at,reviewed_at:row.reviewed_at,review_reason:row.review_reason}
}
export async function readOwnApplication(expectedId:string,client:Client=getSupabaseClient()){
 const identity=await actor(client,expectedId),result=await client.from('professional_applications').select(fields).eq('applicant_id',identity.id).maybeSingle()
 await assertSessionUnchanged(client,identity)
 if(result.error||result.data&&result.data.applicant_id!==identity.id)throw Error('Solicitação indisponível.')
 return result.data?copy(result.data):null
}
export async function readApplicationQueue(expectedAdminId:string,page=1,client:Client=getSupabaseClient()){
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Página inválida.')
 const identity=await actor(client,expectedAdminId),result=await client.from('professional_applications').select(fields).eq('status','pending').order('requested_at').order('applicant_id').range((page-1)*20,page*20-1)
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>20)throw Error('Fila indisponível.')
 const ids=new Set<string>()
 return result.data.map(row=>{if(row.status!=='pending'||ids.has(row.applicant_id))throw Error('Fila indisponível.');ids.add(row.applicant_id);return copy(row)})
}
export async function submitApplication(specialty:Specialty,credential:string,expectedId:string,client:Client=getSupabaseClient()){
 if(!Object.hasOwn(specialties,specialty))throw Error('Área inválida.')
 const p_credential=text(credential,160),identity=await actor(client,expectedId),result=await client.rpc('submit_professional_application',{p_specialty:specialty,p_credential}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data||result.data.applicant_id!==identity.id||result.data.status!=='pending'||result.data.specialty!==specialty||result.data.credential!==p_credential)throw Error('Não foi possível solicitar.')
 return copy(result.data)
}
export async function reviewApplication(row:Application,decision:'approved'|'rejected',reason:string,expectedAdminId:string,client:Client=getSupabaseClient()){
 const p_applicant_id=uuid(row.applicant_id),p_expected_version=row.version,p_reason=text(reason,1000)
 if(row.status!=='pending'||!Number.isSafeInteger(p_expected_version)||p_expected_version<1||!['approved','rejected'].includes(decision))throw Error('Análise indisponível.')
 const identity=await actor(client,expectedAdminId)
 if(identity.id===p_applicant_id)throw Error('Análise indisponível.')
 const result=await client.rpc('review_professional_application',{p_applicant_id,p_expected_version,p_decision:decision,p_reason}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data||result.data.applicant_id!==p_applicant_id||result.data.version!==p_expected_version||result.data.status!==decision||result.data.review_reason!==p_reason)throw Error('Não foi possível analisar.')
 return copy(result.data)
}

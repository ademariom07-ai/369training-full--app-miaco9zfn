import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import type {StudentLink} from './links'
export type ParticipantLink=StudentLink&{participant_name:string|null}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const date=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))
export async function readParticipantLinks(account:{id:string;role:string},page=1,client:SupabaseClient<Database>=getSupabaseClient()):Promise<ParticipantLink[]>{
 const accountId=account.id,role=account.role
 if(!uuid(accountId)||!['aluno','profissional'].includes(role)||!Number.isSafeInteger(page)||page<1||page>10000||role==='aluno'&&page!==1)throw Error('Consulta indisponível.')
 const actor=await verifiedIdentity(client)
 if(actor.id!==accountId)throw Error('Sessão alterada. Atualize a tela.')
 const result=await client.rpc('list_participant_links',{p_page:page})
 await assertSessionUnchanged(client,actor)
 if(result.error||!Array.isArray(result.data)||result.data.length>(role==='aluno'?1:20))throw Error('Não foi possível carregar seus vínculos.')
 const students=new Set<string>()
 return result.data.map(row=>{
  if(!row||!uuid(row.student_id)||!uuid(row.professional_id)||row.student_id===row.professional_id||students.has(row.student_id)||!Number.isSafeInteger(row.version)||row.version<1||!['pending','active','revoked'].includes(row.state)||!date(row.requested_at)||role==='aluno'&&row.student_id!==actor.id||role==='profissional'&&row.professional_id!==actor.id)throw Error('Vínculo indisponível.')
  if(row.state==='pending'&&(row.accepted_at!==null||row.revoked_at!==null)||row.state==='active'&&(!date(row.accepted_at)||row.revoked_at!==null)||row.state==='revoked'&&!date(row.revoked_at)||row.accepted_at!==null&&!date(row.accepted_at))throw Error('Vínculo indisponível.')
  if(row.participant_name!==null&&(typeof row.participant_name!=='string'||!row.participant_name.trim()||row.participant_name.length>160)||row.state==='revoked'&&row.participant_name!==null)throw Error('Nome indisponível.')
  students.add(row.student_id)
  return{student_id:row.student_id,professional_id:row.professional_id,state:row.state,version:row.version,requested_at:row.requested_at,accepted_at:row.accepted_at,revoked_at:row.revoked_at,participant_name:row.participant_name}
 })
}

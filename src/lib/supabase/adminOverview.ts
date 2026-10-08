import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged,readOwnProfile} from './profiles'
type RpcRow=Database['public']['Functions']['admin_participant_overview']['Returns'][number]
export type ParticipantOverview=Omit<RpcRow,'available_cents'|'reserved_cents'|'wallet_version'|'wallet_updated_at'>&{available_cents:number|null;reserved_cents:number|null;wallet_version:number|null;wallet_updated_at:string|null}
type Client=SupabaseClient<Database>
function uuid(v:string){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
function count(v:unknown){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0}
function date(v:unknown){return typeof v==='string'&&Number.isFinite(Date.parse(v))}
function copy(r:ParticipantOverview):ParticipantOverview{
 if(!r||!uuid(r.participant_id)||typeof r.display_name!=='string'||r.display_name.length>160||!['aluno','profissional'].includes(r.participant_role)||typeof r.professional_approved!=='boolean'||typeof r.wallet_initialized!=='boolean'||!date(r.joined_at)||!date(r.checked_at)||![r.esg_pending,r.esg_approved,r.esg_rejected].every(count))throw Error('Resumo indisponível.')
 if(r.wallet_initialized){if(!count(r.available_cents)||!count(r.reserved_cents)||!Number.isSafeInteger((r.available_cents as number)+(r.reserved_cents as number))||!count(r.wallet_version)||r.wallet_version!<1||!date(r.wallet_updated_at))throw Error('Carteira inconsistente.')}
 else if([r.available_cents,r.reserved_cents,r.wallet_version,r.wallet_updated_at].some(v=>v!==null))throw Error('Carteira não inicializada inconsistente.')
 return {participant_id:r.participant_id,display_name:r.display_name,participant_role:r.participant_role,professional_approved:r.professional_approved,joined_at:r.joined_at,wallet_initialized:r.wallet_initialized,available_cents:r.available_cents,reserved_cents:r.reserved_cents,wallet_version:r.wallet_version,wallet_updated_at:r.wallet_updated_at,esg_pending:r.esg_pending,esg_approved:r.esg_approved,esg_rejected:r.esg_rejected,checked_at:r.checked_at}
}
export async function readAdminParticipantOverview(expectedAdminId:string,page=1,query='',client:Client=getSupabaseClient()){
 if(!uuid(expectedAdminId)||!Number.isSafeInteger(page)||page<1||page>10000||typeof query!=='string'||query.length>120)throw Error('Consulta inválida.')
 const identity=await verifiedIdentity(client)
 if(identity.id!==expectedAdminId.toLowerCase())throw Error('Sessão alterada.')
 const profile=await readOwnProfile(client)
 if(!profile||profile.id!==identity.id||profile.role!=='admin')throw Error('Consulta restrita ao administrativo.')
 await assertSessionUnchanged(client,identity)
 const result=await client.rpc('admin_participant_overview',{p_page:page,p_query:query.trim()})
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>20)throw Error('Não foi possível consultar os participantes.')
 const ids=new Set<string>()
 return result.data.map(row=>{const r=copy(row);if(ids.has(r.participant_id))throw Error('Resumo repetido.');ids.add(r.participant_id);return r})
}

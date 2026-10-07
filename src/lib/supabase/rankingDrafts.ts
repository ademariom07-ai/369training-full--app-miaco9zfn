import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import type {RankingPolicy} from '../rankingRules'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged,readOwnProfile} from './profiles'
type Client=SupabaseClient<Database>
export const poolBases=['tarifas_only','tarifas_and_monthly','weighted_tarifas_monthly'] as const
export type DraftInput={title:string;notes:string;referrals:RankingPolicy['referrals'];partnerServices:RankingPolicy['partnerServices'];rating:RankingPolicy['rating'];poolBasis:typeof poolBases[number]}
export type RankingDraft=Omit<Database['public']['Tables']['ranking_policy_drafts']['Row'],'referrals'|'partner_services'|'rating'|'pool_basis'>&{referrals:DraftInput['referrals'];partner_services:DraftInput['partnerServices'];rating:DraftInput['rating'];pool_basis:DraftInput['poolBasis']}
const fields='id,request_id,created_by,created_at,title,notes,referrals,partner_services,rating,pool_basis'
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificação inválida.');return value.toLowerCase()}
export function validateDraft(input:DraftInput):DraftInput{
 if(!input||typeof input.title!=='string'||typeof input.notes!=='string')throw Error('Dados inválidos.')
 const title=input.title.trim(),notes=input.notes.trim()
 if(!title||Array.from(title).length>120||Array.from(notes).length>2000||!['minimum_one','plus_one','legacy_divisor_18'].includes(input.referrals)||!['actual','floor_150','cap_150'].includes(input.partnerServices)||!['rounded','exact'].includes(input.rating)||!poolBases.includes(input.poolBasis))throw Error('Escolha todas as opções do rascunho.')
 return{title,notes,referrals:input.referrals,partnerServices:input.partnerServices,rating:input.rating,poolBasis:input.poolBasis}
}
function row(value:Database['public']['Tables']['ranking_policy_drafts']['Row']):RankingDraft{
 if(!value||typeof value.created_at!=='string'||!Number.isFinite(Date.parse(value.created_at)))throw Error('Rascunho indisponível.')
 const body=validateDraft({title:value.title,notes:value.notes,referrals:value.referrals as DraftInput['referrals'],partnerServices:value.partner_services as DraftInput['partnerServices'],rating:value.rating as DraftInput['rating'],poolBasis:value.pool_basis as DraftInput['poolBasis']})
 if(body.title!==value.title||body.notes!==value.notes)throw Error('Rascunho indisponível.')
 return{id:uuid(value.id),request_id:uuid(value.request_id),created_by:uuid(value.created_by),created_at:value.created_at,title:body.title,notes:body.notes,referrals:body.referrals,partner_services:body.partnerServices,rating:body.rating,pool_basis:body.poolBasis}
}
async function admin(expectedId:string,client:Client){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');const profile=await readOwnProfile(client);await assertSessionUnchanged(client,identity);if(profile?.id!==id||profile.role!=='admin')throw Error('Acesso administrativo necessário.');return identity}
export async function createRankingDraft(input:DraftInput,requestId:string,expectedId:string,client:Client=getSupabaseClient()){
 const body=validateDraft(input),key=uuid(requestId),identity=await admin(expectedId,client)
 const result=await client.rpc('create_ranking_policy_draft',{p_request_id:key,p_title:body.title,p_notes:body.notes,p_referrals:body.referrals,p_partner_services:body.partnerServices,p_rating:body.rating,p_pool_basis:body.poolBasis}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível salvar o rascunho.');const draft=row(result.data)
 if(draft.created_by!==identity.id||draft.request_id!==key||draft.title!==body.title||draft.notes!==body.notes||draft.referrals!==body.referrals||draft.partner_services!==body.partnerServices||draft.rating!==body.rating||draft.pool_basis!==body.poolBasis)throw Error('Rascunho indisponível.')
 return draft
}
export async function readRankingDrafts(expectedId:string,page=1,client:Client=getSupabaseClient()){
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Página inválida.');const identity=await admin(expectedId,client)
 const result=await client.from('ranking_policy_drafts').select(fields).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1)
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>20)throw Error('Histórico indisponível.')
 const seen=new Set<string>();return result.data.map(value=>{const draft=row(value);if(seen.has(draft.id))throw Error('Histórico indisponível.');seen.add(draft.id);return draft})
}

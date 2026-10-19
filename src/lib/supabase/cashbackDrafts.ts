import type {SupabaseClient} from '@supabase/supabase-js'
export type CashbackDraftInput={title:string;topPoolPercent:number;topParticipantsPercent:number;topRatio:number}
export type CashbackDraft=CashbackDraftInput&{id:string;requestId:string;createdBy:string;createdAt:string;status:'draft'}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validateCashbackDraft(input:CashbackDraftInput){
 if(!input||typeof input.title!=='string')throw Error('Informe um título.')
 const title=input.title.trim()
 if(!title||Array.from(title).length>120||![input.topPoolPercent,input.topParticipantsPercent].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=99)||!Number.isSafeInteger(input.topRatio)||input.topRatio<1||input.topRatio>100)throw Error('Use título de até 120 caracteres, percentuais de 1 a 99 e multiplicador inteiro de 1 a 100.')
 return {title,topPoolPercent:input.topPoolPercent,topParticipantsPercent:input.topParticipantsPercent,topRatio:input.topRatio}
}
function row(r:any):CashbackDraft{
 if(!r||![r.id,r.request_id,r.created_by].every(v=>typeof v==='string'&&uuid.test(v))||r.status!=='draft'||r.algorithm_version!=='pareto-configurable-v1'||typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at)))throw Error('Rascunho inválido.')
 const values=validateCashbackDraft({title:r.title,topPoolPercent:r.top_pool_percent,topParticipantsPercent:r.top_participants_percent,topRatio:r.top_ratio})
 return {...values,id:r.id,requestId:r.request_id,createdBy:r.created_by,createdAt:r.created_at,status:'draft'}
}
async function admin(client:SupabaseClient,owner:string){
 const before=await client.auth.getSession();const session=before.data.session
 if(before.error||!session||session.user.id!==owner)throw Error('Entre novamente na conta administrativa.')
 const user=await client.auth.getUser(session.access_token)
 if(user.error||user.data.user?.id!==owner||user.data.user?.is_anonymous)throw Error('Sessão não autorizada.')
 const profile=await client.from('profiles').select('id,role').eq('id',owner).single()
 if(profile.error||profile.data?.id!==owner||profile.data?.role!=='admin')throw Error('Acesso administrativo necessário.')
 await unchanged(client,owner,session.access_token)
 return session.access_token
}
async function unchanged(client:SupabaseClient,owner:string,token:string){const s=await client.auth.getSession();if(s.error||s.data.session?.user.id!==owner||s.data.session?.access_token!==token)throw Error('A sessão mudou. Consulte o histórico antes de tentar novamente.')}
export async function saveCashbackDraft(client:SupabaseClient,owner:string,requestId:string,input:CashbackDraftInput){
 const body=validateCashbackDraft(input);if(!uuid.test(requestId))throw Error('Solicitação inválida.')
 const token=await admin(client,owner)
 const r=await client.rpc('create_cashback_policy_draft',{p_request_id:requestId,p_title:body.title,p_top_pool_percent:body.topPoolPercent,p_top_participants_percent:body.topParticipantsPercent,p_top_ratio:body.topRatio}).single()
 await unchanged(client,owner,token)
 if(r.error)throw Error('Não foi possível confirmar o salvamento. Reenvie os mesmos dados para consultar a mesma solicitação.')
 const saved=row(r.data)
 if(saved.createdBy!==owner||saved.requestId!==requestId||saved.title!==body.title||saved.topPoolPercent!==body.topPoolPercent||saved.topParticipantsPercent!==body.topParticipantsPercent||saved.topRatio!==body.topRatio)throw Error('Resposta de salvamento inconsistente.')
 return saved
}
export async function readCashbackDrafts(client:SupabaseClient,owner:string,page:number){
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Página inválida.')
 const token=await admin(client,owner)
 const r=await client.from('cashback_policy_drafts').select('id,request_id,created_by,created_at,title,top_pool_percent,top_participants_percent,top_ratio,status,algorithm_version').order('created_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*20,page*20)
 await unchanged(client,owner,token)
 if(r.error||!Array.isArray(r.data)||r.data.length>21)throw Error('Histórico indisponível.')
 return {rows:r.data.slice(0,20).map(row),hasNext:r.data.length>20}
}

import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Avaliações aluno ↔ profissional (migração 20261126120000).
// Média: 100 mais recentes, sem as 3 piores (com 3 ou menos, usa todas).
type Client=SupabaseClient<Database>
export type ReviewSummary={user_id:string,average:number|null,counted:number,total:number,dropped:number}
export type Review={review_id:string,reviewer_name:string,rating:number,comment:string|null,created_at:string,hidden:boolean}
export type AdminReview=Review&{reviewee_name:string,direction:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const known=['Você só pode avaliar quem acompanhou você (ou seus alunos).','Dê uma nota de 1 a 5 (comentário até 500 caracteres).','Você já avaliou nos últimos 30 dias.','Informe o motivo.','Avaliações indisponíveis.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}
// Mesma regra do banco, para conferência e testes.
export function trimmedAverage(ratings:number[]){const last=ratings.slice(0,100);const kept=last.length<=3?last:[...last].sort((a,b)=>a-b).slice(3);return kept.length?Math.round(kept.reduce((a,b)=>a+b,0)/kept.length*100)/100:null}
export const formatAverage=(n:number|null)=>n===null?'—':n.toFixed(1).replace('.',',')

export async function submitReview(user:string,rating:number,comment:string,client:Client=getSupabaseClient()){
 if(!uuid.test(user))throw Error('Pessoa inválida.')
 if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Escolha de 1 a 5 estrelas.')
 if(comment.trim().length>500)throw Error('Comentário até 500 caracteres.')
 return await call(client,()=>client.rpc('submit_review',{p_reviewee:user,p_rating:rating,p_comment:comment.trim()||null}),'Não foi possível enviar a avaliação.')
}
export async function reviewSummaries(users:string[],client:Client=getSupabaseClient()):Promise<Record<string,ReviewSummary>>{
 const ids=[...new Set(users.filter(u=>uuid.test(u)))].slice(0,60);if(!ids.length)return{}
 const rows=await call(client,()=>client.rpc('review_summaries',{p_users:ids}),'Não foi possível carregar as notas.')
 const out:Record<string,ReviewSummary>={};for(const r of Array.isArray(rows)?rows:[])if(r&&uuid.test(r.user_id))out[r.user_id]={...r,average:r.average===null?null:Number(r.average)}
 return out
}
export async function listReviews(user:string,page=1,client:Client=getSupabaseClient()):Promise<Review[]>{
 const rows=await call(client,()=>client.rpc('list_reviews',{p_user:user,p_page:page}),'Não foi possível carregar as avaliações.')
 return Array.isArray(rows)?rows:[]
}
export async function myReviewStatus(user:string,client:Client=getSupabaseClient()){
 const rows=await call(client,()=>client.rpc('my_review_status',{p_reviewee:user}),'Não foi possível verificar.')
 const r=Array.isArray(rows)?rows[0]:null
 return{canReview:!!r?.can_review,nextAt:r?.next_at??null,lastRating:r?.last_rating??null}
}
export async function hideReview(id:string,hide:boolean,reason:string,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('hide_review',{p_id:id,p_hide:hide,p_reason:reason.trim()||null}),'Não foi possível alterar.',true)}
export async function listRecentReviews(client:Client=getSupabaseClient()):Promise<AdminReview[]>{
 const rows=await call(client,()=>client.rpc('list_recent_reviews'),'Não foi possível carregar.');return Array.isArray(rows)?rows:[]
}

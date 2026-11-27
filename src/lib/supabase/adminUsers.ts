import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Admin: gestão de usuários (migração 20261127120000).
type Client=SupabaseClient<Database>
export type AdminUser={user_id:string,display_name:string,email:string|null,role:string,approved:boolean,created_at:string,last_sign_in_at:string|null,application_status:string|null,application_version:number|null,specialty:string|null,credential:string|null,active_links:number,deleted:boolean}
export type UserFilter=''|'pedido_pendente'|'aluno'|'profissional'|'parceiro_pendente'|'admin'
export const filterLabels:Record<UserFilter,string>={'':'Todos',pedido_pendente:'Pedidos de parceiro',aluno:'Alunos',profissional:'Parceiros ativos',parceiro_pendente:'Parceiros suspensos/pendentes',admin:'Admins'}
export const specialtyLabels:Record<string,string>={educacao_fisica:'Educação física',nutricao:'Nutrição',fisioterapia:'Fisioterapia',psicologia:'Psicologia',artes_marciais:'Artes marciais'}
export const deleteOutcomes:Record<string,string>={excluida:'Conta excluída definitivamente.',anonimizada:'A conta tinha registros que precisam ser guardados (reservas, carteira ou histórico): foi anonimizada, os dados pessoais foram apagados e o login foi bloqueado.',anonimizada_sem_bloqueio:'A conta foi anonimizada, mas não foi possível bloquear o login automaticamente. Bloqueie em Authentication → Users no Supabase.'}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const known=['Informe o motivo (3 a 500 caracteres).','Só parceiros já aprovados podem ser suspensos ou reativados.','Esta conta não pode ser excluída por aqui.','Para confirmar, digite exatamente o e-mail ou o nome da conta.',
 'Encerre o vínculo de aluno antes de aprovar o acesso profissional.','Esta conta não pode virar parceira por aqui.','Este registro profissional já está cadastrado em outra conta. Se ele é seu, fale com a equipe 369.','Informe o número do registro profissional (ex.: CREF 123456-G/SP).','Esta conta já é parceira.','Informe a área e o registro profissional (ex.: CREF, CRN).','Esta pessoa tem vínculo como aluno. Marque "encerrar o vínculo de aluno" para aprovar.','Atualize a solicitação antes de analisar.','Análise indisponível.','Dados inválidos.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}
const reasonOk=(r:string)=>{const t=r.trim();if(t.length<3||t.length>500)throw Error('Informe o motivo (3 a 500 caracteres).');return t}

export async function adminListUsers(query:string,filter:UserFilter,page=1,client:Client=getSupabaseClient()):Promise<AdminUser[]>{
 const rows=await call(client,()=>client.rpc('admin_list_users',{p_query:query.trim().slice(0,120)||null,p_role:filter||null,p_page:page}),'Não foi possível carregar os usuários.')
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&uuid.test(r.user_id))
}
export async function adminSetPartner(user:string,active:boolean,reason:string,client:Client=getSupabaseClient()){
 const r=reasonOk(reason);await call(client,()=>client.rpc('admin_set_partner',{p_user:user,p_active:active,p_reason:r}),'Não foi possível alterar.',true)
}
export async function adminDeleteAccount(user:string,confirm:string,reason:string,client:Client=getSupabaseClient()){
 const r=reasonOk(reason);if(!confirm.trim())throw Error('Para confirmar, digite exatamente o e-mail ou o nome da conta.')
 return await call(client,()=>client.rpc('admin_delete_account',{p_user:user,p_confirm:confirm.trim(),p_reason:r}),'Não foi possível excluir a conta.')
}
export async function adminReviewPartner(user:AdminUser,approve:boolean,reason:string,client:Client=getSupabaseClient()){
 const r=reasonOk(reason)
 if(user.application_status!=='pending'||!user.application_version)throw Error('Análise indisponível.')
 await call(client,()=>client.rpc('review_professional_application',{p_applicant_id:user.user_id,p_expected_version:user.application_version!,p_decision:approve?'approved':'rejected',p_reason:r}),'Não foi possível analisar.')
}
export async function adminListActions(client:Client=getSupabaseClient()){
 const rows=await call(client,()=>client.rpc('admin_list_actions'),'Não foi possível carregar o registro.');return Array.isArray(rows)?rows:[]
}
// Aprova direto como parceiro (com ou sem pedido; pode encerrar o vínculo de aluno que bloqueia a aprovação).
export async function adminMakePartner(user:string,specialty:string,credential:string,reason:string,endStudentLink:boolean,client:Client=getSupabaseClient()){
 const r=reasonOk(reason)
 if(!specialty||!credential.trim())throw Error('Informe a área e o registro profissional (ex.: CREF, CRN).')
 await call(client,()=>client.rpc('admin_make_partner',{p_user:user,p_specialty:specialty,p_credential:credential.trim().slice(0,160),p_reason:r,p_end_student_link:endStudentLink}),'Não foi possível aprovar.',true)
}
export async function adminDuplicateCredentials(client:Client=getSupabaseClient()){
 const rows=await call(client,()=>client.rpc('admin_duplicate_credentials'),'Não foi possível conferir.');return Array.isArray(rows)?rows:[]
}

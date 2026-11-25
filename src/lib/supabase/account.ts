import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity} from './profiles'

// O próprio usuário exclui a conta (migração 20261129120000). Depois, a sessão é encerrada neste aparelho.
type Client=SupabaseClient<Database>
const known=['Para confirmar, digite exatamente o e-mail da sua conta.','Contas de administrador não podem ser excluídas por aqui.']
export async function myEmail(client:Client=getSupabaseClient()){const {data}=await client.auth.getUser();return data.user?.email??''}
export async function deleteMyAccount(confirm:string,reason:string,client:Client=getSupabaseClient()){
 if(!confirm.trim())throw Error('Para confirmar, digite exatamente o e-mail da sua conta.')
 await verifiedIdentity(client)
 const {data,error}=await client.rpc('delete_my_account',{p_confirm:confirm.trim(),p_reason:reason.trim().slice(0,500)||null})
 if(error||typeof data!=='string')throw Error(error?.message&&known.includes(error.message)?error.message:'Não foi possível excluir a conta. Tente de novo ou fale com a equipe 369.')
 try{await client.auth.signOut({scope:'local'})}catch{/* a conta já não existe */}
 return data
}

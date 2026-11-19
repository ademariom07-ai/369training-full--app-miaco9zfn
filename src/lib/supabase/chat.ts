import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Chat (migração 20261119120000): aluno <-> profissional do vínculo e qualquer pessoa <-> equipe 369.
type Client=SupabaseClient<Database>
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type ChatThread={thread_id:string,kind:'vinculo'|'suporte',title:string,last_body:string|null,last_message_at:string|null,unread:number,can_send:boolean,counterpart_id:string|null}
export type ChatMessage={message_id:number,mine:boolean,sender_label:string,body:string,created_at:string}
const known=['Converse com o profissional depois de enviar o pedido de acompanhamento.','Conversa disponível só com seus alunos.','Esta conversa foi encerrada.','Muitas mensagens seguidas. Aguarde um minuto.','Mensagem vazia ou longa demais.']
const safe=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)

async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task()
 await assertSessionUnchanged(client,actor)
 if(result.error||result.data===null||result.data===undefined)throw safe(result.error,fallback)
 return result.data
}

export async function openChat(withId:string|null,client:Client=getSupabaseClient()):Promise<string>{
 if(withId!==null&&!uuid.test(withId))throw Error('Conversa inválida.')
 const id=await call(client,()=>client.rpc('open_chat',{p_with:withId}),'Não foi possível abrir a conversa.')
 if(typeof id!=='string'||!uuid.test(id))throw Error('Conversa indisponível.')
 return id
}
export async function listChats(client:Client=getSupabaseClient()):Promise<ChatThread[]>{
 const rows=await call(client,()=>client.rpc('list_chats'),'Não foi possível carregar as conversas.')
 if(!Array.isArray(rows)||rows.length>100)throw Error('Conversas indisponíveis.')
 return rows.map(row=>{
  if(!row||!uuid.test(row.thread_id)||!['vinculo','suporte'].includes(row.kind)||typeof row.title!=='string')throw Error('Conversas indisponíveis.')
  return{thread_id:row.thread_id,kind:row.kind as ChatThread['kind'],title:row.title,last_body:row.last_body,last_message_at:row.last_message_at,unread:Number(row.unread)||0,can_send:!!row.can_send,counterpart_id:row.counterpart_id}
 })
}
export async function readChat(threadId:string,after=0,client:Client=getSupabaseClient()):Promise<ChatMessage[]>{
 if(!uuid.test(threadId)||!Number.isSafeInteger(after)||after<0)throw Error('Conversa inválida.')
 const rows=await call(client,()=>client.rpc('read_chat',{p_thread:threadId,p_after:after}),'Não foi possível carregar as mensagens.')
 if(!Array.isArray(rows)||rows.length>50)throw Error('Mensagens indisponíveis.')
 return rows.map(row=>{
  if(!row||!Number.isSafeInteger(Number(row.message_id))||typeof row.body!=='string'||row.body.length>2000||typeof row.sender_label!=='string')throw Error('Mensagens indisponíveis.')
  return{message_id:Number(row.message_id),mine:!!row.mine,sender_label:row.sender_label,body:row.body,created_at:row.created_at}
 })
}
export async function sendChat(threadId:string,body:string,client:Client=getSupabaseClient()){
 const text=(body||'').trim()
 if(!uuid.test(threadId))throw Error('Conversa inválida.')
 if(!text)throw Error('Escreva uma mensagem.')
 if(text.length>2000)throw Error('Mensagem vazia ou longa demais.')
 await call(client,()=>client.rpc('send_chat_message',{p_thread:threadId,p_body:text}),'Não foi possível enviar a mensagem.')
}
export async function unreadTotal(client:Client=getSupabaseClient()):Promise<number>{
 const n=await call(client,()=>client.rpc('chat_unread_total'),'Indisponível.')
 return Number(n)||0
}

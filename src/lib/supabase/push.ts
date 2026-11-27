import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Notificações push (migração 20261204120000 + Edge Function "push").
type Client=SupabaseClient<Database>
export type PushPrefs={mensagens:boolean,treinos:boolean,conteudos:boolean,vinculos:boolean,agua:boolean,treino_hora:number|null}
const known=['Aparelho inválido.','Horário inválido.','Ative as notificações neste aparelho primeiro.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}

export function pushSupport(){
 if(typeof window==='undefined')return{ok:false,reason:'Indisponível.'}
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=window.matchMedia?.('(display-mode: standalone)').matches||(navigator as unknown as {standalone?:boolean}).standalone===true
 if(ios&&!standalone)return{ok:false,reason:'No iPhone/iPad, as notificações funcionam com o app instalado: toque em Compartilhar › "Adicionar à Tela de Início", abra o app por lá e ative aqui.'}
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return{ok:false,reason:'Este navegador não aceita notificações. Use o Chrome, Edge, Firefox ou o app instalado.'}
 return{ok:true,reason:''}
}
function keyBytes(base64url:string){const pad='='.repeat((4-base64url.length%4)%4),b=atob((base64url+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function registration(){
 let reg=await navigator.serviceWorker.getRegistration()
 if(!reg)reg=await navigator.serviceWorker.register('/sw.js')
 return await navigator.serviceWorker.ready.then(r=>r).catch(()=>reg!)
}
export async function currentSubscription(){if(!pushSupport().ok)return null;try{return await (await registration()).pushManager.getSubscription()}catch{return null}}
export async function enablePush(client:Client=getSupabaseClient()){
 const support=pushSupport();if(!support.ok)throw Error(support.reason)
 const perm=await Notification.requestPermission()
 if(perm!=='granted')throw Error('As notificações foram bloqueadas no navegador. Libere em Configurações do site › Notificações e tente de novo.')
 const key=await call(client,()=>client.rpc('push_public_key'),'Não foi possível ativar.',true)
 if(!key)throw Error('As notificações ainda estão sendo configuradas pela equipe 369. Tente de novo em alguns minutos.')
 const reg=await registration()
 let sub=await reg.pushManager.getSubscription()
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key)})
 const j=sub.toJSON() as {endpoint?:string,keys?:{p256dh?:string,auth?:string}}
 if(!j.endpoint||!j.keys?.p256dh||!j.keys?.auth)throw Error('Não foi possível ativar neste aparelho.')
 await call(client,()=>client.rpc('save_push_subscription',{p_endpoint:j.endpoint!,p_p256dh:j.keys!.p256dh!,p_auth:j.keys!.auth!}),'Não foi possível ativar.',true)
}
export async function disablePush(client:Client=getSupabaseClient()){
 const sub=await currentSubscription();if(!sub)return
 try{await call(client,()=>client.rpc('delete_push_subscription',{p_endpoint:sub.endpoint}),'Não foi possível desativar.',true)}finally{await sub.unsubscribe().catch(()=>false)}
}
export async function pushSettings(client:Client=getSupabaseClient()){
 const rows=await call(client,()=>client.rpc('my_push_settings'),'Não foi possível carregar.')
 const r=Array.isArray(rows)?rows[0]:null
 return{devices:r?.devices??0,prefs:{mensagens:r?.mensagens??true,treinos:r?.treinos??true,conteudos:r?.conteudos??true,vinculos:r?.vinculos??true,agua:r?.agua??true,treino_hora:r?.treino_hora??null} as PushPrefs}
}
export async function savePushPrefs(p:PushPrefs,client:Client=getSupabaseClient()){
 await call(client,()=>client.rpc('save_push_prefs',{p_mensagens:p.mensagens,p_treinos:p.treinos,p_conteudos:p.conteudos,p_vinculos:p.vinculos,p_agua:p.agua,p_treino_hora:p.treino_hora}),'Não foi possível salvar.',true)
}
export async function pushTest(client:Client=getSupabaseClient()){await call(client,()=>client.rpc('push_test'),'Não foi possível enviar o teste.',true)}

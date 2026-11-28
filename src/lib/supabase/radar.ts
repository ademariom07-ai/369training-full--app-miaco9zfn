import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Radar 369 (migração 20261206120000 + Edge Function "radar").
type Client=SupabaseClient<Database>
export const radarSpecialties={educacao_fisica:'Educação física',nutricao:'Nutrição',fisioterapia:'Fisioterapia',psicologia:'Psicologia',artes_marciais:'Artes marciais'} as const
export type RadarSpecialty=keyof typeof radarSpecialties
export const evidenceLabels:Record<string,{label:string,strength:'forte'|'moderada'|'inicial'}>={
 metanalise:{label:'Metanálise',strength:'forte'},revisao_sistematica:{label:'Revisão sistemática',strength:'forte'},diretriz:{label:'Diretriz',strength:'forte'},
 ensaio_clinico:{label:'Ensaio clínico',strength:'moderada'},revisao:{label:'Revisão',strength:'inicial'},estudo:{label:'Estudo',strength:'inicial'}}
export type RadarItem={item_id:string,kind:'estudo'|'nota',specialty:string,title:string,title_original:string|null,journal:string|null,pub_year:number|null,evidence:string|null,summary:string,practice:string|null,content_idea:string|null,url:string|null,week:string|null,hidden:boolean,created_at:string}
const known=['O Radar 369 é para parceiros.','Nota inválida: confira título, texto e link (https://).','Item indisponível.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}
// Só links seguros e conhecidos viram botão.
export const safeUrl=(u:string|null)=>u&&/^https:\/\/[^\s]+$/.test(u)?u:null
export async function radarMySpecialty(client:Client=getSupabaseClient()){return (await call(client,()=>client.rpc('radar_my_specialty'),'Não foi possível carregar.',true)) as RadarSpecialty|null}
export async function listRadar(specialty:RadarSpecialty|null,page=1,client:Client=getSupabaseClient()):Promise<RadarItem[]>{
 const rows=await call(client,()=>client.rpc('list_radar',{p_specialty:specialty,p_page:page}),'Não foi possível carregar o Radar.')
 return (Array.isArray(rows)?rows:[]).map(r=>({...r,kind:r.kind==='nota'?'nota':'estudo'}))
}
export async function hideRadar(id:string,hide:boolean,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('admin_hide_radar',{p_id:id,p_hide:hide}),'Não foi possível alterar.',true)}
export async function saveRadarNote(input:{specialty:RadarSpecialty|'todas',title:string,body:string,url:string},client:Client=getSupabaseClient()){
 return await call(client,()=>client.rpc('admin_save_radar_note',{p_specialty:input.specialty,p_title:input.title.trim(),p_body:input.body.trim(),p_url:input.url.trim()||null}),'Não foi possível salvar a nota.')
}
// Admin: busca agora (a função confere se é admin).
export async function refreshRadar(client:Client=getSupabaseClient()){
 await verifiedIdentity(client)
 const r=await client.functions.invoke('radar',{body:{}})
 if(r.error){let m='Não foi possível atualizar agora. Tente de novo em alguns minutos.';const ctx=(r.error as {context?:Response}).context;if(ctx?.status===404)m='A função "radar" ainda não foi publicada no Supabase.';try{const b=ctx?await ctx.json():null;if(b?.message&&String(b.message).length<200)m=b.message}catch{/* sem corpo */}throw Error(m)}
 return (r.data as {novos?:Record<string,number|string>})?.novos??{}
}

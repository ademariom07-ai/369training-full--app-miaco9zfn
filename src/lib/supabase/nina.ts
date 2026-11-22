import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity} from './profiles'

// Nina: assistente virtual do profissional (Edge Function "nina").
export const ASSISTANT_NAME='Nina'
type Client=SupabaseClient<Database>
export type NinaMessage={role:'user'|'assistant',content:string}
export type NinaResult={type:'criar'|'alterar'|'enviar',student_id:string,student_name:string,plan_id:string|null,status:string,error?:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseNinaResponse(data:unknown):{reply:string,results:NinaResult[]}{
 const d=(data&&typeof data==='object'?data:{}) as {reply?:unknown,results?:unknown}
 const reply=typeof d.reply==='string'&&d.reply.trim()?d.reply.trim().slice(0,1500):'Pronto.'
 const results=(Array.isArray(d.results)?d.results:[]).slice(0,5).flatMap((r:Record<string,unknown>)=>{
  if(!r||!['criar','alterar','enviar'].includes(String(r.type))||!uuid.test(String(r.student_id)))return []
  return [{type:r.type as NinaResult['type'],student_id:String(r.student_id),student_name:typeof r.student_name==='string'?r.student_name.slice(0,80):'Aluno',
   plan_id:typeof r.plan_id==='string'&&uuid.test(r.plan_id)?r.plan_id:null,status:typeof r.status==='string'?r.status:'erro',error:typeof r.error==='string'?r.error.slice(0,200):undefined}]
 })
 return{reply,results}
}

export async function askNina(messages:NinaMessage[],client:Client=getSupabaseClient()){
 const clean=messages.filter(m=>m.content.trim()).slice(-12).map(m=>({role:m.role,content:m.content.trim().slice(0,2000)}))
 if(!clean.length||clean[clean.length-1].role!=='user')throw Error('Escreva uma mensagem.')
 await verifiedIdentity(client)
 const result=await client.functions.invoke('nina',{body:{messages:clean}})
 if(result.error){
  let message=`A ${ASSISTANT_NAME} está indisponível agora. Tente de novo em alguns minutos.`
  const ctx=(result.error as {context?:Response}).context
  if(ctx&&ctx.status===404)message=`A ${ASSISTANT_NAME} ainda não foi publicada no Supabase (função "nina").`
  try{const body=ctx&&typeof ctx.json==='function'?await ctx.json():null;if(body&&typeof body.message==='string'&&body.message.length<300)message=body.message}catch{/* sem corpo */}
  throw Error(message)
 }
 return parseNinaResponse(result.data)
}

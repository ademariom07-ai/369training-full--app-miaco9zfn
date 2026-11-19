import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity} from './profiles'
import type {DayKey,Kind} from './routines'

// Chama a Edge Function "routine-ai" (Claude). O plano volta como rascunho no banco.
type Client=SupabaseClient<Database>
export type AiAnswers={goal:string,level:string,days:DayKey[],minutes:number,place:string,equipment:string,limitations:string,meals_per_day?:number,avoid_foods?:string,restrictions?:string,parq?:boolean[]}
export const parqQuestions=[
 'Algum médico já disse que você tem problema no coração e que só deve fazer atividade física com orientação dele?',
 'Você sente dor no peito quando faz atividade física?',
 'No último mês, você sentiu dor no peito sem estar fazendo atividade física?',
 'Você perde o equilíbrio por tontura ou já desmaiou?',
 'Você tem problema nos ossos ou articulações que pode piorar com atividade física?',
 'Você toma remédio para pressão ou para o coração?',
 'Existe outro motivo pelo qual você não deveria fazer atividade física?',
] as const
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateRoutine(kind:Kind,student:string,answers:AiAnswers,client:Client=getSupabaseClient()):Promise<string>{
 if(!uuid.test(student))throw Error('Aluno inválido.')
 if(kind==='treino'&&(!answers.days.length||answers.minutes<15||answers.minutes>120))throw Error('Escolha os dias e um tempo entre 15 e 120 minutos.')
 await verifiedIdentity(client)
 const result=await client.functions.invoke('routine-ai',{body:{kind,student_id:student,answers}})
 if(result.error){
  let message='A IA está indisponível agora. Tente de novo em alguns minutos.'
  const ctx=(result.error as {context?:Response}).context
  try{const body=ctx&&typeof ctx.json==='function'?await ctx.json():null;if(body&&typeof body.message==='string'&&body.message.length<300)message=body.message}catch{/* resposta sem corpo */}
  throw Error(message)
 }
 const id=(result.data as {plan_id?:unknown}|null)?.plan_id
 if(typeof id!=='string'||!uuid.test(id))throw Error('Não foi possível gerar o plano.')
 return id
}

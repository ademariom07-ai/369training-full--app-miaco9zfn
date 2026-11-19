import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Json} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import {youtubeVideoId} from './videoFeed'

// Treino e dieta estruturados (migração 20261120120000).
type Client=SupabaseClient<Database>
export const dayKeys=['seg','ter','qua','qui','sex','sab','dom'] as const
export type DayKey=typeof dayKeys[number]
export const dayLabels:Record<DayKey,string>={seg:'Segunda',ter:'Terça',qua:'Quarta',qui:'Quinta',sex:'Sexta',sab:'Sábado',dom:'Domingo'}
export const dayShort:Record<DayKey,string>={seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb',dom:'Dom'}
export type Exercise={name:string,sets:number|null,reps:string,rest:string,load:string,video:string|null,notes:string}
export type TrainingDay={key:DayKey,name:string,items:Exercise[]}
export type MealItem={food:string,qty:string,notes:string,subs:string}
export type Meal={name:string,time:string|null,items:MealItem[]}
export type Kind='treino'|'dieta'
export type Source='profissional'|'ia_profissional'|'ia_aluno'
export type Structure={days:TrainingDay[]}|{meals:Meal[]}
export type Routine={plan_id:string,student_id:string,student_name:string,author_id:string,author_name:string,kind:Kind,source:Source,status:'rascunho'|'revisao'|'publicado',title:string,notes:string|null,structure:Structure,updated_at:string,published_at:string|null,mine:boolean,can_review:boolean}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const known=['Plano inválido: confira os campos.','Dieta só pode ser prescrita por nutricionista.','Treino só pode ser prescrito por profissional de educação física, fisioterapia ou artes marciais.','Plano disponível só para alunos com acompanhamento ativo com você.','Limite diário de planos atingido.','O aluno pode criar só treino sugerido pela IA.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
const s=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):''

// Hoje no fuso de São Paulo (aaaa-mm-dd) e o dia da semana correspondente.
export function todayInfo(now=new Date()){const iso=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(now)
 const wd=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}).format(now)
 const map:Record<string,DayKey>={Mon:'seg',Tue:'ter',Wed:'qua',Thu:'qui',Fri:'sex',Sat:'sab',Sun:'dom'};return{iso,day:map[wd]??'seg'}}

// Limpa e valida o plano antes de enviar (mesmos limites do servidor). Links de vídeo viram o id do YouTube.
export function normalizeStructure(kind:Kind,input:Structure):Structure{
 if(kind==='treino'){const days=('days' in input?input.days:[]).map(d=>({key:d.key,name:s(d.name,60),items:d.items.filter(i=>s(i.name,80)).map(i=>{
   const video=i.video?(/^[A-Za-z0-9_-]{11}$/.test(i.video)?i.video:youtubeVideoId(i.video)):null
   if(i.video&&!video)throw Error(`O vídeo de "${i.name}" não é um link do YouTube.`)
   const sets=i.sets===null||i.sets===undefined||Number.isNaN(i.sets)?null:Math.trunc(Number(i.sets))
   if(sets!==null&&(sets<1||sets>10))throw Error(`Séries de "${i.name}" devem ficar entre 1 e 10.`)
   return{name:s(i.name,80),sets,reps:s(i.reps,20),rest:s(i.rest,20),load:s(i.load,40),video,notes:s(i.notes,300)}})}))
  if(!days.length)throw Error('Inclua pelo menos um dia de treino.')
  if(days.length>7||new Set(days.map(d=>d.key)).size!==days.length)throw Error('Cada dia da semana só pode aparecer uma vez.')
  for(const d of days){if(!d.name)throw Error(`Dê um nome ao treino de ${dayLabels[d.key]} (ex.: Treino A).`);if(!d.items.length||d.items.length>15)throw Error(`${dayLabels[d.key]}: inclua de 1 a 15 exercícios.`)}
  return{days}}
 const meals=('meals' in input?input.meals:[]).map(m=>({name:s(m.name,60),time:m.time&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(m.time)?m.time:null,items:m.items.filter(i=>s(i.food,80)).map(i=>({food:s(i.food,80),qty:s(i.qty,40),notes:s(i.notes,200),subs:s(i.subs,200)}))}))
 if(!meals.length||meals.length>8)throw Error('Inclua de 1 a 8 refeições.')
 for(const m of meals){if(!m.name)throw Error('Dê um nome a cada refeição.');if(!m.items.length||m.items.length>15)throw Error(`${m.name}: inclua de 1 a 15 alimentos.`)}
 return{meals}
}

async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}
export async function saveRoutine(input:{id:string|null,student:string,kind:Kind,source:Source,title:string,notes:string,structure:Structure},client:Client=getSupabaseClient()){
 const title=input.title.trim().replace(/\s+/g,' ')
 if(title.length<3||title.length>120)throw Error('Dê um título com 3 a 120 caracteres.')
 if(input.notes.length>2000)throw Error('Observações longas demais.')
 if(input.id!==null&&!uuid.test(input.id)||!uuid.test(input.student))throw Error('Plano inválido.')
 const structure=normalizeStructure(input.kind,input.structure)
 const id=await call(client,()=>client.rpc('save_routine',{p_id:input.id,p_student:input.student,p_kind:input.kind,p_source:input.source,p_title:title,p_notes:input.notes.trim()||null,p_structure:structure as unknown as Json}),'Não foi possível salvar o plano.')
 if(typeof id!=='string'||!uuid.test(id))throw Error('Não foi possível salvar o plano.')
 return id
}
export async function publishRoutine(id:string,client:Client=getSupabaseClient()){if(!uuid.test(id))throw Error('Plano inválido.');return await call(client,()=>client.rpc('publish_routine',{p_id:id}),'Não foi possível publicar.')}
export async function reviewRoutine(id:string,approve:boolean,client:Client=getSupabaseClient()){if(!uuid.test(id))throw Error('Plano inválido.');return await call(client,()=>client.rpc('review_routine',{p_id:id,p_approve:approve}),'Não foi possível registrar a revisão.')}
export async function archiveRoutine(id:string,client:Client=getSupabaseClient()){if(!uuid.test(id))throw Error('Plano inválido.');await call(client,()=>client.rpc('archive_routine',{p_id:id}),'Não foi possível arquivar.',true)}
export async function listRoutines(student:string|null,client:Client=getSupabaseClient()):Promise<Routine[]>{
 if(student!==null&&!uuid.test(student))throw Error('Aluno inválido.')
 const rows=await call(client,()=>client.rpc('list_routines',{p_student:student}),'Não foi possível carregar os planos.')
 if(!Array.isArray(rows)||rows.length>60)throw Error('Planos indisponíveis.')
 return rows.map(r=>{
  if(!r||!uuid.test(r.plan_id)||!['treino','dieta'].includes(r.kind)||!['rascunho','revisao','publicado'].includes(r.status)||!r.structure||typeof r.structure!=='object')throw Error('Planos indisponíveis.')
  return{...r,kind:r.kind as Kind,source:r.source as Source,status:r.status as Routine['status'],structure:r.structure as unknown as Structure}
 })
}
export async function logRoutineDay(plan:string,day:DayKey|'todos',date:string,done:boolean,client:Client=getSupabaseClient()){
 if(!uuid.test(plan)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Registro inválido.')
 await call(client,()=>client.rpc('log_routine_day',{p_plan:plan,p_day:day,p_date:date,p_done:done}),'Não foi possível registrar.',true)
}
export async function routineProgress(plan:string,client:Client=getSupabaseClient()){
 if(!uuid.test(plan))throw Error('Plano inválido.')
 const rows=await call(client,()=>client.rpc('routine_progress',{p_plan:plan}),'Não foi possível carregar o progresso.')
 return (Array.isArray(rows)?rows:[]).map(r=>({day_key:r.day_key,done_on:r.done_on}))
}

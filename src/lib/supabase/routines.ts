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
const known=['Registro inválido: confira os campos.','Limite diário de registros atingido.','Data inválida.','Dia inválido.','Plano inválido: confira os campos.','Dieta só pode ser prescrita por nutricionista.','Treino só pode ser prescrito por profissional de educação física, fisioterapia ou artes marciais.','Plano disponível só para alunos com acompanhamento ativo com você.','Limite diário de planos atingido.','O aluno pode criar só treino sugerido pela IA.']
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

// ----- Registro do treino feito pelo aluno (migração 20261122120000) -----
export type SessionEntry={name:string,done:boolean,sets:number|null,reps:string,load:string}
export type Session={session_id:string,plan_id:string,plan_title:string,student_id:string,student_name:string,day_key:DayKey,day_name:string,done_on:string,effort:number|null,pain:0|1|2,note:string|null,entries:SessionEntry[],updated_at:string}
export const painLabels=['Sem dor','Dor leve','Dor forte'] as const
export const effortLabel=(n:number)=>n<=3?'Leve':n<=6?'Moderado':n<=8?'Pesado':'Máximo'
// Os últimos 8 dias (hoje e 7 para trás), no fuso de São Paulo.
export function recentDates(now=new Date()){return Array.from({length:8},(_,i)=>todayInfo(new Date(now.getTime()-i*86400000)).iso)}
export function sessionEntriesFrom(day:TrainingDay):SessionEntry[]{return day.items.map(i=>({name:i.name,done:true,sets:i.sets,reps:i.reps,load:i.load}))}
export async function saveRoutineSession(input:{plan:string,day:DayKey,date:string,effort:number|null,pain:number,note:string,entries:SessionEntry[]},client:Client=getSupabaseClient()){
 if(!uuid.test(input.plan)||!dayKeys.includes(input.day)||!/^\d{4}-\d{2}-\d{2}$/.test(input.date))throw Error('Registro inválido.')
 if(input.effort!==null&&(!Number.isInteger(input.effort)||input.effort<1||input.effort>10))throw Error('O esforço vai de 1 a 10.')
 if(![0,1,2].includes(input.pain))throw Error('Registro inválido.')
 const note=input.note.trim();if(note.length>500)throw Error('Recado longo demais (até 500 caracteres).')
 const entries=input.entries.map(e=>{const sets=e.sets===null||Number.isNaN(e.sets)?null:Math.trunc(Number(e.sets))
  if(sets!==null&&(sets<0||sets>10))throw Error(`Séries de "${e.name}" devem ficar entre 0 e 10.`)
  return{name:s(e.name,80),done:!!e.done,sets,reps:s(e.reps,20),load:s(e.load,40)}}).filter(e=>e.name)
 if(!entries.length||entries.length>15)throw Error('Registro inválido.')
 const id=await call(client,()=>client.rpc('save_routine_session',{p_plan:input.plan,p_day:input.day,p_date:input.date,p_effort:input.effort,p_pain:input.pain,p_note:note||null,p_entries:entries as unknown as Json}),'Não foi possível salvar o registro.')
 if(typeof id!=='string'||!uuid.test(id))throw Error('Não foi possível salvar o registro.')
 return id
}
export async function deleteRoutineSession(id:string,client:Client=getSupabaseClient()){if(!uuid.test(id))throw Error('Registro inválido.');await call(client,()=>client.rpc('delete_routine_session',{p_id:id}),'Não foi possível apagar.',true)}
export async function listRoutineSessions(student:string|null,client:Client=getSupabaseClient()):Promise<Session[]>{
 if(student!==null&&!uuid.test(student))throw Error('Aluno inválido.')
 const rows=await call(client,()=>client.rpc('list_routine_sessions',{p_student:student}),'Não foi possível carregar os registros.')
 if(!Array.isArray(rows)||rows.length>120)throw Error('Registros indisponíveis.')
 return rows.filter(r=>r&&uuid.test(r.session_id)&&dayKeys.includes(r.day_key as DayKey)&&Array.isArray(r.entries)).map(r=>({...r,day_key:r.day_key as DayKey,day_name:r.day_name??'',pain:([0,1,2].includes(r.pain)?r.pain:0) as 0|1|2,
  entries:(r.entries as unknown as SessionEntry[]).filter(e=>e&&typeof e.name==='string').map(e=>({name:e.name,done:e.done===true,sets:typeof e.sets==='number'?e.sets:null,reps:typeof e.reps==='string'?e.reps:'',load:typeof e.load==='string'?e.load:''}))}))
}
// Resumo por aluno para o profissional: último treino, quantos nos últimos 7 dias, alerta de dor.
export function summarizeSessions(rows:Session[],now=new Date()){
 const week=new Set(recentDates(now).slice(0,7)),by=new Map<string,{student_id:string,student_name:string,last:Session,week:number,pain:boolean}>()
 for(const r of rows){const cur=by.get(r.student_id)??{student_id:r.student_id,student_name:r.student_name,last:r,week:0,pain:false}
  if(r.done_on>cur.last.done_on)cur.last=r
  if(week.has(r.done_on)){cur.week++;if(r.pain>0)cur.pain=true}
  by.set(r.student_id,cur)}
 return [...by.values()].sort((a,b)=>Number(b.pain)-Number(a.pain)||b.last.done_on.localeCompare(a.last.done_on))
}

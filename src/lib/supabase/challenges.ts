import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import {todayInfo} from './routines'

// Desafios e hidratação (migração 20261125120000).
type Client=SupabaseClient<Database>
export type ChallengeKind='manual'|'treino'|'hidratacao'
export const challengeKindLabels:Record<ChallengeKind,string>={manual:'Marcar cada dia',treino:'Dias com treino registrado (automático)',hidratacao:'Dias com a meta de água (automático)'}
export type Challenge={challenge_id:string,owner_name:string,mine:boolean,title:string,description:string|null,kind:ChallengeKind,goal_days:number,starts_on:string,ends_on:string,joined:boolean,progress:number,checked_today:boolean,participants:number,completed:number}
export type Hydration={goal_ml:number,remind:boolean,every_min:number,from_hour:number,to_hour:number,days:{day:string,ml:number}[]}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const known=['Desafio inválido: confira título, datas e meta de dias.','Desafios são criados por profissionais aprovados e pela equipe.','Limite diário de desafios atingido.','Desafio indisponível.','Este desafio já terminou.','Dia fora do desafio.','Registro inválido.','Configuração inválida.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}
const isDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)
// Situação de um desafio para o aluno.
export function challengeState(c:Pick<Challenge,'starts_on'|'ends_on'|'progress'|'goal_days'>,today=todayInfo().iso){
 if(c.progress>=c.goal_days)return 'concluido' as const
 if(today<c.starts_on)return 'em-breve' as const
 if(today>c.ends_on)return 'encerrado' as const
 return 'em-andamento' as const
}
export const daysLeft=(end:string,today=todayInfo().iso)=>Math.max(0,Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000))

export async function listChallenges(client:Client=getSupabaseClient()):Promise<Challenge[]>{
 const rows=await call(client,()=>client.rpc('list_challenges'),'Não foi possível carregar os desafios.')
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&uuid.test(r.challenge_id)).map(r=>({...r,kind:(['manual','treino','hidratacao'].includes(r.kind)?r.kind:'manual') as ChallengeKind}))
}
export async function saveChallenge(input:{id:string|null,title:string,description:string,kind:ChallengeKind,goalDays:number,startsOn:string,endsOn:string},client:Client=getSupabaseClient()){
 const title=input.title.trim().replace(/\s+/g,' ')
 if(title.length<3||title.length>80)throw Error('Dê um título com 3 a 80 caracteres.')
 if(!isDate(input.startsOn)||!isDate(input.endsOn)||input.endsOn<input.startsOn)throw Error('Confira as datas de início e fim.')
 if(!Number.isInteger(input.goalDays)||input.goalDays<1)throw Error('A meta precisa ser de pelo menos 1 dia.')
 return await call(client,()=>client.rpc('save_challenge',{p_id:input.id,p_title:title,p_description:input.description.trim()||null,p_kind:input.kind,p_goal_days:input.goalDays,p_starts_on:input.startsOn,p_ends_on:input.endsOn}),'Não foi possível salvar o desafio.')
}
export async function archiveChallenge(id:string,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('archive_challenge',{p_id:id}),'Não foi possível arquivar.',true)}
export async function joinChallenge(id:string,join:boolean,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('join_challenge',{p_id:id,p_join:join}),'Não foi possível alterar a participação.',true)}
export async function checkinChallenge(id:string,day:string,done:boolean,client:Client=getSupabaseClient()){return await call(client,()=>client.rpc('checkin_challenge',{p_id:id,p_day:day,p_done:done}),'Não foi possível marcar o dia.')}
export async function challengeParticipants(id:string,client:Client=getSupabaseClient()){
 const rows=await call(client,()=>client.rpc('challenge_participants_progress',{p_id:id}),'Não foi possível carregar os participantes.')
 return Array.isArray(rows)?rows:[]
}
export async function addWater(delta:number,day=todayInfo().iso,client:Client=getSupabaseClient()){
 if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>2000)throw Error('Quantidade inválida.')
 return await call(client,()=>client.rpc('add_water',{p_day:day,p_delta:delta}),'Não foi possível registrar a água.')
}
export async function hydrationSummary(client:Client=getSupabaseClient()):Promise<Hydration>{
 const rows=await call(client,()=>client.rpc('hydration_summary'),'Não foi possível carregar a hidratação.')
 const r=Array.isArray(rows)?rows[0]:null
 if(!r)return{goal_ml:2500,remind:false,every_min:60,from_hour:8,to_hour:21,days:[]}
 const days=(Array.isArray(r.days)?r.days:[]) as {day:string,ml:number}[]
 return{...r,days:days.filter(d=>d&&isDate(String(d.day))).map(d=>({day:String(d.day),ml:Number(d.ml)||0}))}
}
export async function saveHydrationSettings(s:Omit<Hydration,'days'>,client:Client=getSupabaseClient()){
 if(s.goal_ml<500||s.goal_ml>6000)throw Error('A meta vai de 500 a 6.000 ml.')
 if(s.to_hour<=s.from_hour)throw Error('O horário final precisa ser depois do inicial.')
 await call(client,()=>client.rpc('save_hydration_settings',{p_goal_ml:s.goal_ml,p_remind:s.remind,p_every_min:s.every_min,p_from_hour:s.from_hour,p_to_hour:s.to_hour}),'Não foi possível salvar.',true)
}
// Lembrete de água: hora de lembrar? (dentro do horário, abaixo da meta e depois do intervalo).
export function shouldRemind(s:Pick<Hydration,'remind'|'every_min'|'from_hour'|'to_hour'|'goal_ml'>,todayMl:number,lastAt:number|null,now=new Date()){
 if(!s.remind||todayMl>=s.goal_ml)return false
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'numeric',hourCycle:'h23'}).format(now))
 if(hour<s.from_hour||hour>=s.to_hour)return false
 return lastAt===null||now.getTime()-lastAt>=s.every_min*60000
}

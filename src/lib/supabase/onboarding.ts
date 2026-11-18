import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import {normalizeBrazilPhone} from './phone'

// Caminho inicial (focus group, fase 1): objetivo principal e celular da própria conta.
type Client=SupabaseClient<Database>
export const goals={
 emagrecer:'Emagrecer',ganhar_massa:'Ganhar massa muscular',condicionamento:'Melhorar o condicionamento',saude_bem_estar:'Saúde e bem-estar',
 dor_reabilitacao:'Aliviar dores ou me recuperar de lesão',performance:'Melhorar no meu esporte',mente_estresse:'Cuidar da mente e do estresse',alimentacao:'Comer melhor',
} as const
export type Goal=keyof typeof goals
const isGoal=(v:unknown):v is Goal=>typeof v==='string'&&Object.hasOwn(goals,v)

export async function readMyGoal(client:Client=getSupabaseClient()):Promise<Goal|null>{
 const actor=await verifiedIdentity(client),result=await client.from('account_goals').select('user_id,goal').eq('user_id',actor.id).maybeSingle()
 await assertSessionUnchanged(client,actor)
 if(result.error)throw Error('Não foi possível carregar seu objetivo.')
 if(!result.data)return null
 if(result.data.user_id!==actor.id||!isGoal(result.data.goal))throw Error('Objetivo indisponível.')
 return result.data.goal
}
export async function saveMyGoal(goal:Goal,client:Client=getSupabaseClient()):Promise<Goal>{
 if(!isGoal(goal))throw Error('Escolha um objetivo da lista.')
 const actor=await verifiedIdentity(client),result=await client.rpc('set_my_goal',{p_goal:goal}).single()
 await assertSessionUnchanged(client,actor)
 if(result.error||!result.data||result.data.user_id!==actor.id||result.data.goal!==goal)throw Error('Não foi possível salvar seu objetivo.')
 return goal
}
export async function readMyPhone(client:Client=getSupabaseClient()):Promise<string|null>{
 const actor=await verifiedIdentity(client),result=await client.from('account_contacts').select('user_id,phone').eq('user_id',actor.id).maybeSingle()
 await assertSessionUnchanged(client,actor)
 if(result.error)throw Error('Não foi possível carregar seu celular.')
 if(!result.data)return null
 if(result.data.user_id!==actor.id||!/^\+[1-9][0-9]{9,14}$/.test(result.data.phone))throw Error('Celular indisponível.')
 return result.data.phone
}
export async function saveMyPhone(raw:string,client:Client=getSupabaseClient()):Promise<string>{
 const phone=normalizeBrazilPhone(raw)
 if(!phone)throw Error('Digite um celular válido com DDD, por exemplo (11) 98765-4321.')
 const actor=await verifiedIdentity(client),result=await client.rpc('set_my_phone',{p_phone:phone}).single()
 await assertSessionUnchanged(client,actor)
 if(result.error||!result.data||result.data.phone!==phone)throw Error('Não foi possível salvar seu celular.')
 return phone
}
// Mostra +5511987654321 como (11) 98765-4321.
export function formatBrazilPhone(phone:string){
 const m=/^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(phone);return m?`(${m[1]}) ${m[2]}-${m[3]}`:phone
}

// Sugere a correção de domínios de e-mail digitados errado (gmial.com → gmail.com).
const domainFixes:Record<string,string>={'gmial.com':'gmail.com','gmai.com':'gmail.com','gmail.co':'gmail.com','gmail.con':'gmail.com','gmal.com':'gmail.com','gamil.com':'gmail.com','gnail.com':'gmail.com','gmail.com.br':'gmail.com','hotmial.com':'hotmail.com','hotmai.com':'hotmail.com','hotmail.con':'hotmail.com','hotmal.com':'hotmail.com','hotmil.com':'hotmail.com','outlok.com':'outlook.com','outloo.com':'outlook.com','outlook.con':'outlook.com','yahoo.com.b':'yahoo.com.br','yaho.com.br':'yahoo.com.br','yahoo.con.br':'yahoo.com.br','icloud.con':'icloud.com','iclod.com':'icloud.com'}
export function suggestEmail(email:string):string|null{
 const m=/^([^\s@]+)@([^\s@]+)$/.exec((email||'').trim().toLowerCase());if(!m)return null
 const fix=domainFixes[m[2]];return fix?`${m[1]}@${fix}`:null
}

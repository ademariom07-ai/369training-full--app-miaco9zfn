import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readOwnProfile, createOwnProfile, renameOwnProfile, type OwnProfile } from './profiles'
export type AccountState = { phase:'checking'|'signed_out'|'profile_missing'|'ready'|'error'; profile:OwnProfile|null; busy:boolean; error:string }
type Client=SupabaseClient<Database>
export function createAccountSession(client:Client, changed:(state:AccountState)=>void, schedule:(task:()=>void)=>()=>void=task=>{const id=setTimeout(task,0);return()=>clearTimeout(id)}) {
 let disposed=false,busy=false,epoch=0,cancelScheduled=()=>{},unsubscribe=()=>{}
 let state:AccountState={phase:'checking',profile:null,busy:false,error:''}
 function publish(next:Omit<AccountState,'busy'>){state={...next,busy};if(!disposed)changed({...state})}
 function cleared(phase:AccountState['phase'],error=''){publish({phase,profile:null,error})}
 async function refresh(){
  const generation=++epoch;cleared('checking')
  try{
   const session=await client.auth.getSession()
   if(disposed||generation!==epoch)return
   if(session.error)throw Error('Sessão indisponível.')
   if(!session.data.session){cleared('signed_out');return}
   const profile=await readOwnProfile(client)
   if(disposed||generation!==epoch)return
   if(profile&&!['aluno','profissional','admin'].includes(profile.role))throw Error('Perfil indisponível.')
   publish({phase:profile?'ready':'profile_missing',profile,error:''})
  }catch{if(!disposed&&generation===epoch)cleared('error','Não foi possível verificar sua conta. Tente atualizar ou sair.')}
 }
 function start(){
  const result=client.auth.onAuthStateChange((_event,session)=>{
   if(disposed)return
   ++epoch;cancelScheduled();cleared(session?'checking':'signed_out')
   // Synchronous callback only: SDK calls run after its auth lock is released.
   if(session)cancelScheduled=schedule(()=>{void refresh()})
  });unsubscribe=()=>result.data.subscription.unsubscribe();void refresh()
 }
 async function operation(task:()=>Promise<void>){
  if(disposed||busy)throw Error('Aguarde a operação atual.')
  busy=true;++epoch;cancelScheduled();cleared('checking')
  try{await task();if(!disposed)await refresh()}
  catch{if(!disposed)cleared('error','Não foi possível concluir a operação. Verifique seus dados e tente novamente.');throw Error('Não foi possível concluir a operação.')}
  finally{busy=false;if(!disposed)changed({...state,busy:false})}
 }
 async function login(email:string,password:string){
  if(typeof email!=='string'||!email.trim()||email.trim().length>254||typeof password!=='string'||!password||password.length>1024)throw Error('Preencha e-mail e senha válidos.')
  return operation(async()=>{const result=await client.auth.signInWithPassword({email:email.trim(),password});if(result.error||!result.data.session)throw Error('Login indisponível.')})
 }
 async function logout(){return operation(async()=>{const result=await client.auth.signOut({scope:'local'});if(result.error)throw Error('Saída indisponível.')})}
 return {start,refresh,login,logout,createProfile:(name:string)=>operation(async()=>{await createOwnProfile(name,client)}),renameProfile:(name:string)=>operation(async()=>{await renameOwnProfile(name,client)}),dispose:()=>{disposed=true;++epoch;cancelScheduled();unsubscribe()}}
}

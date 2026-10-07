import {createRankingDraft,validateDraft,type DraftInput} from './rankingDrafts'
import {ensureOwnWallet,reserveWallet,cancelWallet} from './wallet'
import {completeTrainingPlan} from './trainingCompletions'
import {createTrainingPlan,markTrainingRead,type TrainingInput} from './trainingPlans'
import {submitApplication,reviewApplication,type Specialty,type Application} from './applications'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { requestStudentLink, acceptStudentLink, revokeStudentLink, type StudentLink } from './links'
import { readOwnProfile, createOwnProfile, renameOwnProfile, type OwnProfile, verifiedIdentity, assertSessionUnchanged } from './profiles'
export type AccountState = { phase:'checking'|'signed_out'|'profile_missing'|'ready'|'error'|'password_recovery'; profile:OwnProfile|null; busy:boolean; error:string }
type Client=SupabaseClient<Database>
export function createAccountSession(client:Client, changed:(state:AccountState)=>void, schedule:(task:()=>void)=>()=>void=task=>{const id=setTimeout(task,0);return()=>clearTimeout(id)},redirectTo?:string) {
 let recovery=false,recoveryAccountId:string|null=null,lastMailAttempt=-Infinity
 let draftRetry:{owner:string;body:DraftInput;requestId:string}|null=null
 let walletRetry:{owner:string;amount:number;requestId:string}|null=null
 let trainingRetry:(TrainingInput&{professionalId:string})|null=null
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
   if(!session.data.session){recovery=false;cleared('signed_out');return}
   if(recovery){cleared('password_recovery');return}
   const profile=await readOwnProfile(client)
   if(disposed||generation!==epoch)return
   if(profile&&!['aluno','profissional','admin'].includes(profile.role))throw Error('Perfil indisponível.')
   publish({phase:profile?'ready':'profile_missing',profile,error:''})
  }catch{if(!disposed&&generation===epoch)cleared('error','Não foi possível verificar sua conta. Tente atualizar ou sair.')}
 }
 function start(){
  const result=client.auth.onAuthStateChange((event,session)=>{
   if(disposed)return
   if(event==='PASSWORD_RECOVERY'&&session?.user?.id){recovery=true;recoveryAccountId=session.user.id}
   if(draftRetry&&(!session||session.user?.id!==draftRetry.owner))draftRetry=null
   if(walletRetry&&(!session||session.user?.id!==walletRetry.owner))walletRetry=null
   if(trainingRetry&&(!session||session.user?.id!==trainingRetry.professionalId))trainingRetry=null
   if(!session||recovery&&session.user?.id!==recoveryAccountId){recovery=false;recoveryAccountId=null}
   ++epoch;cancelScheduled();cleared(session?(recovery?'password_recovery':'checking'):'signed_out')
   // Synchronous callback only: SDK calls run after its auth lock is released.
   if(session&&!recovery)cancelScheduled=schedule(()=>{void refresh()})
  });unsubscribe=()=>result.data.subscription.unsubscribe();void refresh()
 }
 async function operation(task:()=>Promise<void>){
  if(disposed||busy)throw Error('Aguarde a operação atual.')
  busy=true;++epoch;cancelScheduled();cleared('checking')
  try{await task();if(!disposed)await refresh()}
  catch{if(!disposed)cleared(recovery?'password_recovery':'error','Não foi possível concluir a operação. Verifique seus dados e tente novamente.');throw Error('Não foi possível concluir a operação.')}
  finally{busy=false;if(!disposed)changed({...state,busy:false})}
 }
 async function login(email:string,password:string){
  if(typeof email!=='string'||!email.trim()||email.trim().length>254||typeof password!=='string'||!password||password.length>1024)throw Error('Preencha e-mail e senha válidos.')
  return operation(async()=>{const result=await client.auth.signInWithPassword({email:email.trim(),password});if(result.error||!result.data.session)throw Error('Login indisponível.')})
 }
 function mailEmail(value:string){if(typeof value!=='string'||!value.trim()||value.trim().length>254||!/^\S+@\S+\.\S+$/.test(value.trim()))throw Error('Preencha um e-mail válido.');return value.trim()}
 function newPassword(value:string){if(typeof value!=='string'||value.length<10||value.length>72||new TextEncoder().encode(value).length>72)throw Error('Escolha uma senha válida com pelo menos 10 caracteres.')}
 function callbackUrl(){
  if(!redirectTo)throw Error('Acesso indisponível.')
  const url=new URL(redirectTo)
  if((url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))||url.username||url.password||url.pathname!=='/conta-supabase'||url.search||url.hash)throw Error('Retorno indisponível.')
  return url.href
 }
 async function mailOperation(task:(url:string)=>Promise<void>){
  const url=callbackUrl()
  if(!['signed_out','error'].includes(state.phase)||recovery||Date.now()-lastMailAttempt<60000)throw Error('Aguarde antes de tentar novamente.')
  return operation(async()=>{
   const current=await client.auth.getSession()
   if(current.error||current.data.session)throw Error('Saia da conta antes de continuar.')
   lastMailAttempt=Date.now();await task(url)
  })
 }
 async function signup(email:string,password:string){
  const address=mailEmail(email);newPassword(password)
  return mailOperation(async url=>{const result=await client.auth.signUp({email:address,password,options:{emailRedirectTo:url}});if(result.error)throw Error('Cadastro indisponível.')})
 }
 async function recover(email:string){
  const address=mailEmail(email)
  return mailOperation(async url=>{const result=await client.auth.resetPasswordForEmail(address,{redirectTo:url});if(result.error)throw Error('Recuperação indisponível.')})
 }
 async function updateRecoveredPassword(password:string){
  newPassword(password)
  if(!recovery||state.phase!=='password_recovery')throw Error('Abra o link de recuperação válido.')
  return operation(async()=>{
   const actor=await verifiedIdentity(client)
   if(actor.id!==recoveryAccountId)throw Error('Sessão alterada.')
   await assertSessionUnchanged(client,actor)
   const result=await client.auth.updateUser({password})
   await assertSessionUnchanged(client,actor)
   if(result.error||result.data.user?.id!==actor.id)throw Error('Senha indisponível.')
   recovery=false
   const exit=await client.auth.signOut({scope:'local'});if(exit.error)throw Error('Saída indisponível.')
  })
 }
 async function logout(){return operation(async()=>{const result=await client.auth.signOut({scope:'local'});if(result.error)throw Error('Saída indisponível.')})}
 function linkAction(row:StudentLink,action:'accept'|'revoke'){
  const profile=state.profile
  if(state.phase!=='ready'||!profile||busy||disposed)throw Error('Atualize sua conta antes de continuar.')
  const participant=profile.role==='aluno'&&row.student_id===profile.id||profile.role==='profissional'&&row.professional_id===profile.id
  if(!participant||row.state==='revoked'||action==='accept'&&(profile.role!=='profissional'||!profile.approved||row.state!=='pending'))throw Error('Ação indisponível.')
  // Copy before awaiting: a stale UI object cannot change the RPC target/version.
  const studentId=row.student_id,version=row.version
  return operation(async()=>{if(action==='accept')await acceptStudentLink(studentId,version,client);else await revokeStudentLink(studentId,version,client)})
 }
 function requestLink(professionalId:string){
  if(state.phase!=='ready'||state.profile?.role!=='aluno'||busy||disposed)throw Error('Pedido indisponível.')
  const studentId=state.profile.id
  return operation(async()=>{await requestStudentLink(professionalId,client,studentId)})
 }
 function applyProfessional(specialty:Specialty,credential:string){
  const profile=state.profile
  if(state.phase!=='ready'||!profile||busy||disposed||!(profile.role==='aluno'||profile.role==='profissional'&&!profile.approved))throw Error('Solicitação indisponível.')
  const id=profile.id
  return operation(async()=>{await submitApplication(specialty,credential,id,client)})
 }
 function reviewProfessional(row:Application,decision:'approved'|'rejected',reason:string){
  if(state.phase!=='ready'||state.profile?.role!=='admin'||busy||disposed)throw Error('Análise indisponível.')
  const admin=state.profile.id,snapshot={...row}
  return operation(async()=>{await reviewApplication(snapshot,decision,reason,admin,client)})
 }
 function publishTraining(link:StudentLink,title:string,content:string){
  const profile=state.profile
  if(state.phase!=='ready'||profile?.role!=='profissional'||!profile.approved||link.professional_id!==profile.id||link.state!=='active'||busy||disposed)throw Error('Publicação indisponível.')
  if(typeof title!=='string'||typeof content!=='string')throw Error('Dados inválidos.')
  const body={professionalId:profile.id,studentId:link.student_id,linkVersion:link.version,title:title.trim(),content:content.trim()}
  if(!trainingRetry||trainingRetry.professionalId!==body.professionalId||trainingRetry.studentId!==body.studentId||trainingRetry.linkVersion!==body.linkVersion||trainingRetry.title!==body.title||trainingRetry.content!==body.content)trainingRetry={...body,requestId:crypto.randomUUID()}
  const input={...trainingRetry}
  return operation(async()=>{await createTrainingPlan(input,input.professionalId,client);trainingRetry=null})
 }
 function readTraining(planId:string){
  if(state.phase!=='ready'||state.profile?.role!=='aluno'||busy||disposed)throw Error('Aviso indisponível.')
  const id=state.profile.id
  return operation(async()=>{await markTrainingRead(planId,id,client)})
 }
 function completeTraining(planId:string){
  if(state.phase!=='ready'||state.profile?.role!=='aluno'||busy||disposed)throw Error('Registro indisponível.')
  const id=state.profile.id
  return operation(async()=>{await completeTrainingPlan(planId,id,client)})
 }
 function saveRankingDraft(input:DraftInput){
  if(state.phase!=='ready'||state.profile?.role!=='admin'||busy||disposed)throw Error('Acesso administrativo necessário.')
  const owner=state.profile.id,body=validateDraft(input)
  if(!draftRetry||draftRetry.owner!==owner||JSON.stringify(draftRetry.body)!==JSON.stringify(body))draftRetry={owner,body,requestId:crypto.randomUUID()}
  const request={...draftRetry,body:{...draftRetry.body}}
  return operation(async()=>{await createRankingDraft(request.body,request.requestId,request.owner,client);draftRetry=null})
 }
 function walletOwner(){if(state.phase!=='ready'||!state.profile||busy||disposed)throw Error('Carteira indisponível.');return state.profile.id}
 function initializeWallet(){const owner=walletOwner();return operation(async()=>{await ensureOwnWallet(owner,client)})}
 function reserveWithdrawal(amount:number){
  const owner=walletOwner()
  if(!Number.isSafeInteger(amount)||amount<1)throw Error('Valor inválido.')
  if(!walletRetry||walletRetry.owner!==owner||walletRetry.amount!==amount)walletRetry={owner,amount,requestId:crypto.randomUUID()}
  const request={...walletRetry}
  return operation(async()=>{await reserveWallet(request.requestId,request.amount,request.owner,client);walletRetry=null})
 }
 function cancelWithdrawal(row:{id:string;user_id:string}){const owner=walletOwner();if(row.user_id!==owner)throw Error('Reserva indisponível.');const id=row.id;return operation(async()=>{await cancelWallet(id,owner,client)})}
 return {start,refresh,login,logout,saveRankingDraft,initializeWallet,reserveWithdrawal,cancelWithdrawal,publishTraining,readTraining,completeTraining,applyProfessional,reviewProfessional,signup,recover,updateRecoveredPassword,requestLink,acceptLink:(row:StudentLink)=>linkAction(row,'accept'),revokeLink:(row:StudentLink)=>linkAction(row,'revoke'),createProfile:(name:string)=>operation(async()=>{await createOwnProfile(name,client)}),renameProfile:(name:string)=>operation(async()=>{await renameOwnProfile(name,client)}),dispose:()=>{draftRetry=null;walletRetry=null;trainingRetry=null;disposed=true;++epoch;cancelScheduled();unsubscribe()}}
}

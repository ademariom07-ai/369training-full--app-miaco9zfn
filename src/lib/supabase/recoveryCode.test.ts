import {it,expect} from 'vitest'
import type {SupabaseClient,Session} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {createAccountSession,type AccountState} from './accountSession'

// Recuperação por código de 6 dígitos: não depende do link do e-mail nem do endereço de retorno.
function mock(fail=false){
 let session:Session|null=null,listener:((e:string,s:Session|null)=>void)|undefined
 const calls:{name:string,args?:unknown}[]=[],states:AccountState[]=[]
 const client={auth:{
  getSession:async()=>({error:null,data:{session}}),
  getUser:async()=>({error:null,data:{user:session?.user??null}}),
  onAuthStateChange:(cb:(e:string,s:Session|null)=>void)=>{listener=cb;return{data:{subscription:{unsubscribe(){}}}}},
  verifyOtp:async(args:unknown)=>{calls.push({name:'verify',args});if(fail)return{error:Error('Token has expired'),data:{session:null,user:null}};session={access_token:'t',user:{id:'u1',is_anonymous:false}} as unknown as Session;listener?.('SIGNED_IN',session);return{error:null,data:{session,user:session.user}}},
  updateUser:async(args:unknown)=>{calls.push({name:'update',args});return{error:null,data:{user:{id:'u1'}}}},
  signOut:async(args:unknown)=>{calls.push({name:'logout',args});session=null;listener?.('SIGNED_OUT',null);return{error:null}},
 }} as unknown as SupabaseClient<Database>
 const controller=createAccountSession(client,s=>states.push(s),task=>{task();return()=>{}},'https://example.invalid/acesso.html')
 return{controller,calls,last:()=>states[states.length-1]}
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}

it('código malformado não chega ao Auth',async()=>{const m=mock();m.controller.start();await settle()
 for(const code of ['','12345','abcdef','12 34 5x'])await expect(m.controller.verifyRecoveryCode('user@example.invalid',code)).rejects.toThrow('código de 6 dígitos')
 expect(m.calls).toHaveLength(0)})
it('código válido abre o formulário de nova senha e a troca encerra a sessão',async()=>{const m=mock();m.controller.start();await settle()
 await m.controller.verifyRecoveryCode(' user@example.invalid ','123 456');await settle()
 expect(m.calls).toEqual([{name:'verify',args:{email:'user@example.invalid',token:'123456',type:'recovery'}}])
 expect(m.last().phase).toBe('password_recovery');expect(m.last().profile).toBeNull()
 await m.controller.updateRecoveredPassword('long-test-password')
 expect(m.calls.map(c=>c.name)).toEqual(['verify','update','logout']);expect(m.last().phase).toBe('signed_out')})
it('código expirado mostra mensagem clara e não abre sessão',async()=>{const m=mock(true);m.controller.start();await settle()
 await expect(m.controller.verifyRecoveryCode('user@example.invalid','123456')).rejects.toThrow('Código inválido ou expirado')
 expect(m.last().phase).toBe('signed_out');expect(m.calls.map(c=>c.name)).toEqual(['verify'])})

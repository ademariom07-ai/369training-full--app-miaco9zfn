import {it,expect} from 'vitest'
import type {SupabaseClient,Session} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {createAccountSession} from './accountSession'

function mock(signedIn=false,fail=false){
 const calls:unknown[]=[]
 const session=signedIn?{access_token:'t',user:{id:'u1',is_anonymous:false}} as unknown as Session:null
 const client={auth:{
  getSession:async()=>({error:null,data:{session}}),
  getUser:async()=>({error:null,data:{user:session?.user??null}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signInWithOAuth:async(args:unknown)=>{calls.push(args);return{error:fail?Error('provider disabled'):null,data:{}}},
 },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:null,data:null})})})})} as unknown as SupabaseClient<Database>
 const controller=createAccountSession(client,()=>{},task=>{task();return()=>{}},'https://example.invalid/acesso.html')
 return{controller,calls}
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}

it('Google usa só o provedor google e o endereço fixo de retorno',async()=>{const m=mock();m.controller.start();await settle()
 await m.controller.loginWithGoogle()
 expect(m.calls).toEqual([{provider:'google',options:{redirectTo:'https://example.invalid/acesso.html',queryParams:{prompt:'select_account'}}}])})
it('com sessão aberta não inicia outro login',async()=>{const m=mock(true);m.controller.start();await settle()
 await expect(m.controller.loginWithGoogle()).rejects.toThrow();expect(m.calls).toHaveLength(0)})
it('provedor desligado mostra mensagem clara',async()=>{const m=mock(false,true);m.controller.start();await settle()
 await expect(m.controller.loginWithGoogle()).rejects.toThrow('Entrar com Google está indisponível')})

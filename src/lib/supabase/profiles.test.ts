import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readOwnProfile, createOwnProfile, renameOwnProfile } from './profiles'
function mock() {
  const state = { token: 't1', id: 'u1', anonymous: false, verified: true, signedIn: true }
  const calls: { kind: string; args: unknown[] }[] = []
  let returnedId = 'u1', failure = false, onResult = () => {}
  const builder = {
    select(...args: unknown[]) { calls.push({kind:'select',args}); return this },
    eq(...args: unknown[]) { calls.push({kind:'eq',args}); return this },
    insert(...args: unknown[]) { calls.push({kind:'insert',args}); return this },
    update(...args: unknown[]) { calls.push({kind:'update',args}); return this },
    async single() { return this.maybeSingle() },
    async maybeSingle() { onResult(); return {error:failure?{message:'Denied'}:null,data:{id:returnedId,display_name:'Name',role:'aluno',approved:false,created_at:'2026-10-05'}} },
  }
  const client = { auth: {
    getSession: async()=>({error:null,data:{session:state.signedIn?{access_token:state.token,user:{id:state.id}}:null}}),
    getUser: async()=>({error:state.verified?null:{message:'Invalid'},data:{user:{id:state.id,is_anonymous:state.anonymous,user_metadata:{role:'admin'}}}}),
  },from:(...args: unknown[])=>{calls.push({kind:'from',args});return builder} } as unknown as SupabaseClient<Database>
  return {state,calls,client,setReturnedId:(id:string)=>returnedId=id,setFailure:()=>failure=true,onResult:(fn:()=>void)=>onResult=fn}
}
describe('Supabase own profile adapter',()=>{
 it('denies missing unverified or anonymous session before table query',async()=>{for(const key of ['signedIn','verified','anonymous'] as const){const m=mock();m.state[key]=key==='anonymous';await expect(readOwnProfile(m.client)).rejects.toThrow();expect(m.calls).toEqual([])}})
 it('reads own id with explicit projection and ignores metadata role',async()=>{const m=mock();const r=await readOwnProfile(m.client);expect(r?.role).toBe('aluno');expect(m.calls).toContainEqual({kind:'eq',args:['id','u1']});expect(m.calls).toContainEqual({kind:'select',args:['id,display_name,role,approved,created_at']})})
 it('creation sends only verified id and bounded display name',async()=>{const m=mock();await createOwnProfile(' Name ',m.client);expect(m.calls).toContainEqual({kind:'insert',args:[{id:'u1',display_name:'Name'}]})})
 it('rename sends only name and binds current account',async()=>{const m=mock();await renameOwnProfile('New',m.client);expect(m.calls).toContainEqual({kind:'update',args:[{display_name:'New'}]});expect(m.calls).toContainEqual({kind:'eq',args:['id','u1']})})
 it('rejects excessive names before auth or data lookup',async()=>{const m=mock();await expect(createOwnProfile('x'.repeat(161),m.client)).rejects.toThrow();await expect(renameOwnProfile('x'.repeat(161),m.client)).rejects.toThrow();expect(m.calls).toEqual([])})
 it('rejects result for a different account',async()=>{const m=mock();m.setReturnedId('u2');await expect(readOwnProfile(m.client)).rejects.toThrow('Perfil indisponível')})
 it('does not return a response after token changes',async()=>{const m=mock();m.onResult(()=>{m.state.token='t2'});await expect(readOwnProfile(m.client)).rejects.toThrow('Sessão alterada')})
 it('reports server denial without optimistic confirmation',async()=>{const m=mock();m.setFailure();await expect(renameOwnProfile('New',m.client)).rejects.toThrow('Não foi possível atualizar')})
})

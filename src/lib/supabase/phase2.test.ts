import {describe,it,expect} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {saveMyShowcase,searchProfessionals,type Showcase} from './showcase'
import {openChat,sendChat,readChat} from './chat'
import {roleMenu} from '@/components/RoleHome'

const id='11111111-1111-4111-8111-111111111111'
function mock(data:unknown){const calls:unknown[][]=[]
 const client={auth:{getSession:async()=>({error:null,data:{session:{access_token:'t',user:{id}}}}),getUser:async()=>({error:null,data:{user:{id,is_anonymous:false}}})},
  rpc:(...args:unknown[])=>{calls.push(args);const r={error:null,data};return Object.assign(Promise.resolve(r),{single:async()=>r})}} as unknown as SupabaseClient<Database>
 return{client,calls}}

describe('fase 2: vitrine, busca e chat',()=>{
 it('vitrine exige apresentação, modalidade e forma de atendimento antes do servidor',async()=>{const m=mock(null)
  const base:Showcase={headline:'Personal trainer',bio:'',education:'',experience:'',modalities:['educacao_fisica'],modes:['online']}
  await expect(saveMyShowcase({...base,headline:'x'},m.client)).rejects.toThrow('apresentação')
  await expect(saveMyShowcase({...base,modalities:[]},m.client)).rejects.toThrow('modalidades')
  await expect(saveMyShowcase({...base,modes:[]},m.client)).rejects.toThrow('presencial')
  expect(m.calls).toHaveLength(0)})
 it('busca envia filtros válidos e coordenada arredondada',async()=>{const m=mock([])
  await searchProfessionals({modality:'yoga',mode:'presencial',coords:{lat:-23.5678,lng:-46.6912}},1,m.client)
  expect(m.calls).toEqual([['search_professionals',{p_modality:'yoga',p_mode:'presencial',p_lat:-23.57,p_lng:-46.69,p_page:1}]])
  await expect(searchProfessionals({modality:'astrologia' as never,mode:null,coords:null},1,m.client)).rejects.toThrow()})
 it('chat valida conversa e mensagem antes do servidor',async()=>{const m=mock(null)
  await expect(openChat('nao-e-id',m.client)).rejects.toThrow();await expect(sendChat(id,'   ',m.client)).rejects.toThrow('Escreva');await expect(sendChat(id,'x'.repeat(2001),m.client)).rejects.toThrow()
  await expect(readChat('x',0,m.client)).rejects.toThrow();expect(m.calls).toHaveLength(0)})
 it('mensagens existe para todos; vitrine só para parceiro aprovado',()=>{
  for(const p of [{role:'aluno',approved:false},{role:'profissional',approved:true},{role:'profissional',approved:false},{role:'admin',approved:false}] as const)expect(roleMenu(p).map(i=>i.id)).toContain('mensagens')
  expect(roleMenu({role:'profissional',approved:true}).map(i=>i.id)).toContain('vitrine')
  for(const p of [{role:'aluno',approved:false},{role:'profissional',approved:false},{role:'admin',approved:false}] as const)expect(roleMenu(p).map(i=>i.id)).not.toContain('vitrine')})
})

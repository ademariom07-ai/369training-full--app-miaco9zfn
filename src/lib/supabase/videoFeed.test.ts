import {describe,it,expect} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {readVideoFeed,saveMyLocation,submitVideo,reviewVideo,youtubeVideoId} from './videoFeed'

const id='11111111-1111-4111-8111-111111111111',vid='33333333-3333-4333-8333-333333333333',pro='22222222-2222-4222-8222-222222222222'
function mock(data:unknown,error:unknown=null){
 const calls:unknown[][]=[]
 const reply=()=>({error,data})
 const client={auth:{getSession:async()=>({error:null,data:{session:{access_token:'t',user:{id}}}}),getUser:async()=>({error:null,data:{user:{id,is_anonymous:false}}})},
  rpc:(...args:unknown[])=>{calls.push(args);const r=Promise.resolve(reply());return Object.assign(r,{single:async()=>reply()})}} as unknown as SupabaseClient<Database>
 return{client,calls}
}
const row={video_id:vid,youtube_id:'dQw4w9WgXcQ',title:'Mobilidade',description:null,professional_id:pro,professional_name:'Ana',specialty:'educacao_fisica',uf:'SP',city:'São Paulo',neighborhood:'Pinheiros',proximity:'bairro',distance_km:null,published_at:'2026-11-16T10:00:00Z'}

describe('links do YouTube',()=>{
 it('aceita os formatos comuns e recusa outros endereços',()=>{
  for(const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ?si=x','https://youtube.com/shorts/dQw4w9WgXcQ','https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ','youtu.be/dQw4w9WgXcQ','www.youtube.com/watch?v=dQw4w9WgXcQ','http://YouTube.com/live/dQw4w9WgXcQ',' https://music.youtube.com/watch?v=dQw4w9WgXcQ '])expect(youtubeVideoId(url)).toBe('dQw4w9WgXcQ')
  for(const url of ['ftp://youtu.be/dQw4w9WgXcQ','https://evil.com/youtu.be/dQw4w9WgXcQ','https://evil.com/watch?v=dQw4w9WgXcQ','https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ','https://www.youtube.com/playlist?list=PL1','javascript:alert(1)'])expect(youtubeVideoId(url)).toBeNull()
 })
})
describe('feed do aluno',()=>{
 it('envia coordenadas arredondadas (cerca de 1 km) e copia só os campos esperados',async()=>{
  const m=mock([{...row,email:'x@example.invalid'}])
  const items=await readVideoFeed({lat:-23.56789,lng:-46.69123},1,m.client)
  expect(m.calls).toEqual([['student_video_feed',{p_lat:-23.57,p_lng:-46.69,p_page:1}]])
  expect(items).toHaveLength(1);expect(items[0]).not.toHaveProperty('email')
 })
 it('coordenada fora do Brasil ou página inválida não chega ao servidor',async()=>{
  const m=mock([]);await expect(readVideoFeed({lat:40,lng:-74},1,m.client)).rejects.toThrow();await expect(readVideoFeed(null,0,m.client)).rejects.toThrow();expect(m.calls).toHaveLength(0)
 })
 it('resposta malformada é recusada',async()=>{
  for(const bad of [{...row,youtube_id:'<script>'},{...row,proximity:'perto'},{...row,distance_km:-1},Array(13).fill(row)]){
   const m=mock(Array.isArray(bad)?bad:[bad]);await expect(readVideoFeed(null,1,m.client)).rejects.toThrow()
  }
 })
})
describe('região e envio',()=>{
 it('região valida estado e cidade antes do envio',async()=>{
  const m=mock(null);await expect(saveMyLocation({uf:'XX',city:'Lugar',neighborhood:'',coords:null},m.client)).rejects.toThrow('estado');await expect(saveMyLocation({uf:'SP',city:' ',neighborhood:'',coords:null},m.client)).rejects.toThrow('cidade');expect(m.calls).toHaveLength(0)
 })
 it('link que não é do YouTube não é enviado',async()=>{
  const m=mock(null);await expect(submitVideo({url:'https://vimeo.com/1',title:'Treino',description:''},m.client)).rejects.toThrow('YouTube');expect(m.calls).toHaveLength(0)
 })
 it('envia o link no formato padrão e aceita vídeo já publicado (equipe)',async()=>{
  const m=mock({id:vid,professional_id:id,youtube_id:'dQw4w9WgXcQ',title:'Boas-vindas',description:null,status:'approved',review_reason:'Publicado pela equipe.',reviewed_by:id,reviewed_at:'2026-11-17T10:00:00Z',approved_at:'2026-11-17T10:00:00Z',created_at:'2026-11-17T10:00:00Z'})
  const sent=await submitVideo({url:'youtu.be/dQw4w9WgXcQ?si=abc',title:' Boas-vindas ',description:''},m.client)
  expect(m.calls).toEqual([['submit_feed_video',{p_url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',p_title:'Boas-vindas',p_description:null}]]);expect(sent.status).toBe('approved')
 })
 it('análise do admin exige motivo',async()=>{
  const m=mock(null);await expect(reviewVideo(vid,'rejected','  ',m.client)).rejects.toThrow('motivo');expect(m.calls).toHaveLength(0)
 })
})

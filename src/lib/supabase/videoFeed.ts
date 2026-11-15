import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Feed de vídeos dos profissionais (migração 20261116120000). O servidor decide quem envia,
// quem aprova e o que o aluno vê; aqui só se valida a entrada e a forma da resposta.
type Client=SupabaseClient<Database>
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const youtubePattern=/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/
export const ufs=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const

// Mesmo critério de wellness_private.youtube_video_id.
export function youtubeVideoId(url:string):string|null{
 if(typeof url!=='string'||url.length>300)return null
 return youtubePattern.exec(url.trim())?.[1]??null
}
export const youtubeThumbnail=(id:string)=>`https://i.ytimg.com/vi/${id}/hqdefault.jpg`
export const youtubeEmbed=(id:string)=>`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`

export type Coordinates={lat:number,lng:number}
export type MyLocation={uf:string,city:string,neighborhood:string|null,lat:number|null,lng:number|null}
export type FeedItem={video_id:string,youtube_id:string,title:string,description:string|null,professional_id:string,professional_name:string,specialty:string|null,uf:string|null,city:string|null,neighborhood:string|null,proximity:'bairro'|'cidade'|'estado'|'outras',distance_km:number|null,published_at:string}
export type MyVideo={id:string,youtube_id:string,title:string,description:string|null,status:'pending'|'approved'|'rejected'|'removed',review_reason:string|null,created_at:string}
export type ReviewItem={video_id:string,youtube_id:string,title:string,description:string|null,status:'pending'|'approved',professional_id:string,professional_name:string,review_reason:string|null,created_at:string}

const fail=(message:string):never=>{throw Error(message)}
const isId=(v:unknown):v is string=>typeof v==='string'&&uuidPattern.test(v)
const isYoutube=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{11}$/.test(v)
const isText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max
const optText=(v:unknown,max:number)=>v===null||isText(v,max)
const isDate=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
const inBrazil=(c:Coordinates)=>Number.isFinite(c.lat)&&Number.isFinite(c.lng)&&c.lat>=-34&&c.lat<=6&&c.lng>=-74&&c.lng<=-28
export const roundCoordinates=(c:Coordinates):Coordinates=>({lat:Math.round(c.lat*100)/100,lng:Math.round(c.lng*100)/100})
const clean=(v:string)=>v.trim().replace(/\s+/g,' ')

async function run<T>(client:Client,task:(actor:{id:string})=>Promise<T>){const actor=await verifiedIdentity(client),result=await task(actor);await assertSessionUnchanged(client,actor);return{actor,result}}

export async function readMyLocation(client:Client=getSupabaseClient()):Promise<MyLocation|null>{
 const {actor,result}=await run(client,async()=>await client.from('account_locations').select('user_id,uf,city,neighborhood,lat,lng').maybeSingle())
 if(result.error)fail('Não foi possível carregar sua região.')
 const row=result.data;if(!row)return null
 if(row.user_id!==actor.id||!ufs.includes(row.uf as typeof ufs[number])||!isText(row.city,80)||!optText(row.neighborhood,80))fail('Região indisponível.')
 return{uf:row.uf,city:row.city,neighborhood:row.neighborhood,lat:row.lat===null?null:Number(row.lat),lng:row.lng===null?null:Number(row.lng)}
}

export async function saveMyLocation(input:{uf:string,city:string,neighborhood:string,coords:Coordinates|null},client:Client=getSupabaseClient()):Promise<MyLocation>{
 const uf=input.uf?.trim().toUpperCase(),city=clean(input.city??''),neighborhood=clean(input.neighborhood??'')
 if(!ufs.includes(uf as typeof ufs[number]))fail('Escolha o estado.')
 if(city.length<2||city.length>80)fail('Informe a cidade.')
 if(neighborhood&&(neighborhood.length<2||neighborhood.length>80))fail('Bairro inválido.')
 if(input.coords&&!inBrazil(input.coords))fail('Localização fora do Brasil.')
 const coords=input.coords?roundCoordinates(input.coords):null
 const {actor,result}=await run(client,async()=>await client.rpc('set_my_location',{p_uf:uf,p_city:city,p_neighborhood:neighborhood||null,p_lat:coords?.lat??null,p_lng:coords?.lng??null}).single())
 if(result.error||!result.data||result.data.user_id!==actor.id)fail('Não foi possível salvar sua região.')
 const row=result.data!
 return{uf:row.uf,city:row.city,neighborhood:row.neighborhood,lat:row.lat===null?null:Number(row.lat),lng:row.lng===null?null:Number(row.lng)}
}

export async function readVideoFeed(coords:Coordinates|null,page=1,client:Client=getSupabaseClient()):Promise<FeedItem[]>{
 if(!Number.isSafeInteger(page)||page<1||page>500)fail('Página inválida.')
 if(coords&&!inBrazil(coords))fail('Localização fora do Brasil.')
 const sent=coords?roundCoordinates(coords):null
 const {result}=await run(client,async()=>await client.rpc('student_video_feed',{p_lat:sent?.lat??null,p_lng:sent?.lng??null,p_page:page}))
 if(result.error||!Array.isArray(result.data)||result.data.length>12)fail('Não foi possível carregar o feed.')
 const seen=new Set<string>()
 return result.data!.map(row=>{
  if(!row||!isId(row.video_id)||seen.has(row.video_id)||!isYoutube(row.youtube_id)||!isText(row.title,120)||!optText(row.description,1000)||!isId(row.professional_id)||!isText(row.professional_name,160)||!['bairro','cidade','estado','outras'].includes(row.proximity)||!(row.distance_km===null||Number.isSafeInteger(row.distance_km)&&row.distance_km>=1)||!isDate(row.published_at))fail('Feed indisponível.')
  seen.add(row.video_id)
  return{video_id:row.video_id,youtube_id:row.youtube_id,title:row.title,description:row.description,professional_id:row.professional_id,professional_name:row.professional_name,specialty:row.specialty,uf:row.uf,city:row.city,neighborhood:row.neighborhood,proximity:row.proximity as FeedItem['proximity'],distance_km:row.distance_km,published_at:row.published_at}
 })
}

function copyVideo(row:Database['public']['Tables']['feed_videos']['Row']):MyVideo{
 if(!row||!isId(row.id)||!isYoutube(row.youtube_id)||!isText(row.title,120)||!optText(row.description,1000)||!['pending','approved','rejected','removed'].includes(row.status)||!optText(row.review_reason,1000)||!isDate(row.created_at))fail('Vídeo indisponível.')
 return{id:row.id,youtube_id:row.youtube_id,title:row.title,description:row.description,status:row.status as MyVideo['status'],review_reason:row.review_reason,created_at:row.created_at}
}

export async function readMyVideos(client:Client=getSupabaseClient()):Promise<MyVideo[]>{
 const {actor,result}=await run(client,async me=>await client.from('feed_videos').select('id,professional_id,youtube_id,title,description,status,review_reason,reviewed_by,reviewed_at,approved_at,created_at').eq('professional_id',me.id).neq('status','removed').order('created_at',{ascending:false}).limit(50))
 if(result.error||!Array.isArray(result.data))fail('Não foi possível carregar seus vídeos.')
 if(result.data!.some(row=>row.professional_id!==actor.id))fail('Vídeos indisponíveis.')
 return result.data!.map(copyVideo)
}

export async function submitVideo(input:{url:string,title:string,description:string},client:Client=getSupabaseClient()):Promise<MyVideo>{
 if(!youtubeVideoId(input.url))fail('Cole um link do YouTube (youtube.com ou youtu.be).')
 const title=clean(input.title??''),description=(input.description??'').trim()
 if(title.length<3||title.length>120)fail('O título precisa ter de 3 a 120 caracteres.')
 if(description.length>1000)fail('A descrição pode ter até 1000 caracteres.')
 const {actor,result}=await run(client,async()=>await client.rpc('submit_feed_video',{p_url:input.url.trim(),p_title:title,p_description:description||null}).single())
 if(result.error){const known=['Este vídeo já foi enviado.','Aguarde a análise dos vídeos enviados.'];fail(known.includes(result.error.message)?result.error.message:'Não foi possível enviar o vídeo.')}
 if(!result.data||result.data.professional_id!==actor.id||result.data.status!=='pending')fail('Não foi possível enviar o vídeo.')
 return copyVideo(result.data!)
}

export async function removeVideo(videoId:string,client:Client=getSupabaseClient()){
 if(!isId(videoId))fail('Vídeo inválido.')
 const {result}=await run(client,async()=>await client.rpc('remove_feed_video',{p_video_id:videoId}).single())
 if(result.error||!result.data||result.data.id!==videoId||result.data.status!=='removed')fail('Não foi possível retirar o vídeo.')
}

export async function readReviewQueue(status:'pending'|'approved',page=1,client:Client=getSupabaseClient()):Promise<ReviewItem[]>{
 if(!['pending','approved'].includes(status)||!Number.isSafeInteger(page)||page<1||page>10000)fail('Dados inválidos.')
 const {result}=await run(client,async()=>await client.rpc('list_feed_videos_for_review',{p_status:status,p_page:page}))
 if(result.error||!Array.isArray(result.data)||result.data.length>20)fail('Fila indisponível.')
 return result.data!.map(row=>{
  if(!row||!isId(row.video_id)||!isYoutube(row.youtube_id)||!isText(row.title,120)||!optText(row.description,1000)||row.status!==status||!isId(row.professional_id)||!isText(row.professional_name,160)||!optText(row.review_reason,1000)||!isDate(row.created_at))fail('Fila indisponível.')
  return{video_id:row.video_id,youtube_id:row.youtube_id,title:row.title,description:row.description,status,professional_id:row.professional_id,professional_name:row.professional_name,review_reason:row.review_reason,created_at:row.created_at}
 })
}

export async function reviewVideo(videoId:string,decision:'approved'|'rejected'|'removed',reason:string,client:Client=getSupabaseClient()){
 const why=(reason??'').trim()
 if(!isId(videoId)||!['approved','rejected','removed'].includes(decision))fail('Dados inválidos.')
 if(!why||why.length>1000)fail('Escreva o motivo (até 1000 caracteres).')
 const {result}=await run(client,async()=>await client.rpc('review_feed_video',{p_video_id:videoId,p_decision:decision,p_reason:why}).single())
 if(result.error||!result.data||result.data.id!==videoId||result.data.status!==decision)fail('Não foi possível registrar a análise. Atualize a lista.')
}

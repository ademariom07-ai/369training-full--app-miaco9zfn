import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import {roundCoordinates,type Coordinates} from './videoFeed'

// Vitrine do profissional e busca por modalidade/região (migração 20261119120000).
type Client=SupabaseClient<Database>
export const modalities={
 educacao_fisica:'Treino e personal',nutricao:'Nutrição',fisioterapia:'Fisioterapia',psicologia:'Psicologia',artes_marciais:'Artes marciais',
 yoga:'Yoga',pilates:'Pilates',danca:'Dança',corrida:'Corrida',funcional:'Funcional e cross',massoterapia:'Massoterapia e terapias',meditacao:'Meditação',
} as const
export type Modality=keyof typeof modalities
export type Mode='presencial'|'online'
export const modeLabels:Record<Mode,string>={presencial:'Presencial',online:'Online'}
const isModality=(v:unknown):v is Modality=>typeof v==='string'&&Object.hasOwn(modalities,v)
const isMode=(v:unknown):v is Mode=>v==='presencial'||v==='online'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text=(v:unknown,max:number)=>v===null||typeof v==='string'&&v.length<=max

export type Showcase={headline:string,bio:string,education:string,experience:string,modalities:Modality[],modes:Mode[]}
export type SearchResult={professional_id:string,display_name:string,headline:string|null,modalities:Modality[],modes:Mode[],uf:string|null,city:string|null,neighborhood:string|null,proximity:'bairro'|'cidade'|'estado'|'outras',distance_km:number|null,video_count:number,link_state:'pending'|'active'|null}
export type ShowcaseDetail=Omit<SearchResult,'proximity'|'distance_km'|'video_count'>&{bio:string|null,education:string|null,experience:string|null,videos:{youtube_id:string,title:string}[]}

export async function readMyShowcase(client:Client=getSupabaseClient()):Promise<Showcase|null>{
 const actor=await verifiedIdentity(client),result=await client.from('professional_profiles').select('user_id,headline,bio,education,experience,modalities,modes').eq('user_id',actor.id).maybeSingle()
 await assertSessionUnchanged(client,actor)
 if(result.error)throw Error('Não foi possível carregar sua vitrine.')
 const row=result.data;if(!row)return null
 if(row.user_id!==actor.id)throw Error('Vitrine indisponível.')
 return{headline:row.headline,bio:row.bio??'',education:row.education??'',experience:row.experience??'',modalities:row.modalities.filter(isModality),modes:row.modes.filter(isMode)}
}

export async function saveMyShowcase(input:Showcase,client:Client=getSupabaseClient()){
 const headline=input.headline.trim().replace(/\s+/g,' ')
 if(headline.length<3||headline.length>120)throw Error('Escreva uma frase de apresentação com 3 a 120 caracteres.')
 const mods=[...new Set(input.modalities)].filter(isModality),modes=[...new Set(input.modes)].filter(isMode)
 if(!mods.length||mods.length>6)throw Error('Escolha de 1 a 6 modalidades.')
 if(!modes.length)throw Error('Escolha presencial, online ou os dois.')
 if(input.bio.length>1500||input.education.length>1000||input.experience.length>1000)throw Error('Texto longo demais.')
 const actor=await verifiedIdentity(client)
 const result=await client.rpc('save_my_showcase',{p_headline:headline,p_bio:input.bio.trim()||null,p_education:input.education.trim()||null,p_experience:input.experience.trim()||null,p_modalities:mods,p_modes:modes}).single()
 await assertSessionUnchanged(client,actor)
 if(result.error||!result.data||result.data.user_id!==actor.id)throw Error('Não foi possível salvar sua vitrine.')
}

export async function searchProfessionals(filters:{modality:Modality|null,mode:Mode|null,coords:Coordinates|null},page=1,client:Client=getSupabaseClient()):Promise<SearchResult[]>{
 if(!Number.isSafeInteger(page)||page<1||page>500)throw Error('Página inválida.')
 if(filters.modality!==null&&!isModality(filters.modality)||filters.mode!==null&&!isMode(filters.mode))throw Error('Filtro inválido.')
 const c=filters.coords?roundCoordinates(filters.coords):null
 const actor=await verifiedIdentity(client)
 const result=await client.rpc('search_professionals',{p_modality:filters.modality,p_mode:filters.mode,p_lat:c?.lat??null,p_lng:c?.lng??null,p_page:page})
 await assertSessionUnchanged(client,actor)
 if(result.error||!Array.isArray(result.data)||result.data.length>12)throw Error('Não foi possível buscar profissionais.')
 return result.data.map(row=>{
  if(!row||!uuid.test(row.professional_id)||typeof row.display_name!=='string'||!row.display_name.trim()||!text(row.headline,120)||!['bairro','cidade','estado','outras'].includes(row.proximity)||!(row.link_state===null||row.link_state==='pending'||row.link_state==='active'))throw Error('Busca indisponível.')
  return{professional_id:row.professional_id,display_name:row.display_name,headline:row.headline,modalities:(row.modalities||[]).filter(isModality),modes:(row.modes||[]).filter(isMode),uf:row.uf,city:row.city,neighborhood:row.neighborhood,proximity:row.proximity as SearchResult['proximity'],distance_km:row.distance_km,video_count:Number(row.video_count)||0,link_state:row.link_state as SearchResult['link_state']}
 })
}

export async function readShowcase(professionalId:string,client:Client=getSupabaseClient()):Promise<ShowcaseDetail|null>{
 if(!uuid.test(professionalId))throw Error('Profissional inválido.')
 const actor=await verifiedIdentity(client),result=await client.rpc('professional_showcase',{p_professional_id:professionalId})
 await assertSessionUnchanged(client,actor)
 if(result.error||!Array.isArray(result.data))throw Error('Não foi possível abrir a vitrine.')
 const row=result.data[0];if(!row)return null
 if(row.professional_id!==professionalId||!text(row.bio,1500)||!text(row.education,1000)||!text(row.experience,1000))throw Error('Vitrine indisponível.')
 const videos=(Array.isArray(row.videos)?row.videos:[]).filter((v):v is {youtube_id:string,title:string}=>!!v&&typeof v==='object'&&/^[A-Za-z0-9_-]{11}$/.test(String((v as Record<string,unknown>).youtube_id))&&typeof (v as Record<string,unknown>).title==='string')
 return{professional_id:row.professional_id,display_name:row.display_name,headline:row.headline,bio:row.bio,education:row.education,experience:row.experience,modalities:(row.modalities||[]).filter(isModality),modes:(row.modes||[]).filter(isMode),uf:row.uf,city:row.city,neighborhood:row.neighborhood,videos,link_state:row.link_state==='pending'||row.link_state==='active'?row.link_state:null}
}

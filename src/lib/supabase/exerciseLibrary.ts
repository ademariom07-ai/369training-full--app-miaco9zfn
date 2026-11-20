import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Json} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import {youtubeVideoId} from './videoFeed'
import {exerciseAnimations,findAnimation,normalizeName,type ExerciseAnimation} from '@/lib/exerciseAnimations'

// Biblioteca de exercícios no banco (migração 20261121120000): textos oficiais editáveis pelo admin
// e exercícios próprios dos profissionais. As animações continuam no app (src/lib/exerciseAnimations.ts).
type Client=SupabaseClient<Database>
export type LibraryExercise={exercise_id:string,slug:string|null,owner_id:string|null,owner_name:string|null,name:string,aliases:string[],muscles:string|null,
 instructions:string|null,phase_cues:{cues:string[]}[]|null,video:string|null,level:'iniciante'|'intermediario'|'avancado'|null,equipment:string|null,official:boolean,mine:boolean}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const known=['Biblioteca disponível para profissionais aprovados e admin.','Dados do exercício inválidos.','Exercício indisponível.','Exercício indisponível (os 30 animados não podem ser arquivados).']

function parseCues(v:unknown):LibraryExercise['phase_cues']{
 if(!Array.isArray(v))return null
 return v.slice(0,8).map(p=>({cues:Array.isArray((p as {cues?:unknown})?.cues)?((p as {cues:unknown[]}).cues).filter((c):c is string=>typeof c==='string').slice(0,3):[]}))
}
export async function listExercises(client:Client=getSupabaseClient()):Promise<LibraryExercise[]>{
 const actor=await verifiedIdentity(client),result=await client.rpc('list_exercises');await assertSessionUnchanged(client,actor)
 if(result.error||!Array.isArray(result.data))throw Error('Não foi possível carregar a biblioteca.')
 return result.data.filter(r=>r&&uuid.test(r.exercise_id)&&typeof r.name==='string').map(r=>({exercise_id:r.exercise_id,slug:r.slug,owner_id:r.owner_id,owner_name:r.owner_name,name:r.name,
  aliases:Array.isArray(r.aliases)?r.aliases:[],muscles:r.muscles,instructions:r.instructions,phase_cues:parseCues(r.phase_cues),video:r.video&&/^[A-Za-z0-9_-]{11}$/.test(r.video)?r.video:null,
  level:r.level==='iniciante'||r.level==='intermediario'||r.level==='avancado'?r.level:null,equipment:r.equipment,official:!!r.official,mine:!!r.mine}))
}
export type ExerciseInput={id:string|null,name:string,aliases:string,muscles:string,instructions:string,phaseCues:string[][]|null,video:string,level:string,equipment:string}
export async function saveExercise(input:ExerciseInput,client:Client=getSupabaseClient()){
 const name=input.name.trim().replace(/\s+/g,' ')
 if(name.length<3||name.length>80)throw Error('O nome precisa ter de 3 a 80 caracteres.')
 const aliases=input.aliases.split(',').map(a=>a.trim()).filter(a=>a.length>=2&&a.length<=80)
 if(aliases.length>15)throw Error('Use no máximo 15 outros nomes.')
 let video:string|null=null
 if(input.video.trim()){video=youtubeVideoId(input.video)??(/^[A-Za-z0-9_-]{11}$/.test(input.video.trim())?input.video.trim():null);if(!video)throw Error('O vídeo precisa ser um link do YouTube.')}
 const cues=input.phaseCues?input.phaseCues.map(list=>({cues:list.map(c=>c.trim()).filter(Boolean).slice(0,3)})):null
 if(cues&&cues.some(p=>!p.cues.length||p.cues.some(c=>c.length>90)))throw Error('Cada fase precisa de 1 a 3 dicas com até 90 caracteres.')
 if(input.id!==null&&!uuid.test(input.id))throw Error('Exercício inválido.')
 const actor=await verifiedIdentity(client)
 const result=await client.rpc('save_exercise',{p_id:input.id,p_name:name,p_aliases:aliases,p_muscles:input.muscles.trim()||null,p_instructions:input.instructions.trim()||null,
  p_phase_cues:cues as unknown as Json,p_video:video,p_level:['iniciante','intermediario','avancado'].includes(input.level)?input.level:null,p_equipment:input.equipment.trim()||null})
 await assertSessionUnchanged(client,actor)
 if(result.error||typeof result.data!=='string')throw Error(result.error?.message&&known.includes(result.error.message)?result.error.message:'Não foi possível salvar o exercício.')
 invalidateLibrary()
 return result.data
}
export async function archiveExercise(id:string,client:Client=getSupabaseClient()){
 if(!uuid.test(id))throw Error('Exercício inválido.')
 const actor=await verifiedIdentity(client),result=await client.rpc('archive_exercise',{p_id:id});await assertSessionUnchanged(client,actor)
 if(result.error)throw Error(known.includes(result.error.message)?result.error.message:'Não foi possível arquivar.')
 invalidateLibrary()
}

// Cache compartilhado entre telas; recarrega quando alguém salva.
let cache:Promise<LibraryExercise[]>|null=null
const listeners=new Set<()=>void>()
export function invalidateLibrary(){cache=null;listeners.forEach(fn=>fn())}
export function useExerciseLibrary(){
 const [items,setItems]=useState<LibraryExercise[]>([]),[tick,setTick]=useState(0)
 useEffect(()=>{const fn=()=>setTick(t=>t+1);listeners.add(fn);return()=>{listeners.delete(fn)}},[])
 useEffect(()=>{let alive=true;cache??=listExercises().catch(()=>[]);cache.then(list=>{if(alive)setItems(list)});return()=>{alive=false}},[tick])
 return items
}

// Acha o exercício da biblioteca pelo nome (ou outro nome) e monta a animação com os textos editados.
export function findLibraryEntry(name:string,library:LibraryExercise[]){
 const key=normalizeName(name)
 return library.find(e=>normalizeName(e.name)===key||e.aliases.some(a=>normalizeName(a)===key))??null
}
export function applyOverrides(anim:ExerciseAnimation,entry:LibraryExercise|null):ExerciseAnimation{
 if(!entry)return anim
 return{...anim,name:entry.name,muscles:entry.muscles||anim.muscles,phases:anim.phases.map((p,i)=>({...p,cues:entry.phase_cues?.[i]?.cues?.length?entry.phase_cues[i].cues:p.cues}))}
}
export function resolveExercise(name:string,library:LibraryExercise[]){
 const exact=findLibraryEntry(name,library)
 const base=(exact?.slug?exerciseAnimations.find(a=>a.id===exact.slug):null)??findAnimation(name)
 // Nome parecido (não idêntico): usa a ficha da biblioteca ligada à animação encontrada.
 const entry=exact??(base?library.find(e=>e.slug===base.id)??null:null)
 return{entry,animation:base?applyOverrides(base,entry):null}
}

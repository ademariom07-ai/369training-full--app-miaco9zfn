import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database,Json} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Avaliação física e fotos de evolução (migração 20261203120000).
type Client=SupabaseClient<Database>
export const PHOTO_BUCKET='evolucao'
export const measureFields=[
 ['weight_kg','Peso','kg'],['height_cm','Altura','cm'],['body_fat_pct','Gordura corporal','%'],['muscle_kg','Massa muscular','kg'],
 ['waist_cm','Cintura','cm'],['hip_cm','Quadril','cm'],['chest_cm','Tórax','cm'],['arm_cm','Braço','cm'],['thigh_cm','Coxa','cm'],['calf_cm','Panturrilha','cm'],['neck_cm','Pescoço','cm'],
] as const
export type MeasureKey=typeof measureFields[number][0]
export type Assessment={assessment_id:string,author_name:string,mine:boolean,measured_on:string,notes:string|null}&Record<MeasureKey,number|null>
export type ProgressPhoto={photo_id:string,taken_on:string,pose:'frente'|'lado'|'costas',path:string,shared:boolean}
export const poses=['frente','lado','costas'] as const
export const poseLabels={frente:'Frente',lado:'Lado',costas:'Costas'}
const known=['Avaliação inválida.','Use só números nas medidas.','Data inválida.','Avaliação só do próprio aluno ou do profissional que o acompanha.','Limite diário de avaliações atingido.',
 'Informe pelo menos uma medida e confira os números (peso em kg, medidas em cm).','Avaliação indisponível.','Fotos de evolução são do aluno.','Foto inválida.','Limite de fotos atingido. Apague fotos antigas.','Foto indisponível.','Fotos indisponíveis.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// IMC e relação cintura/quadril (com a altura mais recente informada).
export function bmi(weight:number|null,heightCm:number|null){if(!weight||!heightCm)return null;const h=heightCm/100;return Math.round(weight/(h*h)*10)/10}
export function bmiLabel(v:number){return v<18.5?'Abaixo do peso':v<25?'Peso adequado':v<30?'Sobrepeso':'Obesidade'}
export function whr(waist:number|null,hip:number|null){if(!waist||!hip)return null;return Math.round(waist/hip*100)/100}
export function latestHeight(rows:Assessment[]){return rows.find(r=>r.height_cm)?.height_cm??null}
export function parseMeasure(v:string){const t=v.trim().replace(',','.');if(!t)return null;const n=Number(t);if(!Number.isFinite(n))throw Error('Use só números nas medidas.');return Math.round(n*10)/10}

export async function saveAssessment(input:{id:string|null,student:string,date:string,values:Partial<Record<MeasureKey,string>>,notes:string},client:Client=getSupabaseClient()){
 if(!uuid.test(input.student)||!/^\d{4}-\d{2}-\d{2}$/.test(input.date))throw Error('Avaliação inválida.')
 const data:Record<string,number|string|null>={}
 for(const [k] of measureFields){const v=input.values[k];if(v!==undefined&&v.trim()!=='')data[k]=parseMeasure(v)}
 if(!Object.keys(data).length)throw Error('Informe pelo menos uma medida e confira os números (peso em kg, medidas em cm).')
 if(input.notes.trim())data.notes=input.notes.trim().slice(0,500)
 return await call(client,()=>client.rpc('save_assessment',{p_id:input.id,p_student:input.student,p_measured_on:input.date,p_data:data as Json}),'Não foi possível salvar a avaliação.')
}
export async function deleteAssessment(id:string,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('delete_assessment',{p_id:id}),'Não foi possível apagar.',true)}
export async function listAssessments(student:string,client:Client=getSupabaseClient()):Promise<Assessment[]>{
 const rows=await call(client,()=>client.rpc('list_assessments',{p_student:student}),'Não foi possível carregar as avaliações.')
 return (Array.isArray(rows)?rows:[]).map(r=>{const o={...r} as Record<string,unknown>;for(const [k] of measureFields)o[k]=r[k]===null?null:Number(r[k]);return o as Assessment})
}
const exts:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}
export async function uploadProgressPhoto(owner:string,date:string,pose:typeof poses[number],file:File,client:Client=getSupabaseClient()){
 const m=file.name.toLowerCase().match(/\.([a-z0-9]{2,5})$/),ext=m&&exts[m[1]]?m[1]:file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':file.type==='image/webp'?'webp':null
 if(!ext)throw Error('Use uma foto JPG, PNG ou WEBP. No iPhone, se a foto for HEIC, tire pela câmera do app.')
 if(file.size<1||file.size>8*1024*1024)throw Error('Cada foto pode ter até 8 MB.')
 await verifiedIdentity(client)
 const rand=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('')
 const path=`${owner}/${rand}.${ext}`
 const {error}=await client.storage.from(PHOTO_BUCKET).upload(path,file,{contentType:exts[ext],upsert:false})
 if(error)throw Error('Não foi possível enviar a foto. Tente de novo.')
 try{await call(client,()=>client.rpc('save_progress_photo',{p_taken_on:date,p_pose:pose,p_path:path}),'Não foi possível salvar a foto.')}
 catch(err){await client.storage.from(PHOTO_BUCKET).remove([path]).catch(()=>{});throw err}
}
export async function deleteProgressPhoto(id:string,client:Client=getSupabaseClient()){
 const path=await call(client,()=>client.rpc('delete_progress_photo',{p_id:id}),'Não foi possível apagar a foto.')
 if(typeof path==='string')await client.storage.from(PHOTO_BUCKET).remove([path]).catch(()=>{})
}
export async function listProgressPhotos(student:string,client:Client=getSupabaseClient()):Promise<ProgressPhoto[]>{
 const rows=await call(client,()=>client.rpc('list_progress_photos',{p_student:student}),'Não foi possível carregar as fotos.')
 return (Array.isArray(rows)?rows:[]).filter(r=>(poses as readonly string[]).includes(r.pose)) as ProgressPhoto[]
}
export async function photoSharingStatus(student:string,client:Client=getSupabaseClient()){return !!(await call(client,()=>client.rpc('photo_sharing_status',{p_student:student}),'Não foi possível carregar.',true))}
export async function setPhotoSharing(share:boolean,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('set_photo_sharing',{p_share:share}),'Não foi possível salvar.',true)}
export async function progressPhotoUrl(path:string,client:Client=getSupabaseClient()){
 const {data,error}=await client.storage.from(PHOTO_BUCKET).download(path)
 if(error||!data)throw Error('Não foi possível abrir a foto.')
 return URL.createObjectURL(data)
}

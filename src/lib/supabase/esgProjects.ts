import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged,readOwnProfile} from './profiles'
type Client=SupabaseClient<Database>
export type EsgProject=Database['public']['Tables']['esg_projects']['Row']
export const esgCategories={economica:'Econômica',social:'Social',ambiental:'Ambiental'} as const
export type EsgInput={category:keyof typeof esgCategories;title:string;description:string}
const fields='id,owner_id,request_id,category,title,description,status,version,submitted_at,reviewed_at,review_reason'
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificador inválido.');return value.toLowerCase()}
function text(value:string,max:number){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error('Dados inválidos.');return value.trim()}
export function validateEsgInput(input:EsgInput):EsgInput{if(!input||!Object.hasOwn(esgCategories,input.category))throw Error('Categoria inválida.');return {category:input.category,title:text(input.title,120),description:text(input.description,6000)}}
async function actor(client:Client,expectedId:string,admin=false){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');const profile=await readOwnProfile(client);if(!profile||profile.id!==id||admin&&profile.role!=='admin'||!admin&&!['aluno','profissional'].includes(profile.role))throw Error('Acesso indisponível.');await assertSessionUnchanged(client,identity);return identity}
function copy(row:EsgProject){
 if(!row||!['pending','approved','rejected'].includes(row.status)||!Number.isFinite(Date.parse(row.submitted_at)))throw Error('Projeto indisponível.')
 uuid(row.id);uuid(row.owner_id);uuid(row.request_id);validateEsgInput({category:row.category as EsgInput['category'],title:row.title,description:row.description})
 if(row.status==='pending'&&(row.version!==1||row.reviewed_at!==null||row.review_reason!==null)||row.status!=='pending'&&(row.version!==2||!row.reviewed_at||!Number.isFinite(Date.parse(row.reviewed_at))||Date.parse(row.reviewed_at)<Date.parse(row.submitted_at)||!row.review_reason))throw Error('Projeto indisponível.')
 if(row.review_reason!==null)text(row.review_reason,1000)
 return {...row}
}
export async function readEsgProjects(expectedId:string,scope:'own'|'admin',page=1,client:Client=getSupabaseClient()){
 if(!['own','admin'].includes(scope)||!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Consulta inválida.')
 const identity=await actor(client,expectedId,scope==='admin');let query=client.from('esg_projects').select(fields)
 if(scope==='own')query=query.eq('owner_id',identity.id)
 const result=await query.order('submitted_at',{ascending:false}).order('id').range((page-1)*20,page*20-1)
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>20)throw Error('Projetos indisponíveis.')
 const ids=new Set<string>()
 return result.data.map(row=>{if(ids.has(row.id)||scope==='own'&&row.owner_id!==identity.id)throw Error('Projeto indisponível.');ids.add(row.id);return copy(row)})
}
export async function submitEsgProject(input:EsgInput,requestId:string,expectedId:string,client:Client=getSupabaseClient()){
 const body=validateEsgInput(input),key=uuid(requestId),identity=await actor(client,expectedId)
 const result=await client.rpc('submit_esg_project',{p_request_id:key,p_category:body.category,p_title:body.title,p_description:body.description}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data||result.data.owner_id!==identity.id||result.data.request_id!==key||result.data.category!==body.category||result.data.title!==body.title||result.data.description!==body.description)throw Error('Não foi possível confirmar o envio.')
 return copy(result.data)
}
export async function reviewEsgProject(row:EsgProject,decision:'approved'|'rejected',reason:string,expectedId:string,client:Client=getSupabaseClient()){
 const project=copy(row),message=text(reason,1000)
 if(project.status!=='pending'||!['approved','rejected'].includes(decision))throw Error('Atualize o projeto antes de analisar.')
 const identity=await actor(client,expectedId,true);if(project.owner_id===identity.id)throw Error('Não é permitido analisar o próprio projeto.')
 const result=await client.rpc('review_esg_project',{p_project_id:project.id,p_expected_version:project.version,p_decision:decision,p_reason:message}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data||result.data.id!==project.id||result.data.owner_id!==project.owner_id||result.data.status!==decision||result.data.version!==2||result.data.review_reason!==message)throw Error('Não foi possível confirmar a análise.')
 return copy(result.data)
}

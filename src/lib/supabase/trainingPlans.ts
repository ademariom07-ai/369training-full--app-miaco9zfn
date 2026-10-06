import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
export type TrainingPlan=Database['public']['Tables']['training_plans']['Row']
export type TrainingNotice=Database['public']['Tables']['training_plan_notifications']['Row']
export type TrainingInput={studentId:string;linkVersion:number;requestId:string;title:string;content:string}
type Client=SupabaseClient<Database>
const fields='id,request_id,student_id,professional_id,link_version,title,content,created_at'
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificação inválida.');return value.toLowerCase()}
function text(value:string,max:number){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error('Dados inválidos.');return value.trim()}
function positive(value:number){if(!Number.isSafeInteger(value)||value<1)throw Error('Versão inválida.');return value}
async function actor(client:Client,expectedId:string){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');return identity}
function copy(row:TrainingPlan){
 if(!row||!Number.isFinite(Date.parse(row.created_at)))throw Error('Treino indisponível.')
 const id=uuid(row.id),request_id=uuid(row.request_id),student_id=uuid(row.student_id),professional_id=uuid(row.professional_id)
 if(student_id===professional_id)throw Error('Treino indisponível.')
 return{id,request_id,student_id,professional_id,link_version:positive(row.link_version),title:text(row.title,120),content:text(row.content,6000),created_at:row.created_at}
}
function notice(row:TrainingNotice){
 if(!row||!Number.isFinite(Date.parse(row.created_at))||row.read_at!==null&&!Number.isFinite(Date.parse(row.read_at)))throw Error('Aviso indisponível.')
 return{plan_id:uuid(row.plan_id),recipient_id:uuid(row.recipient_id),created_at:row.created_at,read_at:row.read_at}
}
export async function createTrainingPlan(input:TrainingInput,expectedProfessionalId:string,client:Client=getSupabaseClient()){
 const p_student_id=uuid(input.studentId),p_expected_link_version=positive(input.linkVersion),p_request_id=uuid(input.requestId),p_title=text(input.title,120),p_content=text(input.content,6000),identity=await actor(client,expectedProfessionalId)
 const result=await client.rpc('create_training_plan',{p_student_id,p_expected_link_version,p_request_id,p_title,p_content}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível publicar o treino.')
 const row=copy(result.data)
 if(row.professional_id!==identity.id||row.student_id!==p_student_id||row.link_version!==p_expected_link_version||row.request_id!==p_request_id||row.title!==p_title||row.content!==p_content)throw Error('Treino indisponível.')
 return row
}
export async function readTrainingPlans(account:{id:string;role:string},page=1,client:Client=getSupabaseClient()){
 const id=account.id,role=account.role
 if(!['aluno','profissional'].includes(role)||!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Consulta indisponível.')
 const identity=await actor(client,id),result=await client.from('training_plans').select(fields).eq(role==='aluno'?'student_id':'professional_id',identity.id).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1)
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>20)throw Error('Não foi possível carregar os treinos.')
 const ids=new Set<string>()
 return result.data.map(value=>{const row=copy(value);if(ids.has(row.id)||row[role==='aluno'?'student_id':'professional_id']!==identity.id)throw Error('Treino indisponível.');ids.add(row.id);return row})
}
export async function readTrainingNotices(planIds:string[],expectedStudentId:string,client:Client=getSupabaseClient()){
 if(!Array.isArray(planIds)||planIds.length>20||new Set(planIds).size!==planIds.length)throw Error('Consulta indisponível.')
 const ids=planIds.map(uuid),identity=await actor(client,expectedStudentId)
 if(!ids.length)return[]
 const result=await client.from('training_plan_notifications').select('plan_id,recipient_id,created_at,read_at').eq('recipient_id',identity.id).in('plan_id',ids)
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>ids.length)throw Error('Avisos indisponíveis.')
 const seen=new Set<string>()
 return result.data.map(value=>{const row=notice(value);if(row.recipient_id!==identity.id||!ids.includes(row.plan_id)||seen.has(row.plan_id))throw Error('Aviso indisponível.');seen.add(row.plan_id);return row})
}
export async function markTrainingRead(planId:string,expectedStudentId:string,client:Client=getSupabaseClient()){
 const p_plan_id=uuid(planId),identity=await actor(client,expectedStudentId),result=await client.rpc('read_training_notification',{p_plan_id}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível atualizar o aviso.')
 const row=notice(result.data)
 if(row.plan_id!==p_plan_id||row.recipient_id!==identity.id||!row.read_at)throw Error('Aviso indisponível.')
 return row
}

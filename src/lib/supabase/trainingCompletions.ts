import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import type {TrainingPlan} from './trainingPlans'
export type TrainingCompletion=Database['public']['Tables']['training_completions']['Row']
type Client=SupabaseClient<Database>
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificação inválida.');return value.toLowerCase()}
function copy(row:TrainingCompletion){if(!row||!Number.isFinite(Date.parse(row.completed_at)))throw Error('Registro indisponível.');return{plan_id:uuid(row.plan_id),student_id:uuid(row.student_id),completed_at:row.completed_at}}
async function actor(client:Client,expectedId:string){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');return identity}
export async function completeTrainingPlan(planId:string,expectedStudentId:string,client:Client=getSupabaseClient()){
 const p_plan_id=uuid(planId),identity=await actor(client,expectedStudentId)
 const result=await client.rpc('complete_training_plan',{p_plan_id}).single()
 await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível registrar a conclusão.')
 const row=copy(result.data)
 if(row.plan_id!==p_plan_id||row.student_id!==identity.id)throw Error('Registro indisponível.')
 return row
}
export async function readTrainingCompletions(plans:TrainingPlan[],account:{id:string;role:string},client:Client=getSupabaseClient()){
 if(!Array.isArray(plans)||plans.length>20||!['aluno','profissional'].includes(account.role))throw Error('Consulta indisponível.')
 const identity=await actor(client,account.id),targets=new Map<string,string>()
 for(const plan of plans){const id=uuid(plan.id),student=uuid(plan.student_id),professional=uuid(plan.professional_id);if(targets.has(id)||(account.role==='aluno'?student:professional)!==identity.id)throw Error('Consulta indisponível.');targets.set(id,student)}
 if(!targets.size)return[]
 const result=await client.from('training_completions').select('plan_id,student_id,completed_at').in('plan_id',[...targets.keys()])
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>targets.size)throw Error('Registros indisponíveis.')
 const seen=new Set<string>()
 return result.data.map(value=>{const row=copy(value);if(targets.get(row.plan_id)!==row.student_id||seen.has(row.plan_id))throw Error('Registro indisponível.');seen.add(row.plan_id);return row})
}

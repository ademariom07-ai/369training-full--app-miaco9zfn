import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
export type ProfessionalEntry={professional_id:string;display_name:string}
export async function readApprovedProfessionals(page=1,client:SupabaseClient<Database>=getSupabaseClient()):Promise<ProfessionalEntry[]>{
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Página inválida.')
 const actor=await verifiedIdentity(client),result=await client.rpc('list_approved_professionals',{p_page:page})
 await assertSessionUnchanged(client,actor)
 if(result.error||!Array.isArray(result.data)||result.data.length>20)throw Error('Não foi possível carregar os profissionais.')
 const ids=new Set<string>()
 return result.data.map(row=>{
  if(!row||typeof row.professional_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.professional_id)||typeof row.display_name!=='string'||!row.display_name.trim()||row.display_name.length>160||ids.has(row.professional_id))throw Error('Catálogo indisponível.')
  ids.add(row.professional_id)
  return{professional_id:row.professional_id,display_name:row.display_name}
 })
}

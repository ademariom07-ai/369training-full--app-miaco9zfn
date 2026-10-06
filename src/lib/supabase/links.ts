import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getSupabaseClient } from './client'
import { verifiedIdentity, assertSessionUnchanged } from './profiles'
export type StudentLink = Database['public']['Tables']['student_professional_links']['Row']
type Client = SupabaseClient<Database>
const fields = 'student_id,professional_id,state,version,requested_at,accepted_at,revoked_at'
function uuid(value: string) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Conta inválida.'); return value.toLowerCase() }
function version(value: number) { if (!Number.isSafeInteger(value) || value < 1) throw new Error('Versão inválida.'); return value }
function participant(row: StudentLink, id: string) { if (row.student_id !== id && row.professional_id !== id) throw new Error('Vínculo indisponível.'); return row }
export async function requestStudentLink(professionalId: string, client: Client = getSupabaseClient(), expectedStudentId?: string) {
  const p_professional_id = uuid(professionalId), actor = await verifiedIdentity(client)
  if (expectedStudentId !== undefined && actor.id !== expectedStudentId) throw new Error('Sessão alterada. Atualize a tela.')
  const result = await client.rpc('request_student_link', { p_professional_id }).single()
  await assertSessionUnchanged(client, actor)
  if (result.error || !result.data || result.data.student_id !== actor.id || result.data.professional_id !== p_professional_id || !['pending','active'].includes(result.data.state)) throw new Error('Não foi possível pedir o vínculo.')
  return participant(result.data, actor.id)
}
export async function acceptStudentLink(studentId: string, expectedVersion: number, client: Client = getSupabaseClient()) {
  const p_student_id = uuid(studentId), p_expected_version = version(expectedVersion), actor = await verifiedIdentity(client)
  const result = await client.rpc('accept_student_link', { p_student_id, p_expected_version }).single()
  await assertSessionUnchanged(client, actor)
  if (result.error || !result.data || result.data.student_id !== p_student_id || result.data.professional_id !== actor.id || result.data.version !== expectedVersion || result.data.state !== 'active') throw new Error('Não foi possível aceitar o vínculo.')
  return participant(result.data, actor.id)
}
export async function revokeStudentLink(studentId: string, expectedVersion: number, client: Client = getSupabaseClient()) {
  const p_student_id = uuid(studentId), p_expected_version = version(expectedVersion), actor = await verifiedIdentity(client)
  const result = await client.rpc('revoke_student_link', { p_student_id, p_expected_version }).single()
  await assertSessionUnchanged(client, actor)
  if (result.error || !result.data || result.data.student_id !== p_student_id || result.data.version !== expectedVersion || result.data.state !== 'revoked') throw new Error('Não foi possível encerrar o vínculo.')
  return participant(result.data, actor.id)
}
export async function readMyStudentLink(client: Client = getSupabaseClient()) {
  const actor = await verifiedIdentity(client)
  const result = await client.from('student_professional_links').select(fields).eq('student_id', actor.id).maybeSingle()
  await assertSessionUnchanged(client, actor)
  if (result.error || (result.data && result.data.student_id !== actor.id)) throw new Error('Não foi possível carregar o vínculo.')
  return result.data
}
export async function readProfessionalLinks(page = 1, client: Client = getSupabaseClient()) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error('Página inválida.')
  const actor = await verifiedIdentity(client)
  const result = await client.from('student_professional_links').select(fields).eq('professional_id', actor.id).order('requested_at', {ascending: false}).order('student_id').range((page-1)*20, page*20-1)
  await assertSessionUnchanged(client, actor)
  if (result.error || result.data.some(row=>row.professional_id !== actor.id)) throw new Error('Não foi possível carregar os vínculos.')
  return result.data
}

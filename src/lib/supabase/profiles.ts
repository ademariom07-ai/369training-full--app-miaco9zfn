import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getSupabaseClient } from './client.ts'

export type OwnProfile = Database['public']['Tables']['profiles']['Row']
const fields = 'id,display_name,role,approved,created_at'
type Client = SupabaseClient<Database>

export async function verifiedIdentity(client: Client) {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) throw new Error('Entre na sua conta Supabase.')
  const token = data.session.access_token
  const verified = await client.auth.getUser(token)
  if (verified.error || !verified.data.user || verified.data.user.is_anonymous || verified.data.user.id !== data.session.user.id) {
    throw new Error('Sessão indisponível.')
  }
  return { id: verified.data.user.id, token }
}
export async function assertSessionUnchanged(client: Client, actor: { id: string; token: string }) {
  const { data, error } = await client.auth.getSession()
  if (error || data.session?.access_token !== actor.token || data.session?.user.id !== actor.id) {
    throw new Error('Sessão alterada. Atualize a tela.')
  }
}
function name(value: string) {
  if (typeof value !== 'string' || value.trim().length > 160) throw new Error('Nome inválido.')
  return value.trim()
}
export async function readOwnProfile(client: Client = getSupabaseClient()): Promise<OwnProfile | null> {
  const actor = await verifiedIdentity(client)
  const result = await client.from('profiles').select(fields).eq('id', actor.id).maybeSingle()
  await assertSessionUnchanged(client, actor)
  if (result.error) throw new Error('Não foi possível carregar o perfil.')
  if (result.data && result.data.id !== actor.id) throw new Error('Perfil indisponível.')
  return result.data
}
export async function createOwnProfile(displayName: string, client: Client = getSupabaseClient()): Promise<OwnProfile> {
  const display_name = name(displayName), actor = await verifiedIdentity(client)
  const result = await client.from('profiles').insert({ id: actor.id, display_name }).select(fields).single()
  await assertSessionUnchanged(client, actor)
  if (result.error || !result.data || result.data.id !== actor.id) throw new Error('Não foi possível criar o perfil.')
  return result.data
}
export async function renameOwnProfile(displayName: string, client: Client = getSupabaseClient()): Promise<OwnProfile> {
  const display_name = name(displayName), actor = await verifiedIdentity(client)
  const result = await client.from('profiles').update({ display_name }).eq('id', actor.id).select(fields).single()
  await assertSessionUnchanged(client, actor)
  if (result.error || !result.data || result.data.id !== actor.id) throw new Error('Não foi possível atualizar o perfil.')
  return result.data
}

import type { SupabaseClient } from '@supabase/supabase-js'
export type IntakeRow = {
  event_id: string; service_id: string; revision: number; period: string
  student_id: string; partner_id: string; state: 'scheduled' | 'completed' | 'cancelled'
  reported_payment: 'pending' | 'confirmed' | 'disputed' | 'refunded'
  student_reviewed: boolean; partner_reviewed: boolean; verification: 'unverified'
  created_by: string; created_at: string
}
const columns = 'event_id,service_id,revision,period,student_id,partner_id,state,reported_payment,student_reviewed,partner_reviewed,verification,created_by,created_at'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function readServiceIntake(client: SupabaseClient, owner: string, month: string, page: number) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw Error('Informe um mês válido e uma página entre 1 e 10.000.')
  const before = await client.auth.getSession()
  const session = before.data.session
  if (before.error || !session || session.user.id !== owner) throw Error('Entre novamente na sua conta.')
  const { data, error } = await client.from('service_event_intake').select(columns)
    .eq('period', month + '-01').order('created_at', { ascending: false })
    .order('event_id', { ascending: false }).range((page - 1) * 20, page * 20)
  const after = await client.auth.getSession()
  if (after.error || after.data.session?.user.id !== owner || after.data.session?.access_token !== session.access_token)
    throw Error('A sessão mudou. Faça uma nova consulta.')
  if (error) throw Error('Não foi possível consultar o histórico. Verifique seu acesso administrativo.')
  if (!Array.isArray(data) || data.length > 21 || data.some(r =>
    !r || !['event_id','service_id','student_id','partner_id','created_by'].every(k => typeof r[k] === 'string' && uuid.test(r[k])) ||
    r.period !== month + '-01' || !Number.isSafeInteger(r.revision) || r.revision < 1 ||
    !['scheduled','completed','cancelled'].includes(r.state) ||
    !['pending','confirmed','disputed','refunded'].includes(r.reported_payment) ||
    typeof r.student_reviewed !== 'boolean' || typeof r.partner_reviewed !== 'boolean' ||
    r.verification !== 'unverified' || typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))))
    throw Error('O histórico retornou dados inválidos.')
  return { rows: data.slice(0,20) as IntakeRow[], hasNext: data.length > 20 }
}

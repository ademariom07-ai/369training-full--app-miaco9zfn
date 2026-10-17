import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { readServiceIntake, type IntakeRow } from '@/lib/supabase/serviceIntake'
import { saoPauloToday } from '@/lib/supabase/availability'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
const states = { scheduled: 'Agendado', completed: 'Concluído', cancelled: 'Cancelado' }
const payments = { pending: 'Pendente', confirmed: 'Confirmado pelo informante', disputed: 'Contestado', refunded: 'Estornado' }
export default function AdminServiceIntake({ owner, disabled }: { owner: string; disabled: boolean }) {
  const [month,setMonth] = useState(() => saoPauloToday().slice(0,7))
  const [result,setResult] = useState<{rows:IntakeRow[];hasNext:boolean;page:number}|null>(null)
  const [busy,setBusy] = useState(false), [error,setError] = useState('')
  const generation = useRef(0), locked = useRef(false)
  useEffect(() => {
    const {data} = getSupabaseClient().auth.onAuthStateChange(() => {
      generation.current++; locked.current = false; setResult(null); setError(''); setBusy(false)
    })
    return () => { generation.current++; data.subscription.unsubscribe() }
  },[owner])
  async function load(page:number) {
    if(disabled || locked.current) return
    locked.current = true; const ticket = ++generation.current
    setBusy(true); setError(''); setResult(null)
    try {
      const next = await readServiceIntake(getSupabaseClient(),owner,month,page)
      if(ticket === generation.current) setResult({...next,page})
    } catch(err) { if(ticket === generation.current) setError(err instanceof Error ? err.message : 'Consulta indisponível.') }
    finally { if(ticket === generation.current) { locked.current = false; setBusy(false) } }
  }
  return <section className="my-6 space-y-4 rounded-xl border p-5">
    <h2 className="text-lg font-semibold">Histórico de serviços · conferência administrativa</h2>
    <p>Registros não verificados. O pagamento informado não comprova recebimento e não libera pontos, tarifas ou cashback.</p>
    <form className="space-y-3" onSubmit={e => {e.preventDefault(); void load(1)}}>
      <label className="block">Mês de referência<Input type="month" required value={month} disabled={busy || disabled} onChange={e => {setMonth(e.target.value);setResult(null);setError('')}}/></label>
      <Button type="submit" disabled={busy || disabled}>{busy ? 'Consultando…' : 'Consultar histórico'}</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <><p role="status">Página {result.page} · {result.rows.length} revisões exibidas</p>
      {!result.rows.length && <p>Nenhum registro disponível nesta página e neste mês.</p>}
      <ul className="space-y-3">{result.rows.map(row => <li key={row.event_id} className="space-y-1 rounded-lg border p-3 text-sm">
        <p className="font-semibold">Revisão {row.revision} · {states[row.state]}</p><p className="text-amber-800">Não verificado</p>
        <p className="break-all">Serviço: {row.service_id}</p><p className="break-all">Aluno: {row.student_id}</p><p className="break-all">Profissional: {row.partner_id}</p>
        <p>Pagamento informado: {payments[row.reported_payment]}</p>
        <p>Avaliações informadas — aluno: {row.student_reviewed?'sim':'não'}; profissional: {row.partner_reviewed?'sim':'não'}.</p>
        <p>Recebido em {new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
        <details><summary>Rastreabilidade</summary><p className="break-all">Evento: {row.event_id}</p><p className="break-all">Registrado por: {row.created_by}</p></details>
      </li>)}</ul>
      <div className="flex items-center gap-3"><Button variant="outline" disabled={disabled || busy || result.page<=1} onClick={() => void load(result.page-1)}>Anterior</Button><Button variant="outline" disabled={disabled || busy || !result.hasNext || result.page>=10000} onClick={() => void load(result.page+1)}>Próxima</Button></div>
    </>}
    <p className="text-sm text-slate-600">Cada item é uma revisão, não um serviço adicional. Ordem de recebimento; não representa saldo ou ranking. Esta consulta não altera registros.</p>
  </section>
}

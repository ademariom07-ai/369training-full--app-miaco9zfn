/** Read-only replay for administrative reconciliation. Caller-provided payment flags
 * are not receipts. Never authorizes points, debits, refunds or ledger writes.
 * Production needs trusted source events, unique IDs and transactional persistence.
 */
export type ServiceEventSnapshot = {
  eventId: string
  serviceId: string
  revision: number
  period: string
  studentId: string
  partnerId: string
  state: 'scheduled' | 'completed' | 'cancelled'
  payment: 'pending' | 'confirmed' | 'disputed' | 'refunded'
  studentReviewed: boolean
  partnerReviewed: boolean
}
function canonical(e: ServiceEventSnapshot) {
  return JSON.stringify([
    e.eventId,
    e.serviceId,
    e.revision,
    e.period,
    e.studentId,
    e.partnerId,
    e.state,
    e.payment,
    e.studentReviewed,
    e.partnerReviewed,
  ])
}
export function projectServiceEvents(period: string, events: ServiceEventSnapshot[]) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || !Array.isArray(events) || events.length > 100000)
    throw Error('Período ou eventos inválidos.')
  const ids = new Map<string, string>(),
    versions = new Map<string, string>(),
    latest = new Map<string, ServiceEventSnapshot>(),
    owners = new Map<string, string>()
  let duplicates = 0
  for (const e of events) {
    if (
      !e ||
      ['eventId', 'serviceId', 'studentId', 'partnerId'].some(
        (k) =>
          typeof e[k as keyof ServiceEventSnapshot] !== 'string' ||
          !String(e[k as keyof ServiceEventSnapshot]).trim() ||
          String(e[k as keyof ServiceEventSnapshot]).length > 160,
      ) ||
      e.studentId === e.partnerId ||
      !Number.isSafeInteger(e.revision) ||
      e.revision < 1 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(e.period) ||
      !['scheduled', 'completed', 'cancelled'].includes(e.state) ||
      !['pending', 'confirmed', 'disputed', 'refunded'].includes(e.payment) ||
      typeof e.studentReviewed !== 'boolean' ||
      typeof e.partnerReviewed !== 'boolean'
    )
      throw Error('Evento de serviço inválido.')
    const signature = canonical(e),
      seen = ids.get(e.eventId)
    if (seen) {
      if (seen !== signature) throw Error('ID de evento reutilizado com dados diferentes.')
      duplicates++
      continue
    }
    ids.set(e.eventId, signature)
    const owner = JSON.stringify([e.studentId, e.partnerId, e.period]),
      oldOwner = owners.get(e.serviceId)
    if (oldOwner && oldOwner !== owner)
      throw Error('Participantes ou competência alterados; exige conciliação explícita.')
    owners.set(e.serviceId, owner)
    const revisionKey = JSON.stringify([e.serviceId, e.revision])
    if (versions.has(revisionKey)) throw Error('Versão de serviço conflitante.')
    versions.set(revisionKey, signature)
    const prev = latest.get(e.serviceId)
    if (!prev || e.revision > prev.revision) latest.set(e.serviceId, { ...e })
  }
  const counts = new Map<string, number>()
  const services = [...latest.values()]
    .filter((e) => e.period === period)
    .sort((a, b) => (a.serviceId < b.serviceId ? -1 : a.serviceId > b.serviceId ? 1 : 0))
    .map((e) => {
      const reasons: string[] = []
      if (e.state === 'cancelled') reasons.push('Serviço cancelado')
      else if (e.state !== 'completed') reasons.push('Conclusão pendente')
      if (e.payment === 'refunded' || e.payment === 'disputed')
        reasons.push('Estorno ou disputa: conciliação necessária')
      else if (e.payment !== 'confirmed') reasons.push('Pagamento não confirmado')
      if (!e.studentReviewed) reasons.push('Avaliação do aluno pendente')
      if (!e.partnerReviewed) reasons.push('Avaliação do profissional pendente')
      const eligible = reasons.length === 0
      if (eligible)
        for (const id of [e.studentId, e.partnerId]) counts.set(id, (counts.get(id) || 0) + 1)
      return {
        ...e,
        status: eligible
          ? 'eligible_in_simulation'
          : e.payment === 'refunded' || e.payment === 'disputed'
            ? 'reconciliation_required'
            : e.state === 'cancelled'
              ? 'cancelled'
              : 'pending',
        eligible,
        reasons,
      }
    })
  return {
    simulationOnly: true as const,
    paymentAuthorized: false as const,
    pointsWriteAuthorized: false as const,
    period,
    duplicateEventsIgnored: duplicates,
    services,
    participants: [...counts]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([id, eligibleServices]) => ({ id, eligibleServices })),
  }
}

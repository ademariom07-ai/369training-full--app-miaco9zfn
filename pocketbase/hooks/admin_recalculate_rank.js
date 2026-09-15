// Recalculate partner & student ranking on demand (Caminho C - v2)
// Formula: PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
// - Aluno vinculado pontua no plano do profissional
// - Aluno inadimplente sem vínculo sofre downgrade temporário para 0x
// - PRO PARCEIRO: piso de contagem max(serviços reais, pro_parceiro_floor)
routerAdd('POST', '/backend/v1/admin/recalculate_rank', (c) => {
  const users = $app.findRecordsByFilter('users', 'approved = true', '-created', 1000, 0)

  const cycle = new Date().toISOString().slice(0, 7)
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .replace('T', ' ')

  const planMultipliers = {
    gratis: 0,
    basico: 1,
    pro: 2,
    premium: 3,
    pro_parceiro: 1, // Multiplicador de plano 1X para parceiro e aluno vinculado
  }

  const planTarifas = {
    gratis: 1.0,
    basico: 1.0,
    pro: 2.0,
    premium: 3.0,
    pro_parceiro: 2.0,
  }

  let proParceiroFloor = 150
  try {
    const floorRec = $app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
    if (floorRec) {
      const v = floorRec.get('value')
      if (typeof v === 'number') proParceiroFloor = v
    }
  } catch (_) {}

  const scores = []

  for (const u of users) {
    const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
    const role = u.get('role') || 'aluno'
    const isProParceiro = rawPlan === 'pro_parceiro'

    let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
    const linkedProfId = u.get('linked_professional')

    if (role === 'aluno' && linkedProfId) {
      try {
        const profUser = $app.findRecordById('users', linkedProfId)
        const profPlan = (profUser.get('plan') || 'basico').toLowerCase()
        effectiveMultiplier = planMultipliers[profPlan] ?? 1
      } catch (_) {}
    }

    // Regra de inadimplência
    const subStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
    if (
      (subStatus === 'inadimplente' || subStatus === 'cancelada') &&
      !linkedProfId &&
      role === 'aluno'
    ) {
      effectiveMultiplier = 0
    }

    if (effectiveMultiplier === 0 && !isProParceiro) {
      continue
    }

    const serviceFilter =
      role === 'profissional'
        ? `professional = '${u.id}' && status = 'concluido' && created >= '${currentMonthStart}'`
        : `student = '${u.id}' && status = 'concluido' && created >= '${currentMonthStart}'`

    const servicesThisMonth = $app.findRecordsByFilter(
      'services',
      serviceFilter,
      '-created',
      500,
      0,
    )

    let servicesTarifaRS = 0
    for (const svc of servicesThisMonth) {
      let rate = planTarifas[rawPlan] ?? 1.0
      try {
        const txs = $app.findRecordsByFilter(
          'wallet_transactions',
          `reference_id = '${svc.id}' && type = 'tarifa'`,
          '-created',
          1,
          0,
        )
        if (txs && txs.length > 0) {
          rate = Math.abs(Number(txs[0].get('amount') || rate))
        }
      } catch (_) {}
      servicesTarifaRS += rate
    }

    const referralsThisMonth = $app.findRecordsByFilter(
      'referrals',
      `referrer = '${u.id}' && created >= '${currentMonthStart}'`,
      '-created',
      500,
      0,
    )

    const allReferrals = $app.findRecordsByFilter(
      'referrals',
      `referrer = '${u.id}'`,
      '-created',
      500,
      0,
    )

    const realServicesCount = servicesThisMonth.length
    let effectiveServicesCount = realServicesCount
    if (isProParceiro) {
      effectiveServicesCount = Math.max(realServicesCount, proParceiroFloor)
    }

    const indicacoesCount = referralsThisMonth.length
    const totalIndicacoes = allReferrals.length

    const avaliacao = Math.round(Number(u.get('rating_avg') || 5))

    const createdDate = u.get('created') ? new Date(u.get('created')) : new Date()
    const diffMonths = Math.max(
      1,
      Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
    )
    const antiguidade = Math.min(diffMonths, 10)

    const indicacoesFator = Math.max(indicacoesCount, 1)
    const monthlyPoints =
      Math.round(effectiveMultiplier * effectiveServicesCount * indicacoesFator) +
      avaliacao +
      antiguidade

    let closedPastPoints = 0
    try {
      const pastSnapshots = $app.findRecordsByFilter(
        'monthly_rank_snapshots',
        `user = '${u.id}' && cycle != '${cycle}'`,
        '-cycle',
        100,
        0,
      )
      for (const snap of pastSnapshots) {
        closedPastPoints += Number(snap.get('points') || 0)
      }
    } catch (_) {}

    const totalPoints = closedPastPoints + monthlyPoints

    scores.push({
      user: u,
      role,
      plan: rawPlan,
      multiplier: effectiveMultiplier,
      services_count: effectiveServicesCount,
      services_real_count: realServicesCount,
      services_tarifa_rs: servicesTarifaRS,
      referrals_count: totalIndicacoes,
      referrals_this_cycle: indicacoesCount,
      stars: avaliacao,
      antiguidade,
      monthly_points: monthlyPoints,
      closed_past_points: closedPastPoints,
      total_points: totalPoints,
      created: u.get('created'),
    })
  }

  scores.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points
    }
    if (b.stars !== a.stars) {
      return b.stars - a.stars
    }
    return new Date(a.created).getTime() - new Date(b.created).getTime()
  })

  const rankCol = $app.findCollectionByNameOrId('rank_entries')

  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]
    let entry
    try {
      entry = $app.findFirstRecordByData('rank_entries', 'user', s.user.id)
    } catch (_) {
      entry = new Record(rankCol)
    }

    entry.set('user', s.user.id)
    entry.set('cycle', cycle)
    entry.set('points', s.total_points)
    entry.set('services_count', s.services_count)
    entry.set('referrals_count', s.referrals_count)
    entry.set('referrals_this_cycle', s.referrals_this_cycle)
    entry.set('stars', s.stars)
    entry.set('ranking_position', i + 1)
    entry.set('tie_break_details', {
      stars: s.stars,
      antiguidade: s.antiguidade,
      plan_multiplier: s.multiplier,
      monthly_points: s.monthly_points,
      closed_past_points: s.closed_past_points,
      services_count: s.services_count,
      services_real_count: s.services_real_count,
      formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
    })
    $app.save(entry)
  }

  return c.json(200, {
    status: 'ok',
    total_ranked: scores.length,
    cycle,
    message:
      'Ranking recalculado com sucesso conforme fórmula confirmada e suporte a PRO PARCEIRO.',
  })
})

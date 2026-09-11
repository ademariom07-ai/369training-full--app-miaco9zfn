// Cron job to recalculate ranking and execute monthly snapshot & cashback closure on the last day of the month
cronAdd('recalculate_rank', '0 3 * * *', () => {
  const users = $app.findRecordsByFilter('users', 'approved = true', '-created', 1000, 0)

  const now = new Date()
  const cycle = now.toISOString().slice(0, 7) // 'YYYY-MM'
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .replace('T', ' ')

  // Verificar se hoje é o último dia do mês
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isLastDayOfMonth = tomorrow.getDate() === 1

  const planMultipliers = {
    gratis: 0,
    basico: 1,
    pro: 2,
    premium: 3,
  }

  const planTarifas = {
    gratis: 1.0,
    basico: 1.0,
    pro: 2.0,
    premium: 3.0,
  }

  const scores = []

  for (const u of users) {
    const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
    const role = u.get('role') || 'aluno'

    // Regra 3: Plano Grátis = multiplicador 0x → NÃO pontua e NÃO aparece no ranking
    const multiplier = planMultipliers[rawPlan] ?? 0
    if (multiplier === 0) {
      continue
    }

    let effectiveMultiplier = multiplier
    const linkedProfId = u.get('linked_professional')
    const feeMode = u.get('linked_prof_fee_mode') || 'own_plan'
    if (role === 'aluno' && linkedProfId && feeMode === 'prof_sponsored') {
      try {
        const profUser = $app.findRecordById('users', linkedProfId)
        const profPlan = (profUser.get('plan') || 'basico').toLowerCase()
        effectiveMultiplier = planMultipliers[profPlan] ?? 1
      } catch (_) {}
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

    // SOMA EM R$ DAS TARIFAS DOS SERVIÇOS CONCLUÍDOS
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

    const servicosCount = servicesThisMonth.length
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
    // NOVA REGRA (Tarefa 6): PONTOS = (PLANO) × (SERVIÇOS — contagem) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
    const monthlyPoints =
      Math.round(effectiveMultiplier * servicosCount * indicacoesFator) + avaliacao + antiguidade

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
      services_count: servicosCount,
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

  // Ordenação
  scores.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points
    }
    if (b.stars !== a.stars) {
      return b.stars - a.stars
    }
    return new Date(a.created).getTime() - new Date(b.created).getTime()
  })

  // Salvar rank_entries atual
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
      formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
    })
    $app.save(entry)
  }

  // SE HOJE FOR O ÚLTIMO DIA DO MÊS: Salvar snapshot mensal e fechar o ciclo
  if (isLastDayOfMonth) {
    try {
      const snapCol = $app.findCollectionByNameOrId('monthly_rank_snapshots')
      for (let i = 0; i < scores.length; i++) {
        const s = scores[i]
        let snap
        try {
          snap = $app.findRecordsByFilter(
            'monthly_rank_snapshots',
            `user = '${s.user.id}' && cycle = '${cycle}'`,
            '-created',
            1,
            0,
          )[0]
        } catch (_) {}

        if (!snap) {
          snap = new Record(snapCol)
        }

        snap.set('user', s.user.id)
        snap.set('cycle', cycle)
        snap.set('points', s.monthly_points)
        snap.set('services_count', s.services_count)
        snap.set('referrals_count', s.referrals_this_cycle)
        snap.set('stars', s.stars)
        snap.set('antiguidade', s.antiguidade)
        snap.set('ranking_position', i + 1)
        snap.set('plan', s.plan)
        snap.set('closed_at', now.toISOString())
        snap.set('details', {
          multiplier: s.multiplier,
          monthly_points: s.monthly_points,
          total_cumulative_points: s.total_points,
          services_tarifa_rs: s.services_tarifa_rs,
        })
        $app.save(snap)
      }
      console.log(`Snapshot mensal do ciclo ${cycle} salvo com sucesso no fechamento do mês.`)
    } catch (err) {
      console.error('Erro ao registrar snapshot mensal no fechamento:', err)
    }
  }
})

// Recalculate partner & student ranking on demand (Caminho C)
// Formula: PONTOS = (PLANO) × (SERVIÇOS EM R$) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
// - PLANO = multiplicador do plano: Grátis 0x / Básico 1x / Pro 2x / Premium 3x
// - Aluno ou profissional no plano Grátis (multiplicador 0x) NÃO pontua e NÃO aparece no ranking
// - SERVIÇOS (R$) = soma em R$ das tarifas dos serviços concluídos (Básico R$1, Pro R$2, Premium R$3)
// - Snapshots mensais fechados são somados à pontuação do mês vigente
routerAdd('POST', '/backend/v1/admin/recalculate_rank', (c) => {
  const users = $app.findRecordsByFilter('users', 'approved = true', '-created', 1000, 0)

  const cycle = new Date().toISOString().slice(0, 7)
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .replace('T', ' ')

  // Multiplicadores confirmados do Caminho C
  const planMultipliers = {
    gratis: 0,
    basico: 1,
    pro: 2,
    premium: 3,
  }

  // Tarifas em R$ por plano
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

    // Regra de vínculo com profissional para alunos:
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

    // Serviços validados no mês corrente
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
    // Tarifa do plano do usuário: Básico R$1, Pro R$2, Premium R$3
    let servicesTarifaRS = 0
    for (const svc of servicesThisMonth) {
      // Se houver transação registrada na carteira para o serviço, busca o valor absoluto da tarifa
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

    // Indicações validadas no mês corrente (status = 'validated' ou created no mês)
    const referralsThisMonth = $app.findRecordsByFilter(
      'referrals',
      `referrer = '${u.id}' && created >= '${currentMonthStart}'`,
      '-created',
      500,
      0,
    )

    // Total de indicações históricas
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

    // Avaliação (ex: 1 a 5)
    const avaliacao = Math.round(Number(u.get('rating_avg') || 5))

    // Antiguidade (ex: meses na plataforma, min 1)
    const createdDate = u.get('created') ? new Date(u.get('created')) : new Date()
    const diffMonths = Math.max(
      1,
      Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
    )
    const antiguidade = Math.min(diffMonths, 10)

    // Fórmula: PONTOS = PLANO × SERVIÇOS (R$) × INDICAÇÕES + AVALIAÇÃO + ANTIGUIDADE
    // Observação: se indicações no mês for 0, usa base 1 para não anular a multiplicação
    const indicacoesFator = Math.max(indicacoesCount, 1)
    const monthlyPoints =
      Math.round(effectiveMultiplier * servicesTarifaRS * indicacoesFator) + avaliacao + antiguidade

    // Snapshots anteriores
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

  // Ordenação do Ranking: 1º Pontos Totais, 2º Avaliação, 3º Antiguidade
  scores.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points
    }
    if (b.stars !== a.stars) {
      return b.stars - a.stars
    }
    return new Date(a.created).getTime() - new Date(b.created).getTime()
  })

  // Salvar na coleção rank_entries
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
      services_tarifa_rs: s.services_tarifa_rs,
      formula: 'PONTOS = (PLANO) × (SERVIÇOS R$) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
    })
    $app.save(entry)
  }

  return c.json(200, {
    status: 'ok',
    total_ranked: scores.length,
    cycle,
    message:
      'Ranking recalculado com sucesso conforme fórmula do Caminho C (PLANO × SERVIÇOS R$ × INDICAÇÕES + AVALIAÇÃO + ANTIGUIDADE).',
  })
})

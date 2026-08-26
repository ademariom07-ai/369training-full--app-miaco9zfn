// Recalculate partner ranking periodically and store historical snapshots
// Formula: pontos = tarifa × servicos × max(indicacoes_ciclo, 1)
// Recurso 1: As indicações (referrals_this_cycle) são contabilizadas APENAS do ciclo atual (últimos 30 dias).
// referrals_count mantém o total histórico.
cronAdd('recalculate_rank', '0 3 * * *', () => {
  const users = $app.findRecordsByFilter(
    'users',
    "role = 'profissional' && approved = true",
    '-created',
    500,
    0,
  )

  const cycle = new Date().toISOString().slice(0, 7) // '2025-05'
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')

  // Tarifas fixas por plano em R$
  const tarifaPorPlano = {
    gratis: 4.0,
    basico: 1.0,
    pro: 2.0,
    premium: 3.0,
  }

  const scores = []

  for (const u of users) {
    const services = $app.findRecordsByFilter(
      'services',
      `professional = '${u.id}' && status = 'concluido'`,
      '-created',
      500,
      0,
    )

    // Contar indicações totais (histórico)
    const allReferrals = $app.findRecordsByFilter(
      'referrals',
      `referrer = '${u.id}'`,
      '-created',
      500,
      0,
    )

    // Contar indicações apenas do ciclo atual (últimos 30 dias)
    const referralsThisCycle = $app.findRecordsByFilter(
      'referrals',
      `referrer = '${u.id}' && created >= '${thirtyDaysAgo}'`,
      '-created',
      500,
      0,
    )

    const userPlan = (u.get('plan') || 'gratis').toLowerCase()
    const tarifa = tarifaPorPlano[userPlan] ?? 4.0
    const servicosCount = services.length
    const totalIndicacoes = allReferrals.length
    const indicacoesCiclo = referralsThisCycle.length

    // Fórmula 369: pontos = tarifa * servicos * max(indicacoes_ciclo, 1)
    const multiplier = Math.max(indicacoesCiclo, 1)
    const points = Math.round(tarifa * servicosCount * multiplier)

    scores.push({
      user: u,
      points,
      services_count: servicosCount,
      referrals_count: totalIndicacoes,
      referrals_this_cycle: indicacoesCiclo,
      stars: u.get('rating_avg') || 5.0,
      created: u.get('created'),
    })
  }

  // Desempate: 1º Pontos, 2º Avaliação (stars), 3º Antiguidade (created mais antigo)
  scores.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }
    if (b.stars !== a.stars) {
      return b.stars - a.stars
    }
    return new Date(a.created).getTime() - new Date(b.created).getTime()
  })

  // Save ranking
  const rankCol = $app.findCollectionByNameOrId('rank_entries')
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]
    let entry
    try {
      entry = $app.findFirstRecordByData('rank_entries', 'user', s.user.id)
    } catch (_) {
      entry = new Record(rankCol)
    }

    const createdTime = s.created ? new Date(s.created).getTime() : Date.now()
    const seniorityDays = Math.max(
      0,
      Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24)),
    )

    entry.set('user', s.user.id)
    entry.set('cycle', cycle)
    entry.set('points', s.points)
    entry.set('services_count', s.services_count)
    entry.set('referrals_count', s.referrals_count)
    entry.set('referrals_this_cycle', s.referrals_this_cycle)
    entry.set('stars', s.stars)
    entry.set('ranking_position', i + 1)
    entry.set('tie_break_details', {
      stars: s.stars,
      seniority_days: seniorityDays,
      account_age: seniorityDays,
      cycle_days: 30,
      referrals_cycle_used: s.referrals_this_cycle,
    })
    $app.save(entry)
  }
})

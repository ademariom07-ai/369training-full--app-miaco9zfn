// Hook triggered whenever a service review is submitted
// Regras de Produto:
// 1. Quando uma avaliação mútua é criada (service_reviews):
//    - O serviço correspondente tem o estado de validação atualizado:
//      * 1ª avaliação recebida: valida o serviço (validated = true, validation_status = 'validada', validated_at = now)
//      * Se já houver 2 avaliações (profissional e aluno): validation_status = 'totalmente_validada'
//    - Atualiza rating_avg do usuário avaliado (reviewee)
//    - Dispara recálculo instantâneo do ranking (já que a aula agora está validada para efeito de coeficiente de pontuação!)

onRecordAfterCreateSuccess((e) => {
  const review = e.record
  const serviceId = review.get('service')
  const reviewerId = review.get('reviewer')
  const revieweeId = review.get('reviewee')
  const rating = Number(review.get('rating') || 5)

  if (!serviceId) return

  // 1. Atualizar o serviço (validação)
  try {
    const service = $app.findRecordById('services', serviceId)
    if (service) {
      // Contar avaliações deste serviço
      const allReviewsForService = $app.findRecordsByFilter(
        'service_reviews',
        `service = '${serviceId}'`,
        '-created',
        10,
        0,
      )

      const reviewCount = allReviewsForService.length
      service.set('validated', true)
      if (!service.get('validated_at')) {
        service.set('validated_at', new Date().toISOString().replace('T', ' '))
      }

      if (reviewCount >= 2) {
        service.set('validation_status', 'totalmente_validada')
      } else {
        service.set('validation_status', 'validada')
      }

      $app.save(service)
    }
  } catch (errService) {
    console.error('Erro ao atualizar validação do serviço pós-avaliação:', errService)
  }

  // 2. Atualizar rating_avg do reviewee
  if (revieweeId) {
    try {
      const allReviewsForReviewee = $app.findRecordsByFilter(
        'service_reviews',
        `reviewee = '${revieweeId}'`,
        '-created',
        500,
        0,
      )
      if (allReviewsForReviewee && allReviewsForReviewee.length > 0) {
        let sum = 0
        for (const r of allReviewsForReviewee) {
          sum += Number(r.get('rating') || 5)
        }
        const avg = parseFloat((sum / allReviewsForReviewee.length).toFixed(2))
        const revieweeUser = $app.findRecordById('users', revieweeId)
        if (revieweeUser) {
          revieweeUser.set('rating_avg', avg)
          $app.save(revieweeUser)
        }
      }
    } catch (errRating) {
      console.warn('Erro ao atualizar rating_avg do usuário avaliado:', errRating)
    }
  }

  // 3. RECÁLCULO INSTANTÂNEO DO RANKING APÓS SERVIÇO VALIDADO
  try {
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
      pro_parceiro: 1,
    }

    const planTarifas = {
      gratis: 1.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
      pro_parceiro: 0.0,
    }

    const proParceiroCap = 150 // Approved 2026-10-07; old floor config cannot override it.

    const scores = []

    for (const u of users) {
      const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
      const role = u.get('role') || 'aluno'
      const isProParceiro = rawPlan === 'pro_parceiro'
      const isPartnerGratis = role === 'profissional' && rawPlan === 'gratis'

      let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
      if (isPartnerGratis) {
        effectiveMultiplier = planMultipliers['basico'] ?? 1
      }
      const linkedProf = u.get('linked_professional')

      if (role === 'aluno' && linkedProf) {
        try {
          const pUser = $app.findRecordById('users', linkedProf)
          const pPlan = (pUser.get('plan') || 'basico').toLowerCase()
          effectiveMultiplier = planMultipliers[pPlan] ?? 1
        } catch (_) {}
      }

      const subStatus = u.get('subscription_status') || 'ativa'
      if (subStatus === 'inadimplente' || subStatus === 'cancelada') {
        if (role === 'aluno' && !linkedProf) {
          effectiveMultiplier = 0
        }
      }

      if (effectiveMultiplier === 0 && !isProParceiro) {
        continue
      }

      // IMPORTANTE: apenas serviços CONCLUÍDOS e VALIDADOS pela avaliação mútua!
      const serviceFilter =
        role === 'profissional'
          ? `professional = '${u.id}' && status = 'concluido' && validated = true && created >= '${currentMonthStart}'`
          : `student = '${u.id}' && status = 'concluido' && validated = true && created >= '${currentMonthStart}'`

      const rawServicesThisMonth = $app.findRecordsByFilter(
        'services',
        serviceFilter,
        '-created',
        500,
        0,
      )

      const servicesThisMonth = rawServicesThisMonth.filter((svcItem) => {
        const p = svcItem.get('professional')
        const t = (svcItem.get('type') || '').toLowerCase()
        const isWorkoutType =
          t === 'treino_ia' ||
          t === 'treino' ||
          t.indexOf('treino') !== -1 ||
          t.indexOf('workout') !== -1
        if (isWorkoutType && (!p || p === '')) {
          return false
        }
        return true
      })

      let servicesTarifaRS = 0
      for (const svcItem of servicesThisMonth) {
        let r = planTarifas[rawPlan] ?? 1.0
        try {
          const txs = $app.findRecordsByFilter(
            'wallet_transactions',
            `reference_id = '${svcItem.id}' && type = 'tarifa'`,
            '-created',
            1,
            0,
          )
          if (txs && txs.length > 0) {
            r = Math.abs(Number(txs[0].get('amount') || r))
          }
        } catch (_) {}
        servicesTarifaRS += r
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

      let realServicesCount = servicesThisMonth.length
      let effectiveServicesCount = realServicesCount
      if (isProParceiro) {
        effectiveServicesCount = Math.min(realServicesCount, proParceiroCap)
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
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      if (b.stars !== a.stars) return b.stars - a.stars
      return new Date(a.created).getTime() - new Date(b.created).getTime()
    })

    const rankCol = $app.findCollectionByNameOrId('rank_entries')
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i]
      let entry

      const existingEntries = $app.findRecordsByFilter(
        'rank_entries',
        `user = '${s.user.id}'`,
        '-created',
        500,
        0,
      )

      if (existingEntries && existingEntries.length > 0) {
        entry = existingEntries[0]
        for (let k = 1; k < existingEntries.length; k++) {
          try {
            $app.delete(existingEntries[k])
          } catch (_) {}
        }
      } else {
        entry = new Record(rankCol)
      }

      const tieBreakDetails = {
        stars: s.stars,
        antiguidade: s.antiguidade,
        plan_multiplier: s.multiplier,
        monthly_points: s.monthly_points,
        closed_past_points: s.closed_past_points,
        services_count: s.services_count,
        services_real_count: s.services_real_count,
        formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
      }
      if (s.role === 'profissional' && s.plan === 'gratis') {
        tieBreakDetails.plan_effective = 'basico_gratis'
      }

      entry.set('user', s.user.id)
      entry.set('cycle', cycle)
      entry.set('points', s.total_points)
      entry.set('services_count', s.services_count)
      entry.set('referrals_count', s.referrals_count)
      entry.set('referrals_this_cycle', s.referrals_this_cycle)
      entry.set('stars', s.stars)
      entry.set('ranking_position', i + 1)
      entry.set('tie_break_details', tieBreakDetails)
      $app.save(entry)
    }

    try {
      const oldEntries = $app.findRecordsByFilter(
        'rank_entries',
        `cycle != '${cycle}'`,
        '-created',
        1000,
        0,
      )
      for (const oldRec of oldEntries) {
        try {
          $app.delete(oldRec)
        } catch (_) {}
      }
    } catch (_) {}
  } catch (errRank) {
    console.error('Erro no recálculo instantâneo do ranking pós-avaliação:', errRank)
  }
}, 'service_reviews')

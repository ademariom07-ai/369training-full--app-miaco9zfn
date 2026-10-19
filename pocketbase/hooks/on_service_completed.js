// Hook triggered whenever a service status changes to 'concluido' or is created already 'concluido'
// HOTFIX 369 v2:
// 1. Débito de tarifa: PRO PARCEIRO paga R$ 0 de tarifa por serviço (apenas o fixo de R$ 149/mês).
//    Legacy immediate debits removed: settlement adapter must confirm all prerequisites.
// 2. Anti-duplicidade na tarifa: wallet_transactions já com reference_id = service.id && type = 'tarifa'.
// 3. PRO PARCEIRO: 150 fixos para pontuação, peso 2; volume real preservado.
// 4. Grátis retains rating/seniority with plan multiplier zero; no automatic inheritance.

onRecordAfterUpdateSuccess((e) => {
  const service = e.record
  const oldStatus = e.oldRecord ? e.oldRecord.get('status') : ''
  const newStatus = service.get('status')

  if (newStatus !== 'concluido' || oldStatus === 'concluido') {
    return
  }

  const profId = service.get('professional')
  const studentId = service.get('student')

  // Financial release is deferred to authenticated settlement after payment,
  // completion and mutual reviews. Status alone must never debit a tariff.
  // No automatic service-fee writes until that adapter is homologated.

  // 2. VALIDAÇÃO DE INDICAÇÃO E BÔNUS DE REFERRAL
  try {
    let minServicesToValidate = 5
    try {
      const configRec = $app.findFirstRecordByData(
        'platform_config',
        'key',
        'min_services_to_validate_referral',
      )
      if (configRec) {
        const val = configRec.get('value')
        if (typeof val === 'number') minServicesToValidate = val
        else if (typeof val === 'string' && !isNaN(Number(val))) minServicesToValidate = Number(val)
      }
    } catch (_) {}

    if (studentId) {
      let referralRecord = null
      try {
        referralRecord = $app.findFirstRecordByData('referrals', 'referred', studentId)
      } catch (_) {}

      if (referralRecord) {
        const completedServices = $app.findRecordsByFilter(
          'services',
          `student = '${studentId}' && status = 'concluido'`,
          '-created',
          500,
          0,
        )

        const currentCount = completedServices.length
        referralRecord.set('services_count', currentCount)

        if (currentCount >= minServicesToValidate) {
          referralRecord.set('status', 'validated')
          if (!referralRecord.get('referral_bonus_paid')) {
            referralRecord.set('validated_at', new Date().toISOString().replace('T', ' '))
            referralRecord.set('referral_bonus_paid', true)
          }
        } else {
          if (!referralRecord.get('status')) {
            referralRecord.set('status', 'pending')
          }
        }
        $app.save(referralRecord)
      }
    }
  } catch (err) {
    console.error('Erro ao validar indicação:', err)
  }

  // 3. RECÁLCULO INSTANTÂNEO DO RANKING APÓS SERVIÇO CONCLUÍDO
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
      pro_parceiro: 2,
    }

    const planTarifas = {
      gratis: 0.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
      pro_parceiro: 0.0,
    }

    const proParceiroFixedServices = 150 // Confirmed 2026-10-19: scoring only, not real service volume.

    const scores = []

    for (const u of users) {
      const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
      const role = u.get('role') || 'aluno'
      const isProParceiro = role === 'profissional' && rawPlan === 'pro_parceiro'
      // Own plan only: a link does not prove historical sponsorship.
      let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
      const subStatus = u.get('subscription_status') || 'ativa'
      if (subStatus === 'inadimplente' || subStatus === 'cancelada') {
        if (role === 'aluno') {
          effectiveMultiplier = 0
        }
      }

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

      // Regra: treino sem o acompanhamento do profissional não pontua no ranking.
      // Registros de serviços de treino sem professional associado (ex: treino_ia auto-concluído) não contam.
      const servicesThisMonth = rawServicesThisMonth.filter((svc) => {
        const p = svc.get('professional')
        const t = (svc.get('type') || '').toLowerCase()
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
      for (const svc of servicesThisMonth) {
        let r = planTarifas[rawPlan] ?? 1.0
        try {
          const txs = $app.findRecordsByFilter(
            'wallet_transactions',
            `reference_id = '${svc.id}' && type = 'tarifa'`,
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
      // TETO de serviços do PRO PARCEIRO: Math.min(servicos_reais, 150)
      let effectiveServicesCount = realServicesCount
      if (isProParceiro) {
        effectiveServicesCount = proParceiroFixedServices
      }

      const indicacoesCount = referralsThisMonth.length
      const totalIndicacoes = allReferrals.length

      const ratingValue = u.get('rating_avg') ?? 5
      if (typeof ratingValue !== 'number' || !Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 5) {
        throw new Error('Avaliação fora do intervalo permitido; recálculo interrompido.')
      }
      const avaliacao = ratingValue
      const rawCreated = u.get('created')
      // PocketBase stores UTC; count completed calendar months, clamping month-end anniversaries.
      const normalizedCreated = typeof rawCreated === 'string' ? rawCreated.replace(' ', 'T') : ''
      const createdDate = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedCreated) ? normalizedCreated : normalizedCreated + 'Z')
      if (!Number.isFinite(createdDate.getTime()) || createdDate.getTime() > now.getTime()) {
        throw new Error('Data de cadastro inválida; recálculo interrompido.')
      }
      let diffMonths = (now.getUTCFullYear() - createdDate.getUTCFullYear()) * 12 + now.getUTCMonth() - createdDate.getUTCMonth()
      const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
      const anniversary = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(createdDate.getUTCDate(), lastDay), createdDate.getUTCHours(), createdDate.getUTCMinutes(), createdDate.getUTCSeconds(), createdDate.getUTCMilliseconds())
      if (now.getTime() < anniversary) diffMonths--
      const antiguidade = Math.max(diffMonths, 1)

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
      const joined = new Date(a.created).getTime() - new Date(b.created).getTime()
      return joined || (a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0)
    })

    const rankCol = $app.findCollectionByNameOrId('rank_entries')
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i]
      let entry

      // Buscar todas as entradas existentes do usuário
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
        tieBreakDetails.plan_effective = 'gratis'
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

    // Limpeza de segurança: remover quaisquer entradas órfãs de ciclos anteriores
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
  } catch (err) {
    console.error('Erro no recálculo instantâneo do ranking:', err)
  }
}, 'services')

// Blindagem: também processar débito/validação quando serviço for criado já com status 'concluido'
onRecordAfterCreateSuccess((e) => {
  const service = e.record
  const status = service.get('status')
  if (status !== 'concluido') {
    return
  }

  const profId = service.get('professional')
  if (!profId) {
    return
  }

  // Financial release is deferred to authenticated settlement after payment,
  // completion and mutual reviews. Status alone must never debit a tariff.
  // No automatic service-fee writes until that adapter is homologated.

  // 2. RECÁLCULO INSTANTÂNEO DO RANKING APÓS SERVIÇO CRIADO COMO CONCLUÍDO
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
      pro_parceiro: 2,
    }

    const planTarifas = {
      gratis: 0.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
      pro_parceiro: 0.0,
    }

    const proParceiroFixedServices = 150 // Confirmed 2026-10-19: scoring only, not real service volume.

    const scores = []

    for (const u of users) {
      const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
      const role = u.get('role') || 'aluno'
      const isProParceiro = role === 'profissional' && rawPlan === 'pro_parceiro'
      // Own plan only: a link does not prove historical sponsorship.
      let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
      const subStatus = u.get('subscription_status') || 'ativa'
      if (subStatus === 'inadimplente' || subStatus === 'cancelada') {
        if (role === 'aluno') {
          effectiveMultiplier = 0
        }
      }

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
        effectiveServicesCount = proParceiroFixedServices
      }

      const indicacoesCount = referralsThisMonth.length
      const totalIndicacoes = allReferrals.length

      const ratingValue = u.get('rating_avg') ?? 5
      if (typeof ratingValue !== 'number' || !Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 5) {
        throw new Error('Avaliação fora do intervalo permitido; recálculo interrompido.')
      }
      const avaliacao = ratingValue
      const rawCreated = u.get('created')
      // PocketBase stores UTC; count completed calendar months, clamping month-end anniversaries.
      const normalizedCreated = typeof rawCreated === 'string' ? rawCreated.replace(' ', 'T') : ''
      const createdDate = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedCreated) ? normalizedCreated : normalizedCreated + 'Z')
      if (!Number.isFinite(createdDate.getTime()) || createdDate.getTime() > now.getTime()) {
        throw new Error('Data de cadastro inválida; recálculo interrompido.')
      }
      let diffMonths = (now.getUTCFullYear() - createdDate.getUTCFullYear()) * 12 + now.getUTCMonth() - createdDate.getUTCMonth()
      const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
      const anniversary = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(createdDate.getUTCDate(), lastDay), createdDate.getUTCHours(), createdDate.getUTCMinutes(), createdDate.getUTCSeconds(), createdDate.getUTCMilliseconds())
      if (now.getTime() < anniversary) diffMonths--
      const antiguidade = Math.max(diffMonths, 1)

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
      const joined = new Date(a.created).getTime() - new Date(b.created).getTime()
      return joined || (a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0)
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
        tieBreakDetails.plan_effective = 'gratis'
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
    console.error('Erro no recálculo instantâneo do ranking no create:', errRank)
  }
}, 'services')

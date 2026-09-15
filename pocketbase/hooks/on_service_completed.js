// Hook triggered whenever a service status changes to 'concluido'
// 1. Debitar tarifa do serviço SEMPRE DO PROFISSIONAL (v2: R$ 1/2/3 por serviço ou R$ 2 no pro_parceiro)
// 2. Validar indicação se o aluno atingiu o mínimo de serviços
// 3. RECÁLCULO INSTANTÂNEO DO RANKING (com suporte a pro_parceiro floor e planos v2)
onRecordAfterUpdateSuccess((e) => {
  const service = e.record
  const oldStatus = e.oldRecord ? e.oldRecord.get('status') : ''
  const newStatus = service.get('status')

  if (newStatus !== 'concluido' || oldStatus === 'concluido') {
    return
  }

  const profId = service.get('professional')
  const studentId = service.get('student')

  // 1. DÉBITO DA TARIFA DE SERVIÇO: SEMPRE debitar do profissional (removido modo own_plan do aluno)
  try {
    const prof = $app.findRecordById('users', profId)
    const profPlan = (prof.get('plan') || 'basico').toLowerCase()

    let rate = 1.0
    if (profPlan === 'pro') rate = 2.0
    if (profPlan === 'premium') rate = 3.0
    if (profPlan === 'pro_parceiro') rate = 2.0 // Tarifa por serviço continua R$ 2,00 no pro_parceiro

    const payerUserId = profId // Tarifa SEMPRE debitada do profissional

    const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
    const feeTx = new Record(walletCol)
    feeTx.set('user', payerUserId)
    feeTx.set('type', 'tarifa')
    feeTx.set('amount', -rate)
    feeTx.set('status', 'concluido')
    feeTx.set('reference_type', 'service')
    feeTx.set('reference_id', service.id)
    feeTx.set(
      'description',
      `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${service.id.slice(0, 6)}`,
    )
    $app.save(feeTx)
  } catch (err) {
    console.error('Erro ao debitar tarifa de serviço:', err)
  }

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
      gratis: 1.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
      pro_parceiro: 2.0,
    }

    let proParceiroFloor = 10
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

      // Aluno com vínculo ativo pontua no plano do profissional
      let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
      const linkedProf = u.get('linked_professional')

      if (role === 'aluno' && linkedProf) {
        try {
          const pUser = $app.findRecordById('users', linkedProf)
          const pPlan = (pUser.get('plan') || 'basico').toLowerCase()
          effectiveMultiplier = planMultipliers[pPlan] ?? 1
        } catch (_) {}
      }

      // Regra de Inadimplência: se assinatura estiver inadimplente, downgrade temporário para Grátis (0x)
      const subStatus = u.get('subscription_status') || 'ativa'
      if (subStatus === 'inadimplente' || subStatus === 'cancelada') {
        if (role === 'aluno' && !linkedProf) {
          effectiveMultiplier = 0
        }
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
      // Para PRO PARCEIRO: piso de pontuação max(servicos_reais, piso_fixo)
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
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      if (b.stars !== a.stars) return b.stars - a.stars
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
  } catch (err) {
    console.error('Erro no recálculo instantâneo do ranking:', err)
  }
}, 'services')

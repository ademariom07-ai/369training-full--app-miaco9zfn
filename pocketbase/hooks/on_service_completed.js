// Hook triggered whenever a service status changes to 'concluido' or is created already 'concluido'
// HOTFIX 369 v2:
// 1. Débito de tarifa: PRO PARCEIRO paga R$ 0 de tarifa por serviço (apenas o fixo de R$ 149/mês).
//    Planos: basico R$ 1, pro R$ 2, premium R$ 3, pro_parceiro R$ 0, gratis R$ 1.
// 2. Anti-duplicidade na tarifa: wallet_transactions já com reference_id = service.id && type = 'tarifa'.
// 3. Teto do PRO PARCEIRO: Math.min(realServicesCount, proParceiroFloor) (teto de 150).
// 4. Parceiro Grátis: pontua como Básico (1x), sem cashback, tie_break com plan_effective = 'basico_gratis'.

onRecordAfterUpdateSuccess((e) => {
  const service = e.record
  const oldStatus = e.oldRecord ? e.oldRecord.get('status') : ''
  const newStatus = service.get('status')

  if (newStatus !== 'concluido' || oldStatus === 'concluido') {
    return
  }

  const profId = service.get('professional')
  const studentId = service.get('student')

  // Função interna de débito de tarifa com verificação anti-duplicidade e isenção do PRO PARCEIRO
  const debitServiceFee = (svc, professionalId) => {
    if (!professionalId) return
    try {
      // Blindagem anti-duplicidade via findRecordsByFilter (compatível com Goja sem erros de ponteiro)
      let existingTxs = []
      try {
        existingTxs = $app.findRecordsByFilter(
          'wallet_transactions',
          `reference_id = '${svc.id}' && type = 'tarifa'`,
          '-created',
          1,
          0,
        )
      } catch (checkErr) {
        console.warn('Aviso ao verificar duplicidade de tarifa:', checkErr)
      }

      if (existingTxs && existingTxs.length > 0) {
        return // Já debitado previamente (anti-duplicidade)
      }

      let prof = null
      try {
        prof = $app.findRecordById('users', professionalId)
      } catch (profErr) {
        console.warn('Aviso ao buscar profissional para tarifa:', profErr)
      }

      const profPlan = prof ? (prof.get('plan') || 'basico').toLowerCase() : 'basico'

      // PRO PARCEIRO paga apenas o fixo de R$ 149/mês — SEM tarifa por serviço
      if (profPlan === 'pro_parceiro') {
        return
      }

      let rate = 1.0
      if (profPlan === 'pro') rate = 2.0
      if (profPlan === 'premium') rate = 3.0
      if (profPlan === 'basico' || profPlan === 'gratis') rate = 1.0

      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
      const feeTx = new Record(walletCol)
      feeTx.set('user', professionalId)
      feeTx.set('type', 'tarifa')
      feeTx.set('amount', -rate)
      feeTx.set('status', 'concluido')
      feeTx.set('reference_type', 'service')
      feeTx.set('reference_id', svc.id)
      feeTx.set(
        'description',
        `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${svc.id.slice(0, 6)}`,
      )
      $app.save(feeTx)
    } catch (err) {
      console.error('Erro ao debitar tarifa de serviço:', err)
    }
  }

  // 1. DÉBITO DA TARIFA DE SERVIÇO
  try {
    debitServiceFee(service, profId)
  } catch (errFee) {
    console.error('Erro na etapa de débito de tarifa:', errFee)
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
      pro_parceiro: 1,
    }

    const planTarifas = {
      gratis: 1.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
      pro_parceiro: 0.0,
    }

    let proParceiroFloor = 150
    try {
      const floorRec = $app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
      if (floorRec) {
        const v = floorRec.get('value')
        if (typeof v === 'number') proParceiroFloor = v
        else if (typeof v === 'string' && !isNaN(Number(v))) proParceiroFloor = Number(v)
      }
    } catch (_) {}

    const scores = []

    for (const u of users) {
      const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
      const role = u.get('role') || 'aluno'
      const isProParceiro = rawPlan === 'pro_parceiro'
      const isPartnerGratis = role === 'profissional' && rawPlan === 'gratis'

      // Aluno com vínculo ativo pontua no plano do profissional
      let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
      if (isPartnerGratis) {
        effectiveMultiplier = planMultipliers['basico'] ?? 1 // 1x — parceiro grátis pontua como Básico
      }
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
        effectiveServicesCount = Math.min(realServicesCount, proParceiroFloor)
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

  // Função interna de débito de tarifa com verificação anti-duplicidade e isenção do PRO PARCEIRO
  const debitServiceFee = (svc, professionalId) => {
    if (!professionalId) return
    try {
      // Blindagem anti-duplicidade via findRecordsByFilter (compatível com Goja sem erros de ponteiro)
      let existingTxs = []
      try {
        existingTxs = $app.findRecordsByFilter(
          'wallet_transactions',
          `reference_id = '${svc.id}' && type = 'tarifa'`,
          '-created',
          1,
          0,
        )
      } catch (checkErr) {
        console.warn('Aviso ao verificar duplicidade de tarifa no create:', checkErr)
      }

      if (existingTxs && existingTxs.length > 0) {
        return // Já debitado previamente (anti-duplicidade)
      }

      let prof = null
      try {
        prof = $app.findRecordById('users', professionalId)
      } catch (profErr) {
        console.warn('Aviso ao buscar profissional para tarifa no create:', profErr)
      }

      const profPlan = prof ? (prof.get('plan') || 'basico').toLowerCase() : 'basico'

      // PRO PARCEIRO paga apenas o fixo de R$ 149/mês — SEM tarifa por serviço
      if (profPlan === 'pro_parceiro') {
        return
      }

      let rate = 1.0
      if (profPlan === 'pro') rate = 2.0
      if (profPlan === 'premium') rate = 3.0
      if (profPlan === 'basico' || profPlan === 'gratis') rate = 1.0

      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
      const feeTx = new Record(walletCol)
      feeTx.set('user', professionalId)
      feeTx.set('type', 'tarifa')
      feeTx.set('amount', -rate)
      feeTx.set('status', 'concluido')
      feeTx.set('reference_type', 'service')
      feeTx.set('reference_id', svc.id)
      feeTx.set(
        'description',
        `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${svc.id.slice(0, 6)}`,
      )
      $app.save(feeTx)
    } catch (err) {
      console.error('Erro ao debitar tarifa de serviço:', err)
    }
  }

  // 1. DÉBITO DA TARIFA DE SERVIÇO
  try {
    debitServiceFee(service, profId)
  } catch (errFee) {
    console.error('Erro na etapa de débito de tarifa no create:', errFee)
  }

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
      pro_parceiro: 1,
    }

    const planTarifas = {
      gratis: 1.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
      pro_parceiro: 0.0,
    }

    let proParceiroFloor = 150
    try {
      const floorRec = $app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
      if (floorRec) {
        const v = floorRec.get('value')
        if (typeof v === 'number') proParceiroFloor = v
        else if (typeof v === 'string' && !isNaN(Number(v))) proParceiroFloor = Number(v)
      }
    } catch (_) {}

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
        effectiveServicesCount = Math.min(realServicesCount, proParceiroFloor)
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
    console.error('Erro no recálculo instantâneo do ranking no create:', errRank)
  }
}, 'services')

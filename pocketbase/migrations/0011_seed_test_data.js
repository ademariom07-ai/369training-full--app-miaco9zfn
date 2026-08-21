migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const referralsCol = app.findCollectionByNameOrId('referrals')
    const servicesCol = app.findCollectionByNameOrId('services')
    const rankCol = app.findCollectionByNameOrId('rank_entries')
    const cbDistCol = app.findCollectionByNameOrId('cashback_distributions')
    const walletCol = app.findCollectionByNameOrId('wallet_transactions')
    const notifCol = app.findCollectionByNameOrId('notifications')

    // -------------------------------------------------------------
    // 1. APROVAR os 3 profissionais pendentes:
    // Marina (iinwtaqpu07h9a8), Lais T (gaqtq4psh10w2ot), Lais M (fu5ncan3b8fd0w2)
    // -------------------------------------------------------------
    const pendingProfIds = ['iinwtaqpu07h9a8', 'gaqtq4psh10w2ot', 'fu5ncan3b8fd0w2']
    for (const profId of pendingProfIds) {
      try {
        const profRecord = app.findRecordById('users', profId)
        profRecord.set('approved', true)
        app.save(profRecord)
      } catch (e) {
        console.log('Erro ao aprovar profissional ' + profId + ':', e ? e.message : '')
      }
    }

    // -------------------------------------------------------------
    // 2. CRIAR REFERRALS (árvore binária):
    // Carlos (vhvun6ujx1esr19) é a RAIZ (nível 1, posição 1)
    // Carlos indicou Marina (iinwtaqpu07h9a8) -> lado esquerdo, nível 2
    // Carlos indicou Lais T (gaqtq4psh10w2ot) -> lado direito, nível 2
    // Marina indicou Lais M (fu5ncan3b8fd0w2) -> lado esquerdo, nível 3
    // -------------------------------------------------------------
    const treeReferrals = [
      { referrer: 'vhvun6ujx1esr19', referred: 'iinwtaqpu07h9a8', level: 2, code: 'CARLOS369-ESQ' },
      { referrer: 'vhvun6ujx1esr19', referred: 'gaqtq4psh10w2ot', level: 2, code: 'CARLOS369-DIR' },
      { referrer: 'iinwtaqpu07h9a8', referred: 'fu5ncan3b8fd0w2', level: 3, code: 'MARINA369-ESQ' },
    ]

    for (const ref of treeReferrals) {
      try {
        const existingRef = app.findFirstRecordByData('referrals', 'referred', ref.referred)
        existingRef.set('referrer', ref.referrer)
        existingRef.set('level', ref.level)
        existingRef.set('code', ref.code)
        app.save(existingRef)
      } catch (_) {
        const newRef = new Record(referralsCol)
        newRef.set('referrer', ref.referrer)
        newRef.set('referred', ref.referred)
        newRef.set('level', ref.level)
        newRef.set('code', ref.code)
        app.save(newRef)
      }
    }

    // -------------------------------------------------------------
    // 3. CRIAR 3 ALUNOS de teste:
    // Aluno 1: email=guerreiro1@test.com, name="Pedro Guerreiro", role=aluno, plan=gratis, plan_type=aluno, password="Teste@123"
    // Aluno 2: email=guerreiro2@test.com, name="Ana Guerreira", role=aluno, plan=gratis, plan_type=aluno, password="Teste@123"
    // Aluno 3: email=guerreiro3@test.com, name="Lucas Combatente", role=aluno, plan=gratis, plan_type=aluno, password="Teste@123"
    // -------------------------------------------------------------
    const testStudents = [
      {
        email: 'guerreiro1@test.com',
        name: 'Pedro Guerreiro',
        role: 'aluno',
        plan: 'gratis',
        plan_type: 'aluno',
        password: 'Teste@123',
        referral_code: 'PEDRO369',
      },
      {
        email: 'guerreiro2@test.com',
        name: 'Ana Guerreira',
        role: 'aluno',
        plan: 'gratis',
        plan_type: 'aluno',
        password: 'Teste@123',
        referral_code: 'ANA369',
      },
      {
        email: 'guerreiro3@test.com',
        name: 'Lucas Combatente',
        role: 'aluno',
        plan: 'gratis',
        plan_type: 'aluno',
        password: 'Teste@123',
        referral_code: 'COMBAT369',
      },
    ]

    const createdStudentRecords = {}
    for (const s of testStudents) {
      let stRecord
      try {
        stRecord = app.findAuthRecordByEmail('_pb_users_auth_', s.email)
        stRecord.set('name', s.name)
        stRecord.set('role', s.role)
        stRecord.set('plan', s.plan)
        stRecord.set('plan_type', s.plan_type)
        stRecord.set('approved', true)
        stRecord.setPassword(s.password)
        app.save(stRecord)
      } catch (_) {
        stRecord = new Record(usersCol)
        stRecord.setEmail(s.email)
        stRecord.setPassword(s.password)
        stRecord.setVerified(true)
        stRecord.set('name', s.name)
        stRecord.set('role', s.role)
        stRecord.set('plan', s.plan)
        stRecord.set('plan_type', s.plan_type)
        stRecord.set('approved', true)
        stRecord.set('referral_code', s.referral_code)
        app.save(stRecord)
      }
      createdStudentRecords[s.email] = stRecord
    }

    const pedroId = createdStudentRecords['guerreiro1@test.com'].id
    const anaId = createdStudentRecords['guerreiro2@test.com'].id
    const lucasId = createdStudentRecords['guerreiro3@test.com'].id

    // -------------------------------------------------------------
    // 4. CRIAR SERVIÇOS CONCLUÍDOS (collection services):
    // - Carlos atendeu Pedro: 5 serviços concluídos (status=concluido, professional=vhvun6ujx1esr19, student=pedroId, plan=premium, tarifa=3.00 em R$)
    // - Marina atendeu Ana: 2 serviços concluídos (status=concluido, professional=iinwtaqpu07h9a8, student=anaId, plan=basico, tarifa=1.00 em R$)
    // - Lais T atendeu Lucas: 1 serviço concluído (status=concluido, professional=gaqtq4psh10w2ot, student=lucasId, plan=basico, tarifa=1.00 em R$)
    // -------------------------------------------------------------
    const servicesToCreate = [
      // Carlos (5 serviços com Pedro) - valor R$ 150.00 cada
      {
        professional: 'vhvun6ujx1esr19',
        student: pedroId,
        count: 5,
        titlePrefix: 'Consultoria e Treinamento VIP Carlos #',
        type: 'Consultoria Presencial + App',
        value: 150.0,
      },
      // Marina (2 serviços com Ana) - valor R$ 120.00 cada
      {
        professional: 'iinwtaqpu07h9a8',
        student: anaId,
        count: 2,
        titlePrefix: 'Sessão Fisioterapia e Reabilitação Marina #',
        type: 'Fisioterapia e Reabilitação',
        value: 120.0,
      },
      // Lais T (1 serviço com Lucas) - valor R$ 100.00 cada
      {
        professional: 'gaqtq4psh10w2ot',
        student: lucasId,
        count: 1,
        titlePrefix: 'Treinamento Funcional Personalizado Lais T #',
        type: 'Treinamento Funcional',
        value: 100.0,
      },
    ]

    const createdServices = []
    const nowIsoDate = new Date().toISOString().slice(0, 10)

    for (const group of servicesToCreate) {
      for (let i = 1; i <= group.count; i++) {
        const title = group.titlePrefix + i
        let svcRecord
        try {
          svcRecord = app.findFirstRecordByData('services', 'title', title)
          svcRecord.set('professional', group.professional)
          svcRecord.set('student', group.student)
          svcRecord.set('type', group.type)
          svcRecord.set('value', group.value)
          svcRecord.set('status', 'concluido')
          svcRecord.set('completed_at', nowIsoDate)
          app.save(svcRecord)
        } catch (_) {
          svcRecord = new Record(servicesCol)
          svcRecord.set('professional', group.professional)
          svcRecord.set('student', group.student)
          svcRecord.set('type', group.type)
          svcRecord.set('title', title)
          svcRecord.set('value', group.value)
          svcRecord.set('status', 'concluido')
          svcRecord.set('completed_at', nowIsoDate)
          svcRecord.set('notes', 'Atendimento concluído e registrado no sistema 369TRAINING.')
          app.save(svcRecord)
        }
        createdServices.push({
          record: svcRecord,
          professional: group.professional,
          value: group.value,
        })
      }
    }

    // -------------------------------------------------------------
    // 5. CARREGAR CONFIGURAÇÕES E PARÂMETROS DA ÁRVORE BINÁRIA
    // -------------------------------------------------------------
    let tarifas = { gratis: 1.0, basico: 1.0, pro: 2.0, premium: 3.0 }
    try {
      const tarifaConfig = app.findFirstRecordByData('platform_config', 'key', 'plan_tarifas')
      const val = tarifaConfig.get('value')
      if (val) tarifas = val
    } catch (_) {}

    let partnerPoolPct = 0.38
    try {
      const revConfig = app.findFirstRecordByData('platform_config', 'key', 'revenue_split')
      const rev = revConfig.get('value') || {}
      if (rev.partner_pool_pct !== undefined) partnerPoolPct = Number(rev.partner_pool_pct)
    } catch (_) {}

    let esgMetas = { bonus: 0.55, economica: 0.15, social: 0.15, ecologica: 0.15 }
    try {
      const esgConfig = app.findFirstRecordByData('platform_config', 'key', 'esg_metas')
      const esg = esgConfig.get('value') || {}
      if (esg.bonus !== undefined) esgMetas = esg
    } catch (_) {}

    let paramsMap = {}
    try {
      const allParams = app.findRecordsByFilter('binary_tree_params', '', 'position', 300, 0)
      if (allParams) {
        for (const p of allParams) {
          paramsMap[p.getInt('position')] = {
            level: p.getInt('level'),
            segment: p.getString('segment'),
            coefficient: p.getFloat('coefficient'),
            modifier: p.getFloat('modifier'),
            divisor: p.getFloat('divisor'),
            level_percentage: p.getFloat('level_percentage'),
            cashback_weight: p.getFloat('cashback_weight'),
          }
        }
      }
    } catch (_) {}

    // -------------------------------------------------------------
    // 6. RECÁLCULO DO RANKING PARA OS 4 PROFISSIONAIS
    // -------------------------------------------------------------
    const currentCycle = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    const targetProfIds = [
      'vhvun6ujx1esr19',
      'iinwtaqpu07h9a8',
      'gaqtq4psh10w2ot',
      'fu5ncan3b8fd0w2',
    ]

    const scoredList = []
    for (const profId of targetProfIds) {
      try {
        const u = app.findRecordById('users', profId)
        const plan = u.getString('plan') || 'basico'
        const stars = u.getFloat('rating_avg') || 5.0

        let referralsCount = 0
        try {
          const refs = app.findRecordsByFilter(
            'referrals',
            "referrer = '" + profId + "'",
            '',
            1000,
            0,
          )
          referralsCount = refs ? refs.length : 0
        } catch (_) {}

        let servicesCount = 0
        try {
          const svcs = app.findRecordsByFilter(
            'services',
            "professional = '" + profId + "' && status = 'concluido'",
            '',
            2000,
            0,
          )
          servicesCount = svcs ? svcs.length : 0
        } catch (_) {}

        let tarifaRS = 1.0
        if (tarifas[plan] !== undefined) {
          tarifaRS = Number(tarifas[plan])
        } else {
          tarifaRS = plan === 'premium' ? 3.0 : plan === 'pro' ? 2.0 : 1.0
        }

        // Fórmula: pontos = tarifa_R$ × serviços × (indicações/18 + 1)
        const variavel = referralsCount / 18 + 1
        const rawPoints = Math.round(tarifaRS * servicesCount * variavel)
        const points = Number(rawPoints) >= 0 ? Number(rawPoints) : 0

        scoredList.push({
          user_id: profId,
          points: points,
          stars: stars,
          tarifa_rs: tarifaRS,
          services_count: servicesCount,
          referrals_count: referralsCount,
          created: u.getString('created'),
        })
      } catch (e) {
        console.log('Erro ao processar ranking para ' + profId + ':', e ? e.message : '')
      }
    }

    // Ordenar por pontos desc -> stars desc -> created asc
    scoredList.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.stars !== a.stars) return b.stars - a.stars
      return a.created.localeCompare(b.created)
    })

    const userRankPosMap = {}
    for (let i = 0; i < scoredList.length; i++) {
      const item = scoredList[i]
      const pos = i + 1
      userRankPosMap[item.user_id] = pos

      const param = paramsMap[pos] || {
        level: Math.min(36, Math.floor(Math.log2(pos || 1)) + 1),
        segment: pos <= 3 ? 'Top Tier Diamante' : 'Rede',
        modifier: 1.0,
        divisor: 1.0,
        cashback_weight: 1 / (pos + 1),
      }

      let rankRec
      try {
        rankRec = app.findFirstRecordByData('rank_entries', 'user', item.user_id)
      } catch (_) {
        rankRec = new Record(rankCol)
        rankRec.set('user', item.user_id)
      }

      rankRec.set('cycle', currentCycle)
      rankRec.set('points', item.points)
      rankRec.set('services_count', item.services_count)
      rankRec.set('referrals_count', item.referrals_count)
      rankRec.set('stars', item.stars)
      rankRec.set('ranking_position', pos)
      rankRec.set('tie_break_details', {
        position: pos,
        level: param.level,
        segment: param.segment,
        cashback_weight: param.cashback_weight,
        stars: item.stars,
        tarifa_rs: item.tarifa_rs,
        cycle: currentCycle,
        formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
        recomputed_at: new Date().toISOString(),
      })
      app.save(rankRec)
    }

    // -------------------------------------------------------------
    // 7. GERAR TRANSAÇÕES DE CARTEIRA E CASHBACK DISTRIBUTIONS PARA OS SERVIÇOS
    // -------------------------------------------------------------
    for (const item of createdServices) {
      const svcRecord = item.record
      const profId = item.professional
      const serviceValue = item.value
      const serviceId = svcRecord.id

      // Obter plano do profissional
      let profPlan = 'basico'
      let tarifaAmount = 1.0
      try {
        const p = app.findRecordById('users', profId)
        profPlan = p.getString('plan') || 'basico'
      } catch (_) {}

      if (tarifas[profPlan] !== undefined) {
        tarifaAmount = Number(tarifas[profPlan])
      } else {
        tarifaAmount = profPlan === 'premium' ? 3.0 : profPlan === 'pro' ? 2.0 : 1.0
      }

      // Registrar Tarifa e Crédito na Carteira
      try {
        const existingTarifaTx = app.findRecordsByFilter(
          'wallet_transactions',
          "reference_type = 'services' && reference_id = '" + serviceId + "' && type = 'tarifa'",
          '',
          1,
          0,
        )
        if (!existingTarifaTx || existingTarifaTx.length === 0) {
          const tarifaTx = new Record(walletCol)
          tarifaTx.set('user', profId)
          tarifaTx.set('type', 'tarifa')
          tarifaTx.set('amount', -Math.abs(tarifaAmount))
          tarifaTx.set('status', 'concluido')
          tarifaTx.set('reference_type', 'services')
          tarifaTx.set('reference_id', serviceId)
          tarifaTx.set(
            'description',
            'Tarifa de serviço (Plano ' +
              profPlan.toUpperCase() +
              ' - R$ ' +
              tarifaAmount.toFixed(2) +
              ')',
          )
          app.save(tarifaTx)

          const netServiceEarned = serviceValue - tarifaAmount
          const servicoTx = new Record(walletCol)
          servicoTx.set('user', profId)
          servicoTx.set('type', 'servico')
          servicoTx.set('amount', Math.max(0, netServiceEarned))
          servicoTx.set('status', 'concluido')
          servicoTx.set('reference_type', 'services')
          servicoTx.set('reference_id', serviceId)
          servicoTx.set(
            'description',
            'Recebimento de serviço concluído (' + svcRecord.getString('title') + ')',
          )
          app.save(servicoTx)
        }
      } catch (e) {
        console.log('Erro ao criar tx carteira do servico ' + serviceId + ':', e ? e.message : '')
      }

      // Distribuir cashback na árvore binária (upline)
      const totalPoolShare = serviceValue * partnerPoolPct
      let currentReferralUser = profId
      let level = 1

      while (level <= 36) {
        try {
          const refRecord = app.findFirstRecordByData('referrals', 'referred', currentReferralUser)
          const uplineUserId = refRecord.getString('referrer')
          if (!uplineUserId) break

          // Verificar se cashback já foi gravado para este serviço e upline
          const existingCb = app.findRecordsByFilter(
            'cashback_distributions',
            "service_id = '" + serviceId + "' && user = '" + uplineUserId + "'",
            '',
            1,
            0,
          )

          if (!existingCb || existingCb.length === 0) {
            const userRankPos =
              userRankPosMap[uplineUserId] || Math.min(265, Math.pow(2, level - 1))
            const param = paramsMap[userRankPos] || {
              level: level,
              segment: 'Rede',
              level_percentage: Math.min(1.8, 0.24 + level * 0.04),
              divisor: Math.pow(2, Math.min(level - 1, 10)),
              modifier: Math.min(18.5, 1.0 + level * 0.45),
              cashback_weight: 1 / (userRankPos + 1),
            }

            const nivelVariavel = param.level_percentage || Math.min(1.8, 0.24 + level * 0.04)
            const divisor = param.divisor || Math.pow(2, Math.min(level - 1, 10))
            const modifier = param.modifier || Math.min(18.5, 1.0 + level * 0.45)

            let cashbackRaw = (totalPoolShare * nivelVariavel) / (divisor * modifier)
            if (param.cashback_weight) {
              cashbackRaw = cashbackRaw * (1 + param.cashback_weight * 2)
            }

            const levelAmount = Math.max(0.01, Math.round(cashbackRaw * 100) / 100)
            const metasSplit = {
              bonus: Math.round(levelAmount * (esgMetas.bonus || 0.55) * 100) / 100,
              economica: Math.round(levelAmount * (esgMetas.economica || 0.15) * 100) / 100,
              social: Math.round(levelAmount * (esgMetas.social || 0.15) * 100) / 100,
              ecologica: Math.round(levelAmount * (esgMetas.ecologica || 0.15) * 100) / 100,
              penalty_rate_applied: 1.0,
              ranking_position: userRankPos,
            }

            const cbRecord = new Record(cbDistCol)
            cbRecord.set('user', uplineUserId)
            cbRecord.set('service_id', serviceId)
            cbRecord.set('level', level)
            cbRecord.set('pool_share', totalPoolShare)
            cbRecord.set('variable_pct', nivelVariavel)
            cbRecord.set('divisor', divisor)
            cbRecord.set('modifier', modifier)
            cbRecord.set('amount', levelAmount)
            cbRecord.set('metas', metasSplit)
            app.save(cbRecord)

            // Creditar na carteira do upline
            const cbTx = new Record(walletCol)
            cbTx.set('user', uplineUserId)
            cbTx.set('type', 'cashback')
            cbTx.set('amount', levelAmount)
            cbTx.set('status', 'concluido')
            cbTx.set('reference_type', 'cashback_distribution')
            cbTx.set('reference_id', serviceId)
            cbTx.set(
              'description',
              'Cashback Nível ' + level + ' (Pos. #' + userRankPos + ' - 369 Partner Pool 38%)',
            )
            app.save(cbTx)

            // Notificar upline
            const notif = new Record(notifCol)
            notif.set('user', uplineUserId)
            notif.set('type', 'cashback')
            notif.set('title', 'Cashback Recebido! R$ ' + levelAmount.toFixed(2))
            notif.set(
              'body',
              'Você recebeu cashback do Nível ' + level + ' através da sua rede 369TRAINING.',
            )
            notif.set('read', false)
            notif.set('action_url', '/profissional/carteira')
            app.save(notif)
          }

          currentReferralUser = uplineUserId
          level++
        } catch (_) {
          break
        }
      }
    }
  },
  (app) => {},
)

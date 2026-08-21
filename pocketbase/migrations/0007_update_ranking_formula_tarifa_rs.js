migrate(
  (app) => {
    // 1. Atualizar platform_config com as tarifas e fórmula baseadas em R$
    // Básico = R$1, Pro = R$2, Premium = R$3
    const tarifasPadrao = {
      gratis: 1.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
    }

    try {
      const tarifaRec = app.findFirstRecordByData('platform_config', 'key', 'plan_tarifas')
      tarifaRec.set('value', tarifasPadrao)
      tarifaRec.set(
        'description',
        'Tarifa cobrada por serviço em R$ (Básico R$1, Pro R$2, Premium R$3)',
      )
      app.save(tarifaRec)
    } catch (_) {
      try {
        const configCol = app.findCollectionByNameOrId('platform_config')
        const tarifaRec = new Record(configCol)
        tarifaRec.set('key', 'plan_tarifas')
        tarifaRec.set('value', tarifasPadrao)
        tarifaRec.set(
          'description',
          'Tarifa cobrada por serviço em R$ (Básico R$1, Pro R$2, Premium R$3)',
        )
        app.save(tarifaRec)
      } catch (e) {
        console.log('Error setting plan_tarifas in migration:', e.message)
      }
    }

    try {
      const rankingWeightsRec = app.findFirstRecordByData(
        'platform_config',
        'key',
        'ranking_weights',
      )
      rankingWeightsRec.set('value', {
        indicacoes_divisor: 18,
        formula: 'pontos = tarifa_R$ * servicos * (indicacoes/18 + 1)',
        tarifas_reais: { gratis: 1.0, basico: 1.0, pro: 2.0, premium: 3.0 },
      })
      rankingWeightsRec.set(
        'description',
        'Fórmula de pontuação do ranking com valor real de tarifa em R$',
      )
      app.save(rankingWeightsRec)
    } catch (_) {
      try {
        const configCol = app.findCollectionByNameOrId('platform_config')
        const rankingWeightsRec = new Record(configCol)
        rankingWeightsRec.set('key', 'ranking_weights')
        rankingWeightsRec.set('value', {
          indicacoes_divisor: 18,
          formula: 'pontos = tarifa_R$ * servicos * (indicacoes/18 + 1)',
          tarifas_reais: { gratis: 1.0, basico: 1.0, pro: 2.0, premium: 3.0 },
        })
        rankingWeightsRec.set(
          'description',
          'Fórmula de pontuação do ranking com valor real de tarifa em R$',
        )
        app.save(rankingWeightsRec)
      } catch (e) {
        console.log('Error setting ranking_weights in migration:', e.message)
      }
    }

    // 2. Recalcular pontuações existentes na coleção rank_entries
    const currentCycle = new Date().toISOString().slice(0, 7)
    const rankCol = app.findCollectionByNameOrId('rank_entries')

    const users = app.findRecordsByFilter(
      'users',
      "role = 'profissional' && approved = true",
      '',
      500,
      0,
    )

    if (users && users.length > 0) {
      const scoredList = []

      for (const u of users) {
        const profId = u.id
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
            1000,
            0,
          )
          servicesCount = svcs ? svcs.length : 0
        } catch (_) {}

        // Nova fórmula: pontos = tarifa_R$ × serviços × (indicações/18 + 1)
        // Básico = 1, Pro = 2, Premium = 3
        const tarifaRS =
          tarifasPadrao[plan] !== undefined
            ? tarifasPadrao[plan]
            : plan === 'premium'
              ? 3.0
              : plan === 'pro'
                ? 2.0
                : 1.0
        const variavel = referralsCount / 18 + 1
        const points = Math.round(tarifaRS * Math.max(1, servicesCount) * variavel)

        scoredList.push({
          user_id: profId,
          points: points,
          stars: stars,
          tarifa_rs: tarifaRS,
          services_count: servicesCount,
          referrals_count: referralsCount,
          created: u.getString('created'),
        })
      }

      // Ordenar por pontos desc -> stars desc -> antiguidade
      scoredList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.stars !== a.stars) return b.stars - a.stars
        return a.created.localeCompare(b.created)
      })

      for (let i = 0; i < scoredList.length; i++) {
        const item = scoredList[i]
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
        rankRec.set('ranking_position', i + 1)
        rankRec.set('tie_break_details', {
          position: i + 1,
          stars: item.stars,
          tarifa_rs: item.tarifa_rs,
          cycle: currentCycle,
          recomputed_at: new Date().toISOString(),
          formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
        })
        app.save(rankRec)
      }
    }
  },
  (app) => {
    // Reverter platform_config se necessário
    try {
      const tarifaRec = app.findFirstRecordByData('platform_config', 'key', 'plan_tarifas')
      tarifaRec.set('value', { gratis: 4.0, basico: 3.0, pro: 2.0, premium: 1.0 })
      app.save(tarifaRec)
    } catch (_) {}
  },
)

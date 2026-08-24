migrate(
  (app) => {
    try {
      // 1. Atualizar platform_config para refletir a nova fórmula
      try {
        const rankingWeightsRec = app.findFirstRecordByData(
          'platform_config',
          'key',
          'ranking_weights',
        )
        rankingWeightsRec.set('value', {
          formula: 'pontos = tarifa_R$ * servicos * max(indicacoes, 1)',
        })
        rankingWeightsRec.set(
          'description',
          'Fórmula de pontuação do ranking com max(indicações, 1)',
        )
        app.save(rankingWeightsRec)
      } catch (_) {
        const platformConfigCol = app.findCollectionByNameOrId('platform_config')
        const r = new Record(platformConfigCol)
        r.set('key', 'ranking_weights')
        r.set('value', {
          formula: 'pontos = tarifa_R$ * servicos * max(indicacoes, 1)',
        })
        r.set('description', 'Fórmula de pontuação do ranking com max(indicações, 1)')
        app.save(r)
      }

      // 2. Recalcular e atualizar todos os registros de rank_entries com a nova fórmula
      const currentCycle = new Date().toISOString().slice(0, 7)
      const users = app.findRecordsByFilter(
        'users',
        "role = 'profissional' && approved = true",
        '',
        500,
        0,
      )
      if (!users || users.length === 0) return

      let tarifas = { gratis: 1.0, basico: 1.0, pro: 2.0, premium: 3.0 }
      try {
        const tarifaConfig = app.findFirstRecordByData('platform_config', 'key', 'plan_tarifas')
        const val = tarifaConfig.get('value')
        if (val) tarifas = val
      } catch (_) {}

      let paramsMap = {}
      try {
        const allParams = app.findRecordsByFilter('binary_tree_params', '', 'position', 600, 0)
        if (allParams) {
          for (let p of allParams) {
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

      const rankCol = app.findCollectionByNameOrId('rank_entries')
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

        // Nova fórmula: pontos = tarifa_R$ × serviços × max(indicações, 1)
        const variavel = Math.max(referralsCount, 1)
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
      }

      scoredList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.stars !== a.stars) return b.stars - a.stars
        return a.created.localeCompare(b.created)
      })

      for (let i = 0; i < scoredList.length; i++) {
        const item = scoredList[i]
        const pos = i + 1

        let param
        if (pos <= 511 && paramsMap[pos]) {
          param = paramsMap[pos]
        } else {
          let lvl = 10
          while (lvl < 36 && Math.pow(2, lvl) - 1 < pos) {
            lvl++
          }
          const levelPct = Math.min(1.8, +(0.24 + (lvl - 1) * 0.04).toFixed(3))
          const modifier = +(1.0 + (lvl - 1) * 0.45).toFixed(2)
          const divisor = Math.pow(2, Math.min(lvl - 1, 10))
          const coefficient = Math.max(0.1, +(1000 / Math.pow(pos, 0.75)).toFixed(3))
          const cashbackWeight = Math.max(0.0001, +(1 / (pos * 0.8 + 1)).toFixed(5))

          param = {
            level: lvl,
            segment: 'Nível ' + lvl + ' Rede',
            coefficient: coefficient,
            modifier: modifier,
            divisor: divisor,
            level_percentage: levelPct,
            cashback_weight: cashbackWeight,
          }
        }

        let rankRec
        try {
          rankRec = app.findFirstRecordByData('rank_entries', 'user', item.user_id)
        } catch (_) {
          rankRec = new Record(rankCol)
          rankRec.set('user', item.user_id)
        }

        rankRec.set('cycle', currentCycle)
        rankRec.set('points', Number(item.points) || 0)
        rankRec.set('services_count', Number(item.services_count) || 0)
        rankRec.set('referrals_count', Number(item.referrals_count) || 0)
        rankRec.set('stars', Number(item.stars) || 5.0)
        rankRec.set('ranking_position', Number(pos))
        rankRec.set('tie_break_details', {
          position: pos,
          level: param.level,
          segment: param.segment,
          cashback_weight: param.cashback_weight,
          stars: item.stars,
          tarifa_rs: item.tarifa_rs,
          cycle: currentCycle,
          formula: 'tarifa_R$ * servicos * max(indicacoes, 1)',
          is_hybrid_calculated: pos > 511,
          recomputed_at: new Date().toISOString(),
        })
        app.save(rankRec)
      }
    } catch (err) {
      console.log(
        'Error in migration 0023_update_ranking_formula_max_indicacoes:',
        err ? err.message : '',
      )
    }
  },
  () => {
    // Revert not required
  },
)

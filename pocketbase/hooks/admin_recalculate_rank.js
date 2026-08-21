routerAdd(
  'POST',
  '/api/custom/admin/recalculate-ranking',
  (e) => {
    try {
      const currentCycle = new Date().toISOString().slice(0, 7)
      const users = $app.findRecordsByFilter(
        'users',
        "role = 'profissional' && approved = true",
        '',
        500,
        0,
      )
      if (!users || users.length === 0) {
        return e.json(200, {
          success: true,
          count: 0,
          message: 'Nenhum profissional aprovado encontrado',
        })
      }

      let tarifas = { gratis: 1.0, basico: 1.0, pro: 2.0, premium: 3.0 }
      try {
        const tarifaConfig = $app.findFirstRecordByData('platform_config', 'key', 'plan_tarifas')
        const val = tarifaConfig.get('value')
        if (val) tarifas = val
      } catch (_) {}

      // Carregar parâmetros individuais de binary_tree_params (posições 1 a 511)
      let paramsMap = {}
      try {
        const allParams = $app.findRecordsByFilter('binary_tree_params', '', 'position', 600, 0)
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

      const rankCol = $app.findCollectionByNameOrId('rank_entries')
      const scoredList = []

      for (const u of users) {
        const profId = u.id
        const plan = u.getString('plan') || 'basico'
        const stars = u.getFloat('rating_avg') || 5.0

        let referralsCount = 0
        try {
          const refs = $app.findRecordsByFilter(
            'referrals',
            "referrer = '" + profId + "'",
            '',
            1000,
            0,
          )
          referralsCount = refs ? refs.length : 0
        } catch (_) {}

        // Pontos cumulativos mês a mês
        let servicesCount = 0
        try {
          const svcs = $app.findRecordsByFilter(
            'services',
            "professional = '" + profId + "' && status = 'concluido'",
            '',
            2000,
            0,
          )
          servicesCount = svcs ? svcs.length : 0
        } catch (_) {}

        // Fórmula oficial de pontos: tarifa_R$ × serviços × (indicações/18 + 1)
        let tarifaRS = 1.0
        if (tarifas[plan] !== undefined) {
          tarifaRS = Number(tarifas[plan])
        } else {
          tarifaRS = plan === 'premium' ? 3.0 : plan === 'pro' ? 2.0 : 1.0
        }

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
      }

      // Ranking exclusivamente por pontos (desempate por estrelas e antiguidade)
      scoredList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.stars !== a.stars) return b.stars - a.stars
        return a.created.localeCompare(b.created)
      })

      for (let i = 0; i < scoredList.length; i++) {
        const item = scoredList[i]
        const pos = i + 1

        // MODELO HÍBRIDO:
        // Posição <= 511: parâmetros individuais da coleção binary_tree_params
        // Posição > 511: parâmetros calculados matematicamente por nível (até nível 36 / 68.719.476.735)
        let param
        if (pos <= 511 && paramsMap[pos]) {
          param = paramsMap[pos]
        } else {
          // Determinar nível matematicamente para pos > 511
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
          rankRec = $app.findFirstRecordByData('rank_entries', 'user', item.user_id)
        } catch (_) {
          rankRec = new Record(rankCol)
          rankRec.set('user', item.user_id)
        }

        rankRec.set('cycle', currentCycle)
        rankRec.set('points', Number(item.points))
        rankRec.set('services_count', Number(item.services_count))
        rankRec.set('referrals_count', Number(item.referrals_count))
        rankRec.set('stars', Number(item.stars))
        rankRec.set('ranking_position', Number(pos))
        rankRec.set('tie_break_details', {
          position: pos,
          level: param.level,
          segment: param.segment,
          cashback_weight: param.cashback_weight,
          stars: item.stars,
          tarifa_rs: item.tarifa_rs,
          cycle: currentCycle,
          formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
          is_hybrid_calculated: pos > 511,
          recomputed_at: new Date().toISOString(),
        })
        $app.save(rankRec)
      }

      return e.json(200, {
        success: true,
        count: scoredList.length,
        items: scoredList,
        message:
          'Ranking recalculado com sucesso no modelo híbrido (1-511 individual, 512+ por nível)!',
      })
    } catch (err) {
      return e.json(500, { success: false, error: err.message })
    }
  },
  $apis.requireAuth(),
)

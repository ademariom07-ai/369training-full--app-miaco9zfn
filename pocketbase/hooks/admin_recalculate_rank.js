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

        let servicesCount = 0
        try {
          const svcs = $app.findRecordsByFilter(
            'services',
            "professional = '" + profId + "' && status = 'concluido'",
            '',
            1000,
            0,
          )
          servicesCount = svcs ? svcs.length : 0
        } catch (_) {}

        // Nova fórmula solicitada: pontos = tarifa_R$ × serviços × (indicações/18 + 1)
        let tarifaRS = 1.0
        if (tarifas[plan] !== undefined) {
          tarifaRS = Number(tarifas[plan])
        } else {
          tarifaRS = plan === 'premium' ? 3.0 : plan === 'pro' ? 2.0 : 1.0
        }

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

      // Sort by points desc -> stars desc -> seniority
      scoredList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.stars !== a.stars) return b.stars - a.stars
        return a.created.localeCompare(b.created)
      })

      for (let i = 0; i < scoredList.length; i++) {
        const item = scoredList[i]
        let rankRec
        try {
          rankRec = $app.findFirstRecordByData('rank_entries', 'user', item.user_id)
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
        })
        $app.save(rankRec)
      }

      return e.json(200, {
        success: true,
        count: scoredList.length,
        items: scoredList,
        message: 'Ranking recalculado com sucesso utilizando a nova fórmula de tarifa em R$!',
      })
    } catch (err) {
      return e.json(500, { success: false, error: err.message })
    }
  },
  $apis.requireAuth(),
)

// Recalculate partner & student ranking on demand (Caminho C - v2)
// Formula: PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
// - Para aluno vinculado: effectiveMultiplier = Math.max(multAluno, multProf)
// - Para parceiro grátis: pontua como Básico (1x), tie_break plan_effective = 'basico_gratis'
// - Aluno inadimplente sem vínculo sofre downgrade temporário para 0x
// - PRO PARCEIRO: teto de contagem min(serviços reais, pro_parceiro_floor = 150)
// - Serviços válidos: validation_status = 'totalmente_validada'
// Regras JSVM: Usar $app.findRecordsByFilter e $app.findRecordById (compatível com PocketBase Goja sem problemas de ponteiro de .all())

routerAdd(
  'POST',
  '/backend/v1/admin/recalculate_rank',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser) {
        return c.json(401, {
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Autenticação necessária.',
        })
      }

      const adminRole = authUser.getString('role')
      if (adminRole !== 'admin') {
        return c.json(403, {
          status: 'error',
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores.',
        })
      }

      const cycle = new Date().toISOString().slice(0, 7)
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .replace('T', ' ')
      const nowIso = now.toISOString().replace('T', ' ').slice(0, 19)

      const planMultipliers = {
        gratis: 0,
        basico: 1,
        pro: 2,
        premium: 3,
        pro_parceiro: 1,
      }

      let proParceiroFloor = 150
      try {
        const floorRec = $app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
        if (floorRec) {
          const v = floorRec.get('value')
          if (typeof v === 'number') proParceiroFloor = v
        }
      } catch (_) {}

      // 1. Carregar todos os usuários aprovados via findRecordsByFilter
      const approvedUsers = $app.findRecordsByFilter(
        'users',
        'approved = true',
        '-created',
        5000,
        0,
      )

      // Mapa de usuários para lookup rápido
      const profPlans = {}
      for (const u of approvedUsers) {
        if ((u.get('role') || 'aluno') === 'profissional') {
          profPlans[u.id] = (u.get('plan') || 'basico').toLowerCase()
        }
      }

      // 2. Agregações de serviços concluídos com validação mútua no mês corrente
      const serviceCounts = {}
      try {
        const servicesThisMonth = $app.findRecordsByFilter(
          'services',
          `status = 'concluido' && validation_status = 'totalmente_validada' && created >= '${currentMonthStart}'`,
          '-created',
          10000,
          0,
        )

        for (const svc of servicesThisMonth) {
          const p = svc.get('professional')
          const s = svc.get('student')
          const t = (svc.get('type') || '').toLowerCase()
          const isWorkoutType =
            t === 'treino_ia' ||
            t === 'treino' ||
            t.indexOf('treino') !== -1 ||
            t.indexOf('workout') !== -1

          if (isWorkoutType && (!p || p === '')) {
            continue
          }

          if (p) {
            serviceCounts[p] = (serviceCounts[p] || 0) + 1
          }
          if (s) {
            serviceCounts[s] = (serviceCounts[s] || 0) + 1
          }
        }
      } catch (svcErr) {
        console.warn('Aviso ao agregar servicos via findRecordsByFilter:', svcErr)
      }

      // 3. Agregações de indicações no mês corrente
      const monthRefCounts = {}
      try {
        const refsThisMonth = $app.findRecordsByFilter(
          'referrals',
          `created >= '${currentMonthStart}'`,
          '-created',
          10000,
          0,
        )
        for (const ref of refsThisMonth) {
          const refId = ref.get('referrer')
          if (refId) {
            monthRefCounts[refId] = (monthRefCounts[refId] || 0) + 1
          }
        }
      } catch (refErr) {
        console.warn('Aviso ao agregar indicacoes do mes via findRecordsByFilter:', refErr)
      }

      // 4. Agregações de indicações totais
      const allRefCounts = {}
      try {
        const allRefs = $app.findRecordsByFilter('referrals', 'id != ""', '-created', 10000, 0)
        for (const ref of allRefs) {
          const refId = ref.get('referrer')
          if (refId) {
            allRefCounts[refId] = (allRefCounts[refId] || 0) + 1
          }
        }
      } catch (allRefErr) {
        console.warn('Aviso ao agregar indicacoes totais via findRecordsByFilter:', allRefErr)
      }

      // 5. Agregações de pontos passados de snapshots fechados (ciclos != cycle corrente)
      const pastSnapPoints = {}
      try {
        const pastSnaps = $app.findRecordsByFilter(
          'monthly_rank_snapshots',
          `cycle != '${cycle}'`,
          '-created',
          10000,
          0,
        )
        for (const snap of pastSnaps) {
          const uid = snap.get('user')
          if (uid) {
            pastSnapPoints[uid] = (pastSnapPoints[uid] || 0) + (Number(snap.get('points')) || 0)
          }
        }
      } catch (snapErr) {
        console.warn('Aviso ao agregar snapshots passados via findRecordsByFilter:', snapErr)
      }

      const scores = []

      for (const u of approvedUsers) {
        const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
        const role = u.get('role') || 'aluno'
        const isProParceiro = rawPlan === 'pro_parceiro'
        const isPartnerGratis = role === 'profissional' && rawPlan === 'gratis'

        let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
        if (isPartnerGratis) {
          effectiveMultiplier = planMultipliers['basico'] ?? 1 // 1x — pontua como Básico
        }
        const linkedProfId = u.get('linked_professional')

        if (role === 'aluno') {
          const multAluno = planMultipliers[rawPlan] ?? 0
          if (linkedProfId) {
            const profPlan = profPlans[linkedProfId] || 'basico'
            const multProf = planMultipliers[profPlan] ?? 0
            effectiveMultiplier = Math.max(multAluno, multProf)
          } else {
            effectiveMultiplier = multAluno
          }
        }

        // Regra de inadimplência
        const subStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
        if (
          (subStatus === 'inadimplente' || subStatus === 'cancelada') &&
          !linkedProfId &&
          role === 'aluno'
        ) {
          effectiveMultiplier = 0
        }

        if (effectiveMultiplier === 0 && !isProParceiro) {
          continue
        }

        const realServicesCount = serviceCounts[u.id] || 0
        let effectiveServicesCount = realServicesCount
        if (isProParceiro) {
          effectiveServicesCount = Math.min(realServicesCount, proParceiroFloor)
        }

        const indicacoesCount = monthRefCounts[u.id] || 0
        const totalIndicacoes = allRefCounts[u.id] || 0

        const avaliacao = Math.round(Number(u.get('rating_avg')) || 5)

        const uCreated = u.get('created')
        const createdDate = uCreated ? new Date(String(uCreated).replace(' ', 'T')) : new Date()
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

        const closedPastPoints = pastSnapPoints[u.id] || 0
        const totalPoints = closedPastPoints + monthlyPoints

        scores.push({
          user_id: u.id,
          role: role,
          plan: rawPlan,
          multiplier: effectiveMultiplier,
          services_count: effectiveServicesCount,
          services_real_count: realServicesCount,
          referrals_count: totalIndicacoes,
          referrals_this_cycle: indicacoesCount,
          stars: avaliacao,
          antiguidade: antiguidade,
          monthly_points: monthlyPoints,
          closed_past_points: closedPastPoints,
          total_points: totalPoints,
          created: uCreated,
        })
      }

      // Ordenar por total_points DESC, stars DESC, created ASC
      scores.sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points
        }
        if (b.stars !== a.stars) {
          return b.stars - a.stars
        }
        return new Date(a.created).getTime() - new Date(b.created).getTime()
      })

      // 6. Limpar entradas de ciclos passados em rank_entries
      try {
        const oldEntries = $app.findRecordsByFilter(
          'rank_entries',
          `cycle != '${cycle}'`,
          '-created',
          5000,
          0,
        )
        for (const oldRec of oldEntries) {
          try {
            $app.delete(oldRec)
          } catch (_) {}
        }
      } catch (delErr) {
        console.warn('Aviso ao limpar rank_entries de ciclos passados:', delErr)
      }

      // 7. Atualizar ou inserir registros no rank_entries
      const rankCol = $app.findCollectionByNameOrId('rank_entries')
      const existingEntries = {}
      try {
        const currentEntries = $app.findRecordsByFilter(
          'rank_entries',
          `cycle = '${cycle}'`,
          '-created',
          5000,
          0,
        )
        for (const r of currentEntries) {
          const uid = r.get('user')
          if (uid && !existingEntries[uid]) {
            existingEntries[uid] = r
          }
        }
      } catch (fetchErr) {
        console.warn('Aviso ao consultar rank_entries existentes:', fetchErr)
      }

      for (let i = 0; i < scores.length; i++) {
        const s = scores[i]
        const pos = i + 1

        let entry = existingEntries[s.user_id]
        if (!entry) {
          entry = new Record(rankCol)
          entry.set('user', s.user_id)
          entry.set('cycle', cycle)
        }

        const tieBreakObj = {
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
          tieBreakObj.plan_effective = 'basico_gratis'
        }

        entry.set('points', s.total_points)
        entry.set('services_count', s.services_count)
        entry.set('referrals_count', s.referrals_count)
        entry.set('referrals_this_cycle', s.referrals_this_cycle)
        entry.set('stars', s.stars)
        entry.set('ranking_position', pos)
        entry.set('tie_break_details', tieBreakObj)

        try {
          $app.save(entry)
        } catch (saveErr) {
          console.warn(`Erro ao salvar rank_entry do usuario ${s.user_id}:`, saveErr)
        }
      }

      return c.json(200, {
        status: 'ok',
        total_ranked: scores.length,
        cycle: cycle,
        message:
          'Ranking recalculado com sucesso conforme fórmula confirmada e suporte a PRO PARCEIRO.',
      })
    } catch (err) {
      console.error('Erro no recalculate_rank:', err)
      return c.json(500, {
        status: 'error',
        code: 'RECALCULATE_ERROR',
        message: err ? err.message : 'Erro interno ao recalcular ranking.',
      })
    }
  },
  $apis.requireAuth(),
)

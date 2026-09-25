// Recalculate partner & student ranking on demand (Caminho C - v2)
// Formula: PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
// - Aluno vinculado pontua no plano do profissional
// - Aluno inadimplente sem vínculo sofre downgrade temporário para 0x
// - PRO PARCEIRO: piso de contagem max(serviços reais, pro_parceiro_floor)
// Otimizado para suportar até 10k+ usuários com agregação SQL direta e execução rápida em lotes!

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

      // Agregações de serviços concluídos válidos no mês por usuário
      const serviceCounts = {}
      try {
        const svcRows = $app
          .db()
          .newQuery(`
          SELECT
            CASE
              WHEN (professional IS NOT NULL AND professional != '') THEN professional
              ELSE student
            END as user_id,
            COUNT(*) as total_svc
          FROM services
          WHERE status = 'concluido'
            AND created >= {:monthStart}
            AND NOT (
              (type LIKE '%treino%' OR type LIKE '%workout%')
              AND (professional IS NULL OR professional = '')
            )
          GROUP BY user_id
        `)
          .bind({ monthStart: currentMonthStart })
          .all()

        for (const row of svcRows) {
          if (row.user_id) {
            serviceCounts[row.user_id] = parseInt(row.total_svc, 10) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar agregação de serviços:', err)
      }

      // Agregações de indicações no mês por usuário
      const monthRefCounts = {}
      try {
        const refMonthRows = $app
          .db()
          .newQuery(`
          SELECT referrer, COUNT(*) as total_ref
          FROM referrals
          WHERE created >= {:monthStart}
          GROUP BY referrer
        `)
          .bind({ monthStart: currentMonthStart })
          .all()

        for (const row of refMonthRows) {
          if (row.referrer) {
            monthRefCounts[row.referrer] = parseInt(row.total_ref, 10) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar indicações do mês:', err)
      }

      // Agregações de indicações totais
      const allRefCounts = {}
      try {
        const refAllRows = $app
          .db()
          .newQuery(`
          SELECT referrer, COUNT(*) as total_ref
          FROM referrals
          GROUP BY referrer
        `)
          .all()

        for (const row of refAllRows) {
          if (row.referrer) {
            allRefCounts[row.referrer] = parseInt(row.total_ref, 10) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar indicações totais:', err)
      }

      // Agregações de pontos passados de snapshots fechados
      const pastSnapPoints = {}
      try {
        const snapRows = $app
          .db()
          .newQuery(`
          SELECT user, SUM(points) as total_past
          FROM monthly_rank_snapshots
          WHERE cycle != {:cycle}
          GROUP BY user
        `)
          .bind({ cycle: cycle })
          .all()

        for (const row of snapRows) {
          if (row.user) {
            pastSnapPoints[row.user] = parseFloat(row.total_past) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar snapshots passados:', err)
      }

      // Mapa de planos dos profissionais para herança de alunos patrocinados
      const profPlans = {}
      try {
        const pRows = $app
          .db()
          .newQuery("SELECT id, plan FROM users WHERE role = 'profissional'")
          .all()
        for (const pr of pRows) {
          profPlans[pr.id] = (pr.plan || 'basico').toLowerCase()
        }
      } catch (_) {}

      // Buscar todos os usuários aprovados
      const usersRows = $app
        .db()
        .newQuery(`
        SELECT id, name, role, plan, subscription_status, linked_professional, rating_avg, created
        FROM users
        WHERE approved = 1
      `)
        .all()

      const scores = []

      for (const u of usersRows) {
        const rawPlan = (u.plan || 'gratis').toLowerCase()
        const role = u.role || 'aluno'
        const isProParceiro = rawPlan === 'pro_parceiro'

        let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
        const linkedProfId = u.linked_professional

        if (role === 'aluno' && linkedProfId && profPlans[linkedProfId]) {
          const profPlan = profPlans[linkedProfId]
          effectiveMultiplier = planMultipliers[profPlan] ?? 1
        }

        // Regra de inadimplência
        const subStatus = (u.subscription_status || 'ativa').toLowerCase()
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
          effectiveServicesCount = Math.max(realServicesCount, proParceiroFloor)
        }

        const indicacoesCount = monthRefCounts[u.id] || 0
        const totalIndicacoes = allRefCounts[u.id] || 0

        const avaliacao = Math.round(Number(u.rating_avg) || 5)

        const createdDate = u.created ? new Date(u.created.replace(' ', 'T')) : new Date()
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
          created: u.created,
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

      // Gravar entradas do ranking no ciclo atual de forma ultrarrápida com SQL em transação
      $app.runInTransaction((txApp) => {
        // 1. Limpar entradas de ciclos passados em rank_entries
        txApp
          .db()
          .newQuery('DELETE FROM rank_entries WHERE cycle != {:cycle}')
          .bind({ cycle: cycle })
          .execute()

        // 2. Mapear IDs de rank_entries já existentes para este ciclo
        const existingEntries = {}
        const rows = txApp
          .db()
          .newQuery('SELECT id, user FROM rank_entries WHERE cycle = {:cycle}')
          .bind({ cycle: cycle })
          .all()
        for (const r of rows) {
          if (r.user && !existingEntries[r.user]) {
            existingEntries[r.user] = r.id
          }
        }

        // 3. Atualizar ou inserir em lotes
        for (let i = 0; i < scores.length; i++) {
          const s = scores[i]
          const pos = i + 1
          const existingId = existingEntries[s.user_id]
          const id =
            existingId ||
            ($security.md5('rank_' + cycle + '_' + s.user_id) + '123456789012345')
              .slice(0, 15)
              .toLowerCase()

          const tieBreak = JSON.stringify({
            stars: s.stars,
            antiguidade: s.antiguidade,
            plan_multiplier: s.multiplier,
            monthly_points: s.monthly_points,
            closed_past_points: s.closed_past_points,
            services_count: s.services_count,
            services_real_count: s.services_real_count,
            formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
          })

          txApp
            .db()
            .newQuery(`
            INSERT OR REPLACE INTO rank_entries (
              id, created, updated, user, cycle, points, services_count,
              referrals_count, referrals_this_cycle, stars, ranking_position, tie_break_details
            ) VALUES (
              {:id}, {:created}, {:updated}, {:user}, {:cycle}, {:points}, {:services_count},
              {:referrals_count}, {:referrals_this_cycle}, {:stars}, {:ranking_position}, {:tie_break_details}
            )
          `)
            .bind({
              id: id,
              created: nowIso,
              updated: nowIso,
              user: s.user_id,
              cycle: cycle,
              points: s.total_points,
              services_count: s.services_count,
              referrals_count: s.referrals_count,
              referrals_this_cycle: s.referrals_this_cycle,
              stars: s.stars,
              ranking_position: pos,
              tie_break_details: tieBreak,
            })
            .execute()
        }
      })

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

// Recalculate partner & student ranking on demand (Caminho C - v2)
// Formula: PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
// - Vínculo isolado não altera plano; patrocínio requer fatos históricos.
// - Aluno com assinatura inativa usa 0x no produto, preservando avaliação/antiguidade.
// - PRO PARCEIRO: teto de contagem min(serviços reais, pro_parceiro_floor = 150)
// - Grátis: multiplicador zero, mantendo avaliação/antiguidade e posição.
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

      let summary
      $app.runInTransaction((txApp) => {
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

      const proParceiroCap = 150 // Approved 2026-10-07; old floor config cannot override it.

      // Agregações de serviços concluídos válidos no mês por usuário
      const serviceCounts = {}
      try {
        const svcRows = arrayOf(new DynamicModel({"user_id": "", "total_svc": 0}))
        txApp
          .db()
          .newQuery(`
          SELECT u.id as user_id, COUNT(DISTINCT s.id) as total_svc
          FROM services s
          JOIN users u ON (
            (u.role = 'profissional' AND s.professional = u.id)
            OR (u.role = 'aluno' AND s.student = u.id)
          )
          WHERE u.approved = 1
            AND s.status = 'concluido'
            AND s.validated = 1
            AND s.created >= {:monthStart}
            AND NOT (
              (LOWER(COALESCE(s.type, '')) LIKE '%treino%' OR LOWER(COALESCE(s.type, '')) LIKE '%workout%')
              AND (s.professional IS NULL OR s.professional = '')
            )
          GROUP BY u.id
        `)
          .bind({ monthStart: currentMonthStart })
          .all(svcRows)

        for (const row of svcRows) {
          if (row.user_id) {
            serviceCounts[row.user_id] = parseInt(row.total_svc, 10) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar agregação de serviços:', err)
        throw new Error('Não foi possível validar a contagem de serviços; recálculo interrompido.')
      }

      // Agregações de indicações no mês por usuário
      const monthRefCounts = {}
      try {
        const refMonthRows = arrayOf(new DynamicModel({"referrer": "", "total_ref": 0}))
        txApp
          .db()
          .newQuery(`
          SELECT referrer, COUNT(*) as total_ref
          FROM referrals
          WHERE created >= {:monthStart}
          GROUP BY referrer
        `)
          .bind({ monthStart: currentMonthStart })
          .all(refMonthRows)

        for (const row of refMonthRows) {
          if (row.referrer) {
            monthRefCounts[row.referrer] = parseInt(row.total_ref, 10) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar indicações do mês:', err)
        throw new Error("Falha no recálculo; nenhuma alteração confirmada.")
      }

      // Agregações de indicações totais
      const allRefCounts = {}
      try {
        const refAllRows = arrayOf(new DynamicModel({"referrer": "", "total_ref": 0}))
        txApp
          .db()
          .newQuery(`
          SELECT referrer, COUNT(*) as total_ref
          FROM referrals
          GROUP BY referrer
        `)
          .all(refAllRows)

        for (const row of refAllRows) {
          if (row.referrer) {
            allRefCounts[row.referrer] = parseInt(row.total_ref, 10) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar indicações totais:', err)
        throw new Error("Falha no recálculo; nenhuma alteração confirmada.")
      }

      // Agregações de pontos passados de snapshots fechados
      const pastSnapPoints = {}
      try {
        const snapRows = arrayOf(new DynamicModel({"user": "", "total_past": 0}))
        txApp
          .db()
          .newQuery(`
          SELECT user, SUM(points) as total_past
          FROM monthly_rank_snapshots
          WHERE cycle != {:cycle}
          GROUP BY user
        `)
          .bind({ cycle: cycle })
          .all(snapRows)

        for (const row of snapRows) {
          if (row.user) {
            pastSnapPoints[row.user] = parseFloat(row.total_past) || 0
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar snapshots passados:', err)
        throw new Error("Falha no recálculo; nenhuma alteração confirmada.")
      }

      // Buscar todos os usuários aprovados
      const usersRows = arrayOf(new DynamicModel({"id": "", "name": "", "role": "", "plan": "", "subscription_status": "", "linked_professional": "", "rating_avg": 0, "created": ""}))
        txApp
        .db()
        .newQuery(`
        SELECT id, name, role, plan, subscription_status, linked_professional, rating_avg, created
        FROM users
        WHERE approved = 1
      `)
        .all(usersRows)

      const scores = []

      for (const u of usersRows) {
        const rawPlan = (u.plan || 'gratis').toLowerCase()
        const role = u.role || 'aluno'
        const isProParceiro = rawPlan === 'pro_parceiro'
        let effectiveMultiplier = planMultipliers[rawPlan] ?? 0

        // Regra de inadimplência
        const subStatus = (u.subscription_status || 'ativa').toLowerCase()
        if (
          (subStatus === 'inadimplente' || subStatus === 'cancelada') &&
          role === 'aluno'
        ) {
          effectiveMultiplier = 0
        }

        const realServicesCount = serviceCounts[u.id] || 0
        let effectiveServicesCount = realServicesCount
        if (isProParceiro) {
          effectiveServicesCount = Math.min(realServicesCount, proParceiroCap)
        }

        const indicacoesCount = monthRefCounts[u.id] || 0
        const totalIndicacoes = allRefCounts[u.id] || 0

        const avaliacao = Math.round(Number(u.rating_avg ?? 5))

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
        const joined = new Date(a.created).getTime() - new Date(b.created).getTime()
        return joined || (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0)
      })

      // Gravar entradas do ranking no ciclo atual com SQL direto em transação única
      try {
        // 1. Limpar entradas de ciclos passados em rank_entries
        txApp
          .db()
          .newQuery('DELETE FROM rank_entries WHERE cycle != {:cycle}')
          .bind({ cycle: cycle })
          .execute()
      } catch (delErr) {
        console.warn('Aviso ao limpar rank_entries de ciclos passados:', delErr)
        throw new Error("Falha no recálculo; nenhuma alteração confirmada.")
      }

      // 2. Mapear IDs de rank_entries já existentes para este ciclo
      const existingEntries = {}
      try {
        const rows = arrayOf(new DynamicModel({"id": "", "user": ""}))
        txApp
          .db()
          .newQuery('SELECT id, user FROM rank_entries WHERE cycle = {:cycle}')
          .bind({ cycle: cycle })
          .all(rows)
        for (const r of rows) {
          if (r.user && !existingEntries[r.user]) {
            existingEntries[r.user] = r.id
          }
        }
      } catch (fetchErr) {
        console.warn('Aviso ao consultar rank_entries existentes:', fetchErr)
        throw new Error("Falha no recálculo; nenhuma alteração confirmada.")
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
          tieBreakObj.plan_effective = 'gratis'
        }
        const tieBreak = JSON.stringify(tieBreakObj)

        try {
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
        } catch (insertErr) {
          console.warn(`Erro ao salvar rank_entry do usuário ${s.user_id}:`, insertErr)
        throw new Error("Falha no recálculo; nenhuma alteração confirmada.")
        }
      }

      summary = {
        status: 'ok',
        total_ranked: scores.length,
        cycle: cycle,
        message:
          'Recálculo legado concluído com teto PRO PARCEIRO e participação do Grátis. Não representa fechamento financeiro homologado.',
      }
      })
      return c.json(200, summary)
    } catch (err) {
      console.error('Erro no recalculate_rank:', err)
      return c.json(500, {
        status: 'error',
        code: 'RECALCULATE_ERROR',
        message: 'Não foi possível recalcular o ranking. Nenhuma alteração foi confirmada.',
      })
    }
  },
  $apis.requireAuth(),
)

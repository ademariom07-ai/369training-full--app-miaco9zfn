// Hook: Resumo Financeiro do Ciclo (Fonte da Verdade)
// Endpoint: GET /backend/v1/admin/financial_summary?cycle=YYYY-MM
// Restrito a admin ($apis.requireAuth() + role === 'admin')
// Apenas leitura (sem gravar nada no banco)
// Regras JSVM: Usar $app.findRecordsByFilter (compatível com PocketBase Goja sem problemas de ponteiro de .all()), try/catch por etapa

routerAdd(
  'GET',
  '/backend/v1/admin/financial_summary',
  (c) => {
    try {
      // 0. Autenticação e autorização de admin
      const authUser = c.auth
      if (!authUser) {
        return c.json(401, {
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Autenticação necessária.',
        })
      }

      const role = authUser.getString('role')
      if (role !== 'admin') {
        return c.json(403, {
          status: 'error',
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores.',
        })
      }

      // Parâmetro cycle opcional (default = mês corrente UTC)
      const now = new Date()
      let cycle = c.queryParam('cycle')
      if (!cycle || !/^\d{4}-\d{2}$/.test(cycle)) {
        cycle = now.toISOString().slice(0, 7)
      }

      const [yearStr, monthStr] = cycle.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10) // 1-12

      // Período do ciclo: [cycleStart, cycleEnd)
      const cycleStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
      const nextMonthDate = new Date(Date.UTC(year, month, 1, 0, 0, 0))
      const cycleStart = cycleStartDate.toISOString().replace('T', ' ').slice(0, 19)
      const cycleEnd = nextMonthDate.toISOString().replace('T', ' ').slice(0, 19)

      // 1. Carregar regras de pool_feed_config de platform_config
      let poolFeedConfig = {
        partner_pool_pct: 0.38,
        student_monthly_pct: 1.0,
        pro_parceiro_monthly_pct: 0.38,
        service_tarifa_pct: 1.0,
      }
      try {
        const pfcRec = $app.findFirstRecordByData('platform_config', 'key', 'pool_feed_config')
        if (pfcRec) {
          const v = pfcRec.get('value')
          if (typeof v === 'object' && v !== null) {
            poolFeedConfig = Object.assign(poolFeedConfig, v)
          }
        }
      } catch (_) {}

      // Mapa de todos os usuários para lookup
      const userMap = {}
      const allUsersWithPos = []
      let maxLevelHabitado = 1

      try {
        const uRecords = $app.findRecordsByFilter('users', 'id != ""', '-created', 10000, 0)
        for (let i = 0; i < uRecords.length; i++) {
          const u = uRecords[i]
          const uid = u.get('id')
          const uRole = u.get('role') || 'aluno'
          const uPlan = (u.get('plan') || 'gratis').toLowerCase()
          const uLinked = u.get('linked_professional') || ''
          const uSubStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
          const uPos = Number(u.get('tree_position')) || 0
          const uLvl = Number(u.get('tree_level')) || 1

          const item = {
            id: uid,
            role: uRole,
            plan: uPlan,
            linked_professional: uLinked,
            subscription_status: uSubStatus,
            tree_position: uPos,
            tree_level: uLvl,
          }
          userMap[uid] = item

          if (uPos > 0) {
            allUsersWithPos.push(item)
            if (uLvl > maxLevelHabitado && uLvl <= 36) {
              maxLevelHabitado = uLvl
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar mapa de usuários via findRecordsByFilter:', err)
      }

      // 2. Totalizar tarifas do ciclo
      let totalTarifas = 0
      let quantidadeTarifas = 0
      const tarifasPorPlano = { basico: 0, pro: 0, premium: 0, pro_parceiro: 0 }

      try {
        const tarifaFilter = `type = 'tarifa' && status = 'concluido' && created >= '${cycleStart}' && created < '${cycleEnd}'`
        const tarifaTxs = $app.findRecordsByFilter(
          'wallet_transactions',
          tarifaFilter,
          '-created',
          10000,
          0,
        )

        for (let i = 0; i < tarifaTxs.length; i++) {
          const t = tarifaTxs[i]
          const amt = Math.abs(Number(t.get('amount')) || 0)
          totalTarifas += amt
          quantidadeTarifas++

          const userId = t.get('user')
          const u = userId ? userMap[userId] : null
          const plan = u ? u.plan : 'basico'
          if (plan === 'pro_parceiro') {
            tarifasPorPlano.pro_parceiro = (tarifasPorPlano.pro_parceiro || 0) + amt
          } else if (plan === 'premium') {
            tarifasPorPlano.premium = (tarifasPorPlano.premium || 0) + amt
          } else if (plan === 'pro') {
            tarifasPorPlano.pro = (tarifasPorPlano.pro || 0) + amt
          } else {
            tarifasPorPlano.basico = (tarifasPorPlano.basico || 0) + amt
          }
        }
      } catch (err) {
        console.warn('Erro ao totalizar tarifas via findRecordsByFilter:', err)
      }

      // 3. Totalizar mensalidades pagas no ciclo
      let totalMensalidadesAlunos = 0
      let totalMensalidadesProParceiro = 0
      let quantidadeMensalidades = 0

      try {
        const mensalidadeFilter = `type = 'mensalidade' && status = 'concluido' && created >= '${cycleStart}' && created < '${cycleEnd}'`
        const mensalidadeTxs = $app.findRecordsByFilter(
          'wallet_transactions',
          mensalidadeFilter,
          '-created',
          10000,
          0,
        )

        for (let i = 0; i < mensalidadeTxs.length; i++) {
          const m = mensalidadeTxs[i]
          const amt = Math.abs(Number(m.get('amount')) || 0)
          quantidadeMensalidades++
          const userId = m.get('user')
          const u = userId ? userMap[userId] : null

          let isStudentUnlinked = false
          let isProParceiroTx = false

          if (u) {
            if (u.role === 'aluno' && !u.linked_professional) {
              isStudentUnlinked = true
            } else if (u.plan === 'pro_parceiro' || u.role === 'profissional') {
              isProParceiroTx = true
            }
          }

          if (isStudentUnlinked) {
            totalMensalidadesAlunos += amt
          } else if (isProParceiroTx) {
            totalMensalidadesProParceiro += amt
          } else {
            totalMensalidadesAlunos += amt
          }
        }
      } catch (err) {
        console.warn('Erro ao totalizar mensalidades via findRecordsByFilter:', err)
      }

      totalTarifas = Number(totalTarifas.toFixed(2))
      totalMensalidadesAlunos = Number(totalMensalidadesAlunos.toFixed(2))
      totalMensalidadesProParceiro = Number(totalMensalidadesProParceiro.toFixed(2))
      const totalEntradasReais = Number(
        (totalTarifas + totalMensalidadesAlunos + totalMensalidadesProParceiro).toFixed(2),
      )

      tarifasPorPlano.basico = Number(tarifasPorPlano.basico.toFixed(2))
      tarifasPorPlano.pro = Number(tarifasPorPlano.pro.toFixed(2))
      tarifasPorPlano.premium = Number(tarifasPorPlano.premium.toFixed(2))
      tarifasPorPlano.pro_parceiro = Number(tarifasPorPlano.pro_parceiro.toFixed(2))

      // 4. Base de alimentação do Pool 38%
      const studentPct = poolFeedConfig.student_monthly_pct ?? 1.0
      const proParceiroPct = poolFeedConfig.pro_parceiro_monthly_pct ?? 0.38
      const tarifaPct = poolFeedConfig.service_tarifa_pct ?? 1.0
      const partnerPoolPct = poolFeedConfig.partner_pool_pct ?? 0.38

      const baseAlunos = Number((totalMensalidadesAlunos * studentPct).toFixed(2))
      const baseProParceiro = Number((totalMensalidadesProParceiro * proParceiroPct).toFixed(2))
      const baseTarifas = Number((totalTarifas * tarifaPct).toFixed(2))
      const baseTotalEntradas = Number((baseAlunos + baseProParceiro + baseTarifas).toFixed(2))

      const partnerPool = Number((baseTotalEntradas * partnerPoolPct).toFixed(2))

      // 5. Descobrir níveis habitados na rede única global
      const niveisHabitados = Math.max(1, Math.min(36, maxLevelHabitado))
      const proximoNivel = niveisHabitados + 1
      const step = 0.8 / (proximoNivel / 2)
      const valorDoNivel =
        niveisHabitados > 0 ? Number((partnerPool / niveisHabitados).toFixed(2)) : 0

      // Mapear usuários e elegibilidade por nível
      const usersByLevel = {}
      const eligibleUsersByLevel = {}
      for (let lvl = 1; lvl <= niveisHabitados; lvl++) {
        usersByLevel[lvl] = []
        eligibleUsersByLevel[lvl] = []
      }

      for (let i = 0; i < allUsersWithPos.length; i++) {
        const u = allUsersWithPos[i]
        const lvl = Math.min(niveisHabitados, Math.max(1, u.tree_level))
        if (!usersByLevel[lvl]) usersByLevel[lvl] = []
        if (!eligibleUsersByLevel[lvl]) eligibleUsersByLevel[lvl] = []

        usersByLevel[lvl].push(u)

        let effectivePlanForCashback = u.plan
        if (u.role === 'aluno' && u.linked_professional && userMap[u.linked_professional]) {
          effectivePlanForCashback = userMap[u.linked_professional].plan || 'basico'
        }

        if (effectivePlanForCashback === 'gratis') continue
        if (
          (u.subscription_status === 'inadimplente' || u.subscription_status === 'cancelada') &&
          !u.linked_professional
        )
          continue

        eligibleUsersByLevel[lvl].push(u)
      }

      // 6. Montar tabela equalizada por nível (idêntica à de fechamento)
      const porNivel = []
      let totalDistribuidoEqualizado = 0

      for (let lvl = 1; lvl <= niveisHabitados; lvl++) {
        const corretor = Number((step * lvl + 0.2).toFixed(4))
        const valorEqualizado = Number((valorDoNivel * corretor).toFixed(2))
        const pessoasTeoricas = Math.pow(2, lvl - 1)
        const pessoasHab = usersByLevel[lvl] ? usersByLevel[lvl].length : 0
        const elegiveis = eligibleUsersByLevel[lvl] ? eligibleUsersByLevel[lvl].length : 0
        const excluidos = Math.max(0, pessoasHab - elegiveis)

        let valorPorElegivel = 0
        let valorRedistribuido = 0

        if (elegiveis > 0 && valorEqualizado > 0) {
          valorPorElegivel = Number((valorEqualizado / elegiveis).toFixed(4))
          const valorTeoricoPorPessoa = valorEqualizado / pessoasTeoricas
          valorRedistribuido = Number(
            Math.max(0, valorEqualizado - valorTeoricoPorPessoa * elegiveis).toFixed(2),
          )
        }

        totalDistribuidoEqualizado += valorEqualizado

        porNivel.push({
          level: lvl,
          pessoas_teoricas: pessoasTeoricas,
          pessoas_hab: pessoasHab,
          elegiveis: elegiveis,
          excluidos: excluidos,
          corretor: corretor,
          valor_do_nivel: valorDoNivel,
          valor_equalizado: valorEqualizado,
          valor_por_elegivel: valorPorElegivel,
          total_redistribuido: valorRedistribuido,
        })
      }

      // 7. Contar participantes no ranking do ciclo
      let totalRanked = 0
      try {
        const rEntries = $app.findRecordsByFilter(
          'rank_entries',
          `cycle = '${cycle}'`,
          '-points',
          5000,
          0,
        )
        totalRanked = rEntries.length
      } catch (err) {
        console.warn('Erro ao contar rank_entries:', err)
      }

      // 8. Retorno do resumo financeiro do ciclo
      return c.json(200, {
        status: 'ok',
        cycle: cycle,
        entradas: {
          total_tarifas: totalTarifas,
          tarifas_por_plano: tarifasPorPlano,
          total_mensalidades_alunos: totalMensalidadesAlunos,
          total_mensalidades_pro_parceiro: totalMensalidadesProParceiro,
          total_entradas_reais: totalEntradasReais,
          quantidade_tarifas: quantidadeTarifas,
          quantidade_mensalidades: quantidadeMensalidades,
        },
        pool: {
          base_alunos: baseAlunos,
          base_pro_parceiro: baseProParceiro,
          base_tarifas: baseTarifas,
          base_total_entradas: baseTotalEntradas,
          partner_pool_38: partnerPool,
          config_usada: poolFeedConfig,
        },
        rede: {
          niveis_habitados: niveisHabitados,
          total_usuarios: allUsersWithPos.length,
          por_nivel: porNivel,
        },
        ranking: {
          total_ranked: totalRanked,
          ciclo: cycle,
        },
      })
    } catch (err) {
      console.error('Erro no financial_summary:', err)
      return c.json(500, {
        status: 'error',
        code: 'FINANCIAL_SUMMARY_ERROR',
        message: err ? err.message : 'Erro interno ao calcular resumo financeiro.',
      })
    }
  },
  $apis.requireAuth(),
)

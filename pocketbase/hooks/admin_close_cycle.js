// Hook: Fechamento de Ciclo 369 (Opção A) e abertura de novo ciclo
// Endpoint: POST /backend/v1/admin/close_cycle
// Restrito a usuário administrador autenticado.
//
// Sequência de execução:
// a. Snapshot do ciclo atual: grava em monthly_rank_snapshots a posição, pontos totais (e mensais)
//    e detalhes de cada usuário participante do ranking, com closed_at preenchido e flag manual: true.
// b. Fechamento de valores: Pool 38% (mensalidades alunos não vinculados + PRO PARCEIRO + tarifas do ciclo)
//    -> níveis habitados -> corretores Caminho C -> equalização -> crédito na carteira (wallet_transactions).
//    Se não houver lastro (total de entradas <= 0), retorna 400 avisando "sem lastro para distribuição" sem distribuir nada.
// c. Zerar APENAS os contadores mensais (serviços e indicações do ciclo) no rank_entries.
//    NÃO zera pontos totais nem posições — a base fechada permanece acumulada para sempre (Opção A).
// d. Registrar em audits a ação CYCLE_CLOSED com detalhes do ciclo, pool e totais.
// e. Retornar resumo JSON para a UI do Admin.

routerAdd(
  'POST',
  '/backend/v1/admin/close_cycle',
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

      const now = new Date()
      const closingCycle = now.toISOString().slice(0, 7) // 'YYYY-MM' do ciclo que fecha
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .replace('T', ' ')

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

      // 2. Totalizar tarifas de serviços no ciclo corrente
      let totalTarifasEntrada = 0
      const tarifaTxs = $app.findRecordsByFilter(
        'wallet_transactions',
        `type = 'tarifa' && status = 'concluido' && created >= '${currentMonthStart}'`,
        '-created',
        5000,
        0,
      )
      for (const t of tarifaTxs) {
        totalTarifasEntrada += Math.abs(Number(t.get('amount')) || 0)
      }

      // 3. Totalizar mensalidades pagas no ciclo (tipo 'mensalidade' e status 'concluido')
      let totalMensalidadesAlunos = 0
      let totalMensalidadesProParceiro = 0

      const mensalidadeTxs = $app.findRecordsByFilter(
        'wallet_transactions',
        `type = 'mensalidade' && status = 'concluido' && created >= '${currentMonthStart}'`,
        '-created',
        5000,
        0,
      )

      for (const m of mensalidadeTxs) {
        const amt = Math.abs(Number(m.get('amount')) || 0)
        const userId = m.get('user')
        let isStudentUnlinked = false
        let isProParceiroTx = false

        if (userId) {
          try {
            const u = $app.findRecordById('users', userId)
            const userRole = u.get('role') || 'aluno'
            const plan = (u.get('plan') || '').toLowerCase()
            const linkedProf = u.get('linked_professional')

            if (userRole === 'aluno' && !linkedProf) {
              isStudentUnlinked = true
            } else if (plan === 'pro_parceiro' || userRole === 'profissional') {
              isProParceiroTx = true
            }
          } catch (_) {}
        }

        if (isStudentUnlinked) {
          totalMensalidadesAlunos += amt
        } else if (isProParceiroTx) {
          totalMensalidadesProParceiro += amt
        } else {
          totalMensalidadesAlunos += amt
        }
      }

      // 4. Base de alimentação do Pool 38%
      const baseAlunos = totalMensalidadesAlunos * (poolFeedConfig.student_monthly_pct ?? 1.0)
      const baseProParceiro =
        totalMensalidadesProParceiro * (poolFeedConfig.pro_parceiro_monthly_pct ?? 0.38)
      const baseTarifas = totalTarifasEntrada * (poolFeedConfig.service_tarifa_pct ?? 1.0)

      const baseTotalEntradas = baseAlunos + baseProParceiro + baseTarifas
      const totalEntradasReais =
        totalTarifasEntrada + totalMensalidadesAlunos + totalMensalidadesProParceiro

      // Bloqueio "sem lastro": se não houver entradas reais no mês
      if (totalEntradasReais <= 0 || baseTotalEntradas <= 0) {
        return c.json(400, {
          status: 'error',
          code: 'SEM_LASTRO',
          cycle: closingCycle,
          total_entradas_reais: totalEntradasReais,
          total_tarifas_entrada: totalTarifasEntrada,
          total_mensalidades_alunos: totalMensalidadesAlunos,
          total_mensalidades_pro_parceiro: totalMensalidadesProParceiro,
          partner_pool_38_pct: 0,
          usuarios_beneficiados: 0,
          message: 'sem lastro para distribuição',
        })
      }

      // 5. Pool 38% e equalização da Rede Única Global
      const partnerPool = baseTotalEntradas * (poolFeedConfig.partner_pool_pct ?? 0.38)

      const allUsersWithPos = $app.findRecordsByFilter(
        'users',
        'tree_position > 0',
        'tree_level',
        2000,
        0,
      )

      let maxLevelHabitado = 1
      for (const u of allUsersWithPos) {
        const lvl = Number(u.get('tree_level')) || 1
        if (lvl > maxLevelHabitado && lvl <= 36) {
          maxLevelHabitado = lvl
        }
      }

      const niveisHabitados = Math.max(1, Math.min(36, maxLevelHabitado))
      const proximoNivel = niveisHabitados + 1
      const step = 0.8 / (proximoNivel / 2)
      const valorDoNivel = partnerPool / niveisHabitados

      const levelDetails = []
      let totalDistribuidoEqualizado = 0

      for (let lvl = 1; lvl <= niveisHabitados; lvl++) {
        const corretor = Number((step * lvl + 0.2).toFixed(4))
        const valorEqualizado = Number((valorDoNivel * corretor).toFixed(2))
        const pessoasNoNivel = Math.pow(2, lvl - 1)
        const valorPorPessoa = Number((valorEqualizado / pessoasNoNivel).toFixed(4))

        totalDistribuidoEqualizado += valorEqualizado

        levelDetails.push({
          level: lvl,
          corretor,
          pessoasNoNivel,
          valorDoNivel,
          valorEqualizado,
          valorPorPessoa,
        })
      }

      // 6. Distribuir Cashback aos usuários elegíveis
      const cbCol = $app.findCollectionByNameOrId('cashback_distributions')
      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
      let countDistribuicoes = 0
      const userCashbackMap = {} // userId -> amount

      for (const u of allUsersWithPos) {
        const plan = (u.get('plan') || 'gratis').toLowerCase()
        const subStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
        const linkedProf = u.get('linked_professional')

        if (plan === 'gratis') continue
        if ((subStatus === 'inadimplente' || subStatus === 'cancelada') && !linkedProf) continue

        const userLevel = Math.min(niveisHabitados, Math.max(1, Number(u.get('tree_level')) || 1))
        const lvlInfo = levelDetails[userLevel - 1]
        if (!lvlInfo) continue

        const amountUser = Number(lvlInfo.valorPorPessoa.toFixed(2))
        if (amountUser <= 0) continue

        // Idempotência: verificar se já foi concedido cashback deste ciclo para este usuário
        let alreadyCredited = false
        try {
          const existingTxs = $app.findRecordsByFilter(
            'wallet_transactions',
            `user = '${u.id}' && type = 'cashback' && reference_id = '${closingCycle}'`,
            '-created',
            1,
            0,
          )
          if (existingTxs && existingTxs.length > 0) {
            alreadyCredited = true
          }
        } catch (_) {}

        if (!alreadyCredited) {
          // Salvar em cashback_distributions
          const cb = new Record(cbCol)
          cb.set('user', u.id)
          cb.set('service_id', null)
          cb.set('level', userLevel)
          cb.set('pool_share', partnerPool)
          cb.set('variable_pct', lvlInfo.corretor)
          cb.set('divisor', lvlInfo.pessoasNoNivel)
          cb.set('modifier', lvlInfo.corretor)
          cb.set('amount', amountUser)
          cb.set('metas', {
            cycle: closingCycle,
            niveis_habitados: niveisHabitados,
            corretor: lvlInfo.corretor,
            valor_equalizado_nivel: lvlInfo.valorEqualizado,
            fechamento_mensal: true,
            fechamento_manual: true,
            pool_components: {
              total_tarifas: totalTarifasEntrada,
              mensalidades_alunos: totalMensalidadesAlunos,
              mensalidades_pro_parceiro: totalMensalidadesProParceiro,
            },
          })
          $app.save(cb)

          // Creditar na carteira (wallet_transactions)
          const w = new Record(walletCol)
          w.set('user', u.id)
          w.set('type', 'cashback')
          w.set('amount', amountUser)
          w.set('status', 'concluido')
          w.set('reference_type', 'fechamento_mensal')
          w.set('reference_id', closingCycle)
          w.set(
            'description',
            `Cashback Fechamento de Ciclo (${closingCycle}) - Nível ${userLevel} (Rede Única 369)`,
          )
          $app.save(w)
        }

        countDistribuicoes++
        userCashbackMap[u.id] = (userCashbackMap[u.id] || 0) + amountUser
      }

      // 7. Gravar SNAPSHOT do ciclo em monthly_rank_snapshots
      // Ler rank_entries do ciclo atual (ordenado por ranking_position)
      const currentRankEntries = $app.findRecordsByFilter(
        'rank_entries',
        `cycle = '${closingCycle}'`,
        'ranking_position',
        2000,
        0,
      )

      const snapCol = $app.findCollectionByNameOrId('monthly_rank_snapshots')
      let snapshotsCreated = 0

      for (let i = 0; i < currentRankEntries.length; i++) {
        const re = currentRankEntries[i]
        const userId = re.get('user')
        let uRecord = null
        try {
          uRecord = $app.findRecordById('users', userId)
        } catch (_) {}

        const plan = uRecord ? (uRecord.get('plan') || 'basico').toLowerCase() : 'basico'
        const stars = Number(re.get('stars')) || 5
        const pos = Number(re.get('ranking_position')) || i + 1
        const points = Number(re.get('points')) || 0
        const servicesCount = Number(re.get('services_count')) || 0
        const referralsCount =
          re.get('referrals_this_cycle') !== undefined && re.get('referrals_this_cycle') !== null
            ? Number(re.get('referrals_this_cycle'))
            : Number(re.get('referrals_count')) || 0
        const cashbackEarned = userCashbackMap[userId] || 0

        let detailsObj = {}
        const rawTie = re.get('tie_break_details')
        if (typeof rawTie === 'object' && rawTie !== null) {
          detailsObj = Object.assign({}, rawTie)
        }
        detailsObj.manual_closure = true
        detailsObj.closed_at = now.toISOString()
        detailsObj.plan = plan
        detailsObj.user_name = uRecord ? uRecord.get('name') : ''
        detailsObj.user_role = uRecord ? uRecord.get('role') : ''

        // Verificar se já existe snapshot deste usuário para este ciclo
        let snapRecord = null
        try {
          const existingSnaps = $app.findRecordsByFilter(
            'monthly_rank_snapshots',
            `user = '${userId}' && cycle = '${closingCycle}'`,
            '-created',
            1,
            0,
          )
          if (existingSnaps && existingSnaps.length > 0) {
            snapRecord = existingSnaps[0]
          }
        } catch (_) {}

        if (!snapRecord) {
          snapRecord = new Record(snapCol)
        }

        snapRecord.set('user', userId)
        snapRecord.set('cycle', closingCycle)
        snapRecord.set('points', points)
        snapRecord.set('services_count', servicesCount)
        snapRecord.set('referrals_count', referralsCount)
        snapRecord.set('stars', stars)
        snapRecord.set('antiguidade', Number(detailsObj.antiguidade) || 1)
        snapRecord.set('ranking_position', pos)
        snapRecord.set('plan', plan)
        snapRecord.set('cashback_earned', cashbackEarned)
        snapRecord.set('closed_at', now.toISOString())
        snapRecord.set('details', detailsObj)

        $app.save(snapRecord)
        snapshotsCreated++
      }

      // 8. Zerar APENAS os contadores mensais de rank_entries (Opção A)
      // Mantém pontos totais e posições congeladas na base acumulada.
      // Contadores mensais zerados: services_count = 0, referrals_this_cycle = 0,
      // e no tie_break_details: monthly_points = 0, services_count = 0, services_real_count = 0.
      for (const re of currentRankEntries) {
        re.set('services_count', 0)
        re.set('referrals_this_cycle', 0)

        let tie = {}
        const rawTie = re.get('tie_break_details')
        if (typeof rawTie === 'object' && rawTie !== null) {
          tie = Object.assign({}, rawTie)
        }
        // Base fechada preservada
        const currentTotal = Number(re.get('points')) || 0
        tie.closed_past_points = currentTotal
        tie.monthly_points = 0
        tie.services_count = 0
        tie.services_real_count = 0
        tie.cycle_reset_at = now.toISOString()
        tie.last_closed_cycle = closingCycle
        re.set('tie_break_details', tie)

        $app.save(re)
      }

      // 9. Registrar em audits: CYCLE_CLOSED
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('actor', authUser.id)
        auditRec.set('target_type', 'cycle')
        auditRec.set('target_id', closingCycle)
        auditRec.set('action', 'CYCLE_CLOSED')
        auditRec.set('details', {
          cycle: closingCycle,
          closed_at: now.toISOString(),
          closed_by: authUser.id,
          total_ranked_users: currentRankEntries.length,
          snapshots_created: snapshotsCreated,
          total_entradas_reais: totalEntradasReais,
          partner_pool_38_pct: partnerPool,
          niveis_habitados: niveisHabitados,
          total_distribuido_equalizado: totalDistribuidoEqualizado,
          usuarios_beneficiados: countDistribuicoes,
          mode: 'OPCAO_A_PONTOS_ACUMULADOS_CONTADORES_ZERADOS',
        })
        $app.save(auditRec)
      } catch (err) {
        console.error('Erro ao registrar audit CYCLE_CLOSED:', err)
      }

      // 10. Resumo JSON de retorno
      return c.json(200, {
        status: 'ok',
        code: 'CYCLE_CLOSED_SUCCESS',
        cycle: closingCycle,
        closed_at: now.toISOString(),
        total_ranked_users: currentRankEntries.length,
        snapshots_created: snapshotsCreated,
        total_entradas_reais: totalEntradasReais,
        total_tarifas_entrada: totalTarifasEntrada,
        total_mensalidades_alunos: totalMensalidadesAlunos,
        total_mensalidades_pro_parceiro: totalMensalidadesProParceiro,
        partner_pool_38_pct: partnerPool,
        niveis_habitados: niveisHabitados,
        valor_base_por_nivel: valorDoNivel,
        total_distribuido_equalizado: totalDistribuidoEqualizado,
        usuarios_beneficiados: countDistribuicoes,
        message: `Ciclo ${closingCycle} fechado com sucesso! Snapshots congelados, Pool 38% (R$ ${partnerPool.toFixed(2)}) distribuído para ${countDistribuicoes} usuários e contadores mensais zerados mantendo a pontuação acumulada (Opção A).`,
      })
    } catch (err) {
      console.error('Erro geral no fechamento de ciclo:', err)
      return c.json(500, {
        status: 'error',
        code: 'CYCLE_CLOSE_ERROR',
        message: err ? err.message : 'Erro interno ao fechar ciclo.',
      })
    }
  },
  $apis.requireAuth(),
)

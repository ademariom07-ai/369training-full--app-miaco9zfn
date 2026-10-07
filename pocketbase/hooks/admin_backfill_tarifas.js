// Hook Admin: Resgate (Backfill) idempotente de tarifas de serviços concluídos sem tarifa
// Rota: POST /backend/v1/admin/backfill_tarifas
// Restrito a admin ($apis.requireAuth() + role === 'admin')
// Regras JSVM PocketBase:
// - Usar $app.findRecordsByFilter e $app.findRecordById (NUNCA .all()/.execute() de baixo nível nem $app.runInTransaction)
// - Try/catch POR SERVIÇO para que uma falha isolada não aborte os demais
// - Blindagem anti-duplicidade idêntica ao on_service_completed.js:
//   wallet_transactions com reference_id = svc.id && type = 'tarifa'
// - Campos idênticos ao on_service_completed.js:
//   user = professionalId, type = 'tarifa', amount = -rate, status = 'concluido',
//   reference_type = 'service', reference_id = svc.id,
//   description = "Tarifa de serviço 369 (R$ X.XX) - Atendimento #XXXXXX"
// - PRO PARCEIRO: rate = 0 (pula sem criar)
// - Ao final, dispara recálculo de ranking atualizado para o ciclo corrente

routerAdd(
  'POST',
  '/backend/v1/admin/backfill_tarifas',
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

      const role = authUser.getString('role')
      if (role !== 'admin') {
        return c.json(403, {
          status: 'error',
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores.',
        })
      }

      // 1. Listar serviços com status 'concluido'
      // Preserva ciclos passados: serviços de meses anteriores já têm suas tarifas nos ciclos respectivos
      // (ex: agendamentos de setembro com reference_type 'appointments'). O backfill atua sobre os serviços do ciclo corrente
      // ou serviços que não possuem qualquer tarifa associada.
      let completedServices = []
      try {
        completedServices = $app.findRecordsByFilter(
          'services',
          "status = 'concluido'",
          '-created',
          5000,
          0,
        )
      } catch (svcErr) {
        console.error('Erro ao buscar serviços concluídos para backfill:', svcErr)
        return c.json(500, {
          status: 'error',
          code: 'FETCH_SERVICES_ERROR',
          message: 'Erro ao buscar serviços concluídos.',
        })
      }

      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')

      let tarifasCriadas = 0
      let tarifasPuladasProParceiro = 0
      let tarifasJaExistentes = 0
      let servicosSemProfissional = 0
      const erros = []

      // Cache de planos de profissionais para evitar buscas repetidas
      const profPlanCache = {}

      for (let i = 0; i < completedServices.length; i++) {
        const svc = completedServices[i]
        const svcId = svc.id
        const profId = svc.get('professional')

        if (!profId) {
          servicosSemProfissional++
          continue
        }

        try {
          // Checagem anti-duplicidade: já existe tarifa para este serviço (direto ou via agendamento original)?
          let existingTxs = []
          try {
            existingTxs = $app.findRecordsByFilter(
              'wallet_transactions',
              `reference_id = '${svcId}' && type = 'tarifa'`,
              '-created',
              1,
              0,
            )
          } catch (checkErr) {
            console.warn(`Aviso ao verificar duplicidade para svc ${svcId}:`, checkErr)
          }

          if (existingTxs && existingTxs.length > 0) {
            tarifasJaExistentes++
            continue
          }

          // Checar se o serviço veio de um agendamento que já possui tarifa em wallet_transactions (ex: setembro/agosto)
          const svcNotes = svc.get('notes') || ''
          let appointmentIdFromNotes = ''
          const matchAppt =
            svcNotes.match(/agendamento\s*#?([a-z0-9]+)/i) || svcNotes.match(/ID:\s*([a-z0-9]+)/i)
          if (matchAppt && matchAppt[1]) {
            appointmentIdFromNotes = matchAppt[1]
          }

          if (appointmentIdFromNotes) {
            let apptTxs = []
            try {
              apptTxs = $app.findRecordsByFilter(
                'wallet_transactions',
                `reference_id = '${appointmentIdFromNotes}' && type = 'tarifa'`,
                '-created',
                1,
                0,
              )
            } catch (_) {}

            if (apptTxs && apptTxs.length > 0) {
              tarifasJaExistentes++
              continue
            }
          }

          // Descobrir plano do profissional
          let profPlan = profPlanCache[profId]
          if (!profPlan) {
            let profRecord = null
            try {
              profRecord = $app.findRecordById('users', profId)
            } catch (pErr) {
              console.warn(`Aviso ao buscar prof ${profId} para svc ${svcId}:`, pErr)
            }
            profPlan = profRecord ? (profRecord.get('plan') || 'basico').toLowerCase() : 'basico'
            profPlanCache[profId] = profPlan
          }

          // Regra PRO PARCEIRO: R$ 0 tarifa por atendimento (apenas fixo R$ 149)
          if (profPlan === 'pro_parceiro') {
            tarifasPuladasProParceiro++
            continue
          }

          let rate = 1.0
          if (profPlan === 'pro') rate = 2.0
          if (profPlan === 'premium') rate = 3.0
          if (profPlan === 'basico' || profPlan === 'gratis') rate = 1.0

          // Criar wallet_transaction idêntica ao on_service_completed.js
          const feeTx = new Record(walletCol)
          feeTx.set('user', profId)
          feeTx.set('type', 'tarifa')
          feeTx.set('amount', -rate)
          feeTx.set('status', 'concluido')
          feeTx.set('reference_type', 'service')
          feeTx.set('reference_id', svcId)
          feeTx.set(
            'description',
            `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${svcId.slice(0, 6)}`,
          )
          $app.save(feeTx)

          tarifasCriadas++
        } catch (svcItemErr) {
          console.error(`Erro ao processar backfill de tarifa para svc ${svcId}:`, svcItemErr)
          erros.push({
            service_id: svcId,
            professional_id: profId,
            error: svcItemErr ? svcItemErr.message : String(svcItemErr),
          })
        }
      }

      // 2. Disparar recálculo do ranking após criar as tarifas (mesma lógica de ranking do on_service_completed.js)
      try {
        const users = $app.findRecordsByFilter('users', 'approved = true', '-created', 1000, 0)
        const cycle = new Date().toISOString().slice(0, 7)
        const now = new Date()
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .replace('T', ' ')

        const planMultipliers = {
          gratis: 0,
          basico: 1,
          pro: 2,
          premium: 3,
          pro_parceiro: 1,
        }

        const planTarifas = {
          gratis: 1.0,
          basico: 1.0,
          pro: 2.0,
          premium: 3.0,
          pro_parceiro: 0.0,
        }

        const proParceiroCap = 150 // Approved 2026-10-07; old floor config cannot override it.

        const scores = []

        for (const u of users) {
          const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
          const uRole = u.get('role') || 'aluno'
          const isProParceiro = rawPlan === 'pro_parceiro'
          const isPartnerGratis = uRole === 'profissional' && rawPlan === 'gratis'

          let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
          if (isPartnerGratis) {
            effectiveMultiplier = planMultipliers['basico'] ?? 1
          }
          const linkedProf = u.get('linked_professional')

          if (uRole === 'aluno' && linkedProf) {
            try {
              const pUser = $app.findRecordById('users', linkedProf)
              const pPlan = (pUser.get('plan') || 'basico').toLowerCase()
              effectiveMultiplier = planMultipliers[pPlan] ?? 1
            } catch (_) {}
          }

          const subStatus = u.get('subscription_status') || 'ativa'
          if (subStatus === 'inadimplente' || subStatus === 'cancelada') {
            if (uRole === 'aluno' && !linkedProf) {
              effectiveMultiplier = 0
            }
          }

          if (effectiveMultiplier === 0 && !isProParceiro) {
            continue
          }

          const serviceFilter =
            uRole === 'profissional'
              ? `professional = '${u.id}' && status = 'concluido' && created >= '${currentMonthStart}'`
              : `student = '${u.id}' && status = 'concluido' && created >= '${currentMonthStart}'`

          const rawServicesThisMonth = $app.findRecordsByFilter(
            'services',
            serviceFilter,
            '-created',
            500,
            0,
          )

          const servicesThisMonth = rawServicesThisMonth.filter((svcItem) => {
            const p = svcItem.get('professional')
            const t = (svcItem.get('type') || '').toLowerCase()
            const isWorkoutType =
              t === 'treino_ia' ||
              t === 'treino' ||
              t.indexOf('treino') !== -1 ||
              t.indexOf('workout') !== -1
            if (isWorkoutType && (!p || p === '')) {
              return false
            }
            return true
          })

          let servicesTarifaRS = 0
          for (const svcItem of servicesThisMonth) {
            let r = planTarifas[rawPlan] ?? 1.0
            try {
              const txs = $app.findRecordsByFilter(
                'wallet_transactions',
                `reference_id = '${svcItem.id}' && type = 'tarifa'`,
                '-created',
                1,
                0,
              )
              if (txs && txs.length > 0) {
                r = Math.abs(Number(txs[0].get('amount') || r))
              }
            } catch (_) {}
            servicesTarifaRS += r
          }

          const referralsThisMonth = $app.findRecordsByFilter(
            'referrals',
            `referrer = '${u.id}' && created >= '${currentMonthStart}'`,
            '-created',
            500,
            0,
          )

          const allReferrals = $app.findRecordsByFilter(
            'referrals',
            `referrer = '${u.id}'`,
            '-created',
            500,
            0,
          )

          let realServicesCount = servicesThisMonth.length
          let effectiveServicesCount = realServicesCount
          if (isProParceiro) {
            effectiveServicesCount = Math.min(realServicesCount, proParceiroCap)
          }

          const indicacoesCount = referralsThisMonth.length
          const totalIndicacoes = allReferrals.length

          const avaliacao = Math.round(Number(u.get('rating_avg') || 5))
          const createdDate = u.get('created') ? new Date(u.get('created')) : new Date()
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

          let closedPastPoints = 0
          try {
            const pastSnapshots = $app.findRecordsByFilter(
              'monthly_rank_snapshots',
              `user = '${u.id}' && cycle != '${cycle}'`,
              '-cycle',
              100,
              0,
            )
            for (const snap of pastSnapshots) {
              closedPastPoints += Number(snap.get('points') || 0)
            }
          } catch (_) {}

          const totalPoints = closedPastPoints + monthlyPoints

          scores.push({
            user: u,
            role: uRole,
            plan: rawPlan,
            multiplier: effectiveMultiplier,
            services_count: effectiveServicesCount,
            services_real_count: realServicesCount,
            services_tarifa_rs: servicesTarifaRS,
            referrals_count: totalIndicacoes,
            referrals_this_cycle: indicacoesCount,
            stars: avaliacao,
            antiguidade,
            monthly_points: monthlyPoints,
            closed_past_points: closedPastPoints,
            total_points: totalPoints,
            created: u.get('created'),
          })
        }

        scores.sort((a, b) => {
          if (b.total_points !== a.total_points) return b.total_points - a.total_points
          if (b.stars !== a.stars) return b.stars - a.stars
          return new Date(a.created).getTime() - new Date(b.created).getTime()
        })

        const rankCol = $app.findCollectionByNameOrId('rank_entries')
        for (let i = 0; i < scores.length; i++) {
          const s = scores[i]
          let entry

          const existingEntries = $app.findRecordsByFilter(
            'rank_entries',
            `user = '${s.user.id}'`,
            '-created',
            500,
            0,
          )

          if (existingEntries && existingEntries.length > 0) {
            entry = existingEntries[0]
            for (let k = 1; k < existingEntries.length; k++) {
              try {
                $app.delete(existingEntries[k])
              } catch (_) {}
            }
          } else {
            entry = new Record(rankCol)
          }

          const tieBreakDetails = {
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
            tieBreakDetails.plan_effective = 'basico_gratis'
          }

          entry.set('user', s.user.id)
          entry.set('cycle', cycle)
          entry.set('points', s.total_points)
          entry.set('services_count', s.services_count)
          entry.set('referrals_count', s.referrals_count)
          entry.set('referrals_this_cycle', s.referrals_this_cycle)
          entry.set('stars', s.stars)
          entry.set('ranking_position', i + 1)
          entry.set('tie_break_details', tieBreakDetails)
          $app.save(entry)
        }

        try {
          const oldEntries = $app.findRecordsByFilter(
            'rank_entries',
            `cycle != '${cycle}'`,
            '-created',
            1000,
            0,
          )
          for (const oldRec of oldEntries) {
            try {
              $app.delete(oldRec)
            } catch (_) {}
          }
        } catch (_) {}
      } catch (rankErr) {
        console.error('Erro ao recalcular ranking no backfill:', rankErr)
      }

      return c.json(200, {
        status: 'ok',
        servicos_verificados: completedServices.length,
        tarifas_criadas: tarifasCriadas,
        tarifas_puladas_por_plano_pro_parceiro: tarifasPuladasProParceiro,
        tarifas_ja_existentes: tarifasJaExistentes,
        servicos_sem_profissional: servicosSemProfissional,
        erros: erros,
      })
    } catch (err) {
      console.error('Erro geral no admin_backfill_tarifas:', err)
      return c.json(500, {
        status: 'error',
        code: 'BACKFILL_ERROR',
        message: err ? err.message : 'Erro interno ao executar backfill de tarifas.',
      })
    }
  },
  $apis.requireAuth(),
)

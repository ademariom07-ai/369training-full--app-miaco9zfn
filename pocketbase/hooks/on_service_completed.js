// Hook triggered whenever a service status changes to 'concluido' or is created already 'concluido'
// HOTFIX 369 v2 + OTIMIZAÇÃO EM LOTE (evita N+1 na conclusão de atendimentos):
// 1. Débito de tarifa: PRO PARCEIRO paga R$ 0 de tarifa por serviço (apenas o fixo de R$ 149/mês).
//    Planos: basico R$ 1, pro R$ 2, premium R$ 3, pro_parceiro R$ 0, gratis R$ 1.
// 2. Anti-duplicidade na tarifa: wallet_transactions já com reference_id = service.id && type = 'tarifa'.
// 3. Teto do PRO PARCEIRO: Math.min(realServicesCount, proParceiroFloor) (teto de 150).
// 4. Parceiro Grátis: pontua como Básico (1x), sem cashback, tie_break com plan_effective = 'basico_gratis'.
// 5. Otimização em Lote: substitui consultas síncronas por usuário por consultas únicas montadas em memória.
// ATENÇÃO JSVM: escopos declarados no nível superior não são compartilhados nas pools Goja — todas as funções são declaradas inline.

onRecordAfterUpdateSuccess((e) => {
  try {
    const service = e.record
    const oldStatus = e.oldRecord ? e.oldRecord.get('status') : ''
    const newStatus = service.get('status')

    if (newStatus !== 'concluido' || oldStatus === 'concluido') {
      return
    }

    const profId = service.get('professional')
    const studentId = service.get('student')

    const debitServiceFee = (svc, professionalId) => {
      if (!professionalId) return
      try {
        let existingTxs = []
        try {
          existingTxs = $app.findRecordsByFilter(
            'wallet_transactions',
            `reference_id = '${svc.id}' && type = 'tarifa'`,
            '-created',
            1,
            0,
          )
        } catch (checkErr) {
          console.warn('Aviso ao verificar duplicidade de tarifa:', checkErr)
        }

        if (existingTxs && existingTxs.length > 0) {
          return // Já debitado previamente (anti-duplicidade)
        }

        let prof = null
        try {
          prof = $app.findRecordById('users', professionalId)
        } catch (profErr) {
          console.warn('Aviso ao buscar profissional para tarifa:', profErr)
        }

        const profPlan = prof ? (prof.get('plan') || 'basico').toLowerCase() : 'basico'

        // PRO PARCEIRO paga apenas o fixo de R$ 149/mês — SEM tarifa por serviço
        if (profPlan === 'pro_parceiro') {
          return
        }

        let rate = 1.0
        if (profPlan === 'pro') rate = 2.0
        if (profPlan === 'premium') rate = 3.0
        if (profPlan === 'basico' || profPlan === 'gratis') rate = 1.0

        const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
        const feeTx = new Record(walletCol)
        feeTx.set('user', professionalId)
        feeTx.set('type', 'tarifa')
        feeTx.set('amount', -rate)
        feeTx.set('status', 'concluido')
        feeTx.set('reference_type', 'service')
        feeTx.set('reference_id', svc.id)
        feeTx.set(
          'description',
          `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${svc.id.slice(0, 6)}`,
        )
        $app.save(feeTx)
      } catch (err) {
        console.error('Erro ao debitar tarifa de serviço:', err)
      }
    }

    const runRecalculateBatch = () => {
      const users = $app.findRecordsByFilter('users', 'approved = true', '-created', 5000, 0)
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

      let proParceiroFloor = 150
      try {
        const floorRec = $app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
        if (floorRec) {
          const v = floorRec.get('value')
          if (typeof v === 'number') proParceiroFloor = v
          else if (typeof v === 'string' && !isNaN(Number(v))) proParceiroFloor = Number(v)
        }
      } catch (_) {}

      // 1. Mapa de planos de profissionais para herança de alunos vinculados
      const userMap = {}
      for (const u of users) {
        userMap[u.id] = u
      }

      // 2. Consulta Única em Lote: Services concluídos e totalmente validados do mês
      const serviceCounts = {} // user_id -> count
      const validServiceIds = [] // IDs para buscar tarifa
      const serviceToUserMap = {} // service.id -> { profId, studentId }
      try {
        const allServicesThisMonth = $app.findRecordsByFilter(
          'services',
          `status = 'concluido' && validation_status = 'totalmente_validada' && created >= '${currentMonthStart}'`,
          '-created',
          10000,
          0,
        )

        for (const svc of allServicesThisMonth) {
          const p = svc.get('professional')
          const s = svc.get('student')
          const t = (svc.get('type') || '').toLowerCase()
          const isWorkoutType =
            t === 'treino_ia' ||
            t === 'treino' ||
            t.indexOf('treino') !== -1 ||
            t.indexOf('workout') !== -1

          // Regra: treino sem o acompanhamento do profissional não pontua no ranking.
          if (isWorkoutType && (!p || p === '')) {
            continue
          }

          validServiceIds.push(svc.id)
          serviceToUserMap[svc.id] = { profId: p, studentId: s }

          if (p) {
            serviceCounts[p] = (serviceCounts[p] || 0) + 1
          }
          if (s) {
            serviceCounts[s] = (serviceCounts[s] || 0) + 1
          }
        }
      } catch (svcErr) {
        console.warn('Aviso ao consultar services em lote:', svcErr)
      }

      // 3. Consulta Única em Lote: wallet_transactions type = 'tarifa' do ciclo
      const serviceTarifaMap = {}
      try {
        const allTarifaTxs = $app.findRecordsByFilter(
          'wallet_transactions',
          `type = 'tarifa' && created >= '${currentMonthStart}'`,
          '-created',
          10000,
          0,
        )
        for (const tx of allTarifaTxs) {
          const refId = tx.get('reference_id')
          if (refId) {
            const amt = Math.abs(Number(tx.get('amount') || 0))
            serviceTarifaMap[refId] = amt
          }
        }
      } catch (txErr) {
        console.warn('Aviso ao consultar wallet_transactions em lote:', txErr)
      }

      // Somar tarifas por usuário em JS para serviços válidos do mês
      const servicesTarifaRSByUser = {}
      for (const svcId of validServiceIds) {
        const meta = serviceToUserMap[svcId]
        if (!meta) continue

        if (meta.profId) {
          const uProf = userMap[meta.profId]
          const rawPlanProf = uProf ? (uProf.get('plan') || 'gratis').toLowerCase() : 'basico'
          const fallbackTarifaProf = planTarifas[rawPlanProf] ?? 1.0
          const tarifaProf =
            serviceTarifaMap[svcId] !== undefined ? serviceTarifaMap[svcId] : fallbackTarifaProf
          servicesTarifaRSByUser[meta.profId] =
            (servicesTarifaRSByUser[meta.profId] || 0) + tarifaProf
        }

        if (meta.studentId) {
          const uStudent = userMap[meta.studentId]
          const rawPlanStudent = uStudent
            ? (uStudent.get('plan') || 'gratis').toLowerCase()
            : 'basico'
          const fallbackTarifaStudent = planTarifas[rawPlanStudent] ?? 1.0
          const tarifaStudent =
            serviceTarifaMap[svcId] !== undefined ? serviceTarifaMap[svcId] : fallbackTarifaStudent
          servicesTarifaRSByUser[meta.studentId] =
            (servicesTarifaRSByUser[meta.studentId] || 0) + tarifaStudent
        }
      }

      // 4. Consultas Únicas em Lote: referrals deste mês e totais (agrupadas por referrer em JS)
      const referralsThisMonthCounts = {}
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
            referralsThisMonthCounts[refId] = (referralsThisMonthCounts[refId] || 0) + 1
          }
        }
      } catch (refErr) {
        console.warn('Aviso ao consultar referrals do mes em lote:', refErr)
      }

      const allReferralsCounts = {}
      try {
        const allRefs = $app.findRecordsByFilter('referrals', 'id != ""', '-created', 10000, 0)
        for (const ref of allRefs) {
          const refId = ref.get('referrer')
          if (refId) {
            allReferralsCounts[refId] = (allReferralsCounts[refId] || 0) + 1
          }
        }
      } catch (allRefErr) {
        console.warn('Aviso ao consultar all referrals em lote:', allRefErr)
      }

      // 5. Consulta Única em Lote: monthly_rank_snapshots somada por usuário em JS (ciclos passados != cycle)
      const closedPastPointsByUser = {}
      try {
        const pastSnapshots = $app.findRecordsByFilter(
          'monthly_rank_snapshots',
          `cycle != '${cycle}'`,
          '-created',
          10000,
          0,
        )
        for (const snap of pastSnapshots) {
          const uid = snap.get('user')
          if (uid) {
            closedPastPointsByUser[uid] =
              (closedPastPointsByUser[uid] || 0) + (Number(snap.get('points')) || 0)
          }
        }
      } catch (snapErr) {
        console.warn('Aviso ao consultar monthly_rank_snapshots em lote:', snapErr)
      }

      // 6. Consulta Única em Lote: rank_entries existentes do ciclo atual para reaproveitamento/upsert
      const existingEntriesByUserId = {}
      try {
        const currentRankEntries = $app.findRecordsByFilter(
          'rank_entries',
          'id != ""',
          '-created',
          5000,
          0,
        )
        for (const re of currentRankEntries) {
          const uid = re.get('user')
          if (uid) {
            if (!existingEntriesByUserId[uid]) {
              existingEntriesByUserId[uid] = []
            }
            existingEntriesByUserId[uid].push(re)
          }
        }
      } catch (reErr) {
        console.warn('Aviso ao consultar rank_entries existentes em lote:', reErr)
      }

      const scores = []

      // 7. Cálculo das pontuações em memória para cada usuário aprovado
      for (const u of users) {
        const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
        const role = u.get('role') || 'aluno'
        const isProParceiro = rawPlan === 'pro_parceiro'
        const isPartnerGratis = role === 'profissional' && rawPlan === 'gratis'

        let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
        if (isPartnerGratis) {
          effectiveMultiplier = planMultipliers['basico'] ?? 1
        }
        const linkedProf = u.get('linked_professional')

        if (role === 'aluno') {
          const multAluno = planMultipliers[rawPlan] ?? 0
          let multProf = 0
          if (linkedProf) {
            const pUser = userMap[linkedProf]
            const pPlan = pUser ? (pUser.get('plan') || 'basico').toLowerCase() : 'basico'
            multProf = planMultipliers[pPlan] ?? 0
          }
          effectiveMultiplier = linkedProf ? Math.max(multAluno, multProf) : multAluno
        }

        const subStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
        if (subStatus === 'inadimplente' || subStatus === 'cancelada') {
          if (role === 'aluno' && !linkedProf) {
            effectiveMultiplier = 0
          }
        }

        if (effectiveMultiplier === 0 && !isProParceiro) {
          continue
        }

        const realServicesCount = serviceCounts[u.id] || 0
        let effectiveServicesCount = realServicesCount
        if (isProParceiro) {
          effectiveServicesCount = Math.min(realServicesCount, proParceiroFloor)
        }

        const servicesTarifaRS = servicesTarifaRSByUser[u.id] || 0
        const indicacoesCount = referralsThisMonthCounts[u.id] || 0
        const totalIndicacoes = allReferralsCounts[u.id] || 0

        const avaliacao = Math.round(Number(u.get('rating_avg') || 5))
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

        const closedPastPoints = closedPastPointsByUser[u.id] || 0
        const totalPoints = closedPastPoints + monthlyPoints

        scores.push({
          user: u,
          role,
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
          created: uCreated,
        })
      }

      scores.sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points
        if (b.stars !== a.stars) return b.stars - a.stars
        return new Date(a.created).getTime() - new Date(b.created).getTime()
      })

      // 8. Gravação rápida em rank_entries
      const rankCol = $app.findCollectionByNameOrId('rank_entries')
      for (let i = 0; i < scores.length; i++) {
        const s = scores[i]
        let entry

        const userEntries = existingEntriesByUserId[s.user.id]
        if (userEntries && userEntries.length > 0) {
          entry = userEntries[0]
          for (let k = 1; k < userEntries.length; k++) {
            try {
              $app.delete(userEntries[k])
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
        try {
          $app.save(entry)
        } catch (saveErr) {
          console.warn(`Erro ao salvar rank_entry do usuario ${s.user.id}:`, saveErr)
        }
      }

      // 9. Limpeza de segurança: remover entradas órfãs de outros ciclos
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
    }

    // 1. DÉBITO DA TARIFA DE SERVIÇO
    try {
      debitServiceFee(service, profId)
    } catch (errFee) {
      console.error('Erro na etapa de débito de tarifa:', errFee)
    }

    // 2. VALIDAÇÃO DE INDICAÇÃO E BÔNUS DE REFERRAL
    try {
      let minServicesToValidate = 5
      try {
        const configRec = $app.findFirstRecordByData(
          'platform_config',
          'key',
          'min_services_to_validate_referral',
        )
        if (configRec) {
          const val = configRec.get('value')
          if (typeof val === 'number') minServicesToValidate = val
          else if (typeof val === 'string' && !isNaN(Number(val)))
            minServicesToValidate = Number(val)
        }
      } catch (_) {}

      if (studentId) {
        let referralRecord = null
        try {
          referralRecord = $app.findFirstRecordByData('referrals', 'referred', studentId)
        } catch (_) {}

        if (referralRecord) {
          const completedServices = $app.findRecordsByFilter(
            'services',
            `student = '${studentId}' && status = 'concluido'`,
            '-created',
            500,
            0,
          )

          const currentCount = completedServices.length
          referralRecord.set('services_count', currentCount)

          if (currentCount >= minServicesToValidate) {
            referralRecord.set('status', 'validated')
            if (!referralRecord.get('referral_bonus_paid')) {
              referralRecord.set('validated_at', new Date().toISOString().replace('T', ' '))
              referralRecord.set('referral_bonus_paid', true)
            }
          } else {
            if (!referralRecord.get('status')) {
              referralRecord.set('status', 'pending')
            }
          }
          $app.save(referralRecord)
        }
      }
    } catch (err) {
      console.error('Erro ao validar indicação:', err)
    }

    // 3. RECÁLCULO DO RANKING OTIMIZADO EM LOTE (SEM N+1)
    try {
      runRecalculateBatch()
    } catch (err) {
      console.error('Erro no recálculo em lote do ranking no update:', err)
    }
  } finally {
    e.next()
  }
}, 'services')

// Blindagem: também processar débito/validação quando serviço for criado já com status 'concluido'
onRecordAfterCreateSuccess((e) => {
  try {
    const service = e.record
    const status = service.get('status')
    if (status !== 'concluido') {
      return
    }

    const profId = service.get('professional')
    const studentId = service.get('student')

    const debitServiceFee = (svc, professionalId) => {
      if (!professionalId) return
      try {
        let existingTxs = []
        try {
          existingTxs = $app.findRecordsByFilter(
            'wallet_transactions',
            `reference_id = '${svc.id}' && type = 'tarifa'`,
            '-created',
            1,
            0,
          )
        } catch (checkErr) {
          console.warn('Aviso ao verificar duplicidade de tarifa no create:', checkErr)
        }

        if (existingTxs && existingTxs.length > 0) {
          return // Já debitado previamente (anti-duplicidade)
        }

        let prof = null
        try {
          prof = $app.findRecordById('users', professionalId)
        } catch (profErr) {
          console.warn('Aviso ao buscar profissional para tarifa no create:', profErr)
        }

        const profPlan = prof ? (prof.get('plan') || 'basico').toLowerCase() : 'basico'

        // PRO PARCEIRO paga apenas o fixo de R$ 149/mês — SEM tarifa por serviço
        if (profPlan === 'pro_parceiro') {
          return
        }

        let rate = 1.0
        if (profPlan === 'pro') rate = 2.0
        if (profPlan === 'premium') rate = 3.0
        if (profPlan === 'basico' || profPlan === 'gratis') rate = 1.0

        const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
        const feeTx = new Record(walletCol)
        feeTx.set('user', professionalId)
        feeTx.set('type', 'tarifa')
        feeTx.set('amount', -rate)
        feeTx.set('status', 'concluido')
        feeTx.set('reference_type', 'service')
        feeTx.set('reference_id', svc.id)
        feeTx.set(
          'description',
          `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${svc.id.slice(0, 6)}`,
        )
        $app.save(feeTx)
      } catch (err) {
        console.error('Erro ao debitar tarifa de serviço:', err)
      }
    }

    const runRecalculateBatch = () => {
      const users = $app.findRecordsByFilter('users', 'approved = true', '-created', 5000, 0)
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

      let proParceiroFloor = 150
      try {
        const floorRec = $app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
        if (floorRec) {
          const v = floorRec.get('value')
          if (typeof v === 'number') proParceiroFloor = v
          else if (typeof v === 'string' && !isNaN(Number(v))) proParceiroFloor = Number(v)
        }
      } catch (_) {}

      // 1. Mapa de planos de profissionais para herança de alunos vinculados
      const userMap = {}
      for (const u of users) {
        userMap[u.id] = u
      }

      // 2. Consulta Única em Lote: Services concluídos e totalmente validados do mês
      const serviceCounts = {}
      const validServiceIds = []
      const serviceToUserMap = {}
      try {
        const allServicesThisMonth = $app.findRecordsByFilter(
          'services',
          `status = 'concluido' && validation_status = 'totalmente_validada' && created >= '${currentMonthStart}'`,
          '-created',
          10000,
          0,
        )

        for (const svc of allServicesThisMonth) {
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

          validServiceIds.push(svc.id)
          serviceToUserMap[svc.id] = { profId: p, studentId: s }

          if (p) {
            serviceCounts[p] = (serviceCounts[p] || 0) + 1
          }
          if (s) {
            serviceCounts[s] = (serviceCounts[s] || 0) + 1
          }
        }
      } catch (svcErr) {
        console.warn('Aviso ao consultar services em lote no create:', svcErr)
      }

      // 3. Consulta Única em Lote: wallet_transactions type = 'tarifa' do ciclo
      const serviceTarifaMap = {}
      try {
        const allTarifaTxs = $app.findRecordsByFilter(
          'wallet_transactions',
          `type = 'tarifa' && created >= '${currentMonthStart}'`,
          '-created',
          10000,
          0,
        )
        for (const tx of allTarifaTxs) {
          const refId = tx.get('reference_id')
          if (refId) {
            const amt = Math.abs(Number(tx.get('amount') || 0))
            serviceTarifaMap[refId] = amt
          }
        }
      } catch (txErr) {
        console.warn('Aviso ao consultar wallet_transactions em lote no create:', txErr)
      }

      // Somar tarifas por usuário em JS para serviços válidos do mês
      const servicesTarifaRSByUser = {}
      for (const svcId of validServiceIds) {
        const meta = serviceToUserMap[svcId]
        if (!meta) continue

        if (meta.profId) {
          const uProf = userMap[meta.profId]
          const rawPlanProf = uProf ? (uProf.get('plan') || 'gratis').toLowerCase() : 'basico'
          const fallbackTarifaProf = planTarifas[rawPlanProf] ?? 1.0
          const tarifaProf =
            serviceTarifaMap[svcId] !== undefined ? serviceTarifaMap[svcId] : fallbackTarifaProf
          servicesTarifaRSByUser[meta.profId] =
            (servicesTarifaRSByUser[meta.profId] || 0) + tarifaProf
        }

        if (meta.studentId) {
          const uStudent = userMap[meta.studentId]
          const rawPlanStudent = uStudent
            ? (uStudent.get('plan') || 'gratis').toLowerCase()
            : 'basico'
          const fallbackTarifaStudent = planTarifas[rawPlanStudent] ?? 1.0
          const tarifaStudent =
            serviceTarifaMap[svcId] !== undefined ? serviceTarifaMap[svcId] : fallbackTarifaStudent
          servicesTarifaRSByUser[meta.studentId] =
            (servicesTarifaRSByUser[meta.studentId] || 0) + tarifaStudent
        }
      }

      // 4. Consultas Únicas em Lote: referrals deste mês e totais (agrupadas por referrer em JS)
      const referralsThisMonthCounts = {}
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
            referralsThisMonthCounts[refId] = (referralsThisMonthCounts[refId] || 0) + 1
          }
        }
      } catch (refErr) {
        console.warn('Aviso ao consultar referrals do mes em lote no create:', refErr)
      }

      const allReferralsCounts = {}
      try {
        const allRefs = $app.findRecordsByFilter('referrals', 'id != ""', '-created', 10000, 0)
        for (const ref of allRefs) {
          const refId = ref.get('referrer')
          if (refId) {
            allReferralsCounts[refId] = (allReferralsCounts[refId] || 0) + 1
          }
        }
      } catch (allRefErr) {
        console.warn('Aviso ao consultar all referrals em lote no create:', allRefErr)
      }

      // 5. Consulta Única em Lote: monthly_rank_snapshots somada por usuário em JS (ciclos passados != cycle)
      const closedPastPointsByUser = {}
      try {
        const pastSnapshots = $app.findRecordsByFilter(
          'monthly_rank_snapshots',
          `cycle != '${cycle}'`,
          '-created',
          10000,
          0,
        )
        for (const snap of pastSnapshots) {
          const uid = snap.get('user')
          if (uid) {
            closedPastPointsByUser[uid] =
              (closedPastPointsByUser[uid] || 0) + (Number(snap.get('points')) || 0)
          }
        }
      } catch (snapErr) {
        console.warn('Aviso ao consultar monthly_rank_snapshots em lote no create:', snapErr)
      }

      // 6. Consulta Única em Lote: rank_entries existentes do ciclo atual para reaproveitamento/upsert
      const existingEntriesByUserId = {}
      try {
        const currentRankEntries = $app.findRecordsByFilter(
          'rank_entries',
          'id != ""',
          '-created',
          5000,
          0,
        )
        for (const re of currentRankEntries) {
          const uid = re.get('user')
          if (uid) {
            if (!existingEntriesByUserId[uid]) {
              existingEntriesByUserId[uid] = []
            }
            existingEntriesByUserId[uid].push(re)
          }
        }
      } catch (reErr) {
        console.warn('Aviso ao consultar rank_entries existentes em lote no create:', reErr)
      }

      const scores = []

      // 7. Cálculo das pontuações em memória para cada usuário aprovado
      for (const u of users) {
        const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
        const role = u.get('role') || 'aluno'
        const isProParceiro = rawPlan === 'pro_parceiro'
        const isPartnerGratis = role === 'profissional' && rawPlan === 'gratis'

        let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
        if (isPartnerGratis) {
          effectiveMultiplier = planMultipliers['basico'] ?? 1
        }
        const linkedProf = u.get('linked_professional')

        if (role === 'aluno') {
          const multAluno = planMultipliers[rawPlan] ?? 0
          let multProf = 0
          if (linkedProf) {
            const pUser = userMap[linkedProf]
            const pPlan = pUser ? (pUser.get('plan') || 'basico').toLowerCase() : 'basico'
            multProf = planMultipliers[pPlan] ?? 0
          }
          effectiveMultiplier = linkedProf ? Math.max(multAluno, multProf) : multAluno
        }

        const subStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
        if (subStatus === 'inadimplente' || subStatus === 'cancelada') {
          if (role === 'aluno' && !linkedProf) {
            effectiveMultiplier = 0
          }
        }

        if (effectiveMultiplier === 0 && !isProParceiro) {
          continue
        }

        const realServicesCount = serviceCounts[u.id] || 0
        let effectiveServicesCount = realServicesCount
        if (isProParceiro) {
          effectiveServicesCount = Math.min(realServicesCount, proParceiroFloor)
        }

        const servicesTarifaRS = servicesTarifaRSByUser[u.id] || 0
        const indicacoesCount = referralsThisMonthCounts[u.id] || 0
        const totalIndicacoes = allReferralsCounts[u.id] || 0

        const avaliacao = Math.round(Number(u.get('rating_avg') || 5))
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

        const closedPastPoints = closedPastPointsByUser[u.id] || 0
        const totalPoints = closedPastPoints + monthlyPoints

        scores.push({
          user: u,
          role,
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
          created: uCreated,
        })
      }

      scores.sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points
        if (b.stars !== a.stars) return b.stars - a.stars
        return new Date(a.created).getTime() - new Date(b.created).getTime()
      })

      // 8. Gravação rápida em rank_entries
      const rankCol = $app.findCollectionByNameOrId('rank_entries')
      for (let i = 0; i < scores.length; i++) {
        const s = scores[i]
        let entry

        const userEntries = existingEntriesByUserId[s.user.id]
        if (userEntries && userEntries.length > 0) {
          entry = userEntries[0]
          for (let k = 1; k < userEntries.length; k++) {
            try {
              $app.delete(userEntries[k])
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
        try {
          $app.save(entry)
        } catch (saveErr) {
          console.warn(`Erro ao salvar rank_entry do usuario ${s.user.id}:`, saveErr)
        }
      }

      // 9. Limpeza de segurança: remover entradas órfãs de outros ciclos
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
    }

    // 1. DÉBITO DA TARIFA DE SERVIÇO
    try {
      if (profId) {
        debitServiceFee(service, profId)
      }
    } catch (errFee) {
      console.error('Erro na etapa de débito de tarifa no create:', errFee)
    }

    // 2. VALIDAÇÃO DE INDICAÇÃO E BÔNUS DE REFERRAL
    try {
      let minServicesToValidate = 5
      try {
        const configRec = $app.findFirstRecordByData(
          'platform_config',
          'key',
          'min_services_to_validate_referral',
        )
        if (configRec) {
          const val = configRec.get('value')
          if (typeof val === 'number') minServicesToValidate = val
          else if (typeof val === 'string' && !isNaN(Number(val)))
            minServicesToValidate = Number(val)
        }
      } catch (_) {}

      if (studentId) {
        let referralRecord = null
        try {
          referralRecord = $app.findFirstRecordByData('referrals', 'referred', studentId)
        } catch (_) {}

        if (referralRecord) {
          const completedServices = $app.findRecordsByFilter(
            'services',
            `student = '${studentId}' && status = 'concluido'`,
            '-created',
            500,
            0,
          )

          const currentCount = completedServices.length
          referralRecord.set('services_count', currentCount)

          if (currentCount >= minServicesToValidate) {
            referralRecord.set('status', 'validated')
            if (!referralRecord.get('referral_bonus_paid')) {
              referralRecord.set('validated_at', new Date().toISOString().replace('T', ' '))
              referralRecord.set('referral_bonus_paid', true)
            }
          } else {
            if (!referralRecord.get('status')) {
              referralRecord.set('status', 'pending')
            }
          }
          $app.save(referralRecord)
        }
      }
    } catch (err) {
      console.error('Erro ao validar indicação no create:', err)
    }

    // 3. RECÁLCULO DO RANKING OTIMIZADO EM LOTE (SEM N+1)
    try {
      runRecalculateBatch()
    } catch (errRank) {
      console.error('Erro no recálculo em lote do ranking no create:', errRank)
    }
  } finally {
    e.next()
  }
}, 'services')

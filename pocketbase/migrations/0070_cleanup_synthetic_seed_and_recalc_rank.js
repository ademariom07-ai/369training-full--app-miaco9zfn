/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Identificar IDs de usuários sintéticos do lote de teste (seed_loadtest)
    // Padrões do seed_loadtest:
    // - email com 'simul.ind' ou 'carga.' ou 'teste.carlos' ou 'teste.marina' ou 'teste.fernando' ou 'teste.patricia' ou 'teste.pendente' ou 'teste.lucas.coach' ou 'teste.bug.aluno'
    // - name iniciando com 'TESTE '
    // PRESERVANDO RIGOROSAMENTE:
    // - ademariom07@gmail.com (admin)
    // - Lucas (e-mail lucas... ou id '2sn36b6gtm3kdun' ou name 'Lucas...')
    // - Jose (e-mail jose... ou id 'rtbpkql9bhrcam8' ou name 'Jose...')
    // - Qualquer outro usuário não sintético cadastrado

    const protectedIds = ['2sn36b6gtm3kdun', 'rtbpkql9bhrcam8']
    const protectedEmails = ['ademariom07@gmail.com']

    // Buscar usuários sintéticos
    const syntheticUsers = []
    const allUsers = app.findRecordsByFilter('users', 'id != ""', '-created', 5000, 0)

    for (const u of allUsers) {
      const email = (u.get('email') || '').toLowerCase()
      const name = u.get('name') || ''
      const uid = u.id

      if (protectedIds.indexOf(uid) !== -1 || protectedEmails.indexOf(email) !== -1) {
        continue
      }
      if (
        name.toLowerCase().indexOf('lucas') !== -1 &&
        name.indexOf('TESTE') === -1 &&
        email.indexOf('teste') === -1
      ) {
        continue
      }
      if (
        name.toLowerCase().indexOf('jose') !== -1 &&
        name.indexOf('TESTE') === -1 &&
        email.indexOf('teste') === -1
      ) {
        continue
      }

      // Critério de sintético do lote de teste
      const isSynthetic =
        name.startsWith('TESTE ') ||
        email.indexOf('simul.ind') !== -1 ||
        email.indexOf('carga.') !== -1 ||
        email.indexOf('@369training.com') !== -1 ||
        email === 'teste.bug.aluno.001@exemplo.com'

      if (isSynthetic) {
        syntheticUsers.push(u)
      }
    }

    const syntheticIds = syntheticUsers.map((u) => u.id)
    console.log(
      `[Cleanup] Encontrados ${syntheticIds.length} usuários sintéticos do lote de teste para remoção.`,
    )

    // 2. Limpar dados derivados desses usuários sintéticos (services, appointments, reviews, wallet_transactions, referrals, rank_entries, monthly_rank_snapshots)
    for (const uid of syntheticIds) {
      // 2a. referrals onde sintético é referrer ou referred
      try {
        app
          .db()
          .newQuery(`DELETE FROM referrals WHERE referrer = '${uid}' OR referred = '${uid}'`)
          .execute()
      } catch (_) {}

      // 2b. services onde sintético é student ou professional
      try {
        app
          .db()
          .newQuery(`DELETE FROM services WHERE student = '${uid}' OR professional = '${uid}'`)
          .execute()
      } catch (_) {}

      // 2c. appointments
      try {
        app
          .db()
          .newQuery(`DELETE FROM appointments WHERE student = '${uid}' OR professional = '${uid}'`)
          .execute()
      } catch (_) {}

      // 2d. service_reviews
      try {
        app
          .db()
          .newQuery(`DELETE FROM service_reviews WHERE reviewer = '${uid}' OR reviewee = '${uid}'`)
          .execute()
      } catch (_) {}

      // 2e. wallet_transactions
      try {
        app.db().newQuery(`DELETE FROM wallet_transactions WHERE user = '${uid}'`).execute()
      } catch (_) {}

      // 2f. rank_entries & monthly_rank_snapshots
      try {
        app.db().newQuery(`DELETE FROM rank_entries WHERE user = '${uid}'`).execute()
        app.db().newQuery(`DELETE FROM monthly_rank_snapshots WHERE user = '${uid}'`).execute()
      } catch (_) {}

      // 2g. weekly_schedules
      try {
        app.db().newQuery(`DELETE FROM weekly_schedules WHERE profissional = '${uid}'`).execute()
      } catch (_) {}

      // 2h. delete user
      try {
        app.delete(app.findRecordById('users', uid))
      } catch (_) {
        try {
          app.db().newQuery(`DELETE FROM users WHERE id = '${uid}'`).execute()
        } catch (_) {}
      }
    }

    // 2i. Remover referrals com código SIMU101 que ainda apontem para Lucas ou outros
    try {
      app.db().newQuery("DELETE FROM referrals WHERE code = 'SIMU101'").execute()
    } catch (_) {}

    // 3. Recalcular Ranking do ciclo corrente (2026-10) com os dados reais restantes
    const now = new Date()
    const cycle = now.toISOString().slice(0, 7) // '2026-10'
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

    let proParceiroFloor = 150
    try {
      const floorRec = app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
      if (floorRec) {
        const v = floorRec.get('value')
        if (typeof v === 'number') proParceiroFloor = v
      }
    } catch (_) {}

    const remainingApproved = app.findRecordsByFilter(
      'users',
      'approved = true',
      '-created',
      5000,
      0,
    )
    const profPlans = {}
    for (const u of remainingApproved) {
      if ((u.get('role') || 'aluno') === 'profissional') {
        profPlans[u.id] = (u.get('plan') || 'basico').toLowerCase()
      }
    }

    // Contagem de serviços reais válidos
    const serviceCounts = {}
    try {
      const validServices = app.findRecordsByFilter(
        'services',
        `status = 'concluido' && validation_status = 'totalmente_validada' && created >= '${currentMonthStart}'`,
        '-created',
        10000,
        0,
      )
      for (const svc of validServices) {
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
        if (p) serviceCounts[p] = (serviceCounts[p] || 0) + 1
        if (s) serviceCounts[s] = (serviceCounts[s] || 0) + 1
      }
    } catch (_) {}

    // Contagem de indicações reais
    const monthRefCounts = {}
    const allRefCounts = {}
    try {
      const allRefs = app.findRecordsByFilter('referrals', 'id != ""', '-created', 10000, 0)
      for (const ref of allRefs) {
        const refId = ref.get('referrer')
        if (!refId) continue
        allRefCounts[refId] = (allRefCounts[refId] || 0) + 1
        const cDate = ref.get('created')
        if (cDate && cDate >= currentMonthStart) {
          monthRefCounts[refId] = (monthRefCounts[refId] || 0) + 1
        }
      }
    } catch (_) {}

    // Snapshots passados
    const pastSnapPoints = {}
    try {
      const pastSnaps = app.findRecordsByFilter(
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
    } catch (_) {}

    const scores = []
    for (const u of remainingApproved) {
      const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
      const role = u.get('role') || 'aluno'
      const isProParceiro = rawPlan === 'pro_parceiro'
      const isPartnerGratis = role === 'profissional' && rawPlan === 'gratis'

      let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
      if (isPartnerGratis) {
        effectiveMultiplier = planMultipliers['basico'] ?? 1
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
        name: u.get('name'),
        role,
        plan: rawPlan,
        multiplier: effectiveMultiplier,
        services_count: effectiveServicesCount,
        services_real_count: realServicesCount,
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
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points
      }
      if (b.stars !== a.stars) {
        return b.stars - a.stars
      }
      return new Date(a.created).getTime() - new Date(b.created).getTime()
    })

    // Limpar rank_entries antigos e regravar com o novo cálculo
    try {
      app
        .db()
        .newQuery('DELETE FROM rank_entries WHERE user NOT IN (SELECT id FROM users)')
        .execute()
    } catch (_) {}

    const rankCol = app.findCollectionByNameOrId('rank_entries')
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i]
      const pos = i + 1

      let entry = null
      try {
        const found = app.findRecordsByFilter(
          'rank_entries',
          `user = '${s.user_id}'`,
          '-created',
          1,
          0,
        )
        if (found && found.length > 0) entry = found[0]
      } catch (_) {}

      if (!entry) {
        entry = new Record(rankCol)
        entry.set('user', s.user_id)
      }

      entry.set('cycle', cycle)
      entry.set('points', s.total_points)
      entry.set('services_count', s.services_count)
      entry.set('referrals_count', s.referrals_count)
      entry.set('referrals_this_cycle', s.referrals_this_cycle)
      entry.set('stars', s.stars)
      entry.set('ranking_position', pos)
      entry.set('tie_break_details', {
        stars: s.stars,
        antiguidade: s.antiguidade,
        plan_multiplier: s.multiplier,
        monthly_points: s.monthly_points,
        closed_past_points: s.closed_past_points,
        services_count: s.services_count,
        services_real_count: s.services_real_count,
        formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
      })

      app.save(entry)
      console.log(
        `[Rank Cleaned] #${pos} ${s.name} (${s.role}): ${s.total_points} pts (servicos: ${s.services_count}, indicacoes: ${s.referrals_this_cycle}, avaliacao: ${s.stars}, antiguidade: ${s.antiguidade})`,
      )
    }
  },
  () => {},
)

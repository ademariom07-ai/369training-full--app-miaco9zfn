migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. LOCALIZAR OU RECUPERAR USUÁRIOS DE TESTE
    // -------------------------------------------------------------------------
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    function findUser(email, idOrNull) {
      if (email) {
        try {
          return app.findAuthRecordByEmail('_pb_users_auth_', email)
        } catch (_) {}
      }
      if (idOrNull) {
        try {
          return app.findRecordById('users', idOrNull)
        } catch (_) {}
      }
      return null
    }

    // Identificar usuários chave do ecossistema 369TRAINING
    let carlos = findUser('carlos.coach@369training.com', 'vhvun6ujx1esr19')
    let lucas = findUser('aluno.lucas@369training.com', null)
    let marina = findUser('marina.fisio@369training.com', 'iinwtaqpu07h9a8')
    let laisT = findUser('gaqtq4psh10w2ot@369training.com', 'gaqtq4psh10w2ot')
    let laisM = findUser('fu5ncan3b8fd0w2@369training.com', 'fu5ncan3b8fd0w2')
    let pedro = findUser('guerreiro1@test.com', null)
    let ana = findUser('guerreiro2@test.com', null)
    let combatente = findUser('guerreiro3@test.com', null)

    // Se por acaso algum usuário de teste ainda não existir, garantir sua criação para que o seed seja 100% resiliente
    if (!carlos) {
      try {
        carlos = new Record(usersCol)
        carlos.setEmail('carlos.coach@369training.com')
        carlos.setPassword('Skip@Pass')
        carlos.setVerified(true)
        carlos.set('name', 'Prof. Carlos Silva')
        carlos.set('role', 'profissional')
        carlos.set('plan', 'premium')
        carlos.set('plan_type', 'profissional')
        carlos.set('approved', true)
        carlos.set('referral_code', 'CARLOS369')
        app.save(carlos)
      } catch (_) {}
    }

    if (!lucas) {
      try {
        lucas = new Record(usersCol)
        lucas.setEmail('aluno.lucas@369training.com')
        lucas.setPassword('Skip@Pass')
        lucas.setVerified(true)
        lucas.set('name', 'Lucas Ferreira')
        lucas.set('role', 'aluno')
        lucas.set('plan', 'pro')
        lucas.set('plan_type', 'aluno')
        lucas.set('approved', true)
        lucas.set('referral_code', 'LUCAS369')
        app.save(lucas)
      } catch (_) {}
    }

    if (!marina) {
      try {
        marina = new Record(usersCol)
        marina.setEmail('marina.fisio@369training.com')
        marina.setPassword('Skip@Pass')
        marina.setVerified(true)
        marina.set('name', 'Dra. Marina Santos')
        marina.set('role', 'profissional')
        marina.set('plan', 'basico')
        marina.set('plan_type', 'profissional')
        marina.set('approved', true)
        marina.set('referral_code', 'MARINA369')
        app.save(marina)
      } catch (_) {}
    }

    // -------------------------------------------------------------------------
    // 2. CONEXÕES SMARTWATCH (wearable_connections)
    // Regra de Gate:
    // - Alunos: todos os planos (Lucas Ferreira [aluno Pro], Pedro Guerreiro [aluno Grátis])
    // - Parceiros: Pro ou Premium apenas (Prof. Carlos Silva [premium])
    // NÃO criar para Dra. Marina Santos nem Lais M/T se forem profissionais Básicos.
    // -------------------------------------------------------------------------
    const connCol = app.findCollectionByNameOrId('wearable_connections')
    const metricsCol = app.findCollectionByNameOrId('wearable_metrics')

    const connectedWearableUsers = []

    // Carlos Silva -> Garmin (Premium)
    if (carlos && (carlos.getString('plan') === 'premium' || carlos.getString('plan') === 'pro')) {
      connectedWearableUsers.push({
        user: carlos,
        provider: 'garmin',
        aggregator: 'terra',
        aggregator_user_id: 'terra_usr_carlos_' + carlos.id.slice(0, 8),
        device_label: 'Garmin Forerunner 965',
        profile_archetype: 'athlete', // treinos mais intensos, maior contagem de passos e corridas
      })
    }

    // Lucas Ferreira -> Apple Watch (Aluno Pro)
    if (lucas) {
      connectedWearableUsers.push({
        user: lucas,
        provider: 'apple_watch',
        aggregator: 'terra',
        aggregator_user_id: 'terra_usr_lucas_' + lucas.id.slice(0, 8),
        device_label: 'Apple Watch Ultra 2',
        profile_archetype: 'student_pro', // musculação, passos regulares, bom sono
      })
    }

    // Pedro Guerreiro -> Strava / Xiaomi (Aluno Grátis, tem acesso ao smartwatch conforme Caminho A)
    if (pedro) {
      connectedWearableUsers.push({
        user: pedro,
        provider: 'strava',
        aggregator: 'spike',
        aggregator_user_id: 'spike_usr_pedro_' + pedro.id.slice(0, 8),
        device_label: 'Strava App Sync',
        profile_archetype: 'runner',
      })
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const nowIsoDate = nowIso.slice(0, 10)

    for (const item of connectedWearableUsers) {
      const uId = item.user.id

      // Limpar conexões antigas do usuário para idempotência estrita
      try {
        const oldConns = app.findRecordsByFilter(
          'wearable_connections',
          "user = '" + uId + "'",
          '',
          50,
          0,
        )
        for (const oc of oldConns) {
          app.delete(oc)
        }
      } catch (_) {}

      // Criar conexão ativa com status connected
      const conn = new Record(connCol)
      conn.set('user', uId)
      conn.set('provider', item.provider)
      conn.set('aggregator', item.aggregator)
      conn.set('aggregator_user_id', item.aggregator_user_id)
      conn.set('reference_id', uId)
      conn.set('status', 'connected')
      conn.set('last_sync_at', nowIso.replace('T', ' ').slice(0, 19))
      conn.set('metadata', {
        device_label: item.device_label,
        battery_level: 88,
        firmware_version: '14.2.1',
        auto_sync: true,
        permissions: ['activity', 'body', 'daily', 'sleep'],
        initial_sync_completed: true,
      })
      app.save(conn)

      // Limpar métricas antigas do usuário para idempotência estrita
      try {
        const oldMetrics = app.findRecordsByFilter(
          'wearable_metrics',
          "user = '" + uId + "'",
          '',
          500,
          0,
        )
        for (const om of oldMetrics) {
          app.delete(om)
        }
      } catch (_) {}

      // -----------------------------------------------------------------------
      // 3. GERAR 30 DIAS DE MÉTRICAS DIÁRIAS VARIADAS E REALISTAS
      // Passos, batimentos (mín/máx/médio), sono, calorias, distância e treinos
      // -----------------------------------------------------------------------
      for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
        const d = new Date(now)
        d.setDate(d.getDate() - dayOffset)
        const dateStr = d.toISOString().slice(0, 10)

        // Variabilidade determinística realista com base no dia e usuário
        const seedVal = (uId.charCodeAt(0) * 17 + dayOffset * 31 + d.getDay() * 7) % 100
        const isWeekend = d.getDay() === 0 || d.getDay() === 6

        let steps = 8500
        let hrAvg = 68
        let hrMin = 52
        let hrMax = 145
        let calActive = 480
        let calTotal = 2100
        let sleepSeconds = 7.5 * 3600
        let sleepScore = 82
        let workoutsCount = 1
        let workoutsSummary = []
        let distanceMeters = 6200

        if (item.profile_archetype === 'athlete') {
          // Atleta / Profissional de Educação Física: alta queima, treinos pesados
          steps = 9500 + (seedVal % 55) * 120 + (isWeekend ? 3000 : 0)
          hrAvg = 60 + (seedVal % 12)
          hrMin = 46 + (seedVal % 8)
          hrMax = 158 + (seedVal % 28)
          calActive = 650 + (seedVal % 40) * 12
          calTotal = 2400 + calActive
          sleepSeconds = Math.round((7 + (seedVal % 20) / 15) * 3600)
          sleepScore = Math.min(96, Math.max(72, 80 + (seedVal % 18)))
          distanceMeters = Math.round(steps * 0.78)

          const hasWorkout = dayOffset !== 3 && dayOffset !== 12 && dayOffset !== 22
          if (hasWorkout) {
            workoutsCount = seedVal % 10 > 6 && !isWeekend ? 2 : 1
            workoutsSummary = [
              {
                id: 'w_' + dateStr + '_1',
                type: isWeekend ? 'Corrida Outdoor' : 'Musculação Alta Performance',
                duration_minutes: isWeekend ? 55 : 70,
                calories_burned: isWeekend ? 540 : 480,
                avg_heart_rate: isWeekend ? 152 : 138,
                max_heart_rate: isWeekend ? 174 : 166,
                distance_km: isWeekend ? 8.4 : null,
                started_at: dateStr + 'T07:15:00',
              },
            ]
            if (workoutsCount === 2) {
              workoutsSummary.push({
                id: 'w_' + dateStr + '_2',
                type: 'Mobilidade e Core 369',
                duration_minutes: 30,
                calories_burned: 150,
                avg_heart_rate: 110,
                max_heart_rate: 125,
                distance_km: null,
                started_at: dateStr + 'T18:00:00',
              })
            }
          } else {
            workoutsCount = 0
            workoutsSummary = []
          }
        } else if (item.profile_archetype === 'student_pro') {
          // Aluno Pro (Lucas): treinos regulares na academia, constância
          steps = 7800 + (seedVal % 45) * 90
          hrAvg = 70 + (seedVal % 10)
          hrMin = 54 + (seedVal % 8)
          hrMax = 148 + (seedVal % 22)
          calActive = 420 + (seedVal % 30) * 10
          calTotal = 2050 + calActive
          sleepSeconds = Math.round((6.8 + (seedVal % 25) / 15) * 3600)
          sleepScore = Math.min(94, Math.max(68, 76 + (seedVal % 20)))
          distanceMeters = Math.round(steps * 0.74)

          const hasWorkout = d.getDay() !== 0 && dayOffset !== 7 && dayOffset !== 19
          if (hasWorkout) {
            workoutsCount = 1
            const workoutNames = [
              'Treino A - Peito, Ombros e Tríceps',
              'Treino B - Costas e Bíceps',
              'Treino C - Pernas e Glúteos',
              'Cardio HIIT 369',
            ]
            const pickedName = workoutNames[(dayOffset + d.getDay()) % workoutNames.length]
            workoutsSummary = [
              {
                id: 'w_lucas_' + dateStr,
                type: pickedName,
                duration_minutes: 50 + (seedVal % 20),
                calories_burned: 360 + (seedVal % 20) * 8,
                avg_heart_rate: 132 + (seedVal % 14),
                max_heart_rate: 158 + (seedVal % 15),
                distance_km: pickedName.includes('Cardio') ? 4.5 : null,
                started_at: dateStr + 'T19:30:00',
              },
            ]
          } else {
            workoutsCount = 0
            workoutsSummary = []
          }
        } else {
          // Corredor / Aluno Pedro
          steps = 6500 + (seedVal % 60) * 110
          hrAvg = 72 + (seedVal % 8)
          hrMin = 56 + (seedVal % 6)
          hrMax = 152 + (seedVal % 20)
          calActive = 380 + (seedVal % 25) * 10
          calTotal = 1950 + calActive
          sleepSeconds = Math.round((7.2 + (seedVal % 20) / 18) * 3600)
          sleepScore = Math.min(90, Math.max(70, 75 + (seedVal % 16)))
          distanceMeters = Math.round(steps * 0.72)

          const isRunDay = d.getDay() === 2 || d.getDay() === 4 || d.getDay() === 6
          if (isRunDay) {
            workoutsCount = 1
            workoutsSummary = [
              {
                id: 'w_pedro_' + dateStr,
                type: 'Corrida de Rua',
                duration_minutes: 42,
                calories_burned: 390,
                avg_heart_rate: 148,
                max_heart_rate: 168,
                distance_km: 5.6,
                started_at: dateStr + 'T06:45:00',
              },
            ]
          } else {
            workoutsCount = 0
            workoutsSummary = []
          }
        }

        const metricRec = new Record(metricsCol)
        metricRec.set('user', uId)
        metricRec.set('provider', item.provider)
        metricRec.set('date', dateStr)
        metricRec.set('steps', steps)
        metricRec.set('heart_rate_avg', hrAvg)
        metricRec.set('heart_rate_min', hrMin)
        metricRec.set('heart_rate_max', hrMax)
        metricRec.set('calories_active', calActive)
        metricRec.set('calories_total', calTotal)
        metricRec.set('sleep_duration_seconds', sleepSeconds)
        metricRec.set('sleep_score', sleepScore)
        metricRec.set('workouts_count', workoutsCount)
        metricRec.set('workouts_summary', workoutsSummary)
        metricRec.set('distance_meters', distanceMeters)
        metricRec.set('synced_at', d.toISOString().slice(0, 10) + ' 23:45:00')
        metricRec.set('raw_payload', {
          source: item.aggregator,
          provider: item.provider,
          device: item.device_label,
          daily_summary: {
            steps: steps,
            active_cal: calActive,
            resting_hr: hrMin,
            avg_hr: hrAvg,
            sleep_hours: +(sleepSeconds / 3600).toFixed(1),
          },
        })
        app.save(metricRec)
      }
    }

    // -------------------------------------------------------------------------
    // 4. INDICAÇÕES MOCADAS (referrals)
    // Conectar os usuários existentes respeitando a hierarquia de rede e unicidade de 'referred'
    // Status aceitos pelo schema: 'pending', 'validated'
    // -------------------------------------------------------------------------
    const referralsCol = app.findCollectionByNameOrId('referrals')

    // Mapeamento de indicações coerentes da rede:
    // - Carlos (Profissional Premium) indicou:
    //     * Marina (Dra. Marina Santos - Profissional Básico) -> validada
    //     * Lucas (Lucas Ferreira - Aluno Pro) -> validada (aluno muito ativo com Carlos)
    //     * Lais T (Profissional Básico) -> validada
    // - Marina indicou:
    //     * Lais M (Profissional Básico) -> validada
    //     * Ana (Ana Guerreira - Aluna Grátis) -> pendente (em avaliação/primeiras sessões)
    // - Lucas Ferreira (Aluno Pro) indicou:
    //     * Pedro Guerreiro (Aluno) -> validada
    //     * Combatente (Lucas Combatente - Aluno) -> pendente
    const targetReferrals = []

    if (carlos && marina) {
      targetReferrals.push({
        referrer: carlos.id,
        referred: marina.id,
        level: 2,
        code: carlos.getString('referral_code') || 'CARLOS369',
        status: 'validated',
        services_count: 5,
        validated_at: nowIsoDate + ' 10:00:00',
        referral_bonus_paid: true,
      })
    }

    if (carlos && lucas) {
      targetReferrals.push({
        referrer: carlos.id,
        referred: lucas.id,
        level: 2,
        code: carlos.getString('referral_code') || 'CARLOS369',
        status: 'validated',
        services_count: 6,
        validated_at: nowIsoDate + ' 11:30:00',
        referral_bonus_paid: true,
      })
    }

    if (carlos && laisT) {
      targetReferrals.push({
        referrer: carlos.id,
        referred: laisT.id,
        level: 2,
        code: carlos.getString('referral_code') || 'CARLOS369',
        status: 'validated',
        services_count: 3,
        validated_at: nowIsoDate + ' 14:00:00',
        referral_bonus_paid: true,
      })
    }

    if (marina && laisM) {
      targetReferrals.push({
        referrer: marina.id,
        referred: laisM.id,
        level: 3,
        code: marina.getString('referral_code') || 'MARINA369',
        status: 'validated',
        services_count: 2,
        validated_at: nowIsoDate + ' 09:15:00',
        referral_bonus_paid: true,
      })
    }

    if (marina && ana) {
      targetReferrals.push({
        referrer: marina.id,
        referred: ana.id,
        level: 3,
        code: marina.getString('referral_code') || 'MARINA369',
        status: 'pending',
        services_count: 1,
        validated_at: null,
        referral_bonus_paid: false,
      })
    }

    if (lucas && pedro) {
      targetReferrals.push({
        referrer: lucas.id,
        referred: pedro.id,
        level: 2,
        code: lucas.getString('referral_code') || 'LUCAS369',
        status: 'validated',
        services_count: 5,
        validated_at: nowIsoDate + ' 16:00:00',
        referral_bonus_paid: true,
      })
    }

    if (lucas && combatente) {
      targetReferrals.push({
        referrer: lucas.id,
        referred: combatente.id,
        level: 2,
        code: lucas.getString('referral_code') || 'LUCAS369',
        status: 'pending',
        services_count: 0,
        validated_at: null,
        referral_bonus_paid: false,
      })
    }

    for (const ref of targetReferrals) {
      let refRecord
      try {
        refRecord = app.findFirstRecordByData('referrals', 'referred', ref.referred)
      } catch (_) {
        refRecord = new Record(referralsCol)
      }

      refRecord.set('referrer', ref.referrer)
      refRecord.set('referred', ref.referred)
      refRecord.set('level', ref.level)
      refRecord.set('code', ref.code)
      refRecord.set('status', ref.status)
      refRecord.set('services_count', ref.services_count)
      if (ref.validated_at) {
        refRecord.set('validated_at', ref.validated_at)
      }
      refRecord.set('referral_bonus_paid', ref.referral_bonus_paid)
      app.save(refRecord)
    }

    // -------------------------------------------------------------------------
    // 5. RECÁLCULO DO RANKING (rank_entries)
    // Aplicar fórmula Caminho C para refletir imediatamente as novas indicações:
    // PONTOS = PLANO × SERVIÇOS (R$) × INDICAÇÕES + AVALIAÇÃO + ANTIGUIDADE
    // Atualiza colunas: user, cycle, points, services_count, referrals_count,
    // referrals_this_cycle, stars, ranking_position, tie_break_details
    // -------------------------------------------------------------------------
    const currentCycle = nowIso.slice(0, 7) // 'YYYY-MM'
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .replace('T', ' ')

    const planMultipliers = {
      gratis: 0,
      basico: 1,
      pro: 2,
      premium: 3,
    }

    const planTarifas = {
      gratis: 1.0,
      basico: 1.0,
      pro: 2.0,
      premium: 3.0,
    }

    const allApprovedUsers = app.findRecordsByFilter(
      'users',
      'approved = true',
      '-created',
      1000,
      0,
    )
    const scores = []

    for (const u of allApprovedUsers) {
      const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
      const role = u.get('role') || 'aluno'

      const multiplier = planMultipliers[rawPlan] ?? 0
      if (multiplier === 0) {
        continue // Plano Grátis 0x não pontua e não aparece no ranking conforme regra do Caminho C
      }

      let effectiveMultiplier = multiplier
      const linkedProfId = u.get('linked_professional')
      const feeMode = u.get('linked_prof_fee_mode') || 'own_plan'
      if (role === 'aluno' && linkedProfId && feeMode === 'prof_sponsored') {
        try {
          const profUser = app.findRecordById('users', linkedProfId)
          const profPlan = (profUser.get('plan') || 'basico').toLowerCase()
          effectiveMultiplier = planMultipliers[profPlan] ?? 1
        } catch (_) {}
      }

      const serviceFilter =
        role === 'profissional'
          ? "professional = '" +
            u.id +
            "' && status = 'concluido' && created >= '" +
            currentMonthStart +
            "'"
          : "student = '" +
            u.id +
            "' && status = 'concluido' && created >= '" +
            currentMonthStart +
            "'"

      let servicesThisMonth = []
      try {
        servicesThisMonth = app.findRecordsByFilter('services', serviceFilter, '-created', 500, 0)
      } catch (_) {}

      // Soma em R$ das tarifas dos serviços
      let servicesTarifaRS = 0
      for (const svc of servicesThisMonth) {
        let rate = planTarifas[rawPlan] ?? 1.0
        try {
          const txs = app.findRecordsByFilter(
            'wallet_transactions',
            "reference_id = '" + svc.id + "' && type = 'tarifa'",
            '-created',
            1,
            0,
          )
          if (txs && txs.length > 0) {
            rate = Math.abs(Number(txs[0].get('amount') || rate))
          }
        } catch (_) {}
        servicesTarifaRS += rate
      }

      // Se serviços no mês estiver zerado mas o usuário tem serviços concluídos no histórico, considerar tarifa base
      if (servicesTarifaRS === 0 && servicesThisMonth.length === 0) {
        try {
          const histFilter =
            role === 'profissional'
              ? "professional = '" + u.id + "' && status = 'concluido'"
              : "student = '" + u.id + "' && status = 'concluido'"
          const histServices = app.findRecordsByFilter('services', histFilter, '-created', 500, 0)
          if (histServices && histServices.length > 0) {
            servicesTarifaRS = histServices.length * (planTarifas[rawPlan] ?? 1.0)
            servicesThisMonth = histServices
          }
        } catch (_) {}
      }

      // Indicações deste ciclo e históricas
      let allReferrals = []
      try {
        allReferrals = app.findRecordsByFilter(
          'referrals',
          "referrer = '" + u.id + "'",
          '-created',
          500,
          0,
        )
      } catch (_) {}

      let referralsThisCycle = []
      try {
        referralsThisCycle = app.findRecordsByFilter(
          'referrals',
          "referrer = '" + u.id + "' && created >= '" + currentMonthStart + "'",
          '-created',
          500,
          0,
        )
      } catch (_) {}

      // Se todas foram criadas agora no ciclo corrente, usar a contagem real
      const servicosCount = servicesThisMonth.length
      const totalIndicacoes = allReferrals.length
      const indicacoesCount = Math.max(
        referralsThisCycle.length,
        totalIndicacoes > 0 ? totalIndicacoes : 0,
      )

      const avaliacao = Math.round(Number(u.get('rating_avg') || 5))
      const createdDate = u.get('created') ? new Date(u.get('created')) : new Date()
      const diffMonths = Math.max(
        1,
        Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
      )
      const antiguidade = Math.min(diffMonths, 10)

      const indicacoesFator = Math.max(indicacoesCount, 1)
      const monthlyPoints =
        Math.round(effectiveMultiplier * servicesTarifaRS * indicacoesFator) +
        avaliacao +
        antiguidade

      let closedPastPoints = 0
      try {
        const pastSnapshots = app.findRecordsByFilter(
          'monthly_rank_snapshots',
          "user = '" + u.id + "' && cycle != '" + currentCycle + "'",
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
        role: role,
        plan: rawPlan,
        multiplier: effectiveMultiplier,
        services_count: servicosCount,
        services_tarifa_rs: servicesTarifaRS,
        referrals_count: totalIndicacoes,
        referrals_this_cycle: indicacoesCount,
        stars: avaliacao,
        antiguidade: antiguidade,
        monthly_points: monthlyPoints,
        closed_past_points: closedPastPoints,
        total_points: totalPoints,
        created: u.get('created'),
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

    const rankCol = app.findCollectionByNameOrId('rank_entries')

    for (let i = 0; i < scores.length; i++) {
      const s = scores[i]
      let entry
      try {
        entry = app.findFirstRecordByData('rank_entries', 'user', s.user.id)
      } catch (_) {
        entry = new Record(rankCol)
      }

      entry.set('user', s.user.id)
      entry.set('cycle', currentCycle)
      entry.set('points', s.total_points)
      entry.set('services_count', s.services_count)
      entry.set('referrals_count', s.referrals_count)
      entry.set('referrals_this_cycle', s.referrals_this_cycle)
      entry.set('stars', s.stars)
      entry.set('ranking_position', i + 1)
      entry.set('tie_break_details', {
        stars: s.stars,
        antiguidade: s.antiguidade,
        plan_multiplier: s.multiplier,
        monthly_points: s.monthly_points,
        closed_past_points: s.closed_past_points,
        services_tarifa_rs: s.services_tarifa_rs,
        cycle: currentCycle,
        formula: 'PONTOS = (PLANO) × (SERVIÇOS R$) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
        recomputed_at: nowIso,
      })
      app.save(entry)
    }
  },
  (app) => {
    // Reverter dados criados caso necessário
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM wearable_metrics WHERE provider IN ('garmin', 'apple_watch', 'strava')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "DELETE FROM wearable_connections WHERE provider IN ('garmin', 'apple_watch', 'strava')",
        )
        .execute()
    } catch (_) {}
  },
)

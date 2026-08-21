migrate(
  (app) => {
    // 1. Aprovar os 3 profissionais pendentes
    const pendingProfIds = ['iinwtaqpu07h9a8', 'gaqtq4psh10w2ot', 'fu5ncan3b8fd0w2']
    for (const profId of pendingProfIds) {
      try {
        const profRecord = app.findRecordById('users', profId)
        profRecord.set('approved', true)
        app.save(profRecord)
      } catch (e) {}
    }

    // 2. Criar Referrals na collection referrals
    const referralsCol = app.findCollectionByNameOrId('referrals')
    const treeReferrals = [
      { referrer: 'vhvun6ujx1esr19', referred: 'iinwtaqpu07h9a8', level: 2, code: 'CARLOS369-ESQ' },
      { referrer: 'vhvun6ujx1esr19', referred: 'gaqtq4psh10w2ot', level: 2, code: 'CARLOS369-DIR' },
      { referrer: 'iinwtaqpu07h9a8', referred: 'fu5ncan3b8fd0w2', level: 3, code: 'MARINA369-ESQ' },
    ]

    for (const ref of treeReferrals) {
      try {
        const existingRef = app.findFirstRecordByData('referrals', 'referred', ref.referred)
        existingRef.set('referrer', ref.referrer)
        existingRef.set('level', ref.level)
        existingRef.set('code', ref.code)
        app.save(existingRef)
      } catch (_) {
        const newRef = new Record(referralsCol)
        newRef.set('referrer', ref.referrer)
        newRef.set('referred', ref.referred)
        newRef.set('level', ref.level)
        newRef.set('code', ref.code)
        app.save(newRef)
      }
    }

    // 3. Criar 3 Alunos de teste
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const testStudents = [
      {
        email: 'guerreiro1@test.com',
        name: 'Pedro Guerreiro',
        role: 'aluno',
        plan: 'gratis',
        plan_type: 'aluno',
        password: 'Teste@123',
        referral_code: 'PEDRO369',
      },
      {
        email: 'guerreiro2@test.com',
        name: 'Ana Guerreira',
        role: 'aluno',
        plan: 'gratis',
        plan_type: 'aluno',
        password: 'Teste@123',
        referral_code: 'ANA369',
      },
      {
        email: 'guerreiro3@test.com',
        name: 'Lucas Combatente',
        role: 'aluno',
        plan: 'gratis',
        plan_type: 'aluno',
        password: 'Teste@123',
        referral_code: 'COMBAT369',
      },
    ]

    const createdStudentRecords = {}
    for (const s of testStudents) {
      let stRecord
      try {
        stRecord = app.findAuthRecordByEmail('_pb_users_auth_', s.email)
        stRecord.set('name', s.name)
        stRecord.set('role', s.role)
        stRecord.set('plan', s.plan)
        stRecord.set('plan_type', s.plan_type)
        stRecord.set('approved', true)
        stRecord.setPassword(s.password)
        app.save(stRecord)
      } catch (_) {
        stRecord = new Record(usersCol)
        stRecord.setEmail(s.email)
        stRecord.setPassword(s.password)
        stRecord.setVerified(true)
        stRecord.set('name', s.name)
        stRecord.set('role', s.role)
        stRecord.set('plan', s.plan)
        stRecord.set('plan_type', s.plan_type)
        stRecord.set('approved', true)
        stRecord.set('referral_code', s.referral_code)
        app.save(stRecord)
      }
      createdStudentRecords[s.email] = stRecord
    }

    const pedroId = createdStudentRecords['guerreiro1@test.com'].id
    const anaId = createdStudentRecords['guerreiro2@test.com'].id
    const lucasId = createdStudentRecords['guerreiro3@test.com'].id

    // 4. Criar Serviços Concluídos
    const servicesCol = app.findCollectionByNameOrId('services')
    const servicesToCreate = [
      {
        professional: 'vhvun6ujx1esr19',
        student: pedroId,
        count: 5,
        titlePrefix: 'Consultoria e Treinamento VIP Carlos #',
        type: 'Consultoria Presencial + App',
        value: 150.0,
      },
      {
        professional: 'iinwtaqpu07h9a8',
        student: anaId,
        count: 2,
        titlePrefix: 'Sessão Fisioterapia e Reabilitação Marina #',
        type: 'Fisioterapia e Reabilitação',
        value: 120.0,
      },
      {
        professional: 'gaqtq4psh10w2ot',
        student: lucasId,
        count: 1,
        titlePrefix: 'Treinamento Funcional Personalizado Lais T #',
        type: 'Treinamento Funcional',
        value: 100.0,
      },
    ]

    const createdServices = []
    const nowIsoDate = new Date().toISOString().slice(0, 10)

    for (const group of servicesToCreate) {
      for (let i = 1; i <= group.count; i++) {
        const title = group.titlePrefix + i
        let svcRecord
        try {
          svcRecord = app.findFirstRecordByData('services', 'title', title)
          svcRecord.set('professional', group.professional)
          svcRecord.set('student', group.student)
          svcRecord.set('type', group.type)
          svcRecord.set('value', group.value)
          svcRecord.set('status', 'concluido')
          svcRecord.set('completed_at', nowIsoDate)
          app.save(svcRecord)
        } catch (_) {
          svcRecord = new Record(servicesCol)
          svcRecord.set('professional', group.professional)
          svcRecord.set('student', group.student)
          svcRecord.set('type', group.type)
          svcRecord.set('title', title)
          svcRecord.set('value', group.value)
          svcRecord.set('status', 'concluido')
          svcRecord.set('completed_at', nowIsoDate)
          svcRecord.set('notes', 'Atendimento concluído e registrado no sistema 369TRAINING.')
          app.save(svcRecord)
        }
        createdServices.push({
          record: svcRecord,
          professional: group.professional,
          value: group.value,
        })
      }
    }

    // 5. Popular rank_entries usando SQL direto para evitar qualquer validação de schema intermediária
    const currentCycle = new Date().toISOString().slice(0, 7)
    const nowIso = new Date().toISOString()
    const rankedData = [
      {
        user: 'vhvun6ujx1esr19',
        points: 17,
        services_count: 5,
        referrals_count: 2,
        stars: 4.9,
        pos: 1,
        tarifa_rs: 3.0,
      },
      {
        user: 'iinwtaqpu07h9a8',
        points: 2,
        services_count: 2,
        referrals_count: 1,
        stars: 5.0,
        pos: 2,
        tarifa_rs: 1.0,
      },
      {
        user: 'gaqtq4psh10w2ot',
        points: 1,
        services_count: 1,
        referrals_count: 0,
        stars: 5.0,
        pos: 3,
        tarifa_rs: 1.0,
      },
      {
        user: 'fu5ncan3b8fd0w2',
        points: 0,
        services_count: 0,
        referrals_count: 0,
        stars: 5.0,
        pos: 4,
        tarifa_rs: 1.0,
      },
    ]

    for (const item of rankedData) {
      const details = JSON.stringify({
        position: item.pos,
        stars: item.stars,
        tarifa_rs: item.tarifa_rs,
        cycle: currentCycle,
        formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
        recomputed_at: nowIso,
      })

      // Excluir registros antigos desse usuário se existirem
      app
        .db()
        .newQuery('DELETE FROM rank_entries WHERE user = {:user}')
        .bind({ user: item.user })
        .execute()

      // Inserir novo registro com id aleatório
      const newId = $security.randomString(15)
      app
        .db()
        .newQuery(`
        INSERT INTO rank_entries (id, user, cycle, points, services_count, referrals_count, stars, ranking_position, tie_break_details, created, updated)
        VALUES ({:id}, {:user}, {:cycle}, {:points}, {:services_count}, {:referrals_count}, {:stars}, {:ranking_position}, {:tie_break_details}, {:created}, {:updated})
      `)
        .bind({
          id: newId,
          user: item.user,
          cycle: currentCycle,
          points: item.points,
          services_count: item.services_count,
          referrals_count: item.referrals_count,
          stars: item.stars,
          ranking_position: item.pos,
          tie_break_details: details,
          created: nowIso,
          updated: nowIso,
        })
        .execute()
    }

    // 6. Criar Transações de Carteira e Cashback
    const walletCol = app.findCollectionByNameOrId('wallet_transactions')
    const cbDistCol = app.findCollectionByNameOrId('cashback_distributions')
    const notifCol = app.findCollectionByNameOrId('notifications')

    for (const item of createdServices) {
      const svcRecord = item.record
      const profId = item.professional
      const serviceValue = item.value
      const serviceId = svcRecord.id
      const tarifaAmount = profId === 'vhvun6ujx1esr19' ? 3.0 : 1.0

      try {
        const existingTarifaTx = app.findRecordsByFilter(
          'wallet_transactions',
          "reference_type = 'services' && reference_id = '" + serviceId + "' && type = 'tarifa'",
          '',
          1,
          0,
        )
        if (!existingTarifaTx || existingTarifaTx.length === 0) {
          const tarifaTx = new Record(walletCol)
          tarifaTx.set('user', profId)
          tarifaTx.set('type', 'tarifa')
          tarifaTx.set('amount', -Math.abs(tarifaAmount))
          tarifaTx.set('status', 'concluido')
          tarifaTx.set('reference_type', 'services')
          tarifaTx.set('reference_id', serviceId)
          tarifaTx.set('description', 'Tarifa de serviço (R$ ' + tarifaAmount.toFixed(2) + ')')
          app.save(tarifaTx)

          const servicoTx = new Record(walletCol)
          servicoTx.set('user', profId)
          servicoTx.set('type', 'servico')
          servicoTx.set('amount', serviceValue - tarifaAmount)
          servicoTx.set('status', 'concluido')
          servicoTx.set('reference_type', 'services')
          servicoTx.set('reference_id', serviceId)
          servicoTx.set(
            'description',
            'Recebimento de serviço concluído (' + svcRecord.getString('title') + ')',
          )
          app.save(servicoTx)
        }
      } catch (_) {}

      // Cashback para Upline
      const totalPoolShare = serviceValue * 0.38
      let currentReferralUser = profId
      let level = 1

      while (level <= 36) {
        try {
          const refRecord = app.findFirstRecordByData('referrals', 'referred', currentReferralUser)
          const uplineUserId = refRecord.getString('referrer')
          if (!uplineUserId) break

          const existingCb = app.findRecordsByFilter(
            'cashback_distributions',
            "service_id = '" + serviceId + "' && user = '" + uplineUserId + "'",
            '',
            1,
            0,
          )

          if (!existingCb || existingCb.length === 0) {
            const nivelVariavel = 0.28
            const divisor = 1.0
            const modifier = 1.45
            let cashbackRaw = (totalPoolShare * nivelVariavel) / (divisor * modifier)
            const levelAmount = Math.max(0.01, Math.round(cashbackRaw * 100) / 100)

            const cbRecord = new Record(cbDistCol)
            cbRecord.set('user', uplineUserId)
            cbRecord.set('service_id', serviceId)
            cbRecord.set('level', level)
            cbRecord.set('pool_share', totalPoolShare)
            cbRecord.set('variable_pct', nivelVariavel)
            cbRecord.set('divisor', divisor)
            cbRecord.set('modifier', modifier)
            cbRecord.set('amount', levelAmount)
            cbRecord.set('metas', {
              bonus: +(levelAmount * 0.55).toFixed(2),
              economica: +(levelAmount * 0.15).toFixed(2),
              social: +(levelAmount * 0.15).toFixed(2),
              ecologica: +(levelAmount * 0.15).toFixed(2),
            })
            app.save(cbRecord)

            const cbTx = new Record(walletCol)
            cbTx.set('user', uplineUserId)
            cbTx.set('type', 'cashback')
            cbTx.set('amount', levelAmount)
            cbTx.set('status', 'concluido')
            cbTx.set('reference_type', 'cashback_distribution')
            cbTx.set('reference_id', serviceId)
            cbTx.set('description', 'Cashback Nível ' + level + ' - 369 Partner Pool 38%')
            app.save(cbTx)

            const notif = new Record(notifCol)
            notif.set('user', uplineUserId)
            notif.set('type', 'cashback')
            notif.set('title', 'Cashback Recebido! R$ ' + levelAmount.toFixed(2))
            notif.set(
              'body',
              'Você recebeu cashback do Nível ' + level + ' através da sua rede 369TRAINING.',
            )
            notif.set('read', false)
            notif.set('action_url', '/profissional/carteira')
            app.save(notif)
          }

          currentReferralUser = uplineUserId
          level++
        } catch (_) {
          break
        }
      }
    }
  },
  (app) => {},
)

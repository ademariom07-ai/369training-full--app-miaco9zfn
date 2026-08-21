onRecordAfterUpdateSuccess((e) => {
  const status = e.record.getString('status')
  const oldStatus = e.record.original().getString('status')

  // Only execute when status moves to "concluido"
  if (status !== 'concluido' || oldStatus === 'concluido') {
    return e.next()
  }

  const profId = e.record.getString('professional')
  const studentId = e.record.getString('student')
  const serviceValue = e.record.getFloat('value') || 0
  const serviceId = e.record.id

  if (!profId || serviceValue <= 0) {
    return e.next()
  }

  try {
    // 1. Get Professional
    const prof = $app.findRecordById('users', profId)
    const profPlan = prof.getString('plan') || 'basico'

    // 2. Platform Config
    let tarifaAmount = 2.0
    let partnerPoolPct = 0.38
    let esgMetas = { economica: 0.55, social: 0.15, ecologica: 0.15, bonus: 0.15 }

    try {
      const tarifaConfig = $app.findFirstRecordByData('platform_config', 'key', 'plan_tarifas')
      const tarifas = tarifaConfig.get('value') || {}
      if (tarifas[profPlan] !== undefined) {
        tarifaAmount = tarifas[profPlan]
      }
    } catch (_) {}

    try {
      const revConfig = $app.findFirstRecordByData('platform_config', 'key', 'revenue_split')
      const rev = revConfig.get('value') || {}
      if (rev.partner_pool_pct !== undefined) {
        partnerPoolPct = rev.partner_pool_pct
      }
    } catch (_) {}

    try {
      const esgConfig = $app.findFirstRecordByData('platform_config', 'key', 'esg_metas')
      const esg = esgConfig.get('value') || {}
      if (esg.economica !== undefined) {
        esgMetas = esg
      }
    } catch (_) {}

    // 3. Deduct service tariff & credit professional net earnings in wallet
    const walletCol = $app.findCollectionByNameOrId('wallet_transactions')

    // Tarifa transaction
    const tarifaTx = new Record(walletCol)
    tarifaTx.set('user', profId)
    tarifaTx.set('type', 'tarifa')
    tarifaTx.set('amount', -Math.abs(tarifaAmount))
    tarifaTx.set('status', 'concluido')
    tarifaTx.set('reference_type', 'services')
    tarifaTx.set('reference_id', serviceId)
    tarifaTx.set('description', 'Tarifa de serviço (Plano ' + profPlan.toUpperCase() + ')')
    $app.save(tarifaTx)

    // Servico credit transaction
    const netServiceEarned = serviceValue - tarifaAmount
    const servicoTx = new Record(walletCol)
    servicoTx.set('user', profId)
    servicoTx.set('type', 'servico')
    servicoTx.set('amount', Math.max(0, netServiceEarned))
    servicoTx.set('status', 'concluido')
    servicoTx.set('reference_type', 'services')
    servicoTx.set('reference_id', serviceId)
    servicoTx.set('description', 'Recebimento de serviço concluído')
    $app.save(servicoTx)

    // 4. Partner Pool Cashback calculation across upline referrals (up to 36 levels)
    const totalPoolShare = serviceValue * partnerPoolPct
    let currentReferralUser = profId
    let level = 1

    const cbDistCol = $app.findCollectionByNameOrId('cashback_distributions')
    const notifCol = $app.findCollectionByNameOrId('notifications')

    while (level <= 36) {
      try {
        const refRecord = $app.findFirstRecordByData('referrals', 'referred', currentReferralUser)
        const uplineUserId = refRecord.getString('referrer')
        if (!uplineUserId) break

        // Formula: valor_nivel = pool_share * nivel_variavel(24%->180%) / divisor(2^(n-1)) / modificador(1.0->18.5)
        const nivelVariavel = Math.min(1.8, 0.24 + level * 0.04)
        const divisor = Math.pow(2, Math.min(level - 1, 10)) // limit power scaling
        const modifier = Math.min(18.5, 1.0 + level * 0.45)
        const cashbackRaw = (totalPoolShare * nivelVariavel) / (divisor * modifier)
        const levelAmount = Math.max(0.01, Math.round(cashbackRaw * 100) / 100)

        const metasSplit = {
          economica: Math.round(levelAmount * esgMetas.economica * 100) / 100,
          social: Math.round(levelAmount * esgMetas.social * 100) / 100,
          ecologica: Math.round(levelAmount * esgMetas.ecologica * 100) / 100,
          bonus: Math.round(levelAmount * esgMetas.bonus * 100) / 100,
        }

        // Persist Cashback Distribution
        const cbRecord = new Record(cbDistCol)
        cbRecord.set('user', uplineUserId)
        cbRecord.set('service_id', serviceId)
        cbRecord.set('level', level)
        cbRecord.set('pool_share', totalPoolShare)
        cbRecord.set('variable_pct', nivelVariavel)
        cbRecord.set('divisor', divisor)
        cbRecord.set('modifier', modifier)
        cbRecord.set('amount', levelAmount)
        cbRecord.set('metas', metasSplit)
        $app.save(cbRecord)

        // Credit Wallet of upline user
        const cbTx = new Record(walletCol)
        cbTx.set('user', uplineUserId)
        cbTx.set('type', 'cashback')
        cbTx.set('amount', levelAmount)
        cbTx.set('status', 'concluido')
        cbTx.set('reference_type', 'cashback_distribution')
        cbTx.set('reference_id', serviceId)
        cbTx.set('description', 'Cashback Nível ' + level + ' (369 Partner Pool)')
        $app.save(cbTx)

        // Notify upline user
        const notif = new Record(notifCol)
        notif.set('user', uplineUserId)
        notif.set('type', 'cashback')
        notif.set('title', 'Cashback Recebido! R$ ' + levelAmount.toFixed(2))
        notif.set(
          'body',
          'Você recebeu cashback do Nível ' + level + ' através da sua rede 369TRAINING.',
        )
        notif.set('read', false)
        notif.set('action_url', '/aluno/perfil')
        $app.save(notif)

        currentReferralUser = uplineUserId
        level++
      } catch (_) {
        // No further upline referral
        break
      }
    }

    // 5. Update / Create Rank Entry for the Professional
    const currentCycle = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    const rankCol = $app.findCollectionByNameOrId('rank_entries')

    let referralsCount = 0
    try {
      const refList = $app.findRecordsByFilter(
        'referrals',
        "referrer = '" + profId + "'",
        '',
        1000,
        0,
      )
      referralsCount = refList ? refList.length : 0
    } catch (_) {}

    let servicesCount = 1
    try {
      const svcList = $app.findRecordsByFilter(
        'services',
        "professional = '" + profId + "' && status = 'concluido'",
        '',
        1000,
        0,
      )
      servicesCount = svcList ? svcList.length : 1
    } catch (_) {}

    // Nova fórmula: pontos = tarifa_R$ × serviços × (indicações/18 + 1)
    // Tarifas: Básico = R$1, Pro = R$2, Premium = R$3
    let rankingTarifaRS = tarifaAmount
    if (!rankingTarifaRS || rankingTarifaRS <= 0) {
      rankingTarifaRS = profPlan === 'premium' ? 3.0 : profPlan === 'pro' ? 2.0 : 1.0
    }
    const variavel = referralsCount / 18 + 1
    const pontos = Math.round(rankingTarifaRS * servicesCount * variavel)
    const stars = prof.getFloat('rating_avg') || 5.0

    let rankRec
    try {
      rankRec = $app.findFirstRecordByData('rank_entries', 'user', profId)
    } catch (_) {
      rankRec = new Record(rankCol)
      rankRec.set('user', profId)
    }

    rankRec.set('cycle', currentCycle)
    rankRec.set('points', pontos)
    rankRec.set('services_count', servicesCount)
    rankRec.set('referrals_count', referralsCount)
    rankRec.set('stars', stars)
    rankRec.set('tie_break_details', {
      stars: stars,
      points_raw: pontos,
      updated_at: new Date().toISOString(),
    })
    $app.save(rankRec)

    // 6. Notify Student and Professional of completion
    const notifProf = new Record(notifCol)
    notifProf.set('user', profId)
    notifProf.set('type', 'service_completed')
    notifProf.set('title', 'Serviço Concluído com Sucesso')
    notifProf.set('body', 'Serviço registrado. Seus pontos no ranking e saldo foram atualizados.')
    notifProf.set('read', false)
    notifProf.set('action_url', '/profissional/carteira')
    $app.save(notifProf)

    const notifStudent = new Record(notifCol)
    notifStudent.set('user', studentId)
    notifStudent.set('type', 'service_completed')
    notifStudent.set('title', 'Atendimento Finalizado')
    notifStudent.set('body', 'Seu profissional concluiu o atendimento. Confira sua evolução!')
    notifStudent.set('read', false)
    notifStudent.set('action_url', '/aluno')
    $app.save(notifStudent)
  } catch (err) {
    console.log('Error in on_service_completed hook:', err.message)
  }

  return e.next()
}, 'services')

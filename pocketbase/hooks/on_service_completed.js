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

    // 2. Platform Config & Global Split (Pool de parceiros 38%, App 30%, Filantropia 10%, Imposto 10%, Suporte 4%, Mkt 4%, Investidor 4%)
    let tarifaAmount = 1.0
    let partnerPoolPct = 0.38
    let esgMetas = { bonus: 0.55, economica: 0.15, social: 0.15, ecologica: 0.15 }

    try {
      const tarifaConfig = $app.findFirstRecordByData('platform_config', 'key', 'plan_tarifas')
      const tarifas = tarifaConfig.get('value') || {}
      if (tarifas[profPlan] !== undefined) {
        tarifaAmount = Number(tarifas[profPlan])
      } else {
        tarifaAmount = profPlan === 'premium' ? 3.0 : profPlan === 'pro' ? 2.0 : 1.0
      }
    } catch (_) {
      tarifaAmount = profPlan === 'premium' ? 3.0 : profPlan === 'pro' ? 2.0 : 1.0
    }

    try {
      const revConfig = $app.findFirstRecordByData('platform_config', 'key', 'revenue_split')
      const rev = revConfig.get('value') || {}
      if (rev.partner_pool_pct !== undefined) {
        partnerPoolPct = Number(rev.partner_pool_pct)
      }
    } catch (_) {}

    try {
      const esgConfig = $app.findFirstRecordByData('platform_config', 'key', 'esg_metas')
      const esg = esgConfig.get('value') || {}
      if (esg.bonus !== undefined) {
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
    tarifaTx.set(
      'description',
      'Tarifa de serviço (Plano ' +
        profPlan.toUpperCase() +
        ' - R$ ' +
        tarifaAmount.toFixed(2) +
        ')',
    )
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

    // 4. Carregar parâmetros individuais da coleção binary_tree_params (posições 1 a 511)
    let paramsMap = {}
    try {
      const allParams = $app.findRecordsByFilter('binary_tree_params', '', 'position', 600, 0)
      if (allParams) {
        for (let p of allParams) {
          paramsMap[p.getInt('position')] = {
            level: p.getInt('level'),
            segment: p.getString('segment'),
            coefficient: p.getFloat('coefficient'),
            modifier: p.getFloat('modifier'),
            divisor: p.getFloat('divisor'),
            level_percentage: p.getFloat('level_percentage'),
            cashback_weight: p.getFloat('cashback_weight'),
          }
        }
      }
    } catch (_) {}

    // Mapeamento de posições de todos os profissionais para aplicar cashback conforme posição no ranking
    let userRankPosMap = {}
    try {
      const allRankEntries = $app.findRecordsByFilter(
        'rank_entries',
        '',
        'ranking_position',
        500,
        0,
      )
      if (allRankEntries) {
        for (let r of allRankEntries) {
          userRankPosMap[r.getString('user')] = r.getInt('ranking_position')
        }
      }
    } catch (_) {}

    // 5. Partner Pool 38%: Distribuído por todos os níveis habitados (até 36 níveis / 68.719.476.735 posições)
    const totalPoolShare = serviceValue * partnerPoolPct
    let currentReferralUser = profId
    let level = 1

    const cbDistCol = $app.findCollectionByNameOrId('cashback_distributions')
    const notifCol = $app.findCollectionByNameOrId('notifications')

    const currentCycle = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    const cycleStartDate = currentCycle + '-01 00:00:00.000Z'

    while (level <= 36) {
      try {
        const refRecord = $app.findFirstRecordByData('referrals', 'referred', currentReferralUser)
        const uplineUserId = refRecord.getString('referrer')
        if (!uplineUserId) break

        const userRankPos = userRankPosMap[uplineUserId] || Math.min(511, Math.pow(2, level - 1))

        // MODELO HÍBRIDO:
        // Se userRankPos <= 511: parâmetros individuais da tabela binary_tree_params
        // Se userRankPos > 511: cálculo matemático por nível
        let param
        if (userRankPos <= 511 && paramsMap[userRankPos]) {
          param = paramsMap[userRankPos]
        } else {
          let calcLvl = level
          if (userRankPos > 511) {
            calcLvl = 10
            while (calcLvl < 36 && Math.pow(2, calcLvl) - 1 < userRankPos) {
              calcLvl++
            }
          }
          const levelPct = Math.min(1.8, +(0.24 + (calcLvl - 1) * 0.04).toFixed(3))
          const modifier = +(1.0 + (calcLvl - 1) * 0.45).toFixed(2)
          const divisor = Math.pow(2, Math.min(calcLvl - 1, 10))
          const coefficient = Math.max(0.1, +(1000 / Math.pow(userRankPos, 0.75)).toFixed(3))
          const cashbackWeight = Math.max(0.0001, +(1 / (userRankPos * 0.8 + 1)).toFixed(5))

          param = {
            level: calcLvl,
            segment: 'Nível ' + calcLvl + ' Rede',
            coefficient: coefficient,
            modifier: modifier,
            divisor: divisor,
            level_percentage: levelPct,
            cashback_weight: cashbackWeight,
          }
        }

        const nivelVariavel = param.level_percentage || Math.min(1.8, 0.24 + level * 0.04)
        const divisor = param.divisor || Math.pow(2, Math.min(level - 1, 10))
        const modifier = param.modifier || Math.min(18.5, 1.0 + level * 0.45)

        // Base cashback ponderado pela posição no ranking
        let cashbackRaw = (totalPoolShare * nivelVariavel) / (divisor * modifier)
        if (param.cashback_weight) {
          cashbackRaw = cashbackRaw * (1 + param.cashback_weight * 2)
        }

        // 6. Regras de Gatilho ESG (por ciclo mensal acumulado):
        // Acumulado < 10k: 100%
        // R$ 10.000: 1 meta ESG -> se não bater recebe 85%
        // R$ 15.000: 2 metas ESG -> se não bater recebe 55% + 15% por meta batida
        // R$ 20.000: 3 metas ESG -> se não bater recebe 55% + 15% por meta batida
        let monthlyAccumulatedCashback = 0
        try {
          const monthlyTxs = $app.findRecordsByFilter(
            'wallet_transactions',
            "user = '" +
              uplineUserId +
              "' && type = 'cashback' && created >= '" +
              cycleStartDate +
              "'",
            '',
            500,
            0,
          )
          if (monthlyTxs) {
            for (let mtx of monthlyTxs) {
              monthlyAccumulatedCashback += mtx.getFloat('amount') || 0
            }
          }
        } catch (_) {}

        let achievedMetasCount = 3
        let esgPenaltyRate = 1.0

        if (monthlyAccumulatedCashback >= 20000) {
          if (achievedMetasCount < 3) {
            esgPenaltyRate = 0.55 + achievedMetasCount * 0.15
          }
        } else if (monthlyAccumulatedCashback >= 15000) {
          if (achievedMetasCount < 2) {
            esgPenaltyRate = 0.55 + achievedMetasCount * 0.15
          }
        } else if (monthlyAccumulatedCashback >= 10000) {
          if (achievedMetasCount < 1) {
            esgPenaltyRate = 0.85
          }
        }

        const levelAmount = Math.max(0.01, Math.round(cashbackRaw * esgPenaltyRate * 100) / 100)

        // Divisão das metas ESG: Bônus 55% + Econômica 15% + Social 15% + Ecológica 15%
        const metasSplit = {
          bonus: Math.round(levelAmount * (esgMetas.bonus || 0.55) * 100) / 100,
          economica: Math.round(levelAmount * (esgMetas.economica || 0.15) * 100) / 100,
          social: Math.round(levelAmount * (esgMetas.social || 0.15) * 100) / 100,
          ecologica: Math.round(levelAmount * (esgMetas.ecologica || 0.15) * 100) / 100,
          penalty_rate_applied: esgPenaltyRate,
          monthly_accumulated: monthlyAccumulatedCashback,
          ranking_position: userRankPos,
          is_hybrid_calculated: userRankPos > 511,
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
        cbTx.set(
          'description',
          'Cashback Nível ' + level + ' (Pos. #' + userRankPos + ' - 369 Partner Pool 38%)',
        )
        $app.save(cbTx)

        // Notify upline user
        const notif = new Record(notifCol)
        notif.set('user', uplineUserId)
        notif.set('type', 'cashback')
        notif.set('title', 'Cashback Recebido! R$ ' + levelAmount.toFixed(2))
        notif.set(
          'body',
          'Você recebeu cashback do Nível ' +
            level +
            ' (Posição #' +
            userRankPos +
            ') através da sua rede 369TRAINING.',
        )
        notif.set('read', false)
        notif.set('action_url', '/profissional/carteira')
        $app.save(notif)

        currentReferralUser = uplineUserId
        level++
      } catch (_) {
        break
      }
    }

    // 7. Update / Create Rank Entry for the Professional (Pontos cumulativos)
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
        2000,
        0,
      )
      servicesCount = svcList ? svcList.length : 1
    } catch (_) {}

    // Fórmula oficial: pontos = tarifa_R$ × serviços × (indicações/18 + 1)
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
    rankRec.set('points', Number(pontos) || 0)
    rankRec.set('services_count', Number(servicesCount) || 0)
    rankRec.set('referrals_count', Number(referralsCount) || 0)
    rankRec.set('stars', Number(stars) || 5.0)
    rankRec.set('tie_break_details', {
      stars: stars,
      points_raw: pontos,
      tarifa_rs: rankingTarifaRS,
      formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
      updated_at: new Date().toISOString(),
    })
    $app.save(rankRec)

    // 8. Notify Student and Professional of completion
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

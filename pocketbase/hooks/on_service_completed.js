// Hook triggered whenever a service status changes to 'concluido'
// 1. Distribute cashback via 369 Binary Tree algorithm
// 2. Validate referral bonus if student reached min_services_to_validate_referral
onRecordAfterUpdateSuccess((e) => {
  const service = e.record
  const oldStatus = e.oldRecord ? e.oldRecord.get('status') : ''
  const newStatus = service.get('status')

  if (newStatus !== 'concluido' || oldStatus === 'concluido') {
    return
  }

  const profId = service.get('professional')
  const studentId = service.get('student')
  const serviceVal = service.get('value') || 0

  // 1. DISTRIBUIÇÃO BINÁRIA DE CASHBACK
  try {
    const prof = $app.findRecordById('users', profId)
    const plan = (prof.get('plan') || 'gratis').toLowerCase()

    let rate = 4.0
    if (plan === 'basico') rate = 1.0
    if (plan === 'pro') rate = 2.0
    if (plan === 'premium') rate = 3.0

    // Pool de parceiros (38% da tarifa)
    const partnerPool = rate * 0.38
    const baseSharePerLevel = partnerPool / 9 // 9 levels in binary tree

    const ancestry = []
    let currentUserId = profId
    for (let lvl = 1; lvl <= 9; lvl++) {
      try {
        const ref = $app.findFirstRecordByData('referrals', 'referred', currentUserId)
        if (ref && ref.get('referrer')) {
          ancestry.push({ level: lvl, userId: ref.get('referrer') })
          currentUserId = ref.get('referrer')
        } else {
          break
        }
      } catch (_) {
        break
      }
    }

    const cbCol = $app.findCollectionByNameOrId('cashback_distributions')
    const walletCol = $app.findCollectionByNameOrId('wallet_transactions')

    for (const node of ancestry) {
      const amount = Number((baseSharePerLevel * (1 / node.level)).toFixed(2))
      if (amount <= 0) continue

      const cb = new Record(cbCol)
      cb.set('user', node.userId)
      cb.set('service_id', service.id)
      cb.set('level', node.level)
      cb.set('pool_share', partnerPool)
      cb.set('amount', amount)
      cb.set('metas', { esg_achieved: true, plan: plan })
      $app.save(cb)

      const w = new Record(walletCol)
      w.set('user', node.userId)
      w.set('type', 'cashback')
      w.set('amount', amount)
      w.set('status', 'concluido')
      w.set('reference_type', 'service')
      w.set('reference_id', service.id)
      w.set('description', `Cashback Nível ${node.level} - Serviço #${service.id.slice(0, 6)}`)
      $app.save(w)
    }

    // Cobrar tarifa do profissional
    const feeTx = new Record(walletCol)
    feeTx.set('user', profId)
    feeTx.set('type', 'tarifa')
    feeTx.set('amount', -rate)
    feeTx.set('status', 'concluido')
    feeTx.set('reference_type', 'service')
    feeTx.set('reference_id', service.id)
    feeTx.set('description', `Tarifa de serviço 369 (${plan.toUpperCase()})`)
    $app.save(feeTx)
  } catch (err) {
    console.error('Erro ao processar cashback binário do serviço:', err)
  }

  // 2. RECURSO 1 & 2: VALIDAÇÃO DE INDICAÇÃO E BÔNUS DE CASHBACK
  try {
    // Ler o mínimo de serviços do platform_config (default: 5)
    let minServicesToValidate = 5
    try {
      const configRec = $app.findFirstRecordByData(
        'platform_config',
        'key',
        'min_services_to_validate_referral',
      )
      if (configRec) {
        const val = configRec.get('value')
        if (typeof val === 'number') {
          minServicesToValidate = val
        } else if (typeof val === 'string' && !isNaN(Number(val))) {
          minServicesToValidate = Number(val)
        }
      }
    } catch (_) {}

    // Verificar se o student é um 'referred' em referrals
    let referralRecord
    try {
      referralRecord = $app.findFirstRecordByData('referrals', 'referred', studentId)
    } catch (_) {
      // Aluno não veio de indicação
    }

    if (referralRecord) {
      // Contar serviços concluídos do aluno
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

          const referrerId = referralRecord.get('referrer')
          if (referrerId) {
            const referrerUser = $app.findRecordById('users', referrerId)
            const referrerPlan = (referrerUser.get('plan') || 'basico').toLowerCase()

            // Multiplicador conforme plano: Básico 1x (R$ 1), Pro 2x (R$ 2), Premium 3x (R$ 3)
            let bonusMultiplier = 1
            if (referrerPlan === 'pro') bonusMultiplier = 2
            if (referrerPlan === 'premium') bonusMultiplier = 3
            const bonusAmount = bonusMultiplier * 1.0 // 1x, 2x, 3x a tarifa do plano

            const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
            const bonusTx = new Record(walletCol)
            bonusTx.set('user', referrerId)
            bonusTx.set('type', 'cashback_referral')
            bonusTx.set('amount', bonusAmount)
            bonusTx.set('status', 'concluido')
            bonusTx.set('reference_type', 'referral')
            bonusTx.set('reference_id', referralRecord.id)
            bonusTx.set(
              'description',
              `Bônus de Indicação Validada (${currentCount} serviços) - Plano ${referrerPlan.toUpperCase()}`,
            )
            $app.save(bonusTx)
          }
        }
      } else {
        if (!referralRecord.get('status')) {
          referralRecord.set('status', 'pending')
        }
      }
      $app.save(referralRecord)
    }
  } catch (err) {
    console.error('Erro ao validar indicação / cashback referral:', err)
  }
}, 'services')

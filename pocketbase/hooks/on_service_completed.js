// Hook triggered whenever a service status changes to 'concluido'
// 1. Debitar tarifa do serviço conforme o plano e registrar no extrato
// 2. Validar indicação se o aluno atingiu o mínimo de serviços
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

  // 1. DÉBITO DA TARIFA DE SERVIÇO
  try {
    const prof = $app.findRecordById('users', profId)
    const profPlan = (prof.get('plan') || 'basico').toLowerCase()

    let student = null
    let studentPlan = 'gratis'
    if (studentId) {
      try {
        student = $app.findRecordById('users', studentId)
        studentPlan = (student.get('plan') || 'gratis').toLowerCase()
      } catch (_) {}
    }

    // Regra de Vínculo:
    // Opção 1: Aluno usa o próprio plano, pagando a tarifa (ex: Premium R$3)
    // Opção 2: Profissional patrocina a tarifa do serviço (não desconta do aluno)
    const feeMode = student ? student.get('linked_prof_fee_mode') || 'own_plan' : 'own_plan'

    let payerUserId = profId
    let rate = 1.0

    if (profPlan === 'pro') rate = 2.0
    if (profPlan === 'premium') rate = 3.0

    if (student && student.get('linked_professional') === profId && feeMode === 'own_plan') {
      // Aluno paga tarifa do seu plano próprio (ex: R$ 3,00 se premium)
      payerUserId = studentId
      if (studentPlan === 'pro') rate = 2.0
      if (studentPlan === 'premium') rate = 3.0
      if (studentPlan === 'basico' || studentPlan === 'gratis') rate = 1.0
    }

    const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
    const feeTx = new Record(walletCol)
    feeTx.set('user', payerUserId)
    feeTx.set('type', 'tarifa')
    feeTx.set('amount', -rate)
    feeTx.set('status', 'concluido')
    feeTx.set('reference_type', 'service')
    feeTx.set('reference_id', service.id)
    feeTx.set(
      'description',
      `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${service.id.slice(0, 6)}`,
    )
    $app.save(feeTx)
  } catch (err) {
    console.error('Erro ao debitar tarifa de serviço:', err)
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
        else if (typeof val === 'string' && !isNaN(Number(val))) minServicesToValidate = Number(val)
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
}, 'services')

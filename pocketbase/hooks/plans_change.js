routerAdd(
  'POST',
  '/backend/v1/plans/change',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const targetPlan = (body.plan || '').toLowerCase()

      const allowedPlans = ['gratis', 'basico', 'pro', 'premium']
      if (!allowedPlans.includes(targetPlan)) {
        return e.json(400, {
          success: false,
          message: 'Plano inválido. Escolha entre: gratis, basico, pro, premium.',
        })
      }

      const currentPlan = (authUser.getString('plan') || 'gratis').toLowerCase()
      if (targetPlan === currentPlan) {
        return e.json(400, {
          success: false,
          message: 'Você já possui o plano selecionado ativo.',
        })
      }

      // Regra de janela de troca (dias 1 a 3 do mês)
      // Exceção: transição a partir do plano 'gratis' pode ser feita em qualquer dia do mês
      const now = new Date()
      const dayOfMonth = now.getDate()
      const isFromGratis = currentPlan === 'gratis'
      const isWindowOpen = dayOfMonth >= 1 && dayOfMonth <= 3

      if (!isFromGratis && !isWindowOpen) {
        return e.json(403, {
          success: false,
          message:
            'A alteração de plano entre planos pagos só é permitida entre os dias 1 e 3 de cada mês.',
        })
      }

      // Tarifas por plano
      const tarifasPorPlano = {
        gratis: 0.0,
        basico: 1.0,
        pro: 2.0,
        premium: 3.0,
      }

      const newTarifa = tarifasPorPlano[targetPlan] || 0.0
      const oldTarifa = tarifasPorPlano[currentPlan] || 0.0

      // Atualizar o plano do usuário diretamente no banco pelo backend
      authUser.set('plan', targetPlan)
      authUser.set('plan_upgraded_at', now.toISOString().replace('T', ' '))
      $app.save(authUser)

      // Criar transação correspondente caso haja transição ou registro financeiro
      let txRecordId = ''
      try {
        const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
        const tx = new Record(walletCol)
        tx.set('user', authUser.id)
        tx.set('type', 'tarifa')
        tx.set('amount', 0.0) // Registro de marco/adesão de plano
        tx.set('status', 'concluido')
        tx.set('reference_type', 'plan_change')
        tx.set('reference_id', targetPlan)
        tx.set(
          'description',
          `Alteração de Plano: ${currentPlan.toUpperCase()} -> ${targetPlan.toUpperCase()} (Tarifa por serviço: R$ ${newTarifa.toFixed(2)})`,
        )
        $app.save(tx)
        txRecordId = tx.id
      } catch (txErr) {
        console.error('Erro ao registrar transação de plano:', txErr)
      }

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('actor', authUser.id)
        auditRec.set('target_type', 'users')
        auditRec.set('target_id', authUser.id)
        auditRec.set('action', 'PLAN_CHANGED')
        auditRec.set('details', {
          previous_plan: currentPlan,
          new_plan: targetPlan,
          day_of_month: dayOfMonth,
          is_from_gratis: isFromGratis,
          previous_tarifa: oldTarifa,
          new_tarifa: newTarifa,
          transaction_id: txRecordId,
        })
        $app.save(auditRec)
      } catch (_) {}

      // Registrar em access_logs (rota financeira)
      try {
        const logCol = $app.findCollectionByNameOrId('access_logs')
        const logRec = new Record(logCol)
        logRec.set('user', authUser.id)
        logRec.set('ip', info.headers['x-forwarded-for'] || 'client')
        logRec.set('user_agent', info.headers['user-agent'] || 'browser')
        logRec.set('path', '/backend/v1/plans/change')
        logRec.set('method', 'POST')
        logRec.set('details', {
          from_plan: currentPlan,
          to_plan: targetPlan,
        })
        $app.save(logRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: `Plano atualizado com sucesso para ${targetPlan.toUpperCase()}!`,
        plan: targetPlan,
        plan_upgraded_at: now.toISOString(),
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao processar alteração de plano.',
      })
    }
  },
  $apis.requireAuth(),
)

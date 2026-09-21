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
      const billingPeriod = (body.billing_period || 'monthly').toLowerCase() // 'monthly' | 'annual'

      const allowedPlans = ['gratis', 'basico', 'pro', 'premium', 'pro_parceiro']
      if (!allowedPlans.includes(targetPlan)) {
        return e.json(400, {
          success: false,
          message: 'Plano inválido. Escolha entre: gratis, basico, pro, premium, pro_parceiro.',
        })
      }

      const currentPlan = (authUser.getString('plan') || 'gratis').toLowerCase()
      if (targetPlan === currentPlan) {
        return e.json(400, {
          success: false,
          message: 'Você já possui o plano selecionado ativo.',
        })
      }

      const role = authUser.getString('role') || 'aluno'

      // HOTFIX 369: Se o aluno vinculado tentar trocar de plano, bloquear com 409
      if (role === 'aluno' && !!authUser.getString('linked_professional')) {
        return e.json(409, {
          success: false,
          message:
            'Você está vinculado a um profissional e pontua no plano dele. Para escolher um plano próprio, desvincule primeiro.',
        })
      }

      const now = new Date()
      const dayOfMonth = now.getDate()
      const isFromGratis = currentPlan === 'gratis'
      const isWindowOpen = dayOfMonth >= 1 && dayOfMonth <= 3

      // Alunos podem mudar a qualquer momento no primeiro upgrade ou troca;
      // Para profissionais entre planos pagos, janela de dias 1 a 3
      if (role === 'profissional' && !isFromGratis && !isWindowOpen) {
        return e.json(403, {
          success: false,
          message:
            'A alteração de plano entre planos pagos só é permitida entre os dias 1 e 3 de cada mês.',
        })
      }

      // Preços de mensalidades / anuidades conforme platform_config
      const studentMonthlyPrices = {
        gratis: 0,
        basico: 10,
        pro: 20,
        premium: 30,
      }
      const studentAnnualPrices = {
        gratis: 0,
        basico: 100,
        pro: 200,
        premium: 300,
      }

      let planPrice = 0
      if (role === 'aluno') {
        const isLinked = !!authUser.getString('linked_professional')
        if (isLinked) {
          planPrice = 0 // Aluno vinculado não paga mensalidade
        } else {
          planPrice =
            billingPeriod === 'annual'
              ? (studentAnnualPrices[targetPlan] ?? 0)
              : (studentMonthlyPrices[targetPlan] ?? 0)
        }
      } else if (targetPlan === 'pro_parceiro') {
        let monthly = 149
        let annual = 1490
        try {
          const mRec = $app.findFirstRecordByData(
            'platform_config',
            'key',
            'pro_parceiro_price_monthly',
          )
          if (mRec) monthly = Number(mRec.get('value')) || 149
          const aRec = $app.findFirstRecordByData(
            'platform_config',
            'key',
            'pro_parceiro_price_annual',
          )
          if (aRec) annual = Number(aRec.get('value')) || monthly * 10
        } catch (_) {}
        planPrice = billingPeriod === 'annual' ? annual : monthly
      }

      // Atualizar plano do usuário
      authUser.set('plan', targetPlan)
      authUser.set('plan_upgraded_at', now.toISOString().replace('T', ' '))
      authUser.set('subscription_status', 'ativa')

      // Definir expiração: 30 dias para mensal ou 365 para anual
      const expires = new Date(now)
      if (billingPeriod === 'annual') {
        expires.setDate(expires.getDate() + 365)
      } else {
        expires.setDate(expires.getDate() + 30)
      }
      authUser.set('subscription_expires_at', expires.toISOString().replace('T', ' '))

      $app.save(authUser)

      // Registrar transação se houver valor financeiro
      let txRecordId = ''
      if (planPrice > 0) {
        try {
          const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
          const tx = new Record(walletCol)
          tx.set('user', authUser.id)
          tx.set('type', 'mensalidade')
          tx.set('amount', planPrice)
          tx.set('status', 'pendente') // Aguarda validação ou gateway de pagamento
          tx.set('reference_type', 'subscription')
          tx.set('reference_id', `${targetPlan}_${billingPeriod}`)
          tx.set(
            'description',
            `Assinatura Plano ${targetPlan.toUpperCase()} (${
              billingPeriod === 'annual' ? 'Anual 10x' : 'Mensal'
            }) - R$ ${planPrice.toFixed(2)}`,
          )
          $app.save(tx)
          txRecordId = tx.id
        } catch (txErr) {
          console.error('Erro ao registrar transação de mensalidade:', txErr)
        }
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
          billing_period: billingPeriod,
          price: planPrice,
          day_of_month: dayOfMonth,
          transaction_id: txRecordId,
        })
        $app.save(auditRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: `Plano atualizado com sucesso para ${targetPlan.toUpperCase()}!`,
        plan: targetPlan,
        billing_period: billingPeriod,
        price: planPrice,
        subscription_status: 'ativa',
        subscription_expires_at: expires.toISOString(),
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

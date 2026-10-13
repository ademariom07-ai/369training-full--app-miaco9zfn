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
      const isGoingToGratis = targetPlan === 'gratis'
      const isWindowOpen = dayOfMonth >= 1 && dayOfMonth <= 3

      // Alunos podem mudar a qualquer momento no primeiro upgrade ou troca;
      // Vindo de pago para grátis é permitido a qualquer momento;
      // Vindo de grátis para qualquer plano é permitido a qualquer momento;
      // Apenas transição ENTRE planos pagos para profissionais requer janela de dias 1 a 3
      if (role === 'profissional' && !isFromGratis && !isGoingToGratis && !isWindowOpen) {
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

      // Cobrança: o plano pago só é ativado se o saldo da carteira cobrir o valor.
      // O saldo entra por depósito PIX aprovado pelo admin (wallet_deposit + admin_approve_deposit).
      if (planPrice > 0) {
        const userTxs = $app.findRecordsByFilter(
          'wallet_transactions',
          `user = '${authUser.id}' && (status = 'concluido' || status = 'aprovado' || (type = 'saque' && status = 'pendente'))`,
          '-created',
          5000,
          0,
        )
        let saldoReal = 0.0
        for (const t of userTxs) {
          const amt = Number(t.get('amount')) || 0.0
          const txType = (t.get('type') || '').toLowerCase()
          if (txType === 'deposito' || txType === 'cashback' || txType === 'bonus_indicacao') {
            saldoReal += amt
          } else if (
            txType === 'saque' ||
            txType === 'tarifa' ||
            txType === 'pagamento' ||
            txType === 'servico' ||
            txType === 'mensalidade'
          ) {
            saldoReal -= Math.abs(amt)
          }
        }

        if (saldoReal < planPrice) {
          return e.json(402, {
            success: false,
            code: 'INSUFFICIENT_BALANCE',
            message:
              `Saldo insuficiente para ativar o plano ${targetPlan.toUpperCase()} (R$ ${planPrice.toFixed(2)}). ` +
              `Saldo disponível: R$ ${saldoReal.toFixed(2)}. Faça um depósito PIX na sua carteira e tente novamente.`,
            price: planPrice,
            saldo_disponivel: saldoReal,
          })
        }
      }

      const expires = new Date(now)
      if (billingPeriod === 'annual') {
        expires.setDate(expires.getDate() + 365)
      } else {
        expires.setDate(expires.getDate() + 30)
      }

      // Débito e troca de plano na mesma transação: ou ambos acontecem, ou nenhum.
      let txRecordId = ''
      $app.runInTransaction((txApp) => {
        if (planPrice > 0) {
          const walletCol = txApp.findCollectionByNameOrId('wallet_transactions')
          const tx = new Record(walletCol)
          tx.set('user', authUser.id)
          tx.set('type', 'mensalidade')
          tx.set('amount', -planPrice)
          tx.set('status', 'concluido')
          tx.set('reference_type', 'subscription')
          tx.set('reference_id', `${targetPlan}_${billingPeriod}`)
          tx.set(
            'description',
            `Assinatura Plano ${targetPlan.toUpperCase()} (${
              billingPeriod === 'annual' ? 'Anual 10x' : 'Mensal'
            }) - R$ ${planPrice.toFixed(2)}`,
          )
          txApp.save(tx)
          txRecordId = tx.id
        }

        const userRec = txApp.findRecordById('users', authUser.id)
        userRec.set('plan', targetPlan)
        userRec.set('plan_upgraded_at', now.toISOString().replace('T', ' '))
        userRec.set('subscription_status', 'ativa')
        userRec.set('subscription_expires_at', expires.toISOString().replace('T', ' '))
        txApp.save(userRec)
      })

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

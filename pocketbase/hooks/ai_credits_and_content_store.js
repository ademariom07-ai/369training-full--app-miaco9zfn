// Hook dedicado ao gerenciamento do sistema de créditos de Treino IA e compra de Conteúdos
// Regras do usuário:
// 1) Grátis: treino IA apenas descritivo, SEM imagem (0 créditos base, ou gera descritivo sem custo de créditos)
// 2) Básico R$ 10,00/mês = 100 créditos (~5 treinos)
// 3) Pro R$ 20,00/mês = 200 créditos (~10 treinos)
// 4) Premium R$ 30,00/mês = treinos ilimitados
// Cada geração consome 20 créditos.
// Renovação mensal no dia da assinatura (ou ciclo mensal).
// Opção de comprar mais créditos usando saldo da carteira (fluxo PIX/comprovante ou saldo disponível).
// Compra de conteúdo usando saldo da carteira com repasse para o profissional.

// 1. GET /backend/v1/aluno/ai-credits - Consultar saldo de créditos atual e status de renovação
routerAdd(
  'GET',
  '/backend/v1/aluno/ai-credits',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const plan = (authUser.getString('plan') || 'gratis').toLowerCase()
      const now = new Date()
      const currentMonthStr = now.toISOString().slice(0, 7) // YYYY-MM
      const resetAt = authUser.getString('ai_workout_credits_reset_at') || ''
      let currentCredits = authUser.getInt('ai_workout_credits')

      // Verificar renovação mensal automática com base no plano
      const isUnlimited = plan === 'premium'
      let planMonthlyCredits = 0
      if (plan === 'basico') planMonthlyCredits = 100
      else if (plan === 'pro') planMonthlyCredits = 200
      else if (plan === 'premium') planMonthlyCredits = 999999
      else planMonthlyCredits = 0 // grátis

      // Se virou o mês ou se nunca foi inicializado e o plano é pago, renova
      if (resetAt !== currentMonthStr) {
        currentCredits = planMonthlyCredits
        authUser.set('ai_workout_credits', currentCredits)
        authUser.set('ai_workout_credits_reset_at', currentMonthStr)
        $app.save(authUser)
      }

      // Cálculo de saldo da carteira inline
      let walletBalance = 0.0
      try {
        const txs = $app.findRecordsByFilter(
          'wallet_transactions',
          `user = '${authUser.id}' && (status = 'concluido' || status = 'aprovado')`,
          '-created',
          5000,
          0,
        )
        for (const t of txs) {
          const amt = Number(t.get('amount')) || 0.0
          const type = (t.get('type') || '').toLowerCase()
          if (type === 'deposito' || type === 'cashback' || type === 'bonus_indicacao') {
            walletBalance += Math.abs(amt)
          } else if (
            type === 'saque' ||
            type === 'tarifa' ||
            type === 'pagamento' ||
            type === 'servico' ||
            type === 'mensalidade'
          ) {
            walletBalance -= Math.abs(amt)
          }
        }
        if (walletBalance < 0) walletBalance = 0.0
      } catch (_) {}

      return e.json(200, {
        success: true,
        plan,
        credits: currentCredits,
        is_unlimited: isUnlimited,
        cost_per_workout: 20,
        has_images: plan !== 'gratis',
        reset_month: currentMonthStr,
        wallet_balance: walletBalance,
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao consultar créditos.',
      })
    }
  },
  $apis.requireAuth(),
)

// 2. POST /backend/v1/aluno/consume-ai-credit - Consumir 20 créditos para gerar treino IA
routerAdd(
  'POST',
  '/backend/v1/aluno/consume-ai-credit',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const plan = (authUser.getString('plan') || 'gratis').toLowerCase()
      const now = new Date()
      const currentMonthStr = now.toISOString().slice(0, 7)
      const resetAt = authUser.getString('ai_workout_credits_reset_at') || ''
      let currentCredits = authUser.getInt('ai_workout_credits')

      // Renovação se mês virou
      let planMonthlyCredits = 0
      if (plan === 'basico') planMonthlyCredits = 100
      else if (plan === 'pro') planMonthlyCredits = 200
      else if (plan === 'premium') planMonthlyCredits = 999999
      else planMonthlyCredits = 0

      if (resetAt !== currentMonthStr) {
        currentCredits = planMonthlyCredits
        authUser.set('ai_workout_credits', currentCredits)
        authUser.set('ai_workout_credits_reset_at', currentMonthStr)
      }

      // Plano Grátis: treino IA apenas descritivo, SEM imagem
      if (plan === 'gratis') {
        $app.save(authUser)
        return e.json(200, {
          success: true,
          plan: 'gratis',
          has_images: false,
          remaining_credits: currentCredits,
          message: 'Treino em plano Grátis gerado em formato descritivo (sem imagens).',
        })
      }

      // Plano Premium: ilimitado
      if (plan === 'premium') {
        $app.save(authUser)
        return e.json(200, {
          success: true,
          plan: 'premium',
          has_images: true,
          remaining_credits: 999999,
          is_unlimited: true,
          message: 'Treino gerado com sucesso (Acesso Premium Ilimitado).',
        })
      }

      // Básico e Pro: consome 20 créditos
      const cost = 20
      if (currentCredits < cost) {
        return e.json(400, {
          success: false,
          needs_credits: true,
          current_credits: currentCredits,
          cost_required: cost,
          message: `Seus créditos de treino IA acabaram (${currentCredits} restantes). Compre mais créditos usando o saldo da carteira ou evolua seu plano!`,
        })
      }

      currentCredits -= cost
      authUser.set('ai_workout_credits', currentCredits)
      $app.save(authUser)

      return e.json(200, {
        success: true,
        plan,
        has_images: true,
        remaining_credits: currentCredits,
        consumed: cost,
        message: `Treino IA gerado com sucesso! ${cost} créditos utilizados (${currentCredits} restantes).`,
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao processar créditos.',
      })
    }
  },
  $apis.requireAuth(),
)

// 3. POST /backend/v1/aluno/buy-ai-credits - Comprar pacote adicional de créditos usando saldo da carteira
routerAdd(
  'POST',
  '/backend/v1/aluno/buy-ai-credits',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const packageType = body.package_type || 'pacote_100'
      let creditsToAdd = 100
      let price = 10.0

      if (packageType === 'pacote_200') {
        creditsToAdd = 200
        price = 20.0
      } else {
        creditsToAdd = 100
        price = 10.0
      }

      // Saldo da carteira inline
      let balance = 0.0
      try {
        const txs = $app.findRecordsByFilter(
          'wallet_transactions',
          `user = '${authUser.id}' && (status = 'concluido' || status = 'aprovado')`,
          '-created',
          5000,
          0,
        )
        for (const t of txs) {
          const amt = Number(t.get('amount')) || 0.0
          const type = (t.get('type') || '').toLowerCase()
          if (type === 'deposito' || type === 'cashback' || type === 'bonus_indicacao') {
            balance += Math.abs(amt)
          } else if (
            type === 'saque' ||
            type === 'tarifa' ||
            type === 'pagamento' ||
            type === 'servico' ||
            type === 'mensalidade'
          ) {
            balance -= Math.abs(amt)
          }
        }
        if (balance < 0) balance = 0.0
      } catch (_) {}

      if (balance < price) {
        return e.json(400, {
          success: false,
          needs_deposit: true,
          wallet_balance: balance,
          price,
          message: `Saldo insuficiente na carteira (Saldo atual: R$ ${balance.toFixed(2)}, Necessário: R$ ${price.toFixed(2)}). Faça um depósito PIX com comprovante para recarregar sua carteira.`,
        })
      }

      // Registrar débito na carteira (wallet_transactions com status concluido)
      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
      const tx = new Record(walletCol)
      tx.set('user', authUser.id)
      tx.set('type', 'pagamento')
      tx.set('amount', -price)
      tx.set('status', 'concluido')
      tx.set('reference_type', 'ai_credits_purchase')
      tx.set('reference_id', packageType)
      tx.set(
        'description',
        `Compra de ${creditsToAdd} Créditos de Treino IA (R$ ${price.toFixed(2)}) via Saldo da Carteira`,
      )
      $app.save(tx)

      // Adicionar créditos ao usuário
      const cur = authUser.getInt('ai_workout_credits')
      const newBalanceCredits = cur + creditsToAdd
      authUser.set('ai_workout_credits', newBalanceCredits)
      $app.save(authUser)

      return e.json(200, {
        success: true,
        message: `Pacote de ${creditsToAdd} créditos adicionado com sucesso! Novo saldo de créditos: ${newBalanceCredits}.`,
        added_credits: creditsToAdd,
        new_credits_balance: newBalanceCredits,
        price_paid: price,
        new_wallet_balance: balance - price,
      })
    } catch (err) {
      return e.json(500, { success: false, error: err ? err.message : 'Erro ao comprar créditos.' })
    }
  },
  $apis.requireAuth(),
)

// 4. POST /backend/v1/aluno/purchase-content - Comprar conteúdo usando saldo da carteira com repasse ao profissional
routerAdd(
  'POST',
  '/backend/v1/aluno/purchase-content',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const contentId = body.content_id
      if (!contentId) {
        return e.json(400, { success: false, message: 'ID do conteúdo obrigatório.' })
      }

      const content = $app.findRecordById('contents', contentId)
      if (!content) {
        return e.json(404, { success: false, message: 'Conteúdo não encontrado.' })
      }

      const price = Number(content.get('price')) || 0
      const profId = content.getString('professional_id')

      // Verificar se já comprou anteriormente
      const existingPurchases = $app.findRecordsByFilter(
        'content_purchases',
        `user = '${authUser.id}' && content = '${contentId}'`,
        '-created',
        1,
        0,
      )
      if (existingPurchases && existingPurchases.length > 0) {
        return e.json(400, {
          success: false,
          message: 'Você já adquiriu este material previamente.',
        })
      }

      // Se for gratuito
      if (price <= 0) {
        const cpCol = $app.findCollectionByNameOrId('content_purchases')
        const cp = new Record(cpCol)
        cp.set('user', authUser.id)
        cp.set('content', contentId)
        cp.set('price_paid', 0)
        cp.set('platform_fee', 0)
        cp.set('professional_revenue', 0)
        $app.save(cp)

        return e.json(200, {
          success: true,
          message: 'Material gratuito adicionado à sua biblioteca com sucesso!',
          content_id: contentId,
          price_paid: 0,
        })
      }

      // Se for pago, verificar saldo real na carteira inline
      let balance = 0.0
      try {
        const txs = $app.findRecordsByFilter(
          'wallet_transactions',
          `user = '${authUser.id}' && (status = 'concluido' || status = 'aprovado')`,
          '-created',
          5000,
          0,
        )
        for (const t of txs) {
          const amt = Number(t.get('amount')) || 0.0
          const type = (t.get('type') || '').toLowerCase()
          if (type === 'deposito' || type === 'cashback' || type === 'bonus_indicacao') {
            balance += Math.abs(amt)
          } else if (
            type === 'saque' ||
            type === 'tarifa' ||
            type === 'pagamento' ||
            type === 'servico' ||
            type === 'mensalidade'
          ) {
            balance -= Math.abs(amt)
          }
        }
        if (balance < 0) balance = 0.0
      } catch (_) {}

      if (balance < price) {
        return e.json(400, {
          success: false,
          needs_deposit: true,
          wallet_balance: balance,
          price,
          message: `Saldo insuficiente na carteira (Saldo atual: R$ ${balance.toFixed(2)}, Valor do conteúdo: R$ ${price.toFixed(2)}). Adicione saldo via PIX com comprovante para adquirir.`,
        })
      }

      // Repasse padrão 369: tarifa operacional por serviço/venda conforme regras de repasses
      let profUser = null
      if (profId) {
        try {
          profUser = $app.findRecordById('users', profId)
        } catch (_) {}
      }

      const profPlan = profUser ? (profUser.getString('plan') || 'basico').toLowerCase() : 'basico'
      let platformFee = 1.0
      if (profPlan === 'pro') platformFee = 2.0
      if (profPlan === 'premium') platformFee = 3.0
      if (profPlan === 'pro_parceiro') platformFee = 0.0

      const professionalRevenue = Math.max(0, price - platformFee)

      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')

      // 1. Débito no aluno
      const txStudent = new Record(walletCol)
      txStudent.set('user', authUser.id)
      txStudent.set('type', 'pagamento')
      txStudent.set('amount', -price)
      txStudent.set('status', 'concluido')
      txStudent.set('reference_type', 'content_purchase')
      txStudent.set('reference_id', contentId)
      txStudent.set(
        'description',
        `Compra de Material: "${content.getString('title')}" (R$ ${price.toFixed(2)}) via Saldo da Carteira`,
      )
      $app.save(txStudent)

      // 2. Crédito de repasse na carteira do profissional (se houver profissional)
      if (profId && professionalRevenue > 0) {
        const txProf = new Record(walletCol)
        txProf.set('user', profId)
        txProf.set('type', 'servico')
        txProf.set('amount', professionalRevenue)
        txProf.set('status', 'concluido')
        txProf.set('reference_type', 'content_sale')
        txProf.set('reference_id', contentId)
        txProf.set(
          'description',
          `Venda de Conteúdo: "${content.getString('title')}" para ${authUser.getString('name')} (Líquido: R$ ${professionalRevenue.toFixed(2)})`,
        )
        $app.save(txProf)
      }

      // 3. Registrar content_purchases
      const cpCol = $app.findCollectionByNameOrId('content_purchases')
      const cp = new Record(cpCol)
      cp.set('user', authUser.id)
      cp.set('content', contentId)
      cp.set('price_paid', price)
      cp.set('platform_fee', platformFee)
      cp.set('professional_revenue', professionalRevenue)
      $app.save(cp)

      return e.json(200, {
        success: true,
        message: `Material "${content.getString('title')}" adquirido com sucesso! Disponível em Meu Histórico → Materiais Comprados.`,
        content_id: contentId,
        price_paid: price,
        professional_revenue: professionalRevenue,
        new_wallet_balance: balance - price,
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao processar compra de conteúdo.',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/wallet/withdraw',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const amountRequested = parseFloat(body.amount)
      const pixKey = (body.pix_key || body.pixKey || '').trim()
      const pixKeyType = (body.pix_key_type || body.pixKeyType || 'CPF').toUpperCase()

      if (isNaN(amountRequested) || amountRequested <= 0) {
        return e.json(400, {
          success: false,
          message: 'Valor de saque inválido. Deve ser maior que zero.',
        })
      }

      if (!pixKey) {
        return e.json(400, {
          success: false,
          message: 'Chave PIX é obrigatória.',
        })
      }

      // Validação de titularidade: Se o tipo for CPF, deve coincidir com o CPF do usuário (se cadastrado)
      // Normalizar dígitos de CPF
      const cleanPixKey = pixKey.replace(/\D/g, '')
      const userCpf = (authUser.getString('cpf') || '').replace(/\D/g, '')

      if (pixKeyType === 'CPF' && userCpf && cleanPixKey.length === 11) {
        if (cleanPixKey !== userCpf) {
          return e.json(400, {
            success: false,
            message:
              'A chave PIX (CPF) deve pertencer ao titular da conta 369TRAINING (' +
              authUser.getString('name') +
              ').',
          })
        }
      }

      // 1. Validar saldo real: soma das transações concluídas do usuário no banco
      const userTxs = $app.findRecordsByFilter(
        'wallet_transactions',
        `user = '${authUser.id}' && (status = 'concluido' || status = 'aprovado')`,
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
          txType === 'servico'
        ) {
          saldoReal += amt // amount já é negativo ou debitado
        }
      }

      if (amountRequested > saldoReal) {
        return e.json(400, {
          success: false,
          message:
            'Saldo insuficiente para saque. Saldo disponível real: R$ ' + saldoReal.toFixed(2),
          saldo_disponivel: saldoReal,
        })
      }

      // 2. Criar transação de saque com status 'pendente'
      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
      const tx = new Record(walletCol)
      tx.set('user', authUser.id)
      tx.set('type', 'saque')
      tx.set('amount', -amountRequested)
      tx.set('status', 'pendente')
      tx.set('pix_code', `${pixKeyType}: ${pixKey}`)
      tx.set(
        'description',
        `Solicitação de Saque PIX via ${pixKeyType}: ${pixKey} (Titular: ${authUser.getString('name')})`,
      )
      $app.save(tx)

      // 3. Notificar os administradores
      try {
        const admins = $app.findRecordsByFilter('users', "role = 'admin'", '-created', 50, 0)
        const notifCol = $app.findCollectionByNameOrId('notifications')
        for (const adm of admins) {
          const n = new Record(notifCol)
          n.set('user', adm.id)
          n.set('type', 'solicitacao_saque')
          n.set('title', 'Nova Solicitação de Saque PIX')
          n.set(
            'body',
            `O usuário ${authUser.getString('name')} solicitou saque de R$ ${amountRequested.toFixed(2)} via PIX (${pixKeyType}: ${pixKey}).`,
          )
          n.set('read', false)
          n.set('action_url', '/admin/ranking')
          $app.save(n)
        }
      } catch (notifErr) {
        console.error('Erro ao notificar admin sobre saque:', notifErr)
      }

      // 4. Gravar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('actor', authUser.id)
        auditRec.set('target_type', 'wallet_transactions')
        auditRec.set('target_id', tx.id)
        auditRec.set('action', 'WITHDRAW_REQUESTED')
        auditRec.set('details', {
          amount: amountRequested,
          pix_key: pixKey,
          pix_key_type: pixKeyType,
          saldo_anterior: saldoReal,
          user_name: authUser.getString('name'),
        })
        $app.save(auditRec)
      } catch (_) {}

      // 5. Gravar registro em access_logs (MCI art. 15 rota financeira)
      try {
        const logCol = $app.findCollectionByNameOrId('access_logs')
        const logRec = new Record(logCol)
        logRec.set('user', authUser.id)
        logRec.set('ip', info.headers['x-forwarded-for'] || 'client')
        logRec.set('user_agent', info.headers['user-agent'] || 'browser')
        logRec.set('path', '/backend/v1/wallet/withdraw')
        logRec.set('method', 'POST')
        logRec.set('details', {
          amount: amountRequested,
          pix_key_type: pixKeyType,
          tx_id: tx.id,
        })
        $app.save(logRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Solicitação de saque enviada com sucesso! Aguardando processamento.',
        transaction_id: tx.id,
        amount: amountRequested,
        status: 'pendente',
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao processar solicitação de saque.',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admin/approve_deposit',
  (e) => {
    try {
      // 1. Verify that the authenticated user is an admin
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Não autorizado. Autenticação necessária.' })
      }

      const role = authUser.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          success: false,
          message: 'Acesso negado. Apenas administradores podem gerenciar depósitos.',
        })
      }

      // 2. Read request body
      const data = e.requestInfo().body || {}
      const transactionId = data.transaction_id || data.transactionId
      const action = data.action // 'approve' | 'reject'

      if (!transactionId || (action !== 'approve' && action !== 'reject')) {
        return e.json(400, {
          success: false,
          message: 'Parâmetros inválidos. Forneça transaction_id e action ("approve" ou "reject").',
        })
      }

      // 3. Find transaction record
      let txRecord
      try {
        txRecord = $app.findRecordById('wallet_transactions', transactionId)
      } catch (_) {
        return e.json(404, { success: false, message: 'Transação não encontrada.' })
      }

      const currentStatus = txRecord.getString('status')
      if (currentStatus !== 'pendente') {
        return e.json(400, {
          success: false,
          message:
            'Esta transação já foi processada anteriormente (status atual: ' + currentStatus + ').',
        })
      }

      const targetUserId = txRecord.getString('user')
      const amount = txRecord.getFloat('amount') || 0

      if (action === 'approve') {
        txRecord.set('status', 'concluido')
        $app.save(txRecord)

        // Try to create an audit record
        try {
          const auditCol = $app.findCollectionByNameOrId('audits')
          const auditRec = new Record(auditCol)
          auditRec.set('actor', authUser.id)
          auditRec.set('target_type', 'wallet_transactions')
          auditRec.set('target_id', transactionId)
          auditRec.set('action', 'PIX_DEPOSIT_APPROVED')
          auditRec.set('details', {
            amount: amount,
            user_id: targetUserId,
            approved_by: authUser.id,
          })
          $app.save(auditRec)
        } catch (_) {}

        // Notify user about approval
        try {
          const notifCol = $app.findCollectionByNameOrId('notifications')
          const notifRec = new Record(notifCol)
          notifRec.set('user', targetUserId)
          notifRec.set('type', 'deposit_approved')
          notifRec.set('title', 'Depósito PIX Aprovado!')
          notifRec.set(
            'body',
            'Seu depósito PIX de R$ ' +
              amount.toFixed(2) +
              ' foi validado pela administração e os créditos já estão disponíveis.',
          )
          notifRec.set('read', false)
          notifRec.set('action_url', '/aluno/carteira')
          $app.save(notifRec)
        } catch (_) {}

        return e.json(200, {
          success: true,
          action: 'approved',
          transaction_id: transactionId,
          amount: amount,
          message: 'Depósito PIX aprovado com sucesso!',
        })
      } else {
        // Reject
        txRecord.set('status', 'rejeitado')
        $app.save(txRecord)

        // Audit rejection
        try {
          const auditCol = $app.findCollectionByNameOrId('audits')
          const auditRec = new Record(auditCol)
          auditRec.set('actor', authUser.id)
          auditRec.set('target_type', 'wallet_transactions')
          auditRec.set('target_id', transactionId)
          auditRec.set('action', 'PIX_DEPOSIT_REJECTED')
          auditRec.set('details', {
            amount: amount,
            user_id: targetUserId,
            rejected_by: authUser.id,
          })
          $app.save(auditRec)
        } catch (_) {}

        // Notify user about rejection
        try {
          const notifCol = $app.findCollectionByNameOrId('notifications')
          const notifRec = new Record(notifCol)
          notifRec.set('user', targetUserId)
          notifRec.set('type', 'deposit_rejected')
          notifRec.set('title', 'Comprovante PIX Não Aprovado')
          notifRec.set(
            'body',
            'Seu comprovante de depósito PIX de R$ ' +
              amount.toFixed(2) +
              ' não pôde ser validado. Por favor, entre em contato ou envie um novo comprovante legível.',
          )
          notifRec.set('read', false)
          notifRec.set('action_url', '/aluno/carteira')
          $app.save(notifRec)
        } catch (_) {}

        return e.json(200, {
          success: true,
          action: 'rejected',
          transaction_id: transactionId,
          message: 'Depósito PIX rejeitado.',
        })
      }
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro interno ao processar transação PIX.',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/api/custom/admin/approve-deposit',
  (e) => {
    try {
      // 1. Verify that the authenticated user is an admin
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Não autorizado. Autenticação necessária.' })
      }

      const role = authUser.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          success: false,
          message: 'Acesso negado. Apenas administradores podem gerenciar depósitos.',
        })
      }

      // 2. Read request body
      const data = e.requestInfo().body || {}
      const transactionId = data.transaction_id || data.transactionId
      const action = data.action // 'approve' | 'reject'

      if (!transactionId || (action !== 'approve' && action !== 'reject')) {
        return e.json(400, {
          success: false,
          message: 'Parâmetros inválidos. Forneça transaction_id e action ("approve" ou "reject").',
        })
      }

      // 3. Find transaction record
      let txRecord
      try {
        txRecord = $app.findRecordById('wallet_transactions', transactionId)
      } catch (_) {
        return e.json(404, { success: false, message: 'Transação não encontrada.' })
      }

      const currentStatus = txRecord.getString('status')
      if (currentStatus !== 'pendente') {
        return e.json(400, {
          success: false,
          message:
            'Esta transação já foi processada anteriormente (status atual: ' + currentStatus + ').',
        })
      }

      const targetUserId = txRecord.getString('user')
      const amount = txRecord.getFloat('amount') || 0

      if (action === 'approve') {
        txRecord.set('status', 'concluido')
        $app.save(txRecord)

        // Try to create an audit record
        try {
          const auditCol = $app.findCollectionByNameOrId('audits')
          const auditRec = new Record(auditCol)
          auditRec.set('actor', authUser.id)
          auditRec.set('target_type', 'wallet_transactions')
          auditRec.set('target_id', transactionId)
          auditRec.set('action', 'PIX_DEPOSIT_APPROVED')
          auditRec.set('details', {
            amount: amount,
            user_id: targetUserId,
            approved_by: authUser.id,
          })
          $app.save(auditRec)
        } catch (_) {}

        // Notify user about approval
        try {
          const notifCol = $app.findCollectionByNameOrId('notifications')
          const notifRec = new Record(notifCol)
          notifRec.set('user', targetUserId)
          notifRec.set('type', 'deposit_approved')
          notifRec.set('title', 'Depósito PIX Aprovado!')
          notifRec.set(
            'body',
            'Seu depósito PIX de R$ ' +
              amount.toFixed(2) +
              ' foi validado pela administração e os créditos já estão disponíveis.',
          )
          notifRec.set('read', false)
          notifRec.set('action_url', '/aluno/carteira')
          $app.save(notifRec)
        } catch (_) {}

        return e.json(200, {
          success: true,
          action: 'approved',
          transaction_id: transactionId,
          amount: amount,
          message: 'Depósito PIX aprovado com sucesso!',
        })
      } else {
        // Reject
        txRecord.set('status', 'rejeitado')
        $app.save(txRecord)

        // Audit rejection
        try {
          const auditCol = $app.findCollectionByNameOrId('audits')
          const auditRec = new Record(auditCol)
          auditRec.set('actor', authUser.id)
          auditRec.set('target_type', 'wallet_transactions')
          auditRec.set('target_id', transactionId)
          auditRec.set('action', 'PIX_DEPOSIT_REJECTED')
          auditRec.set('details', {
            amount: amount,
            user_id: targetUserId,
            rejected_by: authUser.id,
          })
          $app.save(auditRec)
        } catch (_) {}

        // Notify user about rejection
        try {
          const notifCol = $app.findCollectionByNameOrId('notifications')
          const notifRec = new Record(notifCol)
          notifRec.set('user', targetUserId)
          notifRec.set('type', 'deposit_rejected')
          notifRec.set('title', 'Comprovante PIX Não Aprovado')
          notifRec.set(
            'body',
            'Seu comprovante de depósito PIX de R$ ' +
              amount.toFixed(2) +
              ' não pôde ser validado. Por favor, entre em contato ou envie um novo comprovante legível.',
          )
          notifRec.set('read', false)
          notifRec.set('action_url', '/aluno/carteira')
          $app.save(notifRec)
        } catch (_) {}

        return e.json(200, {
          success: true,
          action: 'rejected',
          transaction_id: transactionId,
          message: 'Depósito PIX rejeitado.',
        })
      }
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro interno ao processar transação PIX.',
      })
    }
  },
  $apis.requireAuth(),
)

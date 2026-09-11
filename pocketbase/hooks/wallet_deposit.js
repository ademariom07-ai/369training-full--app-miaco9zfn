routerAdd(
  'POST',
  '/backend/v1/wallet/deposit',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const amount = parseFloat(body.amount)
      const pixCode = (body.pix_code || '').trim()
      const description = (body.description || '').trim()

      if (isNaN(amount) || amount <= 0) {
        return e.json(400, {
          success: false,
          message: 'Valor de depósito inválido.',
        })
      }

      // Buscar configuração da chave PIX da plataforma
      let platformPixKey = 'financeiro@369training.com'
      let platformPixHolder = '369TRAINING LTDA'
      try {
        const configRec = $app.findFirstRecordByData('platform_config', 'key', 'pix_config')
        if (configRec) {
          const val = configRec.get('value')
          if (val) {
            platformPixKey = val.pix_key || platformPixKey
            platformPixHolder = val.pix_holder || platformPixHolder
          }
        }
      } catch (_) {}

      // Criar o registro na coleção wallet_transactions
      const walletCol = $app.findCollectionByNameOrId('wallet_transactions')
      const tx = new Record(walletCol)
      tx.set('user', authUser.id)
      tx.set('type', 'deposito')
      tx.set('amount', amount)
      tx.set('status', 'pendente')
      tx.set('pix_code', pixCode || platformPixKey)
      tx.set(
        'description',
        description ||
          `Depósito PIX para ${platformPixHolder} (${platformPixKey}) - R$ ${amount.toFixed(2)}`,
      )

      // Se houver arquivo anexado (multipart)
      // PocketBase preenche os arquivos no registro se passado via formData
      // Caso passado como arquivo no upload multipart:
      try {
        const files = info.files || {}
        if (files.comprovante_file && files.comprovante_file.length > 0) {
          tx.set('comprovante_file', files.comprovante_file[0])
        }
      } catch (_) {}

      $app.save(tx)

      // Gravar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('actor', authUser.id)
        auditRec.set('target_type', 'wallet_transactions')
        auditRec.set('target_id', tx.id)
        auditRec.set('action', 'PIX_DEPOSIT_SUBMITTED')
        auditRec.set('details', {
          amount,
          pix_key: platformPixKey,
          user_name: authUser.getString('name'),
        })
        $app.save(auditRec)
      } catch (_) {}

      // Gravar access_logs (rota financeira)
      try {
        const logCol = $app.findCollectionByNameOrId('access_logs')
        const logRec = new Record(logCol)
        logRec.set('user', authUser.id)
        logRec.set('ip', info.headers['x-forwarded-for'] || 'client')
        logRec.set('user_agent', info.headers['user-agent'] || 'browser')
        logRec.set('path', '/backend/v1/wallet/deposit')
        logRec.set('method', 'POST')
        logRec.set('details', {
          amount,
          tx_id: tx.id,
        })
        $app.save(logRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Depósito enviado para validação administrativa!',
        transaction_id: tx.id,
        status: 'pendente',
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao processar depósito.',
      })
    }
  },
  $apis.requireAuth(),
)

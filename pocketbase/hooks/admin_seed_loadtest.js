// Hook: Seed Load Test (10.000 usuários de teste)
// Endpoint: POST /backend/v1/admin/seed_loadtest
// Restrito a admin ($apis.requireAuth() + role === 'admin')
// Aceita: { count: number, batch: number, cursor: number, seed_id: string }
// Permite rodar tudo ou por cursor até count (máx 10.000)

routerAdd(
  'POST',
  '/backend/v1/admin/seed_loadtest',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser) {
        return c.json(401, {
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Autenticação necessária.',
        })
      }

      const role = authUser.getString('role')
      if (role !== 'admin') {
        return c.json(403, {
          status: 'error',
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores.',
        })
      }

      // Parâmetros do body
      let body = {}
      try {
        body = c.requestInfo().body || {}
      } catch (_) {
        body = {}
      }

      const totalCount = Math.min(10000, Math.max(1, parseInt(body.count, 10) || 10000))
      const batchSize = Math.min(2000, Math.max(10, parseInt(body.batch, 10) || 1000))
      const currentCursor = Math.max(0, parseInt(body.cursor, 10) || 0)
      const seedId = body.seed_id ? String(body.seed_id).replace(/[^a-zA-Z0-9_-]/g, '') : 'LT'

      // Quantos processar nesta fatia
      const startIdx = currentCursor + 1
      const endIdx = Math.min(totalCount, currentCursor + batchSize)
      const itemsInThisBatch = endIdx - startIdx + 1

      if (itemsInThisBatch <= 0 || currentCursor >= totalCount) {
        return c.json(200, {
          status: 'ok',
          message: 'Geração de carga concluída.',
          total_target: totalCount,
          completed: totalCount,
          next_cursor: null,
          has_more: false,
        })
      }

      // Obter max tree_position atual do banco para distribuir sequencialmente
      let currentMaxTreePos = 50
      try {
        const row = $app.db().newQuery('SELECT MAX(tree_position) as max_pos FROM users').one()
        if (row && row.max_pos) {
          const p = parseInt(row.max_pos, 10)
          if (!isNaN(p) && p > 0) currentMaxTreePos = p
        }
      } catch (_) {}

      // Configurações do plano e role:
      // 10% profissional com CREF fake, 90% aluno
      // Planos variados: gratis, basico, pro, premium
      const plans = ['gratis', 'basico', 'pro', 'premium']

      const usersCollection = $app.findCollectionByNameOrId('users')
      let insertedCount = 0

      // Usar $app.save(record) dentro de transação para respeitar estritamente o engine do PocketBase
      $app.runInTransaction((txApp) => {
        for (let i = startIdx; i <= endIdx; i++) {
          const isProf = i % 10 === 0
          const userRole = isProf ? 'profissional' : 'aluno'
          const plan = plans[i % plans.length]
          const name = 'TESTE CARGA #' + i
          const email = 'carga.' + i + '@exemplo.com'
          const referralCode = 'CRG' + i.toString().padStart(5, '0')
          const cref = isProf ? 'CREF-TEST-' + i.toString().padStart(5, '0') : ''
          const professionalType = isProf ? 'Pessoa Física' : ''
          const treePos = currentMaxTreePos + i
          const treeLevel = Math.min(
            36,
            Math.max(1, Math.floor(Math.log(treePos) / Math.log(2)) + 1),
          )

          const rawHash = $security.md5('seed_loadtest_' + seedId + '_' + i)
          const customId = (rawHash + '123456789012345').slice(0, 15).toLowerCase()

          // Verificar se já existe por id ou email para idempotência
          try {
            txApp.findAuthRecordByEmail('users', email)
            continue
          } catch (_) {}

          const record = new Record(usersCollection)
          record.set('id', customId)
          record.setEmail(email)
          record.setPassword('Skip@Pass')
          record.setVerified(false)
          record.set('emailVisibility', false)
          record.set('name', name)
          record.set('role', userRole)
          record.set('plan', plan)
          record.set('plan_type', userRole)
          record.set('approved', true)
          record.set('referral_code', referralCode)
          record.set('cref', cref)
          record.set('professional_type', professionalType)
          record.set('tree_position', treePos)
          record.set('tree_level', treeLevel)
          record.set('rating_avg', 5.0)
          record.set('subscription_status', 'cancelada')
          record.set('city', 'São Paulo')
          record.set('state', 'SP')
          record.set('country', 'Brasil')

          txApp.save(record)
          insertedCount++
        }
      })

      const nextCursor = endIdx < totalCount ? endIdx : null
      const hasMore = nextCursor !== null

      return c.json(200, {
        status: 'ok',
        completed: endIdx,
        total_target: totalCount,
        cursor: endIdx,
        inserted_in_batch: insertedCount,
        next_cursor: nextCursor,
        seed_id: seedId,
        batch_inserted: insertedCount,
        has_more: hasMore,
        message:
          'Lote de usuários de teste inserido com sucesso (' + endIdx + '/' + totalCount + ').',
      })
    } catch (err) {
      console.error('Erro no seed_loadtest:', err)
      return c.json(500, {
        status: 'error',
        code: 'SEED_LOADTEST_ERROR',
        message:
          err && err.message ? err.message : 'Erro interno ao executar seed do teste de carga.',
      })
    }
  },
  $apis.requireAuth(),
)

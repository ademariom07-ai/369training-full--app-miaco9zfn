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

      const now = new Date()
      const nowIso = now.toISOString().replace('T', ' ').slice(0, 19)

      // Usar transação do banco para alta velocidade
      let insertedCount = 0

      $app.runInTransaction((txApp) => {
        for (let i = startIdx; i <= endIdx; i++) {
          const isProf = i % 10 === 0
          const userRole = isProf ? 'profissional' : 'aluno'
          const plan = plans[i % plans.length]
          const name = 'TESTE CARGA #' + i
          const email = 'carga.' + i + '@exemplo.com'
          const username = 'carga_' + i + '_' + seedId.toLowerCase()
          const referralCode = 'CRG' + i.toString().padStart(5, '0')
          const cref = isProf ? 'CREF-TEST-' + i.toString().padStart(5, '0') : ''
          const professionalType = isProf ? 'Pessoa Física' : ''
          const treePos = currentMaxTreePos + i
          // Level aproximado na árvore binária: floor(log2(treePos)) + 1
          const treeLevel = Math.min(
            36,
            Math.max(1, Math.floor(Math.log(treePos) / Math.log(2)) + 1),
          )

          // Gerar ID padrão PocketBase de 15 caracteres alfanuméricos seguros
          // Prefixado ou hash para reprodutibilidade
          const rawHash = $security.md5('seed_loadtest_' + seedId + '_' + i)
          const id = (rawHash + '123456789012345').slice(0, 15).toLowerCase()
          const tokenKey = $security.randomString(30)

          // Password hash padrão Bcrypt para "Skip@Pass"
          // $2a$12$e8jU6eL.Bf2m4p... ou podemos usar uma string segura
          const dummyHash = '$2a$10$wN9i/wT9rRj.4iKq08m2sew6K95kQ862e3d7Fk9.4yq945a89q.6m'

          // Insert or Ignore no SQLite com colunas do PocketBase v0.23+
          txApp
            .db()
            .newQuery(`
            INSERT OR IGNORE INTO users (
              id, created, updated, email, emailVisibility, verified, tokenKey, password,
              name, role, plan, plan_type, approved, referral_code, cref, professional_type,
              rating_avg, tree_position, tree_level, subscription_status, city, state, country
            ) VALUES (
              {:id}, {:created}, {:updated}, {:email}, 0, 0, {:tokenKey}, {:password},
              {:name}, {:role}, {:plan}, {:plan_type}, 1, {:referral_code}, {:cref}, {:professional_type},
              5.0, {:tree_position}, {:tree_level}, 'cancelada', 'São Paulo', 'SP', 'Brasil'
            )
          `)
            .bind({
              id: id,
              created: nowIso,
              updated: nowIso,
              email: email,
              tokenKey: tokenKey,
              password: dummyHash,
              name: name,
              role: userRole,
              plan: plan,
              plan_type: userRole,
              referral_code: referralCode,
              cref: cref,
              professional_type: professionalType,
              tree_position: treePos,
              tree_level: treeLevel,
            })
            .execute()

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

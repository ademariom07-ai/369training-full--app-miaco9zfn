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

      // Obter tokenKey e passwordHash de um usuário real como modelo seguro
      let sampleTokenKey = ''
      let samplePasswordHash = ''
      try {
        const uSample = $app
          .db()
          .newQuery('SELECT tokenKey, passwordHash FROM users WHERE tokenKey != "" LIMIT 1')
          .one()
        if (uSample) {
          sampleTokenKey = uSample.tokenKey || ''
          samplePasswordHash = uSample.passwordHash || ''
        }
      } catch (_) {}

      if (!samplePasswordHash) {
        samplePasswordHash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8/kQW6K3n1.mHj9V.gRj9p1lU5jHhe'
      }

      const plans = ['gratis', 'basico', 'pro', 'premium']
      const nowStr = new Date().toISOString().replace('T', ' ').replace('Z', '')
      let insertedCount = 0

      // Executar via SQL direto atômico em lote
      // Isso elimina 100% qualquer risco de conflito de hooks, GoError ou pânico no JSVM
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

          // Idempotência: verificar duplicidade de email por query SQL direta
          let alreadyExists = false
          try {
            const existingRow = txApp
              .db()
              .newQuery('SELECT id FROM users WHERE email = {:em}')
              .bind({ em: email })
              .one()
            if (existingRow && existingRow.id) {
              alreadyExists = true
            }
          } catch (_) {}
          if (alreadyExists) {
            continue
          }

          // ID único de 15 caracteres compatível com PocketBase
          const customId = $security.randomString(15).toLowerCase()
          const uniqueTokenKey = $security.randomString(30)

          txApp
            .db()
            .newQuery(`
              INSERT INTO users (
                id,
                email,
                emailVisibility,
                verified,
                tokenKey,
                passwordHash,
                name,
                role,
                plan,
                plan_type,
                approved,
                referral_code,
                cref,
                professional_type,
                tree_position,
                tree_level,
                rating_avg,
                subscription_status,
                city,
                state,
                country,
                created,
                updated
              ) VALUES (
                {:id},
                {:email},
                0,
                0,
                {:tokenKey},
                {:passwordHash},
                {:name},
                {:role},
                {:plan},
                {:plan_type},
                1,
                {:referral_code},
                {:cref},
                {:professional_type},
                {:tree_position},
                {:tree_level},
                5.0,
                'cancelada',
                'São Paulo',
                'SP',
                'Brasil',
                {:created},
                {:updated}
              )
            `)
            .bind({
              id: customId,
              email: email,
              tokenKey: uniqueTokenKey,
              passwordHash: samplePasswordHash,
              name: name,
              role: userRole,
              plan: plan,
              plan_type: userRole,
              referral_code: referralCode,
              cref: cref,
              professional_type: professionalType,
              tree_position: treePos,
              tree_level: treeLevel,
              created: nowStr,
              updated: nowStr,
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

// Hook: Cleanup Load Test (Remoção dos usuários de teste e registros derivados)
// Endpoint: POST /backend/v1/admin/seed_loadtest_cleanup
// Restrito a admin ($apis.requireAuth() + role === 'admin')
// Remove usuários com name LIKE 'TESTE CARGA #%' OU email LIKE 'carga.%@exemplo.com'
// Remove também registros derivados:
// - rank_entries
// - monthly_rank_snapshots
// - wallet_transactions
// - cashback_distributions
// - referrals (referrer OU referred)
// - users

routerAdd(
  'POST',
  '/backend/v1/admin/seed_loadtest_cleanup',
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

      console.log('[CLEANUP] Iniciando processo de limpeza de teste de carga...')

      // 1. Obter lista de IDs dos usuários de teste
      // Tenta via SQL .all() primeiro; em caso de erro, usa fallback com $app.findRecordsByFilter
      let testUserIds = []
      try {
        const rows = $app
          .db()
          .newQuery(
            "SELECT id FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'",
          )
          .all()
        if (rows && rows.length > 0) {
          for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].id) {
              testUserIds.push(String(rows[i].id))
            }
          }
        }
        console.log('[CLEANUP] IDs obtidos via SQL .all():', testUserIds.length)
      } catch (sqlErr) {
        console.warn(
          '[CLEANUP] Falha no SELECT .all(), tentando fallback via findRecordsByFilter:',
          sqlErr,
        )
        try {
          const records = $app.findRecordsByFilter(
            'users',
            "name ~ 'TESTE CARGA' || email ~ 'carga'",
            '-created',
            10000,
            0,
          )
          if (records && records.length > 0) {
            for (let i = 0; i < records.length; i++) {
              testUserIds.push(records[i].get('id'))
            }
          }
          console.log('[CLEANUP] IDs obtidos via fallback findRecordsByFilter:', testUserIds.length)
        } catch (recErr) {
          console.error('[CLEANUP] Erro fatal ao buscar IDs de teste:', recErr)
          return c.json(500, {
            status: 'error',
            code: 'CLEANUP_QUERY_ERROR',
            message:
              'Erro ao identificar usuários de teste: ' +
              (recErr ? recErr.message : String(recErr)),
          })
        }
      }

      if (testUserIds.length === 0) {
        console.log('[CLEANUP] Nenhum usuário de teste encontrado para remoção.')
        return c.json(200, {
          status: 'ok',
          code: 'CLEANUP_SUCCESS',
          removed_users: 0,
          removed_derived: 0,
          message: 'Nenhum usuário de teste encontrado no banco.',
        })
      }

      // Função auxiliar interna para dividir array em lotes
      const chunkSize = 500
      const chunks = []
      for (let i = 0; i < testUserIds.length; i += chunkSize) {
        chunks.push(testUserIds.slice(i, i + chunkSize))
      }

      const errors = []
      let removedDerivedCount = 0
      let removedUsersCount = 0

      // 2. Limpar tabelas derivadas por chunks de IDs com SQL inline seguro
      // IDs de PocketBase contêm apenas caracteres alfanuméricos minúsculos
      const tablesToDelete = [
        { table: 'rank_entries', column: 'user' },
        { table: 'monthly_rank_snapshots', column: 'user' },
        { table: 'wallet_transactions', column: 'user' },
        { table: 'cashback_distributions', column: 'user' },
      ]

      for (let t = 0; t < tablesToDelete.length; t++) {
        const item = tablesToDelete[t]
        let tableDeleted = 0
        try {
          for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
            const chunk = chunks[cIdx]
            const escapedIds = chunk.map((id) => "'" + id.replace(/'/g, '') + "'").join(',')
            const sql =
              'DELETE FROM ' + item.table + ' WHERE ' + item.column + ' IN (' + escapedIds + ')'
            const res = $app.db().newQuery(sql).execute()
            if (res && typeof res.rowsAffected === 'function') {
              tableDeleted += res.rowsAffected()
            }
          }
          removedDerivedCount += tableDeleted
          console.log(
            '[CLEANUP] passo derivado ' +
              item.table +
              ' ok, ' +
              tableDeleted +
              ' registros afetados',
          )
        } catch (tableErr) {
          console.error('[CLEANUP] Erro ao limpar ' + item.table + ':', tableErr)
          errors.push(item.table + ': ' + (tableErr ? tableErr.message : String(tableErr)))
        }
      }

      // 3. Limpar referrals (referrer OU referred)
      try {
        let refDeleted = 0
        for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
          const chunk = chunks[cIdx]
          const escapedIds = chunk.map((id) => "'" + id.replace(/'/g, '') + "'").join(',')
          const sql =
            'DELETE FROM referrals WHERE referrer IN (' +
            escapedIds +
            ') OR referred IN (' +
            escapedIds +
            ')'
          const res = $app.db().newQuery(sql).execute()
          if (res && typeof res.rowsAffected === 'function') {
            refDeleted += res.rowsAffected()
          }
        }
        removedDerivedCount += refDeleted
        console.log('[CLEANUP] passo derivado referrals ok, ' + refDeleted + ' registros afetados')
      } catch (refErr) {
        console.error('[CLEANUP] Erro ao limpar referrals:', refErr)
        errors.push('referrals: ' + (refErr ? refErr.message : String(refErr)))
      }

      // 4. Limpar users por chunks de IDs
      try {
        for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
          const chunk = chunks[cIdx]
          const escapedIds = chunk.map((id) => "'" + id.replace(/'/g, '') + "'").join(',')
          const sql = 'DELETE FROM users WHERE id IN (' + escapedIds + ')'
          const res = $app.db().newQuery(sql).execute()
          if (res && typeof res.rowsAffected === 'function') {
            removedUsersCount += res.rowsAffected()
          } else {
            removedUsersCount += chunk.length
          }
        }
        console.log('[CLEANUP] passo users ok, ' + removedUsersCount + ' usuários removidos')
      } catch (userErr) {
        console.error('[CLEANUP] Erro ao deletar users:', userErr)
        errors.push('users: ' + (userErr ? userErr.message : String(userErr)))
      }

      // 5. Resposta formatada
      const hasErrors = errors.length > 0
      const message =
        'Limpeza de carga concluída! ' +
        removedUsersCount +
        ' usuários e ' +
        removedDerivedCount +
        ' registros vinculados foram excluídos.' +
        (hasErrors ? ' Avisos: ' + errors.join('; ') : '')

      return c.json(200, {
        status: 'ok',
        code: 'CLEANUP_SUCCESS',
        removed_users: removedUsersCount,
        removed_derived: removedDerivedCount,
        errors: hasErrors ? errors : undefined,
        message: message,
      })
    } catch (err) {
      console.error('[CLEANUP] Erro geral no seed_loadtest_cleanup:', err)
      return c.json(500, {
        status: 'error',
        code: 'CLEANUP_ERROR',
        message: err && err.message ? err.message : 'Erro interno ao limpar usuários de teste.',
      })
    }
  },
  $apis.requireAuth(),
)

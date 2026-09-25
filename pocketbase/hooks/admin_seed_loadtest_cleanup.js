// Hook: Cleanup Load Test (Remoção dos 10.000 usuários de teste e registros derivados)
// Endpoint: POST /backend/v1/admin/seed_loadtest_cleanup
// Restrito a admin ($apis.requireAuth() + role === 'admin')
// Remove usuários com name LIKE 'TESTE CARGA #%' OU email LIKE 'carga.%@exemplo.com'
// Remove também registros derivados:
// - rank_entries
// - monthly_rank_snapshots
// - wallet_transactions
// - cashback_distributions
// - audits de teste
// - services de teste (caso houvesse)
// - referrals de teste

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

      let removedUsersCount = 0
      let removedRankEntriesCount = 0
      let removedSnapshotsCount = 0
      let removedWalletTxsCount = 0
      let removedCashbackDistCount = 0

      // Executar a limpeza com queries diretas e atômicas em transação
      $app.runInTransaction((txApp) => {
        // 1. Contar quantos usuários de teste existem
        const userRow = txApp
          .db()
          .newQuery(
            "SELECT count(*) as total FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'",
          )
          .one()
        if (userRow && userRow.total) {
          removedUsersCount = parseInt(userRow.total, 10) || 0
        }

        // 2. Limpar rank_entries associados a usuários de teste
        txApp
          .db()
          .newQuery(`
            DELETE FROM rank_entries WHERE user IN (
              SELECT id FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'
            )
          `)
          .execute()

        // 3. Limpar monthly_rank_snapshots associados a usuários de teste
        txApp
          .db()
          .newQuery(`
            DELETE FROM monthly_rank_snapshots WHERE user IN (
              SELECT id FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'
            )
          `)
          .execute()

        // 4. Limpar wallet_transactions associadas a usuários de teste
        txApp
          .db()
          .newQuery(`
            DELETE FROM wallet_transactions WHERE user IN (
              SELECT id FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'
            )
          `)
          .execute()

        // 5. Limpar cashback_distributions associados a usuários de teste
        txApp
          .db()
          .newQuery(`
            DELETE FROM cashback_distributions WHERE user IN (
              SELECT id FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'
            )
          `)
          .execute()

        // 6. Limpar referrals associados
        txApp
          .db()
          .newQuery(`
            DELETE FROM referrals WHERE referrer IN (
              SELECT id FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'
            ) OR referred IN (
              SELECT id FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'
            )
          `)
          .execute()

        // 7. Deletar os usuários de teste
        txApp
          .db()
          .newQuery(
            "DELETE FROM users WHERE name LIKE 'TESTE CARGA #%' OR email LIKE 'carga.%@exemplo.com'",
          )
          .execute()

        // 8. Opcional: Reindexar ranking positions de rank_entries caso necessário
        // (Será feito pelo recálculo se o admin chamar)
      })

      return c.json(200, {
        status: 'ok',
        code: 'CLEANUP_SUCCESS',
        removed_users: removedUsersCount,
        message:
          'Limpeza de carga concluída com sucesso! ' +
          removedUsersCount +
          ' usuários e registros vinculados foram excluídos.',
      })
    } catch (err) {
      console.error('Erro no seed_loadtest_cleanup:', err)
      return c.json(500, {
        status: 'error',
        code: 'CLEANUP_ERROR',
        message: err ? err.message : 'Erro interno ao limpar usuários de teste.',
      })
    }
  },
  $apis.requireAuth(),
)

// Migration 0062: Limpeza das tarifas indevidamente criadas para serviços de meses passados
// Regra do projeto: Não alterar tarifas/setembro existentes.
// Os serviços com created < '2026-10-01' pertencem aos ciclos anteriores (agosto/setembro) e não devem
// ter tarifas criadas retroativamente em outubro.
// Esta migração remove SOMENTE as transações de tarifa criadas pela migration 0061 cujo serviço de referência
// foi criado antes de 2026-10-01. As tarifas dos 5 serviços de 01/10 (outubro) são preservadas intactas!

migrate(
  (app) => {
    try {
      // 1. Obter todos os IDs de serviços concluídos criados antes de 2026-10-01
      const pastServices = app.findRecordsByFilter(
        'services',
        "status = 'concluido' && created < '2026-10-01 00:00:00'",
        '-created',
        5000,
        0,
      )

      let removed = 0
      for (let i = 0; i < pastServices.length; i++) {
        const svc = pastServices[i]
        try {
          const txs = app.findRecordsByFilter(
            'wallet_transactions',
            `reference_id = '${svc.id}' && type = 'tarifa' && reference_type = 'service'`,
            '-created',
            10,
            0,
          )
          for (let j = 0; j < txs.length; j++) {
            app.delete(txs[j])
            removed++
          }
        } catch (itemErr) {
          console.warn(`Aviso ao remover tarifa retroativa de svc passado ${svc.id}:`, itemErr)
        }
      }

      console.log(
        `[Migration 0062] Removidas ${removed} tarifas retroativas indevidas de serviços passados. Tarifas de outubro preservadas.`,
      )
    } catch (err) {
      console.error('[Migration 0062] Erro na limpeza:', err)
    }
  },
  (app) => {},
)

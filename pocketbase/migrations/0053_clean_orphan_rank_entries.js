migrate(
  (app) => {
    // 1. Remover entradas órfãs de ciclos anteriores na coleção rank_entries
    // O ciclo atual é 2026-09. Linhas órfãs (ex: ciclo 2026-08 de testes antigos) não devem coexistir
    // e criam duplicidade no ranking ativo do usuário.
    // Preserva intactas as coleções monthly_rank_snapshots e cashback_distributions.
    app
      .db()
      .newQuery(`
      DELETE FROM rank_entries WHERE cycle != '2026-09'
    `)
      .execute()

    // 2. Garantir também que não existam linhas duplicadas por usuário no ciclo 2026-09,
    // mantendo a linha com maior pontuação ou a mais recente caso existisse duplicata.
    app
      .db()
      .newQuery(`
      DELETE FROM rank_entries WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY user ORDER BY points DESC, updated DESC) as rn
          FROM rank_entries
        ) WHERE rn = 1
      )
    `)
      .execute()
  },
  (app) => {
    // Reversão não é necessária para limpeza de registros órfãos de teste
  },
)

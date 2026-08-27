migrate(
  (app) => {
    const challengesCol = app.findCollectionByNameOrId('challenges')

    // Seed 2 initial challenges if empty
    const count = app.countRecords('challenges')
    if (count === 0) {
      let profId = null
      try {
        const prof = app.findFirstRecordByData('users', 'role', 'profissional')
        if (prof) profId = prof.id
      } catch (_) {}

      const c1 = new Record(challengesCol)
      c1.set('title', 'Desafio 21 Dias de Consistência Total')
      c1.set(
        'description',
        'Supere seus limites completando 21 dias seguidos de treino focado e hidratação regular.',
      )
      c1.set(
        'regras',
        'Realizar pelo menos 1 treino por dia, beber 3L de água e registrar o progresso diário.',
      )
      c1.set('dias_total', 21)
      c1.set('reward_badge', 'Guerreiro 369')
      if (profId) c1.set('professional_id', profId)
      app.save(c1)

      const c2 = new Record(challengesCol)
      c2.set('title', 'Desafio 7 Dias de Queima & Mobilidade')
      c2.set('description', 'Uma semana intensa de circuitos metabólicos e flexibilidade postural.')
      c2.set('regras', '30 minutos de mobilidade matinal e circuito de alta intensidade à tarde.')
      c2.set('dias_total', 7)
      c2.set('reward_badge', 'Foco Rápido')
      if (profId) c2.set('professional_id', profId)
      app.save(c2)
    }
  },
  (app) => {
    // Revert logic
  },
)

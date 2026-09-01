migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Campos de Rede Única Global na coleção users (ordem de entrada / spillover até nível 36)
    if (!users.fields.getByName('tree_position')) {
      users.fields.add(
        new NumberField({
          name: 'tree_position',
          min: 1,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('tree_level')) {
      users.fields.add(
        new NumberField({
          name: 'tree_level',
          min: 1,
          max: 36,
          required: false,
        }),
      )
    }

    // Campo para vincular aluno ao profissional (para regra de multiplicador vinculado ou tarifa R$ 3,00)
    if (!users.fields.getByName('linked_professional')) {
      users.fields.add(
        new RelationField({
          name: 'linked_professional',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('linked_prof_fee_mode')) {
      users.fields.add(
        new SelectField({
          name: 'linked_prof_fee_mode',
          values: ['own_plan', 'prof_sponsored'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('plan_upgraded_at')) {
      users.fields.add(
        new DateField({
          name: 'plan_upgraded_at',
          required: false,
        }),
      )
    }

    app.save(users)

    // 2. Coleção de Snapshots Mensais de Ranking (para histórico e soma de meses anteriores fechados + mês vigente)
    try {
      app.findCollectionByNameOrId('monthly_rank_snapshots')
    } catch (_) {
      const snapshotCol = new Collection({
        name: 'monthly_rank_snapshots',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'cycle', type: 'text', required: true }, // ex: "2026-08"
          { name: 'points', type: 'number', required: true },
          { name: 'services_count', type: 'number', required: false },
          { name: 'referrals_count', type: 'number', required: false },
          { name: 'stars', type: 'number', required: false },
          { name: 'antiguidade', type: 'number', required: false },
          { name: 'ranking_position', type: 'number', required: false },
          { name: 'plan', type: 'text', required: false },
          { name: 'cashback_earned', type: 'number', required: false },
          { name: 'closed_at', type: 'date', required: false },
          { name: 'details', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_mrs_user_cycle ON monthly_rank_snapshots (user, cycle)',
          'CREATE INDEX idx_mrs_cycle_pos ON monthly_rank_snapshots (cycle, ranking_position)',
        ],
      })
      app.save(snapshotCol)
    }

    // 3. Atualizar configurações padrão de split (Caminho C: 38% Rede / 30% App / 10% Filantropia / 10% Imposto / 4% Mkt / 4% Parc / 4% Sup)
    const configCol = app.findCollectionByNameOrId('platform_config')
    try {
      const splitRec = app.findFirstRecordByData('platform_config', 'key', 'revenue_split')
      splitRec.set('value', {
        partner_pool_pct: 0.38,
        app_pct: 0.3,
        filantropia_pct: 0.1,
        imposto_pct: 0.1,
        marketing_carreira_pct: 0.04,
        parceiro_investidor_pct: 0.04,
        suporte_tecnico_pct: 0.04,
      })
      splitRec.set('description', 'Split padrão Caminho C 369TRAINING (Total 100%)')
      app.save(splitRec)
    } catch (_) {
      const splitRec = new Record(configCol)
      splitRec.set('key', 'revenue_split')
      splitRec.set('value', {
        partner_pool_pct: 0.38,
        app_pct: 0.3,
        filantropia_pct: 0.1,
        imposto_pct: 0.1,
        marketing_carreira_pct: 0.04,
        parceiro_investidor_pct: 0.04,
        suporte_tecnico_pct: 0.04,
      })
      splitRec.set('description', 'Split padrão Caminho C 369TRAINING (Total 100%)')
      app.save(splitRec)
    }

    // 4. Configurar Multiplicadores e Tarifas do Caminho C
    try {
      const multiRec = app.findFirstRecordByData('platform_config', 'key', 'plan_multipliers')
      multiRec.set('value', {
        gratis: 0,
        basico: 1,
        pro: 2,
        premium: 3,
      })
      app.save(multiRec)
    } catch (_) {
      const multiRec = new Record(configCol)
      multiRec.set('key', 'plan_multipliers')
      multiRec.set('value', {
        gratis: 0,
        basico: 1,
        pro: 2,
        premium: 3,
      })
      multiRec.set(
        'description',
        'Multiplicadores de plano: Grátis 0x, Básico 1x, Pro 2x, Premium 3x',
      )
      app.save(multiRec)
    }

    // 5. Atribuir posições na Rede Única Global para usuários existentes sem posição
    const allUsers = app.findRecordsByFilter('users', '', 'created', 1000, 0)
    let currentPos = 1
    for (const u of allUsers) {
      if (!u.get('tree_position') || u.get('tree_position') <= 0) {
        u.set('tree_position', currentPos)
        // Calcular nível: Nível n tem capacidade 2^(n-1), acumulado 2^n - 1
        let lvl = 1
        while (lvl < 36 && Math.pow(2, lvl) - 1 < currentPos) {
          lvl++
        }
        u.set('tree_level', lvl)
        app.save(u)
      }
      currentPos++
    }
  },
  (app) => {
    try {
      const snapCol = app.findCollectionByNameOrId('monthly_rank_snapshots')
      app.delete(snapCol)
    } catch (_) {}
  },
)

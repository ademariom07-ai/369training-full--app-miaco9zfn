migrate(
  (app) => {
    // 1. Atualizar users:
    // a) Adicionar 'pro_parceiro' aos valores permitidos no select 'plan'
    // b) Adicionar subscription_status: select('ativa', 'inadimplente', 'cancelada')
    // c) Adicionar subscription_expires_at: date
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const planField = users.fields.getByName('plan')
    if (planField && planField instanceof SelectField) {
      planField.values = ['gratis', 'basico', 'pro', 'premium', 'pro_parceiro']
      planField.maxSelect = 1
    }

    if (!users.fields.getByName('subscription_status')) {
      users.fields.add(
        new SelectField({
          name: 'subscription_status',
          values: ['ativa', 'inadimplente', 'cancelada'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('subscription_expires_at')) {
      users.fields.add(
        new DateField({
          name: 'subscription_expires_at',
          required: false,
        }),
      )
    }
    app.save(users)

    // 2. Atualizar wallet_transactions:
    // Permitir type 'mensalidade'
    const walletCol = app.findCollectionByNameOrId('wallet_transactions')
    const typeField = walletCol.fields.getByName('type')
    if (typeField && typeField instanceof SelectField) {
      typeField.values = ['deposito', 'saque', 'cashback', 'tarifa', 'servico', 'mensalidade']
      typeField.maxSelect = 1
    }
    app.save(walletCol)

    // 3. Criar coleção radar_briefings
    if (!app.hasTable('radar_briefings')) {
      const radarCol = new Collection({
        name: 'radar_briefings',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'specialty',
            type: 'text',
            required: true,
          },
          {
            name: 'cycle',
            type: 'text',
            required: true,
          },
          {
            name: 'items',
            type: 'json',
            required: false,
          },
          {
            name: 'published_at',
            type: 'date',
            required: false,
          },
          {
            name: 'is_mock',
            type: 'bool',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_radar_specialty_cycle ON radar_briefings (specialty, cycle)'],
      })
      app.save(radarCol)
    }

    // 4. Configurações de plataforma em platform_config:
    // - student_prices
    // - pro_parceiro_price_monthly
    // - pro_parceiro_price_annual
    // - pro_parceiro_floor
    // - pool_feed_config
    // - partner_ai_limits (franquias preparatórias multi-aluno: 60 treinos/mês + 120 msgs/mês)
    const configCol = app.findCollectionByNameOrId('platform_config')
    const configs = [
      {
        key: 'student_prices',
        value: {
          gratis: 0,
          basico: 10,
          pro: 20,
          premium: 30,
          annual_multiplier: 10,
        },
        description: 'Mensalidades fixas de Alunos e multiplicador anual (10x)',
      },
      {
        key: 'pro_parceiro_price_monthly',
        value: 49,
        description: 'Mensalidade do plano PRO PARCEIRO (R$ 49/mês)',
      },
      {
        key: 'pro_parceiro_price_annual',
        value: 490,
        description: 'Anuidade do plano PRO PARCEIRO (R$ 490 = 10x mensalidade)',
      },
      {
        key: 'pro_parceiro_floor',
        value: 10,
        description:
          'Piso mínimo de contagem de serviços para pontuação do PRO PARCEIRO no ranking',
      },
      {
        key: 'pool_feed_config',
        value: {
          partner_pool_pct: 0.38,
          student_monthly_pct: 1.0,
          pro_parceiro_monthly_pct: 0.38,
          service_tarifa_pct: 1.0,
        },
        description:
          'Regras de alimentação do Pool 38%: mensalidades não vinculados + % PRO PARCEIRO + tarifas',
      },
      {
        key: 'partner_ai_limits',
        value: {
          workouts_per_month: 60,
          messages_per_month: 120,
        },
        description: 'Franquias do agente multi-aluno para plano PRO PARCEIRO',
      },
    ]

    for (const item of configs) {
      try {
        const existing = app.findFirstRecordByData('platform_config', 'key', item.key)
        existing.set('value', item.value)
        existing.set('description', item.description)
        app.save(existing)
      } catch (_) {
        const rec = new Record(configCol)
        rec.set('key', item.key)
        rec.set('value', item.value)
        rec.set('description', item.description)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const radar = app.findCollectionByNameOrId('radar_briefings')
      app.delete(radar)
    } catch (_) {}
  },
)

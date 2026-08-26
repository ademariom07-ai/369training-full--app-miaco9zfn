migrate(
  (app) => {
    // 1. Extend referrals with validated_at and referral_bonus_paid
    const referrals = app.findCollectionByNameOrId('referrals')
    if (!referrals.fields.getByName('validated_at')) {
      referrals.fields.add(
        new DateField({
          name: 'validated_at',
          required: false,
        }),
      )
    }
    if (!referrals.fields.getByName('referral_bonus_paid')) {
      referrals.fields.add(
        new BoolField({
          name: 'referral_bonus_paid',
          required: false,
        }),
      )
    }
    app.save(referrals)

    // 2. Extend appointments with requires_advance, advance_amount, advance_paid
    const appointments = app.findCollectionByNameOrId('appointments')
    if (!appointments.fields.getByName('requires_advance')) {
      appointments.fields.add(
        new BoolField({
          name: 'requires_advance',
          required: false,
        }),
      )
    }
    if (!appointments.fields.getByName('advance_amount')) {
      appointments.fields.add(
        new NumberField({
          name: 'advance_amount',
          min: 0,
          required: false,
        }),
      )
    }
    if (!appointments.fields.getByName('advance_paid')) {
      appointments.fields.add(
        new BoolField({
          name: 'advance_paid',
          required: false,
        }),
      )
    }
    app.save(appointments)

    // 3. Extend messages with reported and report_reason
    const messages = app.findCollectionByNameOrId('messages')
    if (!messages.fields.getByName('reported')) {
      messages.fields.add(
        new BoolField({
          name: 'reported',
          required: false,
        }),
      )
    }
    if (!messages.fields.getByName('report_reason')) {
      messages.fields.add(
        new TextField({
          name: 'report_reason',
          required: false,
        }),
      )
    }
    app.save(messages)

    // 4. Extend users with crp, sub_specialties, country
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('crp')) {
      users.fields.add(
        new TextField({
          name: 'crp',
          required: false,
        }),
      )
    }
    if (!users.fields.getByName('sub_specialties')) {
      users.fields.add(
        new JSONField({
          name: 'sub_specialties',
          required: false,
        }),
      )
    }
    if (!users.fields.getByName('country')) {
      users.fields.add(
        new TextField({
          name: 'country',
          required: false,
        }),
      )
    }

    // Update specialties field in users to include 'Psicologia'
    const specialtiesField = users.fields.getByName('specialties')
    if (specialtiesField && specialtiesField instanceof SelectField) {
      specialtiesField.values = [
        'Educação Física',
        'Nutrição',
        'Fisioterapia',
        'Artes Marciais',
        'Psicologia',
      ]
      specialtiesField.maxSelect = 5
    }
    app.save(users)

    // 5. Create chat_terms_acceptances collection
    try {
      app.findCollectionByNameOrId('chat_terms_acceptances')
    } catch (_) {
      const chatTerms = new Collection({
        name: 'chat_terms_acceptances',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'user',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            required: true,
          },
          { name: 'accepted_at', type: 'date', required: true },
          { name: 'ip_address', type: 'text', required: false },
          { name: 'user_agent', type: 'text', required: false },
          { name: 'version', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_chat_terms_user ON chat_terms_acceptances (user)'],
      })
      app.save(chatTerms)
    }

    // 6. Create contents collection
    try {
      app.findCollectionByNameOrId('contents')
    } catch (_) {
      const contents = new Collection({
        name: 'contents',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text', required: false },
          {
            name: 'type',
            type: 'select',
            values: ['video', 'pdf', 'ebook', 'spreadsheet'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'file',
            type: 'file',
            maxSelect: 1,
            maxSize: 52428800, // 50MB
            required: false,
          },
          { name: 'file_url', type: 'text', required: false },
          { name: 'preview_url', type: 'text', required: false },
          { name: 'price', type: 'number', min: 0, required: false },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'aprovado', 'rejeitado'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'professional_id',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            required: true,
          },
          { name: 'category', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_contents_prof ON contents (professional_id)',
          'CREATE INDEX idx_contents_status ON contents (status)',
        ],
      })
      app.save(contents)
    }

    // 7. Create content_purchases collection (so students track owned contents)
    try {
      app.findCollectionByNameOrId('content_purchases')
    } catch (_) {
      const purchases = new Collection({
        name: 'content_purchases',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'user',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            required: true,
          },
          {
            name: 'content',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('contents').id,
            maxSelect: 1,
            required: true,
          },
          { name: 'price_paid', type: 'number', min: 0, required: true },
          { name: 'platform_fee', type: 'number', min: 0, required: false },
          { name: 'professional_revenue', type: 'number', min: 0, required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_cp_user ON content_purchases (user)',
          'CREATE INDEX idx_cp_content ON content_purchases (content)',
        ],
      })
      app.save(purchases)
    }

    // 8. Platform config default values
    const configCol = app.findCollectionByNameOrId('platform_config')
    const configsToSeed = [
      {
        key: 'min_services_to_validate_referral',
        value: 5,
        description:
          'Mínimo de serviços concluídos para validar indicação e liberar cashback de referral',
      },
      {
        key: 'advance_pct_first_consultation',
        value: 30,
        description:
          'Percentual do sinal/adiantamento obrigatório na 1ª consulta entre profissional e aluno',
      },
      {
        key: 'content_commission_pct',
        value: 10,
        description: 'Percentual de comissão da plataforma sobre vendas de conteúdos',
      },
    ]

    for (const item of configsToSeed) {
      try {
        app.findFirstRecordByData('platform_config', 'key', item.key)
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
      const purchases = app.findCollectionByNameOrId('content_purchases')
      app.delete(purchases)
    } catch (_) {}
    try {
      const contents = app.findCollectionByNameOrId('contents')
      app.delete(contents)
    } catch (_) {}
    try {
      const chatTerms = app.findCollectionByNameOrId('chat_terms_acceptances')
      app.delete(chatTerms)
    } catch (_) {}
  },
)

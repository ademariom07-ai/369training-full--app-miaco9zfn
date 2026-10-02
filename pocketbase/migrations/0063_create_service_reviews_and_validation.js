migrate(
  (app) => {
    // 1. Atualizar a coleção services para incluir campos de controle de validação da aula
    const servicesCol = app.findCollectionByNameOrId('services')
    if (!servicesCol.fields.getByName('validated')) {
      servicesCol.fields.add(new BoolField({ name: 'validated' }))
    }
    if (!servicesCol.fields.getByName('validation_status')) {
      servicesCol.fields.add(
        new SelectField({
          name: 'validation_status',
          values: ['pendente', 'validada', 'totalmente_validada'],
          maxSelect: 1,
        }),
      )
    }
    if (!servicesCol.fields.getByName('validated_at')) {
      servicesCol.fields.add(new DateField({ name: 'validated_at' }))
    }
    app.save(servicesCol)

    // 2. Criar coleção service_reviews (avaliação mútua pós-aula)
    if (!app.hasTable('service_reviews')) {
      const usersColId = '_pb_users_auth_'
      const servicesColId = servicesCol.id

      const reviewCol = new Collection({
        name: 'service_reviews',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (reviewer = @request.auth.id || reviewee = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (reviewer = @request.auth.id || reviewee = @request.auth.id || @request.auth.role = 'admin')",
        createRule: "@request.auth.id != '' && @request.body.reviewer = @request.auth.id",
        updateRule:
          "@request.auth.id != '' && (reviewer = @request.auth.id || @request.auth.role = 'admin')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'service',
            type: 'relation',
            required: true,
            collectionId: servicesColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'reviewer',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'reviewee',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'rating',
            type: 'number',
            required: true,
            min: 1,
            max: 5,
            onlyInt: true,
          },
          {
            name: 'message',
            type: 'text',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_review_service_reviewer ON service_reviews (service, reviewer)',
          'CREATE INDEX idx_review_service ON service_reviews (service)',
          'CREATE INDEX idx_review_reviewee ON service_reviews (reviewee)',
        ],
      })
      app.save(reviewCol)
    }
  },
  (app) => {
    try {
      const reviewCol = app.findCollectionByNameOrId('service_reviews')
      app.delete(reviewCol)
    } catch (_) {}

    try {
      const servicesCol = app.findCollectionByNameOrId('services')
      if (servicesCol.fields.getByName('validated')) {
        servicesCol.fields.removeByName('validated')
      }
      if (servicesCol.fields.getByName('validation_status')) {
        servicesCol.fields.removeByName('validation_status')
      }
      if (servicesCol.fields.getByName('validated_at')) {
        servicesCol.fields.removeByName('validated_at')
      }
      app.save(servicesCol)
    } catch (_) {}
  },
)

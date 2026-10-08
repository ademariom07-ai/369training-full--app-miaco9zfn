/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Verificar se collection já existe
    try {
      const existing = app.findCollectionByNameOrId('matching_profiles')
      if (existing) return
    } catch (_) {}

    const collection = new Collection({
      name: 'matching_profiles',
      type: 'base',
      system: false,
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'age_group',
          type: 'text',
          required: false,
        },
        {
          name: 'primary_goal',
          type: 'text',
          required: false,
        },
        {
          name: 'training_type',
          type: 'text',
          required: false,
        },
        {
          name: 'specialty_needed',
          type: 'text',
          required: false,
        },
        {
          name: 'availability',
          type: 'text',
          required: false,
        },
        {
          name: 'location_pref',
          type: 'text',
          required: false,
        },
        {
          name: 'answers',
          type: 'json',
          required: false,
        },
      ],
    })

    app.save(collection)

    // Agora que o field 'user' existe no schema, aplicamos as regras de controle de acesso
    collection.listRule = '@request.auth.id != "" && user = @request.auth.id'
    collection.viewRule = '@request.auth.id != "" && user = @request.auth.id'
    collection.createRule = '@request.auth.id != "" && @request.body.user = @request.auth.id'
    collection.updateRule = '@request.auth.id != "" && user = @request.auth.id'
    collection.deleteRule = '@request.auth.id != "" && user = @request.auth.id'
    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('matching_profiles')
      if (col) app.delete(col)
    } catch (_) {}
  },
)

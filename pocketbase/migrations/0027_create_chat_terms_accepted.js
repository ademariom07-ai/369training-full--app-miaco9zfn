migrate(
  (app) => {
    // Check if collection already exists
    try {
      app.findCollectionByNameOrId('chat_terms_accepted')
      return // already exists
    } catch (_) {}

    const collection = new Collection({
      name: 'chat_terms_accepted',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'accepted_at',
          type: 'date',
          required: false,
        },
        {
          name: 'ip_hash',
          type: 'text',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: ['CREATE INDEX idx_chat_terms_accepted_user ON chat_terms_accepted (user_id)'],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('chat_terms_accepted')
      app.delete(collection)
    } catch (_) {}
  },
)

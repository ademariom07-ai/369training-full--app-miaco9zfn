/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('ai_workout_credits')) {
      users.fields.add(
        new NumberField({
          name: 'ai_workout_credits',
          required: false,
          min: 0,
          onlyInt: true,
        }),
      )
    }

    if (!users.fields.getByName('ai_workout_credits_reset_at')) {
      users.fields.add(
        new TextField({
          name: 'ai_workout_credits_reset_at',
          required: false,
        }),
      )
    }

    app.save(users)

    // Ajustar createRule de content_purchases se necessário para permitir gravação autenticada ou via hook
    try {
      const cpCol = app.findCollectionByNameOrId('content_purchases')
      cpCol.createRule =
        "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
      app.save(cpCol)
    } catch (_) {}
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      if (users.fields.getByName('ai_workout_credits')) {
        users.fields.removeByName('ai_workout_credits')
      }
      if (users.fields.getByName('ai_workout_credits_reset_at')) {
        users.fields.removeByName('ai_workout_credits_reset_at')
      }
      app.save(users)
    } catch (_) {}
  },
)

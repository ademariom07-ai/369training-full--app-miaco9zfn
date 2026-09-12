migrate(
  (app) => {
    // 1. Atualizar regras de users: permitir listagem e visualização mútua entre aluno e profissional
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule =
      "id = @request.auth.id || @request.auth.role = 'admin' || (@request.auth.role = 'aluno' && role = 'profissional') || (@request.auth.role = 'profissional' && role = 'aluno')"
    users.viewRule =
      "id = @request.auth.id || @request.auth.role = 'admin' || (@request.auth.role = 'aluno' && role = 'profissional') || (@request.auth.role = 'profissional' && role = 'aluno')"
    app.save(users)

    // 2. Proteger mensagens do chat: restringir estritamente a sender e receiver
    const messages = app.findCollectionByNameOrId('messages')
    messages.listRule = 'sender = @request.auth.id || receiver = @request.auth.id'
    messages.viewRule = 'sender = @request.auth.id || receiver = @request.auth.id'
    messages.createRule =
      '@request.body.sender = @request.auth.id && @request.body.receiver != @request.auth.id'
    messages.updateRule = 'sender = @request.auth.id || receiver = @request.auth.id'
    messages.deleteRule = 'sender = @request.auth.id'
    app.save(messages)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule =
      "id = @request.auth.id || @request.auth.role = 'admin' || (@request.auth.role = 'aluno' && role = 'profissional')"
    users.viewRule = 'id = @request.auth.id'
    app.save(users)

    const messages = app.findCollectionByNameOrId('messages')
    messages.listRule = "@request.auth.id != ''"
    messages.viewRule = "@request.auth.id != ''"
    messages.createRule = "@request.auth.id != ''"
    messages.updateRule = "@request.auth.id != ''"
    messages.deleteRule = "@request.auth.id != ''"
    app.save(messages)
  },
)

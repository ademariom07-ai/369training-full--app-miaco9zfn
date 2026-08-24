migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule =
      "id = @request.auth.id || @request.auth.role = 'admin' || (@request.auth.role = 'aluno' && role = 'profissional')"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    app.save(users)
  },
)

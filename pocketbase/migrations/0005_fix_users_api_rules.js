migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    users.createRule = "@request.body.role != 'admin'"
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.updateRule = 'id = @request.auth.id'

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule = ''
    app.save(users)
  },
)

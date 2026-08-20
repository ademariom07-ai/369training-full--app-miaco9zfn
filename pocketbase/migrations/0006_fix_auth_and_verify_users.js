migrate(
  (app) => {
    // 1. Mark existing unverified users as verified so they can log in
    app
      .db()
      .newQuery('UPDATE users SET verified = 1 WHERE verified = 0 OR verified IS NULL')
      .execute()

    // 2. Ensure createRule allows registration without restrictions that could fail
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule = "@request.body.role != 'admin'"
    app.save(users)
  },
  (app) => {
    // Revert if necessary
  },
)

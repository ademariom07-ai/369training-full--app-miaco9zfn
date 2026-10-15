// Ownership containment, not clinical approval. Apply only after staging validation.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('workouts')
    const read = "@request.auth.id != '' && (@request.auth.role = 'admin' || student = @request.auth.id || professional = @request.auth.id)"
    collection.listRule = read
    collection.viewRule = read
    collection.createRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.auth.approved = true && professional = @request.auth.id && student.role = 'aluno'))"
    // Identity changes need a separate audited reassignment flow, including for admins.
    collection.updateRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.auth.approved = true && professional = @request.auth.id))" + " && @request.body.student:isset = false && @request.body.professional:isset = false"
    collection.deleteRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.auth.approved = true && professional = @request.auth.id))"
    app.save(collection)
  },
  (app) => {
    // Never reopen cross-account access on rollback.
    const collection = app.findCollectionByNameOrId('workouts')
    const admin = "@request.auth.id != '' && @request.auth.role = 'admin'"
    collection.listRule = admin
    collection.viewRule = admin
    collection.createRule = null
    collection.updateRule = null
    collection.deleteRule = null
    app.save(collection)
  },
)

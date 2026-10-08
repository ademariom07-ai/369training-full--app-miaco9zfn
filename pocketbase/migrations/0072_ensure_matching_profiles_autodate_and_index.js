/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('matching_profiles')
    let changed = false

    // 1. Garantir campos created e updated autodate se não existirem
    if (!col.fields.getByName('created')) {
      col.fields.add(
        new AutodateField({
          name: 'created',
          onCreate: true,
          onUpdate: false,
        }),
      )
      changed = true
    }

    if (!col.fields.getByName('updated')) {
      col.fields.add(
        new AutodateField({
          name: 'updated',
          onCreate: true,
          onUpdate: true,
        }),
      )
      changed = true
    }

    // 2. Garantir regras estritas de isolamento por aluno (e admin)
    col.listRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    col.viewRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    col.createRule =
      "@request.auth.id != '' && (@request.body.user = @request.auth.id || @request.auth.role = 'admin')"
    col.updateRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    col.deleteRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"

    app.save(col)

    // 3. Adicionar índice no campo user para performance de consulta
    try {
      col.addIndex('idx_matching_profiles_user', false, 'user', '')
      app.save(col)
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('matching_profiles')
      col.removeIndex('idx_matching_profiles_user')
      app.save(col)
    } catch (_) {}
  },
)

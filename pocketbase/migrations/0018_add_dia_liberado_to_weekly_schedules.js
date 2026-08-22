migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('weekly_schedules')
    if (!col.fields.getByName('dia_liberado')) {
      col.fields.add(
        new BoolField({
          name: 'dia_liberado',
          required: false,
        }),
      )
    }
    app.save(col)

    // Ensure all existing weekly_schedules have dia_liberado set to true by default for backward compatibility
    app
      .db()
      .newQuery('UPDATE weekly_schedules SET dia_liberado = 1 WHERE dia_liberado IS NULL')
      .execute()
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('weekly_schedules')
      col.fields.removeByName('dia_liberado')
      app.save(col)
    } catch (_) {}
  },
)

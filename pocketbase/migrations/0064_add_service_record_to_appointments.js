migrate(
  (app) => {
    const apptsCol = app.findCollectionByNameOrId('appointments')
    if (!apptsCol.fields.getByName('service_record')) {
      const servicesCol = app.findCollectionByNameOrId('services')
      apptsCol.fields.add(
        new RelationField({
          name: 'service_record',
          collectionId: servicesCol.id,
          maxSelect: 1,
        }),
      )
      app.save(apptsCol)
    }
  },
  (app) => {
    try {
      const apptsCol = app.findCollectionByNameOrId('appointments')
      if (apptsCol.fields.getByName('service_record')) {
        apptsCol.fields.removeByName('service_record')
        app.save(apptsCol)
      }
    } catch (_) {}
  },
)

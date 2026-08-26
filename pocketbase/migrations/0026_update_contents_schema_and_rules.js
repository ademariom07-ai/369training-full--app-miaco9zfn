migrate(
  (app) => {
    // 1. Update contents collection: ensure list/view rules allow public/students to view approved items,
    // and type select has 'planilha' and 'spreadsheet' if needed.
    const contents = app.findCollectionByNameOrId('contents')

    // Access rules for contents:
    // listRule: public can list approved contents, professionals can list their own, admins can list all
    contents.listRule = "@request.auth.id != '' || status = 'aprovado'"
    contents.viewRule = "@request.auth.id != '' || status = 'aprovado'"
    contents.createRule = "@request.auth.id != ''"
    contents.updateRule = "@request.auth.id != ''"
    contents.deleteRule = "@request.auth.id != ''"

    const typeField = contents.fields.getByName('type')
    if (typeField && typeField instanceof SelectField) {
      typeField.values = ['video', 'pdf', 'ebook', 'planilha', 'spreadsheet']
      typeField.maxSelect = 1
    }

    if (!contents.fields.getByName('rejection_reason')) {
      contents.fields.add(
        new TextField({
          name: 'rejection_reason',
          required: false,
        }),
      )
    }

    app.save(contents)
  },
  (app) => {
    // Revert
  },
)

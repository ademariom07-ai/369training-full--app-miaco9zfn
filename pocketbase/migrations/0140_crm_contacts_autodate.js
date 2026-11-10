/// <reference path="../pb_data/types.d.ts" />

/**
 * FIX crm_contacts: adiciona os campos autodate `created` e `updated` que a
 * migração 0137 omitiu ao criar a coleção. Sem eles, GET /records?sort=-updated
 * (usado pelo CRM) panica com 400 ("no such column: crm_contacts.updated").
 * Idempotente: só adiciona o campo se ele ainda não existir. Não altera regras,
 * campos existentes nem índices.
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('crm_contacts')

    if (!col.fields.getByName('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      console.log('[migr-0140] crm_contacts: campo created adicionado')
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
      console.log('[migr-0140] crm_contacts: campo updated adicionado')
    }

    app.save(col)
    console.log('[migr-0140] crm_contacts autodate garantido')
  },
  (app) => {
    const col = app.findCollectionByNameOrId('crm_contacts')
    try {
      const f = col.fields.getByName('updated')
      if (f) col.fields.removeByName('updated')
    } catch (_) {}
    try {
      const f = col.fields.getByName('created')
      if (f) col.fields.removeByName('created')
    } catch (_) {}
    app.save(col)
  },
)

/// <reference path="../pb_data/types.d.ts" />

/**
 * CRM: Classificação do contato (contact_type) e canais rápidos (phone, email).
 *
 * (1) contact_type: select 'cliente' | 'parceiro' | 'fornecedor', default 'cliente'.
 *     Migração idempotente: contatos existentes sem contact_type viram 'cliente'.
 * (2) phone e email opcionais no crm_contacts para ação rápida de contato.
 * (3) Índice em (professional, contact_type) para agilizar listagens e filtros.
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('crm_contacts')

    // 1. Campo contact_type (select)
    if (!col.fields.getByName('contact_type')) {
      col.fields.add(
        new SelectField({
          name: 'contact_type',
          required: false,
          maxSelect: 1,
          values: ['cliente', 'parceiro', 'fornecedor'],
        }),
      )
    }

    // 2. Campo phone (text) opcional para WhatsApp/telefone
    if (!col.fields.getByName('phone')) {
      col.fields.add(
        new TextField({
          name: 'phone',
          required: false,
          max: 40,
        }),
      )
    }

    // 3. Campo email (email) opcional para disparo rápido
    if (!col.fields.getByName('email')) {
      col.fields.add(
        new EmailField({
          name: 'email',
          required: false,
        }),
      )
    }

    // 4. Índice opcional por tipo
    try {
      col.addIndex('idx_crm_prof_contact_type', false, 'professional, contact_type', '')
    } catch (_) {}

    app.save(col)

    // 5. Backfill idempotente: contatos existentes viram 'cliente'
    try {
      app
        .db()
        .newQuery(
          "UPDATE crm_contacts SET contact_type = 'cliente' WHERE contact_type IS NULL OR contact_type = ''",
        )
        .execute()
    } catch (backfillErr) {
      console.log('[migr-0144] backfill contact_type erro: ' + (backfillErr && backfillErr.message))
    }

    console.log('[migr-0144] crm_contacts atualizado com contact_type, phone, email')
  },
  (app) => {
    const col = app.findCollectionByNameOrId('crm_contacts')
    try {
      col.removeIndex('idx_crm_prof_contact_type')
    } catch (_) {}
    const contactTypeField = col.fields.getByName('contact_type')
    if (contactTypeField) col.fields.removeById(contactTypeField.id)
    const phoneField = col.fields.getByName('phone')
    if (phoneField) col.fields.removeById(phoneField.id)
    const emailField = col.fields.getByName('email')
    if (emailField) col.fields.removeById(emailField.id)
    app.save(col)
  },
)

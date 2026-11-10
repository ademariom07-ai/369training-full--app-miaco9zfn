/// <reference path="../pb_data/types.d.ts" />

/**
 * FIX crm_contacts 400 (parte 2): a migração 0141 comparava a createRule por
 * igualdade exata de string e não bateu com a forma normalizada armazenada
 * pelo PocketBase — a regra velha (que exigia origin = 'chat') permaneceu.
 * Aqui a nova regra é gravada incondicionalmente (gravar de novo é no-op na
 * prática: mesma regra, mesmo estado).
 *
 * Nova regra: o profissional só cria contatos em seu próprio nome e sempre
 * com status 'novo' — com qualquer origem ('vinculo', 'chat', 'perfil').
 */

migrate(
  (app) => {
    const NEW_RULE =
      "@request.auth.id != '' && @request.body.professional = @request.auth.id && @request.body.status = 'novo'"

    const col = app.findCollectionByNameOrId('crm_contacts')
    col.createRule = NEW_RULE
    app.save(col)
    console.log(
      '[migr-0142] crm_contacts createRule gravada: ' +
        app.findCollectionByNameOrId('crm_contacts').createRule,
    )
  },
  (app) => {
    const col = app.findCollectionByNameOrId('crm_contacts')
    col.createRule =
      "@request.auth.id != '' && @request.body.professional = @request.auth.id && @request.body.status = 'novo' && @request.body.origin = 'chat'"
    app.save(col)
  },
)

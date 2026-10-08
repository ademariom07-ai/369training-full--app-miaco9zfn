// Atualização 0.46: financial configuration is administrative-only.
// Allow only the three operational keys consumed by non-admin screens.
// Server-side hooks continue to read configuration through the trusted app API.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('platform_config')
    const readRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || key = 'dpo_config' || key = 'pix_config' || key = 'min_services_to_validate_referral')"
    collection.listRule = readRule
    collection.viewRule = readRule
    app.save(collection)
  },
  (app) => {
    // Fail closed on rollback: never restore the previous financial data leak.
    const collection = app.findCollectionByNameOrId('platform_config')
    collection.listRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    collection.viewRule = collection.listRule
    app.save(collection)
  },
)

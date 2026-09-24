migrate(
  (app) => {
    // 0057: Tornar 'service_id' opcional na coleção 'cashback_distributions'.
    // No fechamento mensal/ciclo da Rede Única (Pool 38%), os créditos decorrem
    // da equalização do pool geral (mensalidades + tarifas), e não de um serviço
    // individualizado de profissional. Portanto, service_id deve ser opcional (required: false).
    const cbCol = app.findCollectionByNameOrId('cashback_distributions')
    const serviceField = cbCol.fields.getByName('service_id')
    if (serviceField) {
      serviceField.required = false
    }
    app.save(cbCol)
  },
  (app) => {
    try {
      const cbCol = app.findCollectionByNameOrId('cashback_distributions')
      const serviceField = cbCol.fields.getByName('service_id')
      if (serviceField) {
        serviceField.required = true
      }
      app.save(cbCol)
    } catch (_) {}
  },
)

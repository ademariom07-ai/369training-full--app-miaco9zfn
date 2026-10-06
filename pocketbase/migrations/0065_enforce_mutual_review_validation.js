migrate(
  (app) => {
    // 1. Atualizar API rules da coleção service_reviews para reforçar segurança e visibilidade
    // Somente os participantes (reviewer ou reviewee) ou administradores podem listar e ver avaliações
    const reviewsCol = app.findCollectionByNameOrId('service_reviews')
    if (reviewsCol) {
      reviewsCol.listRule =
        '@request.auth.id != "" && (@request.auth.id = reviewer || @request.auth.id = reviewee || @request.auth.role = "admin")'
      reviewsCol.viewRule =
        '@request.auth.id != "" && (@request.auth.id = reviewer || @request.auth.id = reviewee || @request.auth.role = "admin")'
      app.save(reviewsCol)
    }

    // 2. Garantir que a coleção services mantenha as opções corretas no select validation_status
    // e documentar que apenas validation_status = 'totalmente_validada' pontua no ranking
    const servicesCol = app.findCollectionByNameOrId('services')
    if (servicesCol) {
      const valField = servicesCol.fields.getByName('validation_status')
      if (valField) {
        valField.values = ['pendente', 'validada', 'totalmente_validada']
        app.save(servicesCol)
      }
    }
  },
  (app) => {
    // Reverter regras básicas se necessário
    try {
      const reviewsCol = app.findCollectionByNameOrId('service_reviews')
      if (reviewsCol) {
        reviewsCol.listRule = '@request.auth.id != ""'
        reviewsCol.viewRule = '@request.auth.id != ""'
        app.save(reviewsCol)
      }
    } catch (_) {}
  },
)

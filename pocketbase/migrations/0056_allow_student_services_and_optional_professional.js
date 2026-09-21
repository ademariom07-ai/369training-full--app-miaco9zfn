migrate(
  (app) => {
    // 0056: Ajustar coleção 'services' para suportar registros de treinos e atividades do aluno (ex: treino_ia, desafio)
    // 1. Tornar o campo relation 'professional' opcional (required = false)
    // 2. Atualizar createRule da coleção 'services' para permitir que o aluno autenticado crie seus próprios registros de serviço
    //    (quando student = @request.auth.id), além de admin e profissional.
    const servCol = app.findCollectionByNameOrId('services')

    const profField = servCol.fields.getByName('professional')
    if (profField) {
      profField.required = false
    }

    // Permitir criação:
    // - admin
    // - profissional criando serviço onde ele é o professional: @request.auth.role = 'profissional' && @request.body.professional = @request.auth.id
    // - aluno criando serviço para si mesmo: student = @request.auth.id (ex: treino_ia, desafio)
    servCol.createRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'admin' || " +
      "(@request.auth.role = 'profissional' && @request.body.professional = @request.auth.id) || " +
      '@request.body.student = @request.auth.id' +
      ')'

    app.save(servCol)
  },
  (app) => {
    try {
      const servCol = app.findCollectionByNameOrId('services')
      const profField = servCol.fields.getByName('professional')
      if (profField) {
        profField.required = true
      }
      servCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.body.professional = @request.auth.id))"
      app.save(servCol)
    } catch (_) {}
  },
)

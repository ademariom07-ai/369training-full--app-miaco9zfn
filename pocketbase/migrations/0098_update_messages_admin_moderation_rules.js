migrate(
  (app) => {
    const messages = app.findCollectionByNameOrId('messages')

    // Regras com respeito à LGPD e moderação:
    // Aluno/Profissional só acessam mensagens em que são remetente ou destinatário.
    // Admin pode listar e visualizar apenas mensagens reportadas/denunciadas (reported = true).
    messages.listRule =
      'sender = @request.auth.id || receiver = @request.auth.id || (@request.auth.role = "admin" && reported = true)'
    messages.viewRule =
      'sender = @request.auth.id || receiver = @request.auth.id || (@request.auth.role = "admin" && reported = true)'

    // Criação: remetente deve ser o próprio usuário logado e destinatário diferente de si
    messages.createRule =
      '@request.body.sender = @request.auth.id && @request.body.receiver != @request.auth.id'

    // Atualização: sender ou receiver podem atualizar (ex: receiver marca como lida read=true; sender ou receiver marca reported=true e report_reason);
    // Admin também pode atualizar mensagens reportadas para fins de moderação (ex: desmarcar ou marcar resolvido).
    messages.updateRule =
      'sender = @request.auth.id || receiver = @request.auth.id || (@request.auth.role = "admin" && reported = true)'

    // Delete: sender pode deletar a própria mensagem, ou admin para mensagens reportadas
    messages.deleteRule =
      'sender = @request.auth.id || (@request.auth.role = "admin" && reported = true)'

    app.save(messages)
  },
  (app) => {
    const messages = app.findCollectionByNameOrId('messages')
    messages.listRule = 'sender = @request.auth.id || receiver = @request.auth.id'
    messages.viewRule = 'sender = @request.auth.id || receiver = @request.auth.id'
    messages.createRule =
      '@request.body.sender = @request.auth.id && @request.body.receiver != @request.auth.id'
    messages.updateRule = 'sender = @request.auth.id || receiver = @request.auth.id'
    messages.deleteRule = 'sender = @request.auth.id'
    app.save(messages)
  },
)

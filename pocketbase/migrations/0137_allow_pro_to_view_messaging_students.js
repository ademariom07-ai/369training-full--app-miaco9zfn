/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0137:
 * Atualizar listRule e viewRule da coleção "users" para que um profissional autenticado
 * consiga listar e visualizar alunos que já trocaram mensagens com ele (como remetente ou destinatário),
 * mesmo que o aluno ainda não tenha o vínculo formal em `linked_professional`.
 *
 * Regra anterior em 0129:
 * proRule = "@request.auth.role = 'profissional' && ((role = 'aluno' && linked_professional = @request.auth.id) || role = 'admin')"
 *
 * Nova proRule:
 * Permite além de linked_professional = @request.auth.id:
 * role = 'aluno' && (
 *   linked_professional = @request.auth.id ||
 *   @collection.messages.receiver ?= @request.auth.id ||
 *   @collection.messages.sender ?= @request.auth.id
 * )
 */

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    const adminOrSelf = "id = @request.auth.id || @request.auth.role = 'admin'"
    const alunoRule = "@request.auth.role = 'aluno' && (role = 'profissional' || role = 'admin')"
    const proRule =
      "@request.auth.role = 'profissional' && ((role = 'aluno' && (linked_professional = @request.auth.id || @collection.messages.receiver ?= @request.auth.id || @collection.messages.sender ?= @request.auth.id)) || role = 'admin')"

    const newUsersRule = `${adminOrSelf} || (${alunoRule}) || (${proRule})`

    users.listRule = newUsersRule
    users.viewRule = newUsersRule

    app.save(users)
    console.log(
      '[0137] Regras listRule/viewRule de users atualizadas com suporte a alunos que trocaram mensagens.',
    )
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('users')
      const adminOrSelf = "id = @request.auth.id || @request.auth.role = 'admin'"
      const alunoRule = "@request.auth.role = 'aluno' && (role = 'profissional' || role = 'admin')"
      const proRule =
        "@request.auth.role = 'profissional' && ((role = 'aluno' && linked_professional = @request.auth.id) || role = 'admin')"
      const revertRule = `${adminOrSelf} || (${alunoRule}) || (${proRule})`
      users.listRule = revertRule
      users.viewRule = revertRule
      app.save(users)
    } catch (_) {}
  },
)

/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // Regra simplificada e direta indexada:
    // - Usuário vê a si mesmo
    // - Admin lista/vê tudo
    // - Aluno pode listar e ver profissionais
    // - Profissional só pode listar e ver alunos vinculados diretamente a ele (linked_professional = @request.auth.id)
    const proRule =
      "@request.auth.role = 'profissional' && role = 'aluno' && linked_professional = @request.auth.id"
    const alunoRule = "@request.auth.role = 'aluno' && role = 'profissional'"
    const adminOrSelf = "id = @request.auth.id || @request.auth.role = 'admin'"

    const newRule = `${adminOrSelf} || (${alunoRule}) || (${proRule})`

    users.listRule = newRule
    users.viewRule = newRule

    // Adicionar índice composto (role, linked_professional) para otimização de consultas
    users.addIndex('idx_users_role_linked_professional', false, 'role, linked_professional', '')

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    try {
      users.removeIndex('idx_users_role_linked_professional')
    } catch (_) {}

    // Reverte para regra anterior caso necessário
    const relatedStudent =
      "role = 'aluno' && (" +
      [
        'linked_professional = @request.auth.id',
        'appointments_via_aluno.profissional ?= @request.auth.id',
        'services_via_student.professional ?= @request.auth.id',
        'workouts_via_student.professional ?= @request.auth.id',
        'diets_via_student.professional ?= @request.auth.id',
        'messages_via_sender.receiver ?= @request.auth.id',
        'messages_via_receiver.sender ?= @request.auth.id',
        'challenge_participants_via_aluno_id.challenge_id.professional_id ?= @request.auth.id',
        'group_session_participants_via_student.session.professional ?= @request.auth.id',
      ].join(' || ') +
      ')'

    const usersRead =
      "id = @request.auth.id || @request.auth.role = 'admin'" +
      " || (@request.auth.role = 'aluno' && role = 'profissional')" +
      ` || (@request.auth.role = 'profissional' && ${relatedStudent})`

    users.listRule = usersRead
    users.viewRule = usersRead
    app.save(users)
  },
)

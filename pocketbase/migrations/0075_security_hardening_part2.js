/// <reference path="../pb_data/types.d.ts" />

// Auditoria de segurança (parte 2):
// - profissional só vê alunos com quem tem relação real (vínculo, agenda, serviço, treino,
//   dieta, mensagem, desafio ou sessão coletiva);
// - contas de teste com senhas publicadas no repositório recebem senha aleatória;
// - garante o valor 'pro_parceiro' no plano (0045 dependia de instanceof).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

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

    const planField = users.fields.getByName('plan')
    if (planField && planField.values && !planField.values.includes('pro_parceiro')) {
      planField.values = [...planField.values, 'pro_parceiro']
    }
    app.save(users)

    // Senhas de teste publicadas no repositório: qualquer conta que ainda as use
    // recebe uma senha aleatória (recupere pelo "Esqueci a senha").
    // A conta do administrador fica de fora para não bloquear o acesso: troque-a manualmente.
    const knownPasswords = ['Skip@Pass', 'Teste@123']
    // Só os domínios usados pelas contas de teste semeadas (bcrypt é lento para checar todos).
    const seeded = app.findRecordsByFilter(
      'users',
      "email ~ '@369training.com' || email ~ '@369wellness.com' || email ~ '@test.com'",
      '',
      0,
      0,
    )
    for (const u of seeded) {
      if (u.getString('role') === 'admin') continue
      const usesKnown = knownPasswords.some((pw) => {
        try {
          return u.validatePassword(pw)
        } catch (_) {
          return false
        }
      })
      if (usesKnown) {
        u.setPassword($security.randomString(32))
        app.save(u)
        console.log('[0075] senha de teste substituída: ' + u.email())
      }
    }

    // Contas sintéticas do teste de carga (admin_seed_loadtest.js) usam um hash fixo publicado
    // no repositório: recebem um hash de senha aleatória e têm as sessões invalidadas.
    const loadtest = app.findRecordsByFilter('users', "email ~ 'carga.%@exemplo.com'", '', 1, 0)
    if (loadtest.length > 0) {
      const first = loadtest[0]
      first.setPassword($security.randomString(32))
      app.save(first)
      const randomHash = app.findRecordById('users', first.id).getString('password')
      app
        .db()
        .newQuery(
          "UPDATE users SET password = {:hash}, tokenKey = lower(hex(randomblob(25))) WHERE email LIKE 'carga.%@exemplo.com'",
        )
        .bind({ hash: randomHash })
        .execute()
    }
  },
  (app) => {
    // Sem rollback automático: reverter reabriria as falhas de segurança.
  },
)

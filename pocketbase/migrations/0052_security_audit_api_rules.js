migrate(
  (app) => {
    // =========================================================================
    // RODADA DE SEGURANÇA — CORREÇÃO DE REGRAS DE API (API RULES)
    // =========================================================================

    // 1. platform_config:
    // Leitura para qualquer usuário autenticado; criar/editar/apagar SOMENTE admin.
    const platCol = app.findCollectionByNameOrId('platform_config')
    platCol.listRule = "@request.auth.id != ''"
    platCol.viewRule = "@request.auth.id != ''"
    platCol.createRule = "@request.auth.role = 'admin'"
    platCol.updateRule = "@request.auth.role = 'admin'"
    platCol.deleteRule = "@request.auth.role = 'admin'"
    app.save(platCol)

    // 2. rank_entries e cashback_distributions:
    // Somente leitura para o dono/admin; criação/edição apenas via hooks server-side (regra vazia/negada: null).
    const rankCol = app.findCollectionByNameOrId('rank_entries')
    rankCol.listRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    rankCol.viewRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    rankCol.createRule = null
    rankCol.updateRule = null
    rankCol.deleteRule = "@request.auth.role = 'admin'"
    app.save(rankCol)

    const cbCol = app.findCollectionByNameOrId('cashback_distributions')
    cbCol.listRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    cbCol.viewRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    cbCol.createRule = null
    cbCol.updateRule = null
    cbCol.deleteRule = "@request.auth.role = 'admin'"
    app.save(cbCol)

    // 3. services:
    // Criar/editar apenas o profissional dono (ou admin); aluno só lê os próprios (aluno: student = @request.auth.id).
    const servCol = app.findCollectionByNameOrId('services')
    servCol.listRule =
      "@request.auth.id != '' && (professional = @request.auth.id || student = @request.auth.id || @request.auth.role = 'admin')"
    servCol.viewRule =
      "@request.auth.id != '' && (professional = @request.auth.id || student = @request.auth.id || @request.auth.role = 'admin')"
    servCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.body.professional = @request.auth.id))"
    servCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional = @request.auth.id))"
    servCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional = @request.auth.id))"
    app.save(servCol)

    // 4. group_session_participants:
    // Aluno só pode mudar a PRÓPRIA linha para 'confirmado' (dentro da janela de validação);
    // profissional dono da sessão pode marcar presença;
    // campos points_awarded, fee_charged, service_record só podem ser escritos via hook server-side (bloqueados no @request.body).
    const gspCol = app.findCollectionByNameOrId('group_session_participants')
    gspCol.listRule = "@request.auth.id != ''"
    gspCol.viewRule = "@request.auth.id != ''"
    gspCol.createRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'admin' || " +
      "@request.auth.role = 'profissional' || " +
      '@request.body.student = @request.auth.id' +
      ')'
    gspCol.updateRule =
      "@request.auth.role = 'admin' || (" +
      "@request.auth.id != '' && " +
      '@request.body.points_awarded:isset = false && ' +
      '@request.body.fee_charged:isset = false && ' +
      '@request.body.service_record:isset = false && ' +
      '(' +
      // Aluno alterando a própria linha para 'confirmado' dentro da janela de validação
      '(' +
      'student = @request.auth.id && ' +
      "@request.body.attendance_status = 'confirmado' && " +
      'session.validation_window_hours != null && ' +
      '@request.body.student:isset = false && ' +
      '@request.body.session:isset = false' +
      ') || ' +
      // Profissional dono da sessão marcando presença
      '(' +
      "@request.auth.role = 'profissional' && " +
      'session.professional = @request.auth.id' +
      ')' +
      ')' +
      ')'
    gspCol.deleteRule =
      "@request.auth.role = 'admin' || (" +
      "@request.auth.id != '' && " +
      "@request.auth.role = 'profissional' && " +
      'session.professional = @request.auth.id' +
      ')'
    app.save(gspCol)

    // 5. users.update:
    // Bloquear auto-edição dos campos verified, rating_avg, subscription_status, subscription_expires_at, linked_professional e linked_prof_fee_mode.
    // Preserva o bloqueio já existente em plan, role, approved, tree_position e tree_level.
    const usersCol = app.findCollectionByNameOrId('users')
    usersCol.updateRule =
      "@request.auth.role = 'admin' || (" +
      'id = @request.auth.id && ' +
      '@request.body.plan:isset = false && ' +
      '@request.body.role:isset = false && ' +
      '@request.body.approved:isset = false && ' +
      '@request.body.tree_position:isset = false && ' +
      '@request.body.tree_level:isset = false && ' +
      '@request.body.verified:isset = false && ' +
      '@request.body.rating_avg:isset = false && ' +
      '@request.body.subscription_status:isset = false && ' +
      '@request.body.subscription_expires_at:isset = false && ' +
      '@request.body.linked_professional:isset = false && ' +
      '@request.body.linked_prof_fee_mode:isset = false' +
      ')'
    app.save(usersCol)

    // 6. notifications, contents, challenges, challenge_participants, weekly_schedules, appointments:
    // Criação/edição restritas ao dono do recurso ou admin.

    // 6.1 notifications:
    // Notificações pertencem a um user. Criação por admin ou qualquer auth que gere notificação (ou dono), edição/deleção só dono ou admin.
    const notifCol = app.findCollectionByNameOrId('notifications')
    notifCol.listRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    notifCol.viewRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    notifCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'profissional' || @request.body.user = @request.auth.id)"
    notifCol.updateRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    notifCol.deleteRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    app.save(notifCol)

    // 6.2 contents:
    // Pertence a professional_id. Leitura autenticada ou aprovado. Criação/edição pelo profissional dono ou admin.
    const contentsCol = app.findCollectionByNameOrId('contents')
    contentsCol.listRule = "@request.auth.id != '' || status = 'aprovado'"
    contentsCol.viewRule = "@request.auth.id != '' || status = 'aprovado'"
    contentsCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.body.professional_id = @request.auth.id))"
    contentsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional_id = @request.auth.id))"
    contentsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional_id = @request.auth.id))"
    app.save(contentsCol)

    // 6.3 challenges:
    // Pertence a professional_id. Criação/edição restritas ao profissional dono ou admin.
    const chalCol = app.findCollectionByNameOrId('challenges')
    chalCol.listRule = "@request.auth.id != ''"
    chalCol.viewRule = "@request.auth.id != ''"
    chalCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.body.professional_id = @request.auth.id))"
    chalCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional_id = @request.auth.id))"
    chalCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional_id = @request.auth.id))"
    app.save(chalCol)

    // 6.4 challenge_participants:
    // Pertence a aluno_id (e vinculado a challenge_id). Criação/edição restritas ao dono (aluno) ou admin.
    const cpCol = app.findCollectionByNameOrId('challenge_participants')
    cpCol.listRule = "@request.auth.id != ''"
    cpCol.viewRule = "@request.auth.id != ''"
    cpCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.aluno_id = @request.auth.id)"
    cpCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || aluno_id = @request.auth.id)"
    cpCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || aluno_id = @request.auth.id)"
    app.save(cpCol)

    // 6.5 weekly_schedules:
    // Pertence a profissional. Criação/edição restritas ao profissional dono ou admin.
    const wsCol = app.findCollectionByNameOrId('weekly_schedules')
    wsCol.listRule = "@request.auth.id != ''"
    wsCol.viewRule = "@request.auth.id != ''"
    wsCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.body.profissional = @request.auth.id))"
    wsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && profissional = @request.auth.id))"
    wsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && profissional = @request.auth.id))"
    app.save(wsCol)

    // 6.6 appointments:
    // Vinculado a profissional e aluno. Criação pelo aluno (para si) ou profissional ou admin. Edição pelo aluno participante, profissional ou admin.
    const apptCol = app.findCollectionByNameOrId('appointments')
    apptCol.listRule =
      "@request.auth.id != '' && (profissional = @request.auth.id || aluno = @request.auth.id || @request.auth.role = 'admin')"
    apptCol.viewRule =
      "@request.auth.id != '' && (profissional = @request.auth.id || aluno = @request.auth.id || @request.auth.role = 'admin')"
    apptCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.aluno = @request.auth.id || @request.body.profissional = @request.auth.id)"
    apptCol.updateRule =
      "@request.auth.id != '' && (aluno = @request.auth.id || profissional = @request.auth.id || @request.auth.role = 'admin')"
    apptCol.deleteRule =
      "@request.auth.id != '' && (aluno = @request.auth.id || profissional = @request.auth.id || @request.auth.role = 'admin')"
    app.save(apptCol)

    // 7. legal_acceptances:
    // Criação somente autenticada e apenas para si mesmo (@request.body.user = @request.auth.id).
    // Ou admin (@request.auth.role = 'admin').
    const legAccCol = app.findCollectionByNameOrId('legal_acceptances')
    legAccCol.listRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    legAccCol.viewRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    legAccCol.createRule =
      "@request.auth.id != '' && (@request.body.user = @request.auth.id || @request.auth.role = 'admin')"
    legAccCol.updateRule = "@request.auth.role = 'admin'"
    legAccCol.deleteRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    app.save(legAccCol)
  },
  (app) => {
    // Reverter regras de API para o estado anterior se necessário
    try {
      const platCol = app.findCollectionByNameOrId('platform_config')
      platCol.listRule = "@request.auth.id != ''"
      platCol.viewRule = "@request.auth.id != ''"
      platCol.createRule = "@request.auth.id != ''"
      platCol.updateRule = "@request.auth.id != ''"
      platCol.deleteRule = "@request.auth.id != ''"
      app.save(platCol)
    } catch (_) {}

    try {
      const rankCol = app.findCollectionByNameOrId('rank_entries')
      rankCol.listRule = "@request.auth.id != ''"
      rankCol.viewRule = "@request.auth.id != ''"
      rankCol.createRule = "@request.auth.id != ''"
      rankCol.updateRule = "@request.auth.id != ''"
      rankCol.deleteRule = "@request.auth.id != ''"
      app.save(rankCol)
    } catch (_) {}

    try {
      const cbCol = app.findCollectionByNameOrId('cashback_distributions')
      cbCol.listRule = "@request.auth.id != ''"
      cbCol.viewRule = "@request.auth.id != ''"
      cbCol.createRule = "@request.auth.id != ''"
      cbCol.updateRule = "@request.auth.id != ''"
      cbCol.deleteRule = "@request.auth.id != ''"
      app.save(cbCol)
    } catch (_) {}

    try {
      const servCol = app.findCollectionByNameOrId('services')
      servCol.listRule = "@request.auth.id != ''"
      servCol.viewRule = "@request.auth.id != ''"
      servCol.createRule = "@request.auth.id != ''"
      servCol.updateRule = "@request.auth.id != ''"
      servCol.deleteRule = "@request.auth.id != ''"
      app.save(servCol)
    } catch (_) {}

    try {
      const gspCol = app.findCollectionByNameOrId('group_session_participants')
      gspCol.listRule = "@request.auth.id != ''"
      gspCol.viewRule = "@request.auth.id != ''"
      gspCol.createRule = "@request.auth.id != ''"
      gspCol.updateRule = "@request.auth.id != ''"
      gspCol.deleteRule = "@request.auth.id != ''"
      app.save(gspCol)
    } catch (_) {}

    try {
      const usersCol = app.findCollectionByNameOrId('users')
      usersCol.updateRule =
        "@request.auth.role = 'admin' || (" +
        'id = @request.auth.id && ' +
        '@request.body.plan:isset = false && ' +
        '@request.body.role:isset = false && ' +
        '@request.body.approved:isset = false && ' +
        '@request.body.tree_position:isset = false && ' +
        '@request.body.tree_level:isset = false' +
        ')'
      app.save(usersCol)
    } catch (_) {}

    try {
      const legAccCol = app.findCollectionByNameOrId('legal_acceptances')
      legAccCol.createRule = "@request.auth.id != '' || @request.body.user != ''"
      app.save(legAccCol)
    } catch (_) {}
  },
)

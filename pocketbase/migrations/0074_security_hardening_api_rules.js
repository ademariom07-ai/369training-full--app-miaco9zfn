/// <reference path="../pb_data/types.d.ts" />

// Auditoria de segurança: restringe as regras de API para que cada usuário
// só leia e altere os próprios registros, e impede que campos financeiros,
// de pontuação e de validação sejam definidos pelo cliente.
migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"
    const ADMIN = "@request.auth.role = 'admin'"
    const PROF = "@request.auth.role = 'profissional'"

    const setRules = (name, rules) => {
      let col
      try {
        col = app.findCollectionByNameOrId(name)
      } catch (_) {
        console.log('[0074] coleção não encontrada, ignorando: ' + name)
        return
      }
      for (const key of Object.keys(rules)) {
        col[key] = rules[key]
      }
      app.save(col)
    }

    // ----- users -----
    // Dados pessoais sensíveis não são usados pelo frontend: ficam visíveis
    // apenas para superusuários e hooks do servidor.
    const users = app.findCollectionByNameOrId('users')
    for (const fieldName of ['cpf', 'guardian_cpf', 'guardian_name', 'birth_date']) {
      const f = users.fields.getByName(fieldName)
      if (f) f.hidden = true
    }
    users.updateRule =
      `${ADMIN} || (id = @request.auth.id` +
      ' && @request.body.plan:isset = false' +
      ' && @request.body.plan_type:isset = false' +
      ' && @request.body.plan_upgraded_at:isset = false' +
      ' && @request.body.role:isset = false' +
      ' && @request.body.approved:isset = false' +
      ' && @request.body.tree_position:isset = false' +
      ' && @request.body.tree_level:isset = false' +
      ' && @request.body.verified:isset = false' +
      ' && @request.body.rating_avg:isset = false' +
      ' && @request.body.subscription_status:isset = false' +
      ' && @request.body.subscription_expires_at:isset = false' +
      ' && @request.body.linked_professional:isset = false' +
      ' && @request.body.linked_prof_fee_mode:isset = false' +
      // CPF é usado para validar a titularidade da chave PIX no saque:
      // só pode ser preenchido uma vez.
      " && (@request.body.cpf:isset = false || cpf = ''))"
    app.save(users)

    // ----- carteira: débito de mensalidade (plans_change.js) -----
    const wallet = app.findCollectionByNameOrId('wallet_transactions')
    const typeField = wallet.fields.getByName('type')
    if (typeField && typeField.values && !typeField.values.includes('mensalidade')) {
      typeField.values = [...typeField.values, 'mensalidade']
      app.save(wallet)
    }

    // ----- serviços: "value" obrigatório rejeitava valor 0 (treino IA e dia de desafio) -----
    const services = app.findCollectionByNameOrId('services')
    const valueField = services.fields.getByName('value')
    if (valueField && valueField.required) {
      valueField.required = false
      app.save(services)
    }

    // ----- registros profissional/aluno -----
    const ownedByPair = `${AUTH} && (student = @request.auth.id || professional = @request.auth.id || ${ADMIN})`
    const pairRules = {
      listRule: ownedByPair,
      viewRule: ownedByPair,
      // O aluno só cria registros próprios sem profissional; o profissional só em seu nome.
      createRule:
        `${AUTH} && (${ADMIN}` +
        " || (@request.body.student = @request.auth.id && (@request.body.professional:isset = false || @request.body.professional = ''))" +
        ` || (${PROF} && @request.body.professional = @request.auth.id))`,
      updateRule:
        `${AUTH} && (${ADMIN} || ((student = @request.auth.id || professional = @request.auth.id)` +
        ' && @request.body.student:isset = false && @request.body.professional:isset = false))',
      deleteRule: `${AUTH} && (${ADMIN} || professional = @request.auth.id || (student = @request.auth.id && professional = ''))`,
    }
    for (const name of ['diets', 'workouts', 'protocols', 'martial_arts_sessions']) {
      setRules(name, pairRules)
    }

    setRules('clinical_session_logs', {
      listRule: `${AUTH} && (professional = @request.auth.id || student = @request.auth.id || ${ADMIN})`,
      viewRule: `${AUTH} && (professional = @request.auth.id || student = @request.auth.id || ${ADMIN})`,
    })

    // ----- auditoria: somente leitura para admin, imutável -----
    setRules('audits', {
      listRule: ADMIN,
      viewRule: ADMIN,
      createRule: `${AUTH} && @request.body.actor = @request.auth.id`,
      updateRule: null,
      deleteRule: null,
    })

    setRules('access_logs', {
      createRule: `${AUTH} && @request.body.user = @request.auth.id`,
    })

    // ----- indicações -----
    const ownReferral = `${AUTH} && (referrer = @request.auth.id || referred = @request.auth.id || ${ADMIN})`
    setRules('referrals', {
      listRule: ownReferral,
      viewRule: ownReferral,
      createRule:
        `${AUTH} && (${ADMIN} || (@request.body.referred = @request.auth.id` +
        ' && @request.body.referrer != @request.auth.id' +
        " && (@request.body.status:isset = false || @request.body.status = 'pending')" +
        ' && (@request.body.referral_bonus_paid:isset = false || @request.body.referral_bonus_paid = false)' +
        ' && (@request.body.services_count:isset = false || @request.body.services_count = 0)' +
        ' && @request.body.validated_at:isset = false))',
      updateRule: ADMIN,
      deleteRule: ADMIN,
    })

    // ----- conquistas e compras: concedidas pelo servidor -----
    setRules('achievements', {
      listRule: `${AUTH} && (user = @request.auth.id || ${ADMIN})`,
      viewRule: `${AUTH} && (user = @request.auth.id || ${ADMIN})`,
      createRule: ADMIN,
      updateRule: ADMIN,
      deleteRule: ADMIN,
    })
    setRules('content_purchases', {
      listRule: `${AUTH} && (user = @request.auth.id || ${ADMIN})`,
      viewRule: `${AUTH} && (user = @request.auth.id || ${ADMIN})`,
      createRule: ADMIN,
      updateRule: ADMIN,
      deleteRule: ADMIN,
    })

    setRules('expert_interactions', {
      listRule: `${AUTH} && (professional = @request.auth.id || ${ADMIN})`,
      viewRule: `${AUTH} && (professional = @request.auth.id || ${ADMIN})`,
      createRule: `${AUTH} && @request.body.professional = @request.auth.id`,
      updateRule: null,
      deleteRule: ADMIN,
    })

    setRules('community_posts', {
      createRule: `${AUTH} && @request.body.user = @request.auth.id`,
      updateRule: `${AUTH} && (${ADMIN} || (user = @request.auth.id && @request.body.user:isset = false))`,
      deleteRule: `${AUTH} && (user = @request.auth.id || ${ADMIN})`,
    })

    setRules('chat_terms_acceptances', {
      listRule: `${AUTH} && (user = @request.auth.id || ${ADMIN})`,
      viewRule: `${AUTH} && (user = @request.auth.id || ${ADMIN})`,
      createRule: `${AUTH} && @request.body.user = @request.auth.id`,
      updateRule: null,
      deleteRule: ADMIN,
    })

    setRules('student_onboarding_surveys', {
      createRule: `${AUTH} && (@request.body.user = @request.auth.id || ${ADMIN})`,
    })

    setRules('credential_verifications', {
      createRule:
        `${AUTH} && @request.body.professional = @request.auth.id` +
        " && (@request.body.status:isset = false || @request.body.status = 'pendente')" +
        ' && @request.body.reviewed_by:isset = false && @request.body.reviewed_at:isset = false' +
        ' && @request.body.review_notes:isset = false',
    })

    // ----- mensagens: o destinatário só marca como lida/denuncia -----
    setRules('messages', {
      updateRule:
        '@request.body.sender:isset = false && @request.body.receiver:isset = false' +
        ' && (sender = @request.auth.id || (receiver = @request.auth.id && @request.body.content:isset = false))',
    })

    // ----- serviços: validação só pelo fluxo de avaliação mútua (hooks) -----
    setRules('services', {
      updateRule:
        `${AUTH} && (${ADMIN} || (${PROF} && professional = @request.auth.id` +
        ' && @request.body.professional:isset = false' +
        ' && @request.body.validation_status:isset = false' +
        ' && @request.body.validated:isset = false' +
        ' && @request.body.validated_at:isset = false))',
    })

    setRules('service_reviews', {
      updateRule:
        `${AUTH} && (${ADMIN} || (reviewer = @request.auth.id` +
        ' && @request.body.service:isset = false && @request.body.reviewer:isset = false' +
        ' && @request.body.reviewee:isset = false))',
    })

    // ----- agendamentos: o aluno não conclui nem altera valores -----
    setRules('appointments', {
      createRule:
        `${AUTH} && (${ADMIN} || @request.body.profissional = @request.auth.id` +
        " || (@request.body.aluno = @request.auth.id && @request.body.status != 'concluído'" +
        ' && @request.body.advance_paid:isset = false && @request.body.service_record:isset = false))',
      updateRule:
        `${AUTH} && (${ADMIN} || profissional = @request.auth.id` +
        " || (aluno = @request.auth.id && @request.body.status = 'cancelado'" +
        ' && @request.body.valor:isset = false && @request.body.taxa_extra:isset = false' +
        ' && @request.body.advance_paid:isset = false && @request.body.service_record:isset = false' +
        ' && @request.body.profissional:isset = false && @request.body.aluno:isset = false))',
    })
  },
  (app) => {
    // Sem rollback automático: reverter reabriria as falhas de segurança.
  },
)

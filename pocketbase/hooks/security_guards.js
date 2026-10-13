/// <reference path="../pb_data/types.d.ts" />

// Proteções do servidor complementares às regras de API (auditoria de segurança).
// Regras de API não conseguem expressar estas checagens, por isso ficam em hooks de request.
// Cada handler roda isolado no PocketBase, por isso a checagem de admin é repetida em cada um.

// ---------------------------------------------------------------------------
// Cadastro: o cliente não define aprovação, plano pago, assinatura, vínculo ou árvore.
// Planos pagos são ativados depois, pelo endpoint /backend/v1/plans/change.
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  const isPrivileged = e.hasSuperuserAuth() || (!!e.auth && e.auth.getString('role') === 'admin')
  if (!isPrivileged) {
    const role = e.record.getString('role') === 'profissional' ? 'profissional' : 'aluno'
    e.record.set('role', role)
    e.record.set('plan_type', role)
    e.record.set('approved', role === 'aluno')
    e.record.set('plan', 'gratis')
    e.record.set('plan_upgraded_at', '')
    e.record.set('subscription_status', 'ativa')
    e.record.set('subscription_expires_at', '')
    e.record.set('linked_professional', '')
    e.record.set('linked_prof_fee_mode', '')
    e.record.set('rating_avg', 5)
    // Zerado para que on_user_create.js atribua a próxima posição global.
    e.record.set('tree_position', 0)
    e.record.set('tree_level', 0)
  }
  return e.next()
}, 'users')

// ---------------------------------------------------------------------------
// Serviços: a validação só acontece pela avaliação mútua, e um aluno só registra
// serviço com um profissional com quem tem vínculo real (evita debitar tarifas
// de profissionais aleatórios).
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || (e.auth && e.auth.getString('role') === 'admin')) return e.next()

  const authId = e.auth ? e.auth.id : ''
  if (!authId) throw new UnauthorizedError('Autenticação necessária.')

  e.record.set('validation_status', 'pendente')
  e.record.set('validated', false)
  e.record.set('validated_at', '')

  const profId = e.record.getString('professional')
  if (profId === authId) return e.next()

  if (e.record.getString('student') !== authId) {
    throw new ForbiddenError('Você só pode registrar serviços em seu próprio nome.')
  }
  if (!profId) return e.next()

  const hasLink = () => {
    if (e.auth.getString('linked_professional') === profId) return true
    try {
      // Treinos com profissional só podem ser criados pelo próprio profissional (regra 0074).
      $app.findFirstRecordByFilter('workouts', 'student = {:s} && professional = {:p}', {
        s: authId,
        p: profId,
      })
      return true
    } catch (_) {}
    try {
      const parts = $app.findRecordsByFilter(
        'challenge_participants',
        'aluno_id = {:s}',
        '-created',
        200,
        0,
        { s: authId },
      )
      for (const part of parts) {
        try {
          const ch = $app.findRecordById('challenges', part.getString('challenge_id'))
          if (ch.getString('professional_id') === profId) return true
        } catch (_) {}
      }
    } catch (_) {}
    return false
  }

  if (!hasLink()) {
    throw new ForbiddenError('Você não possui vínculo com este profissional.')
  }
  return e.next()
}, 'services')

// ---------------------------------------------------------------------------
// Avaliações: só aluno e profissional do serviço avaliam, um ao outro, uma vez cada.
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || (e.auth && e.auth.getString('role') === 'admin')) return e.next()

  const authId = e.auth ? e.auth.id : ''
  if (!authId) throw new UnauthorizedError('Autenticação necessária.')

  let service
  try {
    service = $app.findRecordById('services', e.record.getString('service'))
  } catch (_) {
    throw new BadRequestError('Serviço não encontrado.')
  }

  const studentId = service.getString('student')
  const profId = service.getString('professional')
  let expectedReviewee = ''
  if (authId === studentId) expectedReviewee = profId
  else if (authId === profId) expectedReviewee = studentId

  if (!expectedReviewee) {
    throw new ForbiddenError('Somente o aluno e o profissional do serviço podem avaliá-lo.')
  }
  if (service.getString('status') !== 'concluido') {
    throw new BadRequestError('Somente serviços concluídos podem ser avaliados.')
  }

  try {
    $app.findFirstRecordByFilter('service_reviews', 'service = {:svc} && reviewer = {:r}', {
      svc: service.id,
      r: authId,
    })
    throw new BadRequestError('Você já avaliou este serviço.')
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  const rating = Number(e.record.get('rating') || 0)
  if (!(rating >= 1 && rating <= 5)) {
    throw new BadRequestError('A nota deve estar entre 1 e 5.')
  }

  e.record.set('reviewer', authId)
  e.record.set('reviewee', expectedReviewee)
  return e.next()
}, 'service_reviews')

// ---------------------------------------------------------------------------
// Sessões coletivas: profissional só inscreve em sessões próprias; pontos e
// tarifas são definidos apenas pelo servidor (group_session_validate.js).
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || (e.auth && e.auth.getString('role') === 'admin')) return e.next()

  const authId = e.auth ? e.auth.id : ''
  if (!authId) throw new UnauthorizedError('Autenticação necessária.')

  e.record.set('points_awarded', false)
  e.record.set('fee_charged', false)
  e.record.set('service_record', '')

  let session
  try {
    session = $app.findRecordById('group_sessions', e.record.getString('session'))
  } catch (_) {
    throw new BadRequestError('Sessão não encontrada.')
  }

  if (session.getString('professional') === authId) return e.next()

  if (e.record.getString('student') !== authId) {
    throw new ForbiddenError('Você só pode se inscrever em seu próprio nome.')
  }
  e.record.set('attendance_status', 'pendente')
  e.record.set('confirmed_at', '')
  return e.next()
}, 'group_session_participants')

// ---------------------------------------------------------------------------
// Notificações: profissional só notifica alunos com quem tem relação (evita golpes
// com notificações falsas enviadas a qualquer usuário).
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || (e.auth && e.auth.getString('role') === 'admin')) return e.next()

  const authId = e.auth ? e.auth.id : ''
  if (!authId) throw new UnauthorizedError('Autenticação necessária.')

  const targetId = e.record.getString('user')
  if (targetId === authId) return e.next()

  // A regra de listagem de users (0075) já define "aluno relacionado ao profissional".
  let visible = false
  try {
    visible = $app.canAccessRecord(
      $app.findRecordById('users', targetId),
      e.requestInfo(),
      $app.findCollectionByNameOrId('users').viewRule,
    )
  } catch (_) {}

  if (e.auth.getString('role') !== 'profissional' || !visible) {
    throw new ForbiddenError('Você não pode enviar notificações para este usuário.')
  }
  return e.next()
}, 'notifications')

// ---------------------------------------------------------------------------
// Indicações: só no cadastro (até 1 hora após criar a conta) e uma por pessoa indicada.
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || (e.auth && e.auth.getString('role') === 'admin')) return e.next()

  const authId = e.auth ? e.auth.id : ''
  if (!authId) throw new UnauthorizedError('Autenticação necessária.')

  const createdAt = new Date(e.auth.getString('created').replace(' ', 'T'))
  if (isNaN(createdAt.getTime()) || Date.now() - createdAt.getTime() > 60 * 60 * 1000) {
    throw new ForbiddenError('O código de indicação só pode ser usado no cadastro.')
  }

  try {
    $app.findFirstRecordByFilter('referrals', 'referred = {:id}', { id: authId })
    throw new BadRequestError('Esta conta já possui uma indicação registrada.')
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }
  return e.next()
}, 'referrals')

// ---------------------------------------------------------------------------
// Login: bloqueia a conta por 15 minutos após 10 senhas erradas seguidas (anti força bruta).
// O controle é por e-mail, não por IP, porque o servidor pode estar atrás de um proxy.
// ---------------------------------------------------------------------------
onRecordAuthWithPasswordRequest((e) => {
  const identity = String(e.identity || '')
    .trim()
    .toLowerCase()
  const key = 'login_fail:' + identity
  const windowMs = 15 * 60 * 1000
  const now = Date.now()

  const state = $app.store().get(key)
  if (state && state.count >= 10 && now - state.first < windowMs) {
    throw new TooManyRequestsError(
      'Muitas tentativas de login. Aguarde 15 minutos ou use "Esqueceu a senha?".',
    )
  }

  try {
    e.next()
  } catch (err) {
    const fresh = state && now - state.first < windowMs ? state : { count: 0, first: now }
    $app.store().set(key, { count: fresh.count + 1, first: fresh.first })
    throw err
  }
  $app.store().remove(key)
}, 'users')

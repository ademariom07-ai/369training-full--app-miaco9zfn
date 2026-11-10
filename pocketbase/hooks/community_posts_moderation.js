// Hook de integridade e moderação para posts da comunidade (collection 'community_posts').
// Diretrizes (reaproveita o padrão dos chats):
// 1. Texto obrigatório, sem espaços vazios, limite de 2.000 caracteres.
// 2. Autor deve ser usuário ativo (profissional precisa estar aprovado pela moderação).
// 3. Comentários da comunidade: mesmo limite básico de conteúdo.
// 4. Post denunciado (reported = true) sai do feed (listRule) e gera registro em audits (LGPD).
// Nota: JSVM executa callbacks em pool separado — toda a lógica vive inline no callback.

onRecordCreate((e) => {
  const post = e.record
  const text = (post.get('content') || '').toString().trim()

  if (!text) {
    throw new BadRequestError('O post não pode ficar vazio.')
  }
  if (text.length > 2000) {
    throw new BadRequestError('O post excede o limite máximo permitido de 2.000 caracteres.')
  }

  const banned = [
    /esteroides?\s+anabolizantes?\b/i,
    /\bcomprar\s+(anabolizantes?|winstrol|oxandrolona|dianabol)\b/i,
    /hacke(ar|e|amento)\b/i,
    /\bpirataria\b/i,
    /pornograf/i,
    /\bnudes?\b/i,
    /\bcassino\b/i,
    /\bapostas?\s+esportivas?\b/i,
  ]
  for (let i = 0; i < banned.length; i++) {
    if (banned[i].test(text)) {
      throw new BadRequestError(
        'Conteúdo impróprio detectado. Revise o texto — posts da comunidade devem respeitar as regras de convivência.',
      )
    }
  }

  post.set('content', text)

  const authorId = post.get('user')
  if (!authorId) {
    throw new BadRequestError('Autor do post não identificado.')
  }
  try {
    const author = $app.findRecordById('users', authorId)
    const role = author.getString('role') || 'aluno'
    if (role === 'profissional' && author.getBool('approved') === false) {
      throw new BadRequestError(
        'Profissionais com cadastro pendente de aprovação não podem publicar na comunidade.',
      )
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('não') !== -1) {
      throw err
    }
    console.warn('Aviso ao verificar autor do post:', err)
  }

  return e.next()
}, 'community_posts')

onRecordUpdate((e) => {
  const post = e.record
  const text = (post.get('content') || '').toString().trim()

  if (!text) {
    throw new BadRequestError('O post não pode ficar vazio.')
  }
  if (text.length > 2000) {
    throw new BadRequestError('O post excede o limite máximo permitido de 2.000 caracteres.')
  }

  const banned = [
    /esteroides?\s+anabolizantes?\b/i,
    /\bcomprar\s+(anabolizantes?|winstrol|oxandrolona|dianabol)\b/i,
    /hacke(ar|e|amento)\b/i,
    /\bpirataria\b/i,
    /pornograf/i,
    /\bnudes?\b/i,
    /\bcassino\b/i,
    /\bapostas?\s+esportivas?\b/i,
  ]
  for (let i = 0; i < banned.length; i++) {
    if (banned[i].test(text)) {
      throw new BadRequestError(
        'Conteúdo impróprio detectado. Revise o texto — posts da comunidade devem respeitar as regras de convivência.',
      )
    }
  }

  post.set('content', text)
  return e.next()
}, 'community_posts')

// Post denunciado: sai do feed (listRule) + auditoria LGPD.
onRecordAfterUpdateSuccess((e) => {
  try {
    const post = e.record
    const oldReported = e.oldRecord ? Boolean(e.oldRecord.get('reported')) : false
    if (Boolean(post.get('reported')) && !oldReported) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('target_type', 'community_post_report')
        auditRec.set('target_id', post.id)
        auditRec.set('action', 'community_post_reported')
        auditRec.set('details', {
          post_id: post.id,
          author: post.get('user'),
          report_reason: post.get('report_reason') || 'Denúncia de conteúdo inadequado',
          reported_at: new Date().toISOString(),
        })
        $app.save(auditRec)
      } catch (auditErr) {
        console.warn('Aviso ao registrar auditoria de denúncia de post:', auditErr)
      }
    }
  } finally {
    e.next()
  }
}, 'community_posts')

onRecordCreate((e) => {
  const comment = e.record
  const text = (comment.get('content') || '').toString().trim()

  if (!text) {
    throw new BadRequestError('O comentário não pode ficar vazio.')
  }
  if (text.length > 1000) {
    throw new BadRequestError('O comentário excede o limite máximo permitido de 1.000 caracteres.')
  }

  const banned = [
    /esteroides?\s+anabolizantes?\b/i,
    /\bcomprar\s+(anabolizantes?|winstrol|oxandrolona|dianabol)\b/i,
    /hacke(ar|e|amento)\b/i,
    /\bpirataria\b/i,
    /pornograf/i,
    /\bnudes?\b/i,
    /\bcassino\b/i,
    /\bapostas?\s+esportivas?\b/i,
  ]
  for (let i = 0; i < banned.length; i++) {
    if (banned[i].test(text)) {
      throw new BadRequestError(
        'Conteúdo impróprio detectado. Revise o texto — comentários devem respeitar as regras de convivência.',
      )
    }
  }

  comment.set('content', text)

  const authorId = comment.get('user')
  if (!authorId) {
    throw new BadRequestError('Autor do comentário não identificado.')
  }
  try {
    const author = $app.findRecordById('users', authorId)
    const role = author.getString('role') || 'aluno'
    if (role === 'profissional' && author.getBool('approved') === false) {
      throw new BadRequestError(
        'Profissionais com cadastro pendente de aprovação não podem comentar na comunidade.',
      )
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('não') !== -1) {
      throw err
    }
    console.warn('Aviso ao verificar autor do comentário:', err)
  }

  return e.next()
}, 'community_post_comments')

// Hook de integridade e qualidade para mensagens de chat (collection 'messages')
// Diretrizes:
// 1. Mensagens com texto vazio ou só espaços não podem ser enviadas.
// 2. Limite máximo de 2000 caracteres por mensagem.
// 3. Sender deve ser usuário ativo/aprovado (caso profissional).
// 4. Se a mensagem for denúncia (reported = true), cria registro imutável em audits para fins LGPD.

onRecordCreate((e) => {
  const msg = e.record
  const content = (msg.get('content') || '').toString().trim()

  // 1. Validação de texto vazio
  if (!content || content.length === 0) {
    throw new BadRequestError('A mensagem não pode ser vazia.')
  }

  // 2. Limite de tamanho (2000 caracteres)
  if (content.length > 2000) {
    throw new BadRequestError('A mensagem excede o limite máximo permitido de 2.000 caracteres.')
  }

  // Sanitiza o conteúdo aparando espaços excedentes
  msg.set('content', content)

  // 3. Validação do remetente (sender)
  const senderId = msg.get('sender')
  if (!senderId) {
    throw new BadRequestError('Remetente da mensagem não identificado.')
  }

  try {
    const senderUser = $app.findRecordById('users', senderId)
    if (!senderUser) {
      throw new BadRequestError('Usuário remetente não localizado.')
    }

    // Se o remetente for profissional, deve estar aprovado pela moderação
    const role = senderUser.get('role') || 'aluno'
    if (role === 'profissional') {
      const isApproved = senderUser.get('approved')
      if (isApproved === false || isApproved === 'false') {
        throw new BadRequestError(
          'Profissionais com cadastro pendente de aprovação não podem enviar mensagens.',
        )
      }
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('não') !== -1) {
      throw err
    }
    console.warn('Aviso ao verificar remetente em on_message_create:', err)
  }

  return e.next()
}, 'messages')

// Hook executado quando uma mensagem é atualizada (ex: destinatário reportando mensagem)
onRecordAfterUpdateSuccess((e) => {
  try {
    const msg = e.record
    const oldReported = e.oldRecord ? Boolean(e.oldRecord.get('reported')) : false
    const newReported = Boolean(msg.get('reported'))

    // Se passou a ser reportada, registra evento de auditoria LGPD
    if (newReported && !oldReported) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('target_type', 'message_report')
        auditRec.set('target_id', msg.id)
        auditRec.set('action', 'chat_message_reported')
        auditRec.set('details', {
          message_id: msg.id,
          sender: msg.get('sender'),
          receiver: msg.get('receiver'),
          report_reason: msg.get('report_reason') || 'Denúncia de mensagem inadequada',
          reported_at: new Date().toISOString(),
        })
        $app.save(auditRec)
      } catch (auditErr) {
        console.warn('Aviso ao registrar auditoria de denúncia de mensagem:', auditErr)
      }
    }
  } finally {
    e.next()
  }
}, 'messages')

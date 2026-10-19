// Hook: Notificação em tempo real para o aluno quando o profissional cria ou altera um agendamento
// Não altera os 4 hooks protegidos (plans_change, on_review_created, wallet_withdraw, wearables_gateway)

onRecordAfterCreateSuccess((e) => {
  try {
    const appt = e.record
    const alunoId = appt.getString ? appt.getString('aluno') : appt.get('aluno')
    const profId = appt.getString ? appt.getString('profissional') : appt.get('profissional')

    if (alunoId) {
      let profName = 'Seu profissional'
      if (profId) {
        try {
          const prof = $app.findRecordById('users', profId)
          if (prof) {
            profName = prof.getString('name') || profName
          }
        } catch (_) {}
      }

      const servicoTipo =
        (appt.getString ? appt.getString('servico_tipo') : appt.get('servico_tipo')) ||
        'atendimento'
      const status = (appt.getString ? appt.getString('status') : appt.get('status')) || 'agendado'

      const notifCol = $app.findCollectionByNameOrId('notifications')
      const notif = new Record(notifCol)
      notif.set('user', alunoId)
      notif.set('type', 'agendamento_criado')
      notif.set('title', 'Novo Agendamento Marcado')
      notif.set(
        'body',
        `O profissional ${profName} registrou um agendamento de ${servicoTipo} (status: ${status}).`,
      )
      notif.set('read', false)
      notif.set('action_url', '/aluno')
      $app.save(notif)
    }
  } catch (err) {
    console.error('[on_appointment_notification] Erro ao criar notificação de agendamento:', err)
  } finally {
    e.next()
  }
}, 'appointments')

onRecordAfterUpdateSuccess((e) => {
  try {
    const appt = e.record
    const oldAppt = e.oldRecord
    const alunoId = appt.getString ? appt.getString('aluno') : appt.get('aluno')
    const profId = appt.getString ? appt.getString('profissional') : appt.get('profissional')

    if (alunoId) {
      const oldStatus = oldAppt
        ? oldAppt.getString
          ? oldAppt.getString('status')
          : oldAppt.get('status')
        : ''
      const newStatus = appt.getString ? appt.getString('status') : appt.get('status')
      const oldSchedule = oldAppt
        ? oldAppt.getString
          ? oldAppt.getString('schedule')
          : oldAppt.get('schedule')
        : ''
      const newSchedule = appt.getString ? appt.getString('schedule') : appt.get('schedule')

      // Notificar apenas se houve alteração relevante (status, schedule ou valor)
      if (oldStatus !== newStatus || oldSchedule !== newSchedule) {
        let profName = 'Seu profissional'
        if (profId) {
          try {
            const prof = $app.findRecordById('users', profId)
            if (prof) {
              profName = prof.getString('name') || profName
            }
          } catch (_) {}
        }

        const servicoTipo =
          (appt.getString ? appt.getString('servico_tipo') : appt.get('servico_tipo')) ||
          'atendimento'

        const notifCol = $app.findCollectionByNameOrId('notifications')
        const notif = new Record(notifCol)
        notif.set('user', alunoId)
        notif.set('type', 'agendamento_atualizado')
        notif.set('title', 'Agendamento Atualizado')
        notif.set(
          'body',
          `O agendamento de ${servicoTipo} com ${profName} foi atualizado (status: ${newStatus}).`,
        )
        notif.set('read', false)
        notif.set('action_url', '/aluno')
        $app.save(notif)
      }
    }
  } catch (err) {
    console.error(
      '[on_appointment_notification] Erro ao atualizar notificação de agendamento:',
      err,
    )
  } finally {
    e.next()
  }
}, 'appointments')

// Hook/Endpoint for Group Session Presence Validation & Billing/Ranking Integration
// Handles both student self-confirmation and professional manual confirmation
// Automatically creates a completed record in 'services', triggering:
// - Professional service fee debit (Básico R$ 1, Pro R$ 2, Premium R$ 3, Pro Parceiro R$ 2)
// - Instant Ranking points update & Referral qualification via on_service_completed hook!

routerAdd(
  'POST',
  '/backend/v1/group-sessions/validate-attendance',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Autenticação necessária' })
    }

    const data = e.requestInfo().body || {}
    const participantId = data.participant_id
    const action = data.action || 'confirm' // 'confirm' | 'mark_absent'

    if (!participantId) {
      return e.json(400, { error: 'ID do participante obrigatório' })
    }

    try {
      const participant = $app.findRecordById('group_session_participants', participantId)
      const sessionId = participant.get('session')
      const session = $app.findRecordById('group_sessions', sessionId)
      const profId = session.get('professional')
      const studentId = participant.get('student')
      const currentStatus = participant.get('attendance_status')

      // Auth authorization check:
      // Can only be performed by the professional owner of the session, an admin, or the student themselves
      const isProfessional = authRecord.id === profId || authRecord.get('role') === 'admin'
      const isStudentSelf = studentId && authRecord.id === studentId

      if (!isProfessional && !isStudentSelf) {
        return e.json(403, { error: 'Sem permissão para alterar este participante' })
      }

      // If marking absent
      if (action === 'mark_absent') {
        if (!isProfessional) {
          return e.json(403, {
            error: 'Apenas o profissional pode marcar ausência de participantes',
          })
        }
        participant.set('attendance_status', 'ausente')
        participant.set('notes', data.notes || 'Marcado ausente pelo profissional')
        $app.save(participant)
        return e.json(200, {
          success: true,
          message: 'Participante marcado como ausente',
          status: 'ausente',
        })
      }

      // Action is CONFIRM: Check 24h validation window if student self-confirms
      if (isStudentSelf) {
        const sessionDateStr = session.get('date') // "YYYY-MM-DD"
        const sessionStartTime = session.get('start_time') || '00:00' // "HH:mm"
        const windowHours = Number(session.get('validation_window_hours')) || 24

        // Parse session start time
        const sessionDateTime = new Date(`${sessionDateStr}T${sessionStartTime}:00`)
        const now = new Date()

        // Calculate deadline: session start time + windowHours
        const deadlineMs = sessionDateTime.getTime() + windowHours * 60 * 60 * 1000

        // Permite confirmar se a sessão já começou ou até 2 horas antes de começar
        const earliestMs = sessionDateTime.getTime() - 2 * 60 * 60 * 1000

        if (now.getTime() < earliestMs) {
          return e.json(400, {
            error:
              'A validação de presença só é liberada a partir de 2 horas antes da aula coletiva.',
          })
        }

        if (now.getTime() > deadlineMs) {
          return e.json(400, {
            error: `Janela de validação de presença expirada. O prazo limite foi de ${windowHours}h após a sessão.`,
          })
        }
      }

      // Set participant attendance status
      const newStatus = isStudentSelf ? 'confirmado' : 'marcado_presente'
      const confirmationMethod = isStudentSelf ? 'self_app' : 'professional_manual'
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)

      participant.set('attendance_status', newStatus)
      participant.set('confirmed_at', nowIso)
      participant.set('confirmation_method', confirmationMethod)

      // CHECK IF REGISTERED USER ON PLATFORM
      // Requirement:
      // (a) "Ele tem conta na plataforma (vínculo com usuário existente — visitantes não pontuam nem geram tarifa)"
      // (b) "Confirmou a própria presença no app OU foi marcado presente manualmente pelo profissional"
      const hasRegisteredUser = !!studentId
      participant.set('is_registered_user', hasRegisteredUser)

      let createdServiceId = null
      let feeCharged = false
      let pointsAwarded = false

      // Only process billing and ranking if registered user on platform and not yet processed
      if (
        hasRegisteredUser &&
        !participant.get('service_record') &&
        !participant.get('fee_charged')
      ) {
        try {
          // Create completed service record in 'services' collection.
          // This triggers on_service_completed, which handles:
          // 1. Fee debit to professional (R$ 1/2/3 depending on plan)
          // 2. Ranking points instant recalculation
          // 3. Referral tracking
          const servicesCol = $app.findCollectionByNameOrId('services')
          const svc = new Record(servicesCol)
          svc.set('professional', profId)
          svc.set('student', studentId)
          svc.set('type', session.get('specialty') || 'educacao_fisica')
          svc.set('title', `Aula Coletiva: ${session.get('title') || 'Treinamento em Grupo'}`)
          svc.set('value', Number(session.get('price_per_participant')) || 0)
          svc.set('status', 'concluido')
          svc.set('completed_at', nowIso)
          svc.set(
            'notes',
            `Presença validada na sessão coletiva #${session.id} (${confirmationMethod}). Participante #${participant.id}`,
          )
          $app.save(svc)

          createdServiceId = svc.id
          feeCharged = true
          pointsAwarded = true

          participant.set('service_record', createdServiceId)
          participant.set('fee_charged', true)
          participant.set('points_awarded', true)
        } catch (svcErr) {
          console.error('Erro ao registrar service para participante validado:', svcErr)
        }
      }

      $app.save(participant)

      // Check if session status should transition to 'concluida' if all confirmed or ended
      return e.json(200, {
        success: true,
        participant_id: participant.id,
        attendance_status: newStatus,
        is_registered_user: hasRegisteredUser,
        fee_charged: feeCharged,
        points_awarded: pointsAwarded,
        service_id: createdServiceId,
        message: hasRegisteredUser
          ? 'Presença validada com sucesso! Pontuação e tarifa de serviço processadas.'
          : 'Presença de visitante registrada com sucesso (sem pontuação ou tarifação por não possuir conta).',
      })
    } catch (err) {
      console.error('Erro na validação de presença coletiva:', err)
      return e.json(500, { error: 'Erro ao validar presença: ' + (err.message || String(err)) })
    }
  },
  $apis.requireAuth(),
)

// HOTFIX 369: Rotas de vínculo Aluno <-> Profissional
// Regras de negócio v2:
// - Aluno vinculado pontua no plano do professor e não paga mensalidade (linked_prof_fee_mode = 'prof_sponsored')
// - O vínculo é criado pelo ALUNO via /backend/v1/link/create
// - O vínculo pode ser removido pelo aluno, pelo profissional vinculado ou por admin via /backend/v1/link/remove

routerAdd(
  'POST',
  '/backend/v1/link/create',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const role = authUser.getString('role') || 'aluno'
      if (role !== 'aluno') {
        return e.json(400, {
          success: false,
          message: 'Apenas alunos podem solicitar vínculo com um profissional.',
        })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const professionalId = (body.professional_id || '').trim()

      if (!professionalId) {
        return e.json(400, {
          success: false,
          message: 'ID do profissional é obrigatório.',
        })
      }

      if (professionalId === authUser.id) {
        return e.json(400, {
          success: false,
          message: 'Você não pode se vincular a si mesmo.',
        })
      }

      // Validar profissional
      let profUser = null
      try {
        profUser = $app.findRecordById('users', professionalId)
      } catch (_) {
        return e.json(400, {
          success: false,
          message: 'Profissional não encontrado na plataforma.',
        })
      }

      const profRole = profUser.getString('role')
      const profApproved = profUser.getBool('approved')

      if (profRole !== 'profissional' || !profApproved) {
        return e.json(400, {
          success: false,
          message: 'O usuário selecionado não é um profissional credenciado e aprovado.',
        })
      }

      // Validar se o aluno já está vinculado
      const currentLinked = authUser.getString('linked_professional')
      if (currentLinked) {
        if (currentLinked === professionalId) {
          return e.json(200, {
            success: true,
            linked_professional: professionalId,
            linked_prof_fee_mode: 'prof_sponsored',
            message: 'Você já está vinculado a este profissional.',
          })
        }
        return e.json(409, {
          success: false,
          message: 'Você já possui um profissional vinculado. Desvincule antes de trocar.',
        })
      }

      // Gravar no aluno
      authUser.set('linked_professional', professionalId)
      authUser.set('linked_prof_fee_mode', 'prof_sponsored')
      $app.save(authUser)

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('actor', authUser.id)
        auditRec.set('target_type', 'users')
        auditRec.set('target_id', professionalId)
        auditRec.set('action', 'LINK_CREATED')
        auditRec.set('details', {
          student_id: authUser.id,
          student_name: authUser.getString('name'),
          professional_id: professionalId,
          professional_name: profUser.getString('name'),
          linked_prof_fee_mode: 'prof_sponsored',
        })
        $app.save(auditRec)
      } catch (auditErr) {
        console.error('Erro ao registrar audit de LINK_CREATED:', auditErr)
      }

      // Criar notificação para o profissional
      try {
        const notifCol = $app.findCollectionByNameOrId('notifications')
        const notifRec = new Record(notifCol)
        notifRec.set('user', professionalId)
        notifRec.set('type', 'aluno_vinculado')
        notifRec.set('title', 'Novo aluno vinculado!')
        notifRec.set(
          'body',
          `Novo aluno vinculado: ${authUser.getString('name') || 'Aluno 369'}. Ele agora pontua no seu plano.`,
        )
        notifRec.set('read', false)
        notifRec.set('action_url', '/profissional/alunos')
        $app.save(notifRec)
      } catch (notifErr) {
        console.error('Erro ao criar notificação de vínculo:', notifErr)
      }

      const profName = profUser.getString('name') || 'Profissional'

      return e.json(200, {
        success: true,
        linked_professional: professionalId,
        linked_prof_fee_mode: 'prof_sponsored',
        message: `Agora você treina com ${profName}! Seus pontos contam no plano dele e você não paga mensalidade.`,
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao processar vínculo com profissional.',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/link/remove',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const targetStudentId = (body.student_id || '').trim()

      const authRole = authUser.getString('role') || 'aluno'

      let studentRec = null

      if (authRole === 'aluno') {
        // Aluno desvincula a si próprio
        studentRec = authUser
      } else if (authRole === 'profissional') {
        // Profissional desvincula um de seus alunos
        if (!targetStudentId) {
          return e.json(400, {
            success: false,
            message: 'student_id é obrigatório para o profissional desvincular um aluno.',
          })
        }
        try {
          studentRec = $app.findRecordById('users', targetStudentId)
        } catch (_) {
          return e.json(404, { success: false, message: 'Aluno não encontrado.' })
        }

        const linkedTo = studentRec.getString('linked_professional')
        if (linkedTo !== authUser.id) {
          return e.json(403, {
            success: false,
            message: 'Este aluno não está vinculado ao seu perfil.',
          })
        }
      } else if (authRole === 'admin') {
        // Admin desvincula aluno indicado
        const sid = targetStudentId || authUser.id
        try {
          studentRec = $app.findRecordById('users', sid)
        } catch (_) {
          return e.json(404, { success: false, message: 'Aluno não encontrado.' })
        }
      } else {
        return e.json(403, {
          success: false,
          message: 'Permissão negada para desvincular.',
        })
      }

      const prevProfId = studentRec.getString('linked_professional')
      if (!prevProfId) {
        return e.json(200, {
          success: true,
          message: 'O aluno já não possui nenhum profissional vinculado.',
        })
      }

      // Zerar campos no aluno
      studentRec.set('linked_professional', '')
      studentRec.set('linked_prof_fee_mode', '')
      $app.save(studentRec)

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('actor', authUser.id)
        auditRec.set('target_type', 'users')
        auditRec.set('target_id', studentRec.id)
        auditRec.set('action', 'LINK_REMOVED')
        auditRec.set('details', {
          actor_id: authUser.id,
          actor_role: authRole,
          student_id: studentRec.id,
          previous_professional_id: prevProfId,
        })
        $app.save(auditRec)
      } catch (auditErr) {
        console.error('Erro ao registrar audit de LINK_REMOVED:', auditErr)
      }

      // Notificação para a outra parte
      try {
        const notifCol = $app.findCollectionByNameOrId('notifications')
        const notifRec = new Record(notifCol)
        if (authRole === 'aluno' && prevProfId) {
          // Notificar o profissional
          notifRec.set('user', prevProfId)
          notifRec.set('type', 'desvinculo_aluno')
          notifRec.set('title', 'Aluno desvinculado')
          notifRec.set(
            'body',
            `O aluno ${studentRec.getString('name') || 'Aluno 369'} desvinculou-se do seu perfil.`,
          )
        } else {
          // Notificar o aluno
          notifRec.set('user', studentRec.id)
          notifRec.set('type', 'desvinculo_aluno')
          notifRec.set('title', 'Vínculo encerrado')
          notifRec.set(
            'body',
            'Seu vínculo com o profissional foi encerrado. Você pode vincular-se a outro ou escolher um plano próprio.',
          )
        }
        notifRec.set('read', false)
        $app.save(notifRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Vínculo removido com sucesso.',
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao remover vínculo.',
      })
    }
  },
  $apis.requireAuth(),
)

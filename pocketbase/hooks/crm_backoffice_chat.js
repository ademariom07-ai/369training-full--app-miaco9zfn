/// <reference path="../pb_data/types.d.ts" />

/**
 * CHATBOT BACKOFFICE 369WELLNESS — Agente nativo Skip Cloud com acesso aos dados
 * do próprio profissional (crm_contacts, services, appointments).
 * Endpoint: POST /backend/v1/crm/backoffice_chat
 *
 * O agente nativo "backoffice-pro-369" é definido em migração 0137; aqui ele é invocado
 * com o contexto dos dados do próprio profissional injetado na mensagem.
 * IMPORTANTE (JSVM PocketBase): TODA lógica inline no callback — nada de funções top-level.
 * IMPORTANTE: records usam record.id (nunca .getId()).
 */

routerAdd(
  'POST',
  '/backend/v1/crm/backoffice_chat',
  (e) => {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Não autenticado' })

    let conversationId = null

    try {
      const body = e.requestInfo().body || {}
      const message = (body.message || '').substring(0, 2000)
      if (!message.trim()) return e.badRequestError('Mensagem obrigatória')
      conversationId = body.conversation_id || null

      const userRec = $app.findRecordById('users', auth.id)
      if (userRec.getString('role') !== 'profissional') {
        return e.json(403, { error: 'Apenas profissionais acessam o BackOffice' })
      }

      const profId = auth.id
      const today = new Date().toISOString().slice(0, 10)

      // ---------- CONTEXTO (só dados do próprio profissional) ----------
      const lines = []
      try {
        const contacts = $app.findRecordsByFilter(
          'crm_contacts',
          "professional = '" + profId + "'",
          '-updated',
          100,
          0,
        )
        lines.push('CONTATOS CRM (' + contacts.length + '):')
        for (let i = 0; i < Math.min(contacts.length, 60); i++) {
          const c = contacts[i]
          const fu = c.get('next_followup_at')
          const fuStr = fu ? new Date(fu).toISOString().slice(0, 10) : 'sem'
          lines.push(
            '- ' +
              c.getString('contact_name') +
              ' | status=' +
              c.getString('status') +
              ' | origem=' +
              c.getString('origin') +
              ' | followup=' +
              fuStr +
              ' | valor=' +
              c.getFloat('estimated_value') +
              ' | notas=' +
              c.getString('notes').substring(0, 80),
          )
        }

        const services = $app.findRecordsByFilter(
          'services',
          "professional = '" + profId + "'",
          '-created',
          100,
          0,
        )
        lines.push('SERVIÇOS (' + services.length + '):')
        for (let i = 0; i < Math.min(services.length, 50); i++) {
          const s = services[i]
          let studentName = 'aluno'
          try {
            const st = $app.findRecordById('users', s.getString('student'))
            studentName = st.getString('name')
          } catch (_) {}
          lines.push(
            '- ' +
              s.getString('title') +
              ' | aluno=' +
              studentName +
              ' | status=' +
              s.getString('status') +
              ' | valor=' +
              s.getFloat('value'),
          )
        }

        const appts = $app.findRecordsByFilter(
          'appointments',
          "profissional = '" + profId + "'",
          '-created',
          100,
          0,
        )
        lines.push('AGENDAMENTOS (' + appts.length + '):')
        for (let i = 0; i < Math.min(appts.length, 50); i++) {
          const a = appts[i]
          let alunoName = 'aluno'
          try {
            const al = $app.findRecordById('users', a.getString('aluno'))
            alunoName = al.getString('name')
          } catch (_) {}
          lines.push(
            '- aluno=' +
              alunoName +
              ' | tipo=' +
              a.getString('servico_tipo') +
              ' | status=' +
              a.getString('status') +
              ' | valor=' +
              a.getFloat('valor'),
          )
        }
      } catch (ctxErr) {
        console.log('[CRM_CHAT] contexto: ' + (ctxErr && ctxErr.message))
      }

      lines.push('DATA DE HOJE: ' + today)
      const context = lines.join('\n')

      // ---------- 1) AGENTE NATIVO Skip Cloud (definido em migração 0137) ----------
      let reply = ''
      try {
        if (typeof $ai !== 'undefined' && typeof $ai.agent === 'function') {
          const result = $ai.agent('backoffice-pro-369').chat({
            user_id: profId,
            conversation_id: conversationId,
            message: context + '\n\nPERGUNTA DO PROFISSIONAL: ' + message,
          })
          reply = result.content
          conversationId = result.conversation_id
        }
      } catch (agentErr) {
        console.log('[CRM_CHAT] agente nativo falhou: ' + (agentErr && agentErr.message))
      }

      // ---------- 2) Fallback $ai.chat com o contexto do próprio profissional ----------
      if (!reply) {
        try {
          const completion = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content:
                  'Você é o BACKOFFICE 369 do profissional da 369WELLNESS. Responda EXCLUSIVAMENTE com base nos dados do próprio profissional abaixo (contatos CRM, serviços, agendamentos). Nunca invente dados. Sugira follow-ups quando útil, resuma alunos, aponte leads parados. Responda em português, curto e direto. DADOS DO PROFISSIONAL:\n' +
                  context,
              },
              { role: 'user', content: message },
            ],
            temperature: 0.3,
            maxTokens: 500,
          })
          reply =
            (completion && completion.content) ||
            (completion &&
              completion.choices &&
              completion.choices[0] &&
              completion.choices[0].message.content) ||
            ''
        } catch (fbErr) {
          console.log('[CRM_CHAT] fallback erro: ' + (fbErr && fbErr.message))
        }
      }

      if (!reply) {
        reply =
          'Não consegui processar agora. Verifique seus contatos no CRM ou tente novamente em instantes.'
      }

      return e.json(200, { reply: reply, conversation_id: conversationId })
    } catch (err) {
      console.log('[CRM_CHAT] erro geral: ' + (err && err.message))
      return e.json(500, { error: 'Erro no BackOffice IA' })
    }
  },
  $apis.requireAuth(),
)

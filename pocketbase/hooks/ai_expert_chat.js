routerAdd(
  'POST',
  '/backend/v1/experts/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const expertSlug = body.expert_slug || 'mentor-expansao-369'
      const userMessage = body.message || ''
      const conversationId = body.conversation_id || null

      if (!userMessage.trim()) {
        return e.badRequestError('Mensagem não informada')
      }

      // Check professional plan
      let planTier = 'basico'
      try {
        const user = $app.findRecordById('users', userId)
        planTier = user.getString('plan') || 'basico'
      } catch (_) {}

      // Check interaction quota per plan tier if needed
      // Básico: 15/mês, Pro: 50/mês, Premium: Ilimitado (ex: 500)
      const quotaLimits = { gratis: 5, basico: 15, pro: 50, premium: 500 }
      const maxQuota = quotaLimits[planTier] || 15

      let interactionsCount = 0
      try {
        const currentMonth = new Date().toISOString().slice(0, 7)
        const list = $app.findRecordsByFilter(
          'expert_interactions',
          "professional = '" +
            userId +
            "' && expert_slug = '" +
            expertSlug +
            "' && created >= '" +
            currentMonth +
            "-01'",
          '-created',
          1000,
          0,
        )
        interactionsCount = list ? list.length : 0
      } catch (_) {}

      if (interactionsCount >= maxQuota) {
        return e.json(403, {
          error:
            'Limite de interações atingido para o plano ' +
            planTier.toUpperCase() +
            '. Faça upgrade para continuar.',
          remaining_quota: 0,
          max_quota: maxQuota,
        })
      }

      // Call Agent
      let agentResult
      try {
        agentResult = $ai.agent(expertSlug).chat({
          user_id: userId,
          conversation_id: conversationId,
          message: userMessage,
        })
      } catch (agentErr) {
        // Fallback to chat if agent error or direct response
        if (agentErr instanceof SkipAiConfigError) {
          return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
        }
        const systemPrompts = {
          'mentor-expansao-369':
            'Você é o MENTOR DE EXPANSÃO 369 da 369TRAINING. Focado em crescimento de alunos, marketing e retenção.',
          'roteirista-saude-10':
            'Você é o ROTEIRISTA DE SAÚDE NOTA 10 da 369TRAINING. Focado em roteiros de vídeo, posts e engajamento.',
        }
        const fallbackPrompt = systemPrompts[expertSlug] || systemPrompts['mentor-expansao-369']
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content: fallbackPrompt + ' (Plano do profissional: ' + planTier + ')',
            },
            { role: 'user', content: userMessage },
          ],
        })
        agentResult = {
          content: reply.choices[0].message.content,
          conversation_id: conversationId || 'conv_' + Math.random().toString(36).substring(2, 9),
          message_id: 'msg_' + Math.random().toString(36).substring(2, 9),
          citations: [],
        }
      }

      // Log interaction in expert_interactions
      try {
        const col = $app.findCollectionByNameOrId('expert_interactions')
        const rec = new Record(col)
        rec.set('professional', userId)
        rec.set('expert_slug', expertSlug)
        rec.set('plan_tier', planTier)
        rec.set('prompt', userMessage)
        rec.set('response', agentResult.content)
        rec.set('tokens_used', Math.round(userMessage.length / 4 + agentResult.content.length / 4))
        rec.set('timestamp', new Date().toISOString())
        $app.save(rec)
      } catch (logErr) {
        console.log('Failed to log expert interaction:', logErr.message)
      }

      const remainingQuota = Math.max(0, maxQuota - (interactionsCount + 1))

      return e.json(200, {
        content: agentResult.content,
        conversation_id: agentResult.conversation_id,
        message_id: agentResult.message_id,
        citations: agentResult.citations || [],
        remaining_quota: remainingQuota,
        max_quota: maxQuota,
        plan_tier: planTier,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao processar consulta ao Expert' })
    }
  },
  $apis.requireAuth(),
)

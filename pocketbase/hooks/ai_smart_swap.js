routerAdd(
  'POST',
  '/backend/v1/generate/smart_swap',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const mealItem = body.mealItem || 'Pão francês com queijo prato'
      const reason = body.reason || 'Opção mais saudável e com mais saciedade'

      const prompt = `Você é o assistente de nutrição 369TRAINING.
O usuário deseja uma "Substituição Inteligente" para o seguinte alimento/refeição:
"${mealItem}"
Motivo/Preferência: "${reason}"

Retorne ESTRITAMENTE um JSON com as propriedades:
{
  "original": "${mealItem}",
  "suggestion": "Nome do alimento ou preparação substituta",
  "benefits": "Breve explicação nutricional dos benefícios e macronutrientes equivalentes",
  "portion": "Quantidade recomendada"
}`

      const reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um nutricionista focado em substituições inteligentes e práticas. Responda em JSON puro.',
          },
          { role: 'user', content: prompt },
        ],
      })

      let rawText = reply.choices[0].message.content || '{}'
      rawText = rawText.trim()
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      let parsed
      try {
        parsed = JSON.parse(rawText)
      } catch (_) {
        parsed = {
          original: mealItem,
          suggestion: 'Pão 100% integral com queijo cottage ou ricota temperada',
          benefits:
            'Maior teor de fibras e proteínas, índice glicêmico mais baixo e menor gordura saturada.',
          portion: '2 fatias com 2 colheres de sopa de cottage',
        }
      }

      return e.json(200, parsed)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA indisponível' })
      }
      return e.json(500, { error: err.message || 'Erro ao processar substituição' })
    }
  },
  $apis.requireAuth(),
)

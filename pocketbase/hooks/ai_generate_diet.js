routerAdd(
  'POST',
  '/backend/v1/generate/diet',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const goal = body.goal || 'Ganho de massa magra'
      const calories = body.calories || 2500
      const dietaryRestrictions = body.dietaryRestrictions || 'Nenhuma'
      const mealCount = body.mealCount || 4

      const prompt = `Você é o gerador de planos nutricionais com Inteligência Artificial da 369TRAINING.
Elabore um plano alimentar equilibrado para um aluno com os dados:
- Objetivo: ${goal}
- Meta calórica aproximada: ${calories} kcal
- Refeições por dia: ${mealCount}
- Restrições/Preferências alimentares: ${dietaryRestrictions}

Retorne ESTRITAMENTE um objeto JSON válido (sem markdown ao redor) com a estrutura:
{
  "title": "Plano Nutricional 369 - ${goal}",
  "calories": ${calories},
  "macros": { "protein": 160, "carbs": 280, "fat": 65 },
  "meals": [
    {
      "name": "Café da Manhã (07:30)",
      "calories": 500,
      "items": ["3 ovos mexidos com azeite", "2 fatias de pão 100% integral", "1 porção de frutas vermelhas"]
    }
  ],
  "smart_tips": ["Beba no mínimo 3L de água ao longo do dia.", "Evite ultraprocessados."]
}`

      const reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um nutricionista esportivo de excelência. Responda apenas com JSON estruturado.',
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
          title: 'Plano Nutricional 369 - ' + goal,
          calories: calories,
          macros: { protein: 150, carbs: 260, fat: 60 },
          meals: [
            {
              name: 'Café da Manhã',
              calories: 500,
              items: ['Ovos mexidos', 'Pão integral', 'Fruta da estação'],
            },
            {
              name: 'Almoço',
              calories: 750,
              items: ['Peito de frango ou peixe', 'Arroz integral', 'Feijão', 'Salada variada'],
            },
            {
              name: 'Lanche da Tarde',
              calories: 400,
              items: ['Iogurte natural', 'Whey Protein', 'Aveia e castanhas'],
            },
            {
              name: 'Jantar',
              calories: 650,
              items: ['Carne magra grelhada', 'Batata doce', 'Legumes no vapor'],
            },
          ],
          smart_tips: [
            'Mantenha a hidratação diária.',
            'Consistência nutricional é a chave para o resultado.',
          ],
        }
      }

      return e.json(200, parsed)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      return e.json(500, { error: err.message || 'Erro ao gerar plano alimentar com IA' })
    }
  },
  $apis.requireAuth(),
)

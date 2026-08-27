routerAdd(
  'POST',
  '/backend/v1/generate/workout',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const objective = body.objective || 'Hipertrofia'
      const experience = body.experience || 'Intermediário'
      const daysAvailable = body.daysAvailable || 4
      const restrictions = body.restrictions || 'Nenhuma'
      const notes = body.notes || ''

      const prompt = `Você é o gerador de treinos com Inteligência Artificial da 369TRAINING.
  Crie um plano de treino estruturado, seguro e motivador para o aluno com os seguintes dados:
  - Objetivo principal: ${objective}
  - Nível de experiência: ${experience}
  - Dias disponíveis por semana: ${daysAvailable} dias
  - Restrições físicas/lesões: ${restrictions}
  - Observações adicionais: ${notes}

  IMPORTANTE: Forneça links de demonstração de vídeo reais do YouTube para cada exercício na chave "video".
  Retorne ESTRITAMENTE um objeto JSON válido (sem markdown, sem blocos de código com crases triplas adicionais se possível, apenas o JSON puro) com a seguinte estrutura:
  {
    "title": "Treino Personalizado 369 - ${objective}",
    "objective": "${objective}",
    "frequency": "${daysAvailable}x na semana",
    "exercises": [
      {
        "id": "ex_1",
        "name": "Nome do Exercício em Português",
        "muscle_group": "Grupo Muscular",
        "sets": "4",
        "reps": "10-12",
        "load": "Carga moderada/progressiva",
        "rest": "60s",
        "video": "https://www.youtube.com/watch?v=rT7DgCr-3pg",
        "tips": "Dica de execução técnica e postura",
        "completed": false
      }
    ],
    "disclaimer": "Orientação de IA não garante resultados e não substitui avaliação profissional."
  }`
      const reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um especialista em biomecânica e prescrição de treinamento esportivo de alta precisão. Responda sempre em JSON válido.',
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
          title: 'Treino Personalizado 369 - ' + objective,
          objective: objective,
          exercises: [
            {
              id: 'e1',
              name: 'Aquecimento e Mobilidade Articular',
              sets: '2',
              reps: '10 min',
              load: 'Peso corporal',
              rest: '30s',
              completed: false,
            },
            {
              id: 'e2',
              name: 'Agachamento Livre com Barra',
              sets: '4',
              reps: '10',
              load: 'Moderada',
              rest: '90s',
              completed: false,
            },
            {
              id: 'e3',
              name: 'Supino Reto com Halteres',
              sets: '4',
              reps: '10-12',
              load: 'Moderada',
              rest: '60s',
              completed: false,
            },
            {
              id: 'e4',
              name: 'Puxada Frontal na Polia',
              sets: '4',
              reps: '12',
              load: 'Moderada',
              rest: '60s',
              completed: false,
            },
            {
              id: 'e5',
              name: 'Prancha Abdominal Isométrica',
              sets: '3',
              reps: '45s',
              load: 'Peso corporal',
              rest: '45s',
              completed: false,
            },
          ],
          disclaimer:
            'Orientação de IA não garante resultados e não substitui avaliação profissional.',
        }
      }

      return e.json(200, parsed)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      return e.json(500, { error: err.message || 'Erro ao gerar treino com IA' })
    }
  },
  $apis.requireAuth(),
)

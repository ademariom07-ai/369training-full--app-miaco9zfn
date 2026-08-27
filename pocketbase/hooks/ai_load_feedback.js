routerAdd(
  'POST',
  '/backend/v1/generate/load-feedback',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const exerciseName = body.exerciseName || 'Exercício'
      const weightUsed = Number(body.weightUsed) || 0
      const difficulty = Number(body.difficulty) || 5
      const objective = body.objective || 'Hipertrofia'
      const reps = body.reps || '10-12'
      const sets = body.sets || '4'

      const prompt = `Você é o assistente biomecânico da 369TRAINING especializado em progressão de cargas (Progressive Overload).
O aluno executou o exercício com os seguintes dados:
- Exercício: ${exerciseName}
- Carga atual utilizada: ${weightUsed} kg
- Grau de percepção de esforço (RPE / Dificuldade de 0 a 10): ${difficulty}/10 (sendo 0 = extremamente fácil, 10 = falha absoluta/impossível)
- Séries e Repetições atuais: ${sets} séries x ${reps} repetições
- Objetivo principal do aluno: ${objective}

Analise tecnicamente o feedback:
1. Se a dificuldade for baixa (0 a 4): sugira aumento progressivo de carga (geralmente +2kg a +5kg) ou aumento de repetições/cadência se hipertrofia/força.
2. Se a dificuldade for moderada/ótima (5 a 7): sugira manutenção da carga com foco em contração excêntrica e técnica, ou leve incremento (+1 a +2kg).
3. Se a dificuldade for alta/limite (8 a 10): sugira manter a carga atual ou leve regressão temporária de -5% a -10% para evitar lesões e focar na execução perfeita.

Retorne ESTRITAMENTE um JSON no seguinte formato:
{
  "recommendation": "Frase curta direta e motivadora (ex: 'Aumente +2,5kg na próxima sessão!')",
  "suggestedLoad": "X kg (ou 'Manter Y kg')",
  "suggestedReps": "10-12 reps",
  "rationale": "Explicação técnica concisa de 1 a 2 frases baseada na ciência do esporte e no objetivo ${objective}.",
  "action": "increase | maintain | decrease"
}`

      const reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um treinador de força e fisiologista esportivo de padrão ouro. Responda apenas com JSON estruturado.',
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
        if (difficulty <= 4) {
          parsed = {
            recommendation: `Sugerimos aumentar a carga para ${weightUsed + 2} kg na próxima sessão.`,
            suggestedLoad: `${weightUsed + 2} kg`,
            suggestedReps: reps,
            rationale: `Como a percepção de esforço foi leve (${difficulty}/10), a progressão de carga estimula novas adaptações neuromusculares para ${objective}.`,
            action: 'increase',
          }
        } else if (difficulty >= 8) {
          parsed = {
            recommendation: `Mantenha a carga de ${weightUsed} kg e foque na amplitude e controle do movimento.`,
            suggestedLoad: `${weightUsed} kg`,
            suggestedReps: reps,
            rationale: `Com esforço elevado (${difficulty}/10), consolidar a técnica protege as articulações antes de nova sobrecarga.`,
            action: 'maintain',
          }
        } else {
          parsed = {
            recommendation: `Excelente faixa de intensidade! Tente +1 kg ou mais 1 repetição por série.`,
            suggestedLoad: `${weightUsed + 1} kg`,
            suggestedReps: reps,
            rationale: `Zona ideal de estímulo metabólico (${difficulty}/10) para maximizar ganhos de ${objective}.`,
            action: 'maintain',
          }
        }
      }

      return e.json(200, parsed)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      return e.json(500, { error: err.message || 'Erro ao calcular feedback de carga com IA' })
    }
  },
  $apis.requireAuth(),
)

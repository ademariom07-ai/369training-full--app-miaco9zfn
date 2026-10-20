/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook do Analista de Evolução (Skip Cloud Native AI Agent)
 * NOTA DE ARQUITETURA JSVM POCKETBASE:
 * Todas as funções auxiliares DEVEM ser inline dentro do corpo de cada callback routerAdd,
 * pois o JSVM não compartilha escopo de nível superior entre as instâncias do pool.
 *
 * Endpoints:
 * 1. POST /backend/v1/ai/analista/analisar-aluno (BackOffice do profissional)
 * 2. POST /backend/v1/ai/analista/resumo-aluno (Tela /aluno/evolucao)
 * 3. POST /backend/v1/ai/analista/import-csv (Enriquecimento com planilha)
 */

// -----------------------------------------------------------------------------
// 1. POST /backend/v1/ai/analista/analisar-aluno (BackOffice do profissional)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/ai/analista/analisar-aluno',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) return e.unauthorizedError('Autenticação necessária')

      const profId = authUser.id
      const profRole = authUser.getString('role')
      if (profRole !== 'profissional' && profRole !== 'admin') {
        return e.forbiddenError('Acesso restrito a profissionais de saúde e fitness.')
      }

      const body = e.requestInfo().body || {}
      const studentId = (body.student_id || '').trim()
      const additionalCsvNotes = (body.csv_context || '').trim()

      if (!studentId) {
        return e.badRequestError('student_id é obrigatório.')
      }

      // Restrição LGPD: verificar se o aluno pertence a este profissional (inline)
      if (profRole !== 'admin') {
        let isAllowed = false

        // 1. Vínculo direto de users (linked_professional)
        try {
          const studentUser = $app.findRecordById('users', studentId)
          if (studentUser && studentUser.getString('linked_professional') === profId) {
            isAllowed = true
          }
        } catch (_) {}

        // 2. Histórico de agendamentos entre ambos
        if (!isAllowed) {
          try {
            const appts = $app.findRecordsByFilter(
              'appointments',
              "profissional = '" + profId + "' && aluno = '" + studentId + "'",
              '-created',
              1,
              0,
            )
            if (appts && appts.length > 0) isAllowed = true
          } catch (_) {}
        }

        // 3. Histórico de treinos prescritos
        if (!isAllowed) {
          try {
            const w = $app.findRecordsByFilter(
              'workouts',
              "professional = '" + profId + "' && student = '" + studentId + "'",
              '-created',
              1,
              0,
            )
            if (w && w.length > 0) isAllowed = true
          } catch (_) {}
        }

        // 4. Logs de execução com esse profissional
        if (!isAllowed) {
          try {
            const logs = $app.findRecordsByFilter(
              'workout_logs',
              "professional = '" + profId + "' && student = '" + studentId + "'",
              '-created',
              1,
              0,
            )
            if (logs && logs.length > 0) isAllowed = true
          } catch (_) {}
        }

        // 5. Fichas clínicas
        if (!isAllowed) {
          try {
            const clin = $app.findRecordsByFilter(
              'clinical_records',
              "professional = '" + profId + "' && student = '" + studentId + "'",
              '-created',
              1,
              0,
            )
            if (clin && clin.length > 0) isAllowed = true
          } catch (_) {}
        }

        if (!isAllowed) {
          return e.forbiddenError(
            'LGPD: Você só tem autorização para gerar e visualizar insights dos seus próprios alunos vinculados.',
          )
        }
      }

      // Buscar nome do aluno e objetivo
      let studentName = 'Aluno'
      let studentObjective = 'Evolução Geral'
      try {
        const stUser = $app.findRecordById('users', studentId)
        studentName = stUser.getString('name') || 'Aluno'
        studentObjective = stUser.getString('objective') || 'Evolução Física'
      } catch (_) {}

      // Consolidar métricas reais (inline)
      let allLogs = []
      try {
        allLogs = $app.findRecordsByFilter(
          'workout_logs',
          "student = '" + studentId + "'",
          'completed_at',
          2000,
          0,
        )
      } catch (_) {
        allLogs = []
      }

      const exerciseMap = {}
      let totalVolumeKg = 0
      let rpeSum = 0
      let rpeCount = 0
      const sessionDaysSet = {}

      for (let i = 0; i < allLogs.length; i++) {
        const log = allLogs[i]
        const exName = (log.getString('exercise_name') || 'Geral').trim()
        const weight = Number(log.get('weight_used') || 0)
        const reps = Number(log.get('reps_done') || 0)
        const rpe = Number(log.get('rpe_difficulty') || 0)
        const completedAt = log.getString('completed_at') || log.getString('created') || ''

        if (rpe > 0) {
          rpeSum += rpe
          rpeCount++
        }

        const seriesVol = reps * weight
        totalVolumeKg += seriesVol

        if (completedAt) {
          const dayKey = completedAt.slice(0, 10)
          sessionDaysSet[dayKey] = (sessionDaysSet[dayKey] || 0) + 1
        }

        if (!exerciseMap[exName]) {
          exerciseMap[exName] = {
            firstWeight: weight,
            lastWeight: weight,
            maxWeight: weight,
            count: 1,
          }
        } else {
          exerciseMap[exName].lastWeight = weight
          if (weight > exerciseMap[exName].maxWeight) {
            exerciseMap[exName].maxWeight = weight
          }
          exerciseMap[exName].count++
        }
      }

      // appointments (faltas e presenças)
      let totalAppointments = 0
      let concludedAppointments = 0
      let canceledAppointments = 0
      let pendingAppointments = 0
      try {
        let apptFilter = "aluno = '" + studentId + "'"
        if (profId) {
          apptFilter += " && profissional = '" + profId + "'"
        }
        const appts = $app.findRecordsByFilter('appointments', apptFilter, '-created', 1000, 0)
        totalAppointments = appts ? appts.length : 0
        for (let j = 0; j < totalAppointments; j++) {
          const st = (appts[j].getString('status') || '').toLowerCase()
          if (st === 'concluído' || st === 'concluido') concludedAppointments++
          else if (st === 'cancelado') canceledAppointments++
          else pendingAppointments++
        }
      } catch (_) {}

      // clinical_records
      let maxPainLevel = 0
      const clinicalCategories = []
      try {
        const crList = $app.findRecordsByFilter(
          'clinical_records',
          "student = '" + studentId + "'",
          '-created',
          50,
          0,
        )
        for (let k = 0; k < crList.length; k++) {
          const p = Number(crList[k].get('pain_level') || 0)
          if (p > maxPainLevel) maxPainLevel = p
          const cat = crList[k].getString('category')
          if (cat && clinicalCategories.indexOf(cat) === -1) {
            clinicalCategories.push(cat)
          }
        }
      } catch (_) {}

      // service_reviews
      let reviewCount = 0
      let reviewSum = 0
      try {
        const revs = $app.findRecordsByFilter(
          'service_reviews',
          "reviewee = '" + studentId + "'",
          '-created',
          50,
          0,
        )
        for (let r = 0; r < revs.length; r++) {
          const stars = Number(revs[r].get('rating') || 0)
          if (stars > 0) {
            reviewSum += stars
            reviewCount++
          }
        }
      } catch (_) {}

      const distinctDays = Object.keys(sessionDaysSet).length
      const avgRpe = rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : 0
      const avgRating = reviewCount > 0 ? Math.round((reviewSum / reviewCount) * 10) / 10 : 5.0
      const absenceRate =
        totalAppointments > 0 ? Math.round((canceledAppointments / totalAppointments) * 100) : 0

      const topExercises = Object.keys(exerciseMap)
        .map(function (name) {
          const item = exerciseMap[name]
          const delta = item.lastWeight - item.firstWeight
          const pct = item.firstWeight > 0 ? Math.round((delta / item.firstWeight) * 100) : 0
          return {
            name: name,
            firstWeight: item.firstWeight,
            lastWeight: item.lastWeight,
            maxWeight: item.maxWeight,
            deltaKg: delta,
            progressionPct: pct,
            setsCount: item.count,
          }
        })
        .sort(function (a, b) {
          return b.setsCount - a.setsCount
        })
        .slice(0, 5)

      const metrics = {
        totalLogs: allLogs.length,
        distinctDays: distinctDays,
        totalVolumeKg: Math.round(totalVolumeKg),
        avgRpe: avgRpe,
        topExercises: topExercises,
        appointments: {
          total: totalAppointments,
          concluded: concludedAppointments,
          canceled: canceledAppointments,
          pending: pendingAppointments,
          absenceRatePct: absenceRate,
        },
        clinical: {
          maxPainLevel: maxPainLevel,
          categories: clinicalCategories,
        },
        reviews: {
          count: reviewCount,
          avgRating: avgRating,
        },
      }

      // Montar mensagem estruturada com as métricas para o agente
      const promptLines = [
        'Analisar a evolução do seguinte aluno atendido pelo profissional autenticado:',
        'ALUNO: ' + studentName + ' (ID: ' + studentId + ')',
        'OBJETIVO PRINCIPAL: ' + studentObjective,
        'MÉTRICAS EXTRAÍDAS DAS COLEÇÕES (workout_logs, appointments, clinical_records, service_reviews):',
        '- Total de séries registradas: ' + metrics.totalLogs,
        '- Dias com treino concluído: ' + metrics.distinctDays,
        '- Volume total acumulado: ' + metrics.totalVolumeKg + ' kg',
        '- RPE médio de esforço percebido: ' + metrics.avgRpe + '/10',
        '- Agendamentos totais: ' +
          metrics.appointments.total +
          ' (Concluídos: ' +
          metrics.appointments.concluded +
          ', Cancelados/Faltas: ' +
          metrics.appointments.canceled +
          ', Taxa de faltas: ' +
          metrics.appointments.absenceRatePct +
          '%)',
        '- Nível máximo de dor reportado nas fichas clínicas: ' +
          metrics.clinical.maxPainLevel +
          '/10 (Áreas: ' +
          (metrics.clinical.categories.join(', ') || 'Nenhuma restrição') +
          ')',
        '- Avaliação média recebida pós-aula: ' + metrics.reviews.avgRating + ' estrelas',
      ]

      if (metrics.topExercises.length > 0) {
        promptLines.push('PRINCIPAIS EXERCÍCIOS E PROGRESSÃO DE CARGA:')
        for (let i = 0; i < metrics.topExercises.length; i++) {
          const ex = metrics.topExercises[i]
          promptLines.push(
            '  * ' +
              ex.name +
              ': inicial ' +
              ex.firstWeight +
              ' kg -> final ' +
              ex.lastWeight +
              ' kg (máx ' +
              ex.maxWeight +
              ' kg, variação ' +
              (ex.deltaKg >= 0 ? '+' : '') +
              ex.deltaKg +
              ' kg / ' +
              ex.progressionPct +
              '%, ' +
              ex.setsCount +
              ' séries)',
          )
        }
      }

      if (additionalCsvNotes) {
        promptLines.push('DADOS ADICIONAIS IMPORTADOS VIA PLANILHA CSV PELO PROFISSIONAL:')
        promptLines.push(additionalCsvNotes)
      }

      promptLines.push(
        '\nProduza o relatório no padrão exigido: diagnóstico geral, 3 a 5 pontos com números reais, RECOMENDAÇÕES (ajuste de treino, alerta de platô, risco de overtraining) e SUGESTÕES DE SERVIÇOS DO ECOSSISTEMA (nutrição, fisioterapia, artes marciais) pertinentes aos dados.',
      )

      const fullPrompt = promptLines.join('\n')

      // Invocar o Agente Nativo Skip Cloud
      let analysisText = ''
      let usedModel = 'analista-evolucao'

      try {
        const agentResult = $ai.agent('analista-evolucao').chat({
          user_id: profId,
          message: fullPrompt,
        })
        analysisText = agentResult.content || ''
      } catch (agentErr) {
        if (agentErr instanceof SkipAiConfigError) {
          return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
        }
        usedModel = 'fast-fallback'
        const chatRes = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é o ANALISTA DE EVOLUÇÃO 369 da 369WELLNESS. Analise os dados consolidados do aluno (carga, RPE, volume, constância, faltas) e produza recomendações objetivas de ajuste de treino, alerta de platô, risco de overtraining e sugestão de serviços (nutrição, fisioterapia, artes marciais). Encerre com o aviso CREF de apoio.',
            },
            { role: 'user', content: fullPrompt },
          ],
        })
        analysisText = chatRes.choices[0].message.content
      }

      // Persistir na coleção ai_insights
      let savedInsightId = ''
      try {
        const insightsCol = $app.findCollectionByNameOrId('ai_insights')
        const rec = new Record(insightsCol)
        rec.set('professional', profId)
        rec.set('student', studentId)
        rec.set('insight_type', 'evolucao_aluno')
        rec.set('content', analysisText)
        rec.set('metrics_snapshot', metrics)
        rec.set('generated_by', 'analista-evolucao')
        rec.set('model', usedModel)
        if (body.csv_import_id) {
          rec.set('csv_import', body.csv_import_id)
        }
        $app.save(rec)
        savedInsightId = rec.id
      } catch (saveErr) {
        console.log('[analista-evolucao] Erro ao salvar ai_insights: ' + saveErr.message)
      }

      return e.json(200, {
        success: true,
        insight_id: savedInsightId,
        student_id: studentId,
        student_name: studentName,
        metrics: metrics,
        content: analysisText,
        model: usedModel,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao processar análise do aluno' })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 2. POST /backend/v1/ai/analista/resumo-aluno (Tela /aluno/evolucao)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/ai/analista/resumo-aluno',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) return e.unauthorizedError('Autenticação necessária')

      const studentId = authUser.id

      // Consolidar métricas do próprio aluno (inline)
      let allLogs = []
      try {
        allLogs = $app.findRecordsByFilter(
          'workout_logs',
          "student = '" + studentId + "'",
          'completed_at',
          2000,
          0,
        )
      } catch (_) {
        allLogs = []
      }

      if (allLogs.length === 0) {
        return e.json(200, {
          success: true,
          points: [
            'Você ainda não possui treinos registrados no sistema.',
            'Inicie o registro das suas séries pelo botão "Registrar Treino" para liberar a análise automática.',
            'Assim que registrar suas primeiras sessões, o Analista de Evolução calculará sua sobrecarga progressiva, RPE e constância.',
          ],
          has_data: false,
        })
      }

      const exerciseMap = {}
      let totalVolumeKg = 0
      let rpeSum = 0
      let rpeCount = 0
      const sessionDaysSet = {}

      for (let i = 0; i < allLogs.length; i++) {
        const log = allLogs[i]
        const exName = (log.getString('exercise_name') || 'Geral').trim()
        const weight = Number(log.get('weight_used') || 0)
        const reps = Number(log.get('reps_done') || 0)
        const rpe = Number(log.get('rpe_difficulty') || 0)
        const completedAt = log.getString('completed_at') || log.getString('created') || ''

        if (rpe > 0) {
          rpeSum += rpe
          rpeCount++
        }

        const seriesVol = reps * weight
        totalVolumeKg += seriesVol

        if (completedAt) {
          const dayKey = completedAt.slice(0, 10)
          sessionDaysSet[dayKey] = (sessionDaysSet[dayKey] || 0) + 1
        }

        if (!exerciseMap[exName]) {
          exerciseMap[exName] = {
            firstWeight: weight,
            lastWeight: weight,
            maxWeight: weight,
            count: 1,
          }
        } else {
          exerciseMap[exName].lastWeight = weight
          if (weight > exerciseMap[exName].maxWeight) {
            exerciseMap[exName].maxWeight = weight
          }
          exerciseMap[exName].count++
        }
      }

      const distinctDays = Object.keys(sessionDaysSet).length
      const avgRpe = rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : 0

      const topExercises = Object.keys(exerciseMap)
        .map(function (name) {
          const item = exerciseMap[name]
          const delta = item.lastWeight - item.firstWeight
          const pct = item.firstWeight > 0 ? Math.round((delta / item.firstWeight) * 100) : 0
          return {
            name: name,
            firstWeight: item.firstWeight,
            lastWeight: item.lastWeight,
            maxWeight: item.maxWeight,
            deltaKg: delta,
            progressionPct: pct,
            setsCount: item.count,
          }
        })
        .sort(function (a, b) {
          return b.setsCount - a.setsCount
        })
        .slice(0, 4)

      const metrics = {
        totalLogs: allLogs.length,
        distinctDays: distinctDays,
        totalVolumeKg: Math.round(totalVolumeKg),
        avgRpe: avgRpe,
        topExercises: topExercises,
      }

      const prompt =
        'Com base nos dados reais do aluno:\n' +
        '- Séries realizadas: ' +
        metrics.totalLogs +
        '\n' +
        '- Dias de treino: ' +
        metrics.distinctDays +
        '\n' +
        '- Volume acumulado: ' +
        metrics.totalVolumeKg +
        ' kg\n' +
        '- RPE médio de esforço: ' +
        metrics.avgRpe +
        '/10\n' +
        '- Exercícios mais frequentes: ' +
        metrics.topExercises
          .map(function (x) {
            return (
              x.name +
              ' (' +
              x.firstWeight +
              'kg -> ' +
              x.lastWeight +
              'kg, ' +
              (x.deltaKg >= 0 ? '+' : '') +
              x.progressionPct +
              '%)'
            )
          })
          .join(', ') +
        '\n\nEscreva um RESUMO MOTIVACIONAL PARA O ALUNO contendo ESTRITAMENTE de 3 a 5 pontos (cada um começando com "- "), em linguagem simples, direta e empática, destacando a constância, os maiores ganhos de força e dicas práticas para a próxima semana. Sem termos médicos complexos.'

      let summaryText = ''
      try {
        const agentResult = $ai.agent('analista-evolucao').chat({
          user_id: studentId,
          message: prompt,
        })
        summaryText = agentResult.content || ''
      } catch (err) {
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é o Analista de Evolução 369 da 369WELLNESS. Produza de 3 a 5 pontos (com marcadores "- ") simples e objetivos sobre o progresso do aluno.',
            },
            { role: 'user', content: prompt },
          ],
        })
        summaryText = reply.choices[0].message.content
      }

      // Extrair os pontos como array
      const lines = summaryText
        .split('\n')
        .map(function (l) {
          return l.trim()
        })
        .filter(function (l) {
          return l.startsWith('- ') || l.startsWith('* ') || /^\d+\./.test(l)
        })
        .map(function (l) {
          return l.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '')
        })

      const points = lines.length >= 3 ? lines.slice(0, 5) : [summaryText]

      // Salvar resumo no ai_insights
      try {
        const insightsCol = $app.findCollectionByNameOrId('ai_insights')
        const rec = new Record(insightsCol)
        rec.set('professional', authUser.getString('linked_professional') || studentId)
        rec.set('student', studentId)
        rec.set('insight_type', 'resumo_aluno')
        rec.set('content', summaryText)
        rec.set('metrics_snapshot', metrics)
        rec.set('generated_by', 'analista-evolucao')
        rec.set('model', 'analista-evolucao')
        $app.save(rec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        points: points,
        raw_content: summaryText,
        metrics: metrics,
        has_data: true,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao gerar resumo para o aluno' })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 3. POST /backend/v1/ai/analista/import-csv (Enriquecimento com planilha)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/ai/analista/import-csv',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) return e.unauthorizedError('Autenticação necessária')

      const profId = authUser.id
      const profRole = authUser.getString('role')
      if (profRole !== 'profissional' && profRole !== 'admin') {
        return e.forbiddenError('Acesso restrito a profissionais.')
      }

      const body = e.requestInfo().body || {}
      const studentId = (body.student_id || '').trim()
      const fileName = (body.file_name || 'planilha_treinos.csv').trim()
      const rowCount = Number(body.row_count || 0)
      const parsedSummary = body.parsed_summary || {}

      if (!studentId) {
        return e.badRequestError('student_id é obrigatório.')
      }

      // Restrição LGPD (inline)
      if (profRole !== 'admin') {
        let isAllowed = false
        try {
          const studentUser = $app.findRecordById('users', studentId)
          if (studentUser && studentUser.getString('linked_professional') === profId) {
            isAllowed = true
          }
        } catch (_) {}

        if (!isAllowed) {
          try {
            const appts = $app.findRecordsByFilter(
              'appointments',
              "profissional = '" + profId + "' && aluno = '" + studentId + "'",
              '-created',
              1,
              0,
            )
            if (appts && appts.length > 0) isAllowed = true
          } catch (_) {}
        }

        if (!isAllowed) {
          try {
            const w = $app.findRecordsByFilter(
              'workouts',
              "professional = '" + profId + "' && student = '" + studentId + "'",
              '-created',
              1,
              0,
            )
            if (w && w.length > 0) isAllowed = true
          } catch (_) {}
        }

        if (!isAllowed) {
          return e.forbiddenError('LGPD: Não autorizado a importar dados para este aluno.')
        }
      }

      // Persistir o registro do CSV em ai_csv_imports
      const csvCol = $app.findCollectionByNameOrId('ai_csv_imports')
      const rec = new Record(csvCol)
      rec.set('professional', profId)
      rec.set('student', studentId)
      rec.set('file_name', fileName)
      rec.set('row_count', rowCount)
      rec.set('columns_detected', body.columns_detected || [])
      rec.set('parsed_summary', parsedSummary)
      rec.set('import_status', 'processado')
      $app.save(rec)

      return e.json(200, {
        success: true,
        csv_import_id: rec.id,
        file_name: fileName,
        row_count: rowCount,
        message: 'Planilha CSV processada com sucesso e vinculada ao aluno.',
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao importar planilha CSV' })
    }
  },
  $apis.requireAuth(),
)

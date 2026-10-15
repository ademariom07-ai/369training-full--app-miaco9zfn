// Personal progress only: never creates services, fees or ranking events.
routerAdd('POST', '/backend/v1/workouts/progress', (e) => {
  if (!e.auth?.id) return e.json(401, { error: 'Autenticação necessária.' })
  const body = e.requestInfo().body || {}
  const allowed = body.action === 'complete' ? ['workoutId', 'action'] : ['workoutId', 'action', 'exerciseId', 'completed']
  if (typeof body.workoutId !== 'string' || !body.workoutId || body.workoutId.length > 100 ||
      !['exercise', 'complete'].includes(body.action) || Object.keys(body).some(key => !allowed.includes(key)) ||
      (body.action === 'exercise' && (typeof body.exerciseId !== 'string' || !body.exerciseId || typeof body.completed !== 'boolean'))) {
    return e.json(400, { error: 'Informe apenas a identificação do treino e o progresso.' })
  }
  try {
    let result
    $app.runInTransaction((app) => {
      let workout
      try { workout = app.findRecordById('workouts', body.workoutId) } catch (_) {
        result = { code: 404, data: { error: 'Treino indisponível.' } }; return
      }
      const user = app.findRecordById('users', e.auth.id)
      if (user.getString('role') !== 'aluno' || workout.getString('student') !== user.id) {
        result = { code: 404, data: { error: 'Treino indisponível.' } }; return
      }
      const status = workout.getString('status')
      if (!['ativo', 'concluido'].includes(status)) {
        result = { code: 409, data: { error: 'Este treino não permite registrar progresso.' } }; return
      }
      const exercises = JSON.parse(workout.getString('exercises') || 'null')
      if (!Array.isArray(exercises) || !exercises.length || exercises.some(ex => !ex || typeof ex.id !== 'string' || !ex.id) || new Set(exercises.map(ex => ex.id)).size !== exercises.length) {
        result = { code: 409, data: { error: 'Exercícios precisam de revisão pelo profissional.' } }; return
      }
      let changed = false
      if (body.action === 'complete') {
        if (!exercises.every(ex => ex.completed === true)) {
          result = { code: 409, data: { error: 'Conclua todos os exercícios antes de finalizar.' } }; return
        }
        if (status !== 'concluido') { workout.set('status', 'concluido'); changed = true }
      } else {
        if (status !== 'ativo') { result = { code: 409, data: { error: 'Treino finalizado não pode ser reaberto por este fluxo.' } }; return }
        const index = exercises.findIndex(ex => ex.id === body.exerciseId)
        if (index < 0) { result = { code: 404, data: { error: 'Exercício indisponível.' } }; return }
        if (exercises[index].completed !== body.completed) {
          exercises[index].completed = body.completed
          workout.set('exercises', exercises)
          changed = true
        }
      }
      if (changed) app.save(workout)
      result = { code: 200, data: { id: workout.id, status: workout.getString('status'), exercises, serviceCreated: false, pointsAwarded: false } }
    })
    return e.json(result.code, result.data)
  } catch (_) {
    return e.json(500, { error: 'Não foi possível registrar o progresso.' })
  }
}, $apis.requireAuth())

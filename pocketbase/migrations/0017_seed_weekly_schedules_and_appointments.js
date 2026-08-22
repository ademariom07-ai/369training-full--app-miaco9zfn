migrate(
  (app) => {
    try {
      const users = app.findRecordsByFilter('users', 'role = "profissional"', '', 10, 0)
      const students = app.findRecordsByFilter('users', 'role = "aluno"', '', 10, 0)
      if (!users || users.length === 0) return

      const prof = users[0]
      const student = students && students.length > 0 ? students[0] : null
      const student2 = students && students.length > 1 ? students[1] : student

      const schedCol = app.findCollectionByNameOrId('weekly_schedules')
      const appCol = app.findCollectionByNameOrId('appointments')

      // Calculate next week's dates (Monday to Sunday)
      const today = new Date()
      const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday
      const distanceToNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + distanceToNextMonday)

      const dayNames = [
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
        'Domingo',
      ]

      const createdSchedules = []

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(nextMonday)
        currentDate.setDate(nextMonday.getDate() + i)
        const dateStr = currentDate.toISOString().slice(0, 10)
        const dayName = dayNames[i]

        // Schedule 1: Morning 08:00 - 12:00
        const sched1 = new Record(schedCol)
        sched1.set('profissional', prof.id)
        sched1.set('dia_da_semana', dayName)
        sched1.set('data', dateStr)
        sched1.set('hora_inicio', '08:00')
        sched1.set('hora_fim', '12:00')
        // Let Sunday be blocked/unavailable
        sched1.set('disponivel', i !== 6)
        app.save(sched1)
        createdSchedules.push(sched1)

        // Schedule 2: Afternoon 14:00 - 18:00 (for weekdays)
        if (i < 5) {
          const sched2 = new Record(schedCol)
          sched2.set('profissional', prof.id)
          sched2.set('dia_da_semana', dayName)
          sched2.set('data', dateStr)
          sched2.set('hora_inicio', '14:00')
          sched2.set('hora_fim', '18:00')
          sched2.set('disponivel', true)
          app.save(sched2)
          createdSchedules.push(sched2)
        }
      }

      // Seed a couple of initial appointments
      if (student && createdSchedules.length > 0) {
        const app1 = new Record(appCol)
        app1.set('profissional', prof.id)
        app1.set('aluno', student.id)
        app1.set('schedule', createdSchedules[0].id)
        app1.set('servico_tipo', 'treino')
        app1.set('status', 'confirmado')
        app1.set('valor', 150.0)
        app1.set('taxa_extra', 0)
        app.save(app1)
      }

      if (student2 && createdSchedules.length > 1) {
        const app2 = new Record(appCol)
        app2.set('profissional', prof.id)
        app2.set('aluno', student2.id)
        app2.set('schedule', createdSchedules[1].id)
        app2.set('servico_tipo', 'nutrição')
        app2.set('status', 'pendente')
        app2.set('valor', 200.0)
        app2.set('taxa_extra', 100.0) // Aluno fora da lista: 50% de 200 = 100
        app.save(app2)
      }
    } catch (e) {
      console.log('Error seeding weekly schedules and appointments:', e.message)
    }
  },
  (app) => {
    // Revert logic
    try {
      const appCol = app.findCollectionByNameOrId('appointments')
      app.truncateCollection(appCol)
    } catch (_) {}
    try {
      const schedCol = app.findCollectionByNameOrId('weekly_schedules')
      app.truncateCollection(schedCol)
    } catch (_) {}
  },
)

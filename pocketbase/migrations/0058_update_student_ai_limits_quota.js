migrate(
  (app) => {
    try {
      const configRec = app.findFirstRecordByData('platform_config', 'key', 'student_ai_limits')
      if (configRec) {
        configRec.set('value', {
          gratis: {
            workouts_per_month: 5,
            messages_per_month: 0,
            smartwatch_sleep_adjustment: false,
            menstrual_cycle_module: false,
          },
          basico: {
            workouts_per_month: 30,
            messages_per_month: 0,
            smartwatch_sleep_adjustment: false,
            menstrual_cycle_module: false,
          },
          pro: {
            workouts_per_month: 9999,
            messages_per_month: 10,
            smartwatch_sleep_adjustment: true,
            menstrual_cycle_module: false,
          },
          premium: {
            workouts_per_month: 9999,
            messages_per_month: 60,
            smartwatch_sleep_adjustment: true,
            menstrual_cycle_module: true,
          },
        })
        configRec.set(
          'description',
          'Franquias mensais de IA do Aluno: Grátis (5 treinos), Básico (30 treinos), Pro (ilimitado, 10 msgs, smartwatch), Premium (ilimitado, 60 msgs, ciclo menstrual)',
        )
        app.save(configRec)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const configRec = app.findFirstRecordByData('platform_config', 'key', 'student_ai_limits')
      if (configRec) {
        configRec.set('value', {
          gratis: {
            workouts_per_month: 0,
            messages_per_month: 0,
            smartwatch_sleep_adjustment: false,
            menstrual_cycle_module: false,
          },
          basico: {
            workouts_per_month: 4,
            messages_per_month: 0,
            smartwatch_sleep_adjustment: false,
            menstrual_cycle_module: false,
          },
          pro: {
            workouts_per_month: 12,
            messages_per_month: 10,
            smartwatch_sleep_adjustment: true,
            menstrual_cycle_module: false,
          },
          premium: {
            workouts_per_month: 9999,
            messages_per_month: 60,
            smartwatch_sleep_adjustment: true,
            menstrual_cycle_module: true,
          },
        })
        app.save(configRec)
      }
    } catch (_) {}
  },
)

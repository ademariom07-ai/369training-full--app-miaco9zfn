migrate(
  (app) => {
    // 1. weekly_schedules
    const weeklySchedules = new Collection({
      name: 'weekly_schedules',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'profissional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'dia_da_semana', type: 'text', required: false },
        { name: 'data', type: 'text', required: false },
        { name: 'hora_inicio', type: 'text', required: true },
        { name: 'hora_fim', type: 'text', required: true },
        { name: 'disponivel', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_weekly_sched_prof ON weekly_schedules (profissional)',
        'CREATE INDEX idx_weekly_sched_data ON weekly_schedules (data)',
      ],
    })
    app.save(weeklySchedules)

    // 2. appointments
    const appointments = new Collection({
      name: 'appointments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'profissional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'aluno',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'schedule',
          type: 'relation',
          collectionId: weeklySchedules.id,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'servico_tipo',
          type: 'select',
          values: ['treino', 'nutrição', 'fisioterapia', 'artes_marciais'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'confirmado', 'concluído', 'cancelado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'valor', type: 'number', min: 0, required: true },
        { name: 'taxa_extra', type: 'number', min: 0, required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_appointments_prof ON appointments (profissional)',
        'CREATE INDEX idx_appointments_aluno ON appointments (aluno)',
        'CREATE INDEX idx_appointments_sched ON appointments (schedule)',
        'CREATE INDEX idx_appointments_status ON appointments (status)',
      ],
    })
    app.save(appointments)
  },
  (app) => {
    try {
      const appointments = app.findCollectionByNameOrId('appointments')
      app.delete(appointments)
    } catch (_) {}
    try {
      const weeklySchedules = app.findCollectionByNameOrId('weekly_schedules')
      app.delete(weeklySchedules)
    } catch (_) {}
  },
)

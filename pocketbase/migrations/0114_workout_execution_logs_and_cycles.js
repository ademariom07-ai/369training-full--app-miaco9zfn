/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Adicionar campos semana_ciclo e periodizacao na coleção workouts
    const workoutsCol = app.findCollectionByNameOrId('workouts')
    if (!workoutsCol.fields.getByName('week_number')) {
      workoutsCol.fields.add(
        new NumberField({
          name: 'week_number',
          required: false,
          min: 1,
          max: 52,
          onlyInt: true,
        }),
      )
    }
    if (!workoutsCol.fields.getByName('week_focus')) {
      workoutsCol.fields.add(
        new TextField({
          name: 'week_focus',
          required: false,
        }),
      )
    }
    if (!workoutsCol.fields.getByName('cycle_name')) {
      workoutsCol.fields.add(
        new TextField({
          name: 'cycle_name',
          required: false,
        }),
      )
    }
    app.save(workoutsCol)

    // 2. Criar coleção workout_logs para armazenar séries e execuções reais de cada treino
    if (!app.hasTable('workout_logs')) {
      const usersColId = '_pb_users_auth_'
      const workoutsColId = workoutsCol.id

      const workoutLogs = new Collection({
        name: 'workout_logs',
        type: 'base',
        // RLS: Aluno e profissional vinculado (ou admin) podem listar e ver.
        // O aluno pode criar registros para si próprio.
        // O aluno pode atualizar registros próprios. O profissional vinculado também pode ver/avaliar.
        listRule:
          "@request.auth.id != '' && (student = @request.auth.id || professional = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (student = @request.auth.id || professional = @request.auth.id || @request.auth.role = 'admin')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.student = @request.auth.id || (@request.auth.role = 'profissional' && @request.body.professional = @request.auth.id))",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || student = @request.auth.id || professional = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || student = @request.auth.id || professional = @request.auth.id)",
        fields: [
          {
            name: 'workout',
            type: 'relation',
            required: true,
            collectionId: workoutsColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'professional',
            type: 'relation',
            required: false,
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'exercise_id',
            type: 'text',
            required: true,
          },
          {
            name: 'exercise_name',
            type: 'text',
            required: true,
          },
          {
            name: 'set_index',
            type: 'number',
            required: true,
            min: 1,
            onlyInt: true,
          },
          {
            name: 'reps_done',
            type: 'number',
            required: false,
            min: 0,
            onlyInt: true,
          },
          {
            name: 'weight_used',
            type: 'number',
            required: false,
            min: 0,
          },
          {
            name: 'rpe_difficulty',
            type: 'number',
            required: false,
            min: 0,
            max: 10,
            onlyInt: true,
          },
          {
            name: 'duration_seconds',
            type: 'number',
            required: false,
            min: 0,
            onlyInt: true,
          },
          {
            name: 'week_number',
            type: 'number',
            required: false,
            min: 1,
            max: 52,
            onlyInt: true,
          },
          {
            name: 'completed_at',
            type: 'date',
            required: false,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
          {
            name: 'suggested_progression',
            type: 'text',
            required: false,
          },
          {
            name: 'professional_feedback',
            type: 'text',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_wlogs_workout ON workout_logs (workout)',
          'CREATE INDEX idx_wlogs_student ON workout_logs (student)',
          'CREATE INDEX idx_wlogs_prof ON workout_logs (professional)',
          'CREATE INDEX idx_wlogs_created ON workout_logs (created)',
        ],
      })
      app.save(workoutLogs)
    }
  },
  (app) => {
    try {
      const workoutLogs = app.findCollectionByNameOrId('workout_logs')
      app.delete(workoutLogs)
    } catch (_) {}

    try {
      const workoutsCol = app.findCollectionByNameOrId('workouts')
      const weekNum = workoutsCol.fields.getByName('week_number')
      if (weekNum) workoutsCol.fields.removeByName('week_number')
      const weekFocus = workoutsCol.fields.getByName('week_focus')
      if (weekFocus) workoutsCol.fields.removeByName('week_focus')
      const cycleName = workoutsCol.fields.getByName('cycle_name')
      if (cycleName) workoutsCol.fields.removeByName('cycle_name')
      app.save(workoutsCol)
    } catch (_) {}
  },
)

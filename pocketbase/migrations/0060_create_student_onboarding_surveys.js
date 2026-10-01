migrate(
  (app) => {
    // Nova coleção student_onboarding_surveys para armazenar as respostas do questionário de objetivos
    // aplicado no ato da inscrição do aluno.
    if (!app.hasTable('student_onboarding_surveys')) {
      const surveyCol = new Collection({
        name: 'student_onboarding_surveys',
        type: 'base',
        // list e view: o próprio aluno dono ou admin
        listRule:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')",
        createRule: "@request.auth.id != ''",
        updateRule:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')",
        deleteRule:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'main_goal',
            type: 'text',
            required: true,
          },
          {
            name: 'training_frequency',
            type: 'text',
            required: true,
          },
          {
            name: 'experience_level',
            type: 'text',
            required: true,
          },
          {
            name: 'health_limitations',
            type: 'text',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_student_survey_user ON student_onboarding_surveys (user)',
          'CREATE INDEX idx_student_survey_created ON student_onboarding_surveys (created)',
        ],
      })
      app.save(surveyCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('student_onboarding_surveys')
      app.delete(col)
    } catch (_) {}
  },
)

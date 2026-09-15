migrate(
  (app) => {
    // 1. group_sessions collection
    const groupSessions = new Collection({
      name: 'group_sessions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'profissional'",
      updateRule:
        "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
      deleteRule:
        "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
      fields: [
        {
          name: 'professional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'title', type: 'text', required: true },
        {
          name: 'specialty',
          type: 'select',
          values: ['educacao_fisica', 'nutricao', 'fisioterapia', 'artes_marciais', 'psicologia'],
          maxSelect: 1,
          required: true,
        },
        { name: 'date', type: 'text', required: true },
        { name: 'start_time', type: 'text', required: true },
        { name: 'end_time', type: 'text', required: false },
        { name: 'location', type: 'text', required: false },
        { name: 'max_capacity', type: 'number', min: 1, required: false },
        {
          name: 'status',
          type: 'select',
          values: ['agendada', 'em_andamento', 'concluida', 'cancelada'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'group_selfie',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          required: false,
        },
        { name: 'selfie_uploaded_at', type: 'date', required: false },
        { name: 'validation_window_hours', type: 'number', min: 1, required: false }, // default 24h
        { name: 'price_per_participant', type: 'number', min: 0, required: false },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_group_sessions_prof ON group_sessions (professional)',
        'CREATE INDEX idx_group_sessions_date ON group_sessions (date)',
        'CREATE INDEX idx_group_sessions_specialty ON group_sessions (specialty)',
        'CREATE INDEX idx_group_sessions_status ON group_sessions (status)',
      ],
    })
    app.save(groupSessions)

    // 2. group_session_participants collection
    const participants = new Collection({
      name: 'group_session_participants',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'session',
          type: 'relation',
          collectionId: groupSessions.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'student',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false, // Pode ser null para convidados/visitantes sem conta
        },
        { name: 'guest_name', type: 'text', required: false }, // Se visitante sem conta na plataforma
        { name: 'guest_email', type: 'text', required: false },
        {
          name: 'attendance_status',
          type: 'select',
          values: ['pendente', 'confirmado', 'ausente', 'marcado_presente'],
          maxSelect: 1,
          required: true,
        },
        { name: 'confirmed_at', type: 'date', required: false },
        { name: 'confirmation_method', type: 'text', required: false }, // 'self_app' | 'professional_manual'
        { name: 'is_registered_user', type: 'bool', required: false },
        { name: 'fee_charged', type: 'bool', required: false },
        { name: 'points_awarded', type: 'bool', required: false },
        {
          name: 'service_record',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('services').id,
          maxSelect: 1,
          required: false,
        },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_gsp_session ON group_session_participants (session)',
        'CREATE INDEX idx_gsp_student ON group_session_participants (student)',
        'CREATE INDEX idx_gsp_status ON group_session_participants (attendance_status)',
      ],
    })
    app.save(participants)
  },
  (app) => {
    try {
      const participants = app.findCollectionByNameOrId('group_session_participants')
      app.delete(participants)
    } catch (_) {}
    try {
      const groupSessions = app.findCollectionByNameOrId('group_sessions')
      app.delete(groupSessions)
    } catch (_) {}
  },
)

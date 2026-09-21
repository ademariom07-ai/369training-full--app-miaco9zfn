migrate(
  (app) => {
    // =========================================================================
    // RODADA D — BACKOFFICE DE ARTES MARCIAIS, PSICOLOGIA E FISIOTERAPIA
    // =========================================================================

    // 1. Campos extras no usuário / perfil do profissional
    const users = app.findCollectionByNameOrId('users')

    // Artes Marciais: 5 campos
    // - martial_arts_belt: graduação / faixa atual
    // - martial_arts_federation: federação afiliada
    // - martial_arts_style: estilo / linhagem / modalidade principal
    // - martial_arts_experience_years: anos de experiência
    // - martial_arts_certification: certificação / registro de mestre/instrutor
    if (!users.fields.getByName('martial_arts_belt')) {
      users.fields.add(new TextField({ name: 'martial_arts_belt' }))
    }
    if (!users.fields.getByName('martial_arts_federation')) {
      users.fields.add(new TextField({ name: 'martial_arts_federation' }))
    }
    if (!users.fields.getByName('martial_arts_style')) {
      users.fields.add(new TextField({ name: 'martial_arts_style' }))
    }
    if (!users.fields.getByName('martial_arts_experience_years')) {
      users.fields.add(new NumberField({ name: 'martial_arts_experience_years', min: 0 }))
    }
    if (!users.fields.getByName('martial_arts_certification')) {
      users.fields.add(new TextField({ name: 'martial_arts_certification' }))
    }

    // Fisioterapia:
    // - crefito: registro no CREFITO
    // - physio_experience_years: anos de experiência
    // - physio_certifications: certificações
    // - physio_specialty: especialidade fisioterapêutica (ex: traumato-ortopédica, esportiva, etc.)
    // - physio_practice_area: área de atuação
    if (!users.fields.getByName('crefito')) {
      users.fields.add(new TextField({ name: 'crefito' }))
    }
    if (!users.fields.getByName('physio_experience_years')) {
      users.fields.add(new NumberField({ name: 'physio_experience_years', min: 0 }))
    }
    if (!users.fields.getByName('physio_certifications')) {
      users.fields.add(new TextField({ name: 'physio_certifications' }))
    }
    if (!users.fields.getByName('physio_specialty')) {
      users.fields.add(new TextField({ name: 'physio_specialty' }))
    }
    if (!users.fields.getByName('physio_practice_area')) {
      users.fields.add(new TextField({ name: 'physio_practice_area' }))
    }

    app.save(users)

    // 2. Coleção clinical_records (Prontuário com Regras RLS estritas e Sigilo Absoluto)
    // Sigilo estrito de Psicologia e Fisioterapia:
    // Para category = 'psicologia' ou 'fisioterapia', SOMENTE o profissional responsável pode listar/visualizar/editar.
    // Nem mesmo admin ou outros profissionais podem ver o conteúdo.
    // Para outros tipos ('geral', 'artes_marciais', 'educacao_fisica', 'nutricao'):
    // O profissional responsável ou o aluno dono podem ler.
    if (!app.hasTable('clinical_records')) {
      const clinicalRecords = new Collection({
        name: 'clinical_records',
        type: 'base',
        // listRule e viewRule:
        // - Se psicologia ou fisioterapia: SOMENTE o profissional responsável que criou
        // - Se geral/outros: o profissional responsável ou o próprio aluno
        listRule:
          "@request.auth.id != '' && (" +
          "((category = 'psicologia' || category = 'fisioterapia') && professional = @request.auth.id) || " +
          "(category != 'psicologia' && category != 'fisioterapia' && (professional = @request.auth.id || student = @request.auth.id))" +
          ')',
        viewRule:
          "@request.auth.id != '' && (" +
          "((category = 'psicologia' || category = 'fisioterapia') && professional = @request.auth.id) || " +
          "(category != 'psicologia' && category != 'fisioterapia' && (professional = @request.auth.id || student = @request.auth.id))" +
          ')',
        createRule:
          "@request.auth.id != '' && @request.auth.role = 'profissional' && @request.body.professional = @request.auth.id",
        updateRule:
          "@request.auth.id != '' && @request.auth.role = 'profissional' && professional = @request.auth.id",
        deleteRule:
          "@request.auth.id != '' && @request.auth.role = 'profissional' && professional = @request.auth.id",
        fields: [
          {
            name: 'professional',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'category',
            type: 'select',
            required: true,
            values: [
              'geral',
              'psicologia',
              'fisioterapia',
              'artes_marciais',
              'educacao_fisica',
              'nutricao',
            ],
            maxSelect: 1,
          },
          { name: 'title', type: 'text', required: true },
          { name: 'summary', type: 'text' },
          { name: 'confidential_notes', type: 'text' },
          { name: 'pain_level', type: 'number', min: 0, max: 10 },
          { name: 'mobility_tests', type: 'json' },
          { name: 'protocol_phase', type: 'text' },
          { name: 'functional_goals', type: 'text' },
          { name: 'weight_kg', type: 'number' },
          { name: 'body_fat_pct', type: 'number' },
          { name: 'metadata', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_clinical_prof ON clinical_records (professional)',
          'CREATE INDEX idx_clinical_student ON clinical_records (student)',
          'CREATE INDEX idx_clinical_cat ON clinical_records (category)',
          'CREATE INDEX idx_clinical_created ON clinical_records (created)',
        ],
      })
      app.save(clinicalRecords)
    }

    // 3. Coleção clinical_session_logs (Visão resumida e não confidencial para transparência)
    // Permite que outros profissionais saibam que houve sessão sem expor o conteúdo clínico sigiloso
    // "Fora do módulo, outros perfis veem apenas 'Sessão registrada', nunca o conteúdo"
    if (!app.hasTable('clinical_session_logs')) {
      const sessionLogs = new Collection({
        name: 'clinical_session_logs',
        type: 'base',
        // Qualquer profissional ou aluno participante pode ver a existência da sessão
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'profissional' || student = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'profissional' || student = @request.auth.id)",
        createRule:
          "@request.auth.id != '' && @request.auth.role = 'profissional' && @request.body.professional = @request.auth.id",
        updateRule:
          "@request.auth.id != '' && @request.auth.role = 'profissional' && professional = @request.auth.id",
        deleteRule:
          "@request.auth.id != '' && @request.auth.role = 'profissional' && professional = @request.auth.id",
        fields: [
          {
            name: 'professional',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'category',
            type: 'select',
            required: true,
            values: ['psicologia', 'fisioterapia', 'artes_marciais', 'educacao_fisica', 'nutricao'],
            maxSelect: 1,
          },
          { name: 'public_status', type: 'text', required: true },
          { name: 'session_date', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_csl_student ON clinical_session_logs (student)',
          'CREATE INDEX idx_csl_prof ON clinical_session_logs (professional)',
          'CREATE INDEX idx_csl_date ON clinical_session_logs (session_date)',
        ],
      })
      app.save(sessionLogs)
    }

    // 4. Coleção martial_arts_progress (Evolução Técnica, Graduações e Desempenho)
    if (!app.hasTable('martial_arts_progress')) {
      const maProgress = new Collection({
        name: 'martial_arts_progress',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (professional = @request.auth.id || student = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (professional = @request.auth.id || student = @request.auth.id || @request.auth.role = 'admin')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && @request.body.professional = @request.auth.id))",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional = @request.auth.id))",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'profissional' && professional = @request.auth.id))",
        fields: [
          {
            name: 'professional',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'modality', type: 'text', required: true },
          { name: 'current_belt', type: 'text', required: true },
          { name: 'next_belt', type: 'text' },
          { name: 'degrees', type: 'number', min: 0, max: 10 },
          { name: 'mastered_techniques', type: 'json' },
          { name: 'performance_score', type: 'number', min: 0, max: 100 },
          { name: 'notes', type: 'text' },
          { name: 'graduation_date', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_map_student ON martial_arts_progress (student)',
          'CREATE INDEX idx_map_prof ON martial_arts_progress (professional)',
        ],
      })
      app.save(maProgress)
    }
  },
  (app) => {
    try {
      const maProg = app.findCollectionByNameOrId('martial_arts_progress')
      app.delete(maProg)
    } catch (_) {}

    try {
      const csl = app.findCollectionByNameOrId('clinical_session_logs')
      app.delete(csl)
    } catch (_) {}

    try {
      const cr = app.findCollectionByNameOrId('clinical_records')
      app.delete(cr)
    } catch (_) {}

    try {
      const users = app.findCollectionByNameOrId('users')
      const fieldsToRemove = [
        'martial_arts_belt',
        'martial_arts_federation',
        'martial_arts_style',
        'martial_arts_experience_years',
        'martial_arts_certification',
        'crefito',
        'physio_experience_years',
        'physio_certifications',
        'physio_specialty',
        'physio_practice_area',
      ]
      fieldsToRemove.forEach((name) => {
        const f = users.fields.getByName(name)
        if (f) users.fields.removeByName(name)
      })
      app.save(users)
    } catch (_) {}
  },
)

migrate(
  (app) => {
    // 1. Criar coleção legal_documents
    if (!app.hasTable('legal_documents')) {
      const colLegalDocs = new Collection({
        name: 'legal_documents',
        type: 'base',
        listRule: "status = 'publicado' || @request.auth.role = 'admin'",
        viewRule: "status = 'publicado' || @request.auth.role = 'admin'",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          { name: 'slug', type: 'text', required: true },
          { name: 'title', type: 'text', required: true },
          { name: 'body', type: 'editor' },
          { name: 'version', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['rascunho', 'publicado', 'arquivado'],
            maxSelect: 1,
          },
          {
            name: 'audience',
            type: 'select',
            required: true,
            values: ['aluno', 'profissional', 'todos'],
            maxSelect: 1,
          },
          { name: 'published_at', type: 'date' },
          {
            name: 'updated_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'version_history', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_legal_docs_slug ON legal_documents (slug)',
          'CREATE INDEX idx_legal_docs_status ON legal_documents (status)',
        ],
      })
      app.save(colLegalDocs)
    }

    // 2. Criar coleção legal_acceptances
    if (!app.hasTable('legal_acceptances')) {
      const colLegalDocs = app.findCollectionByNameOrId('legal_documents')
      const colAcceptances = new Collection({
        name: 'legal_acceptances',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')",
        createRule: "@request.auth.id != '' || @request.body.user != ''",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          {
            name: 'document',
            type: 'relation',
            required: true,
            collectionId: colLegalDocs.id,
            maxSelect: 1,
          },
          { name: 'document_slug', type: 'text' },
          { name: 'version', type: 'number', required: true },
          { name: 'accepted_at', type: 'date', required: true },
          { name: 'ip', type: 'text' },
          { name: 'user_agent', type: 'text' },
          { name: 'consent_type', type: 'text' }, // 'termos_aluno' | 'contrato_parceria' | 'politica_privacidade' | 'dados_sensiveis_saude_art11' | etc.
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_legal_acc_user ON legal_acceptances (user)',
          'CREATE INDEX idx_legal_acc_doc ON legal_acceptances (document)',
        ],
      })
      app.save(colAcceptances)
    }

    // 3. Criar coleção credential_verifications
    if (!app.hasTable('credential_verifications')) {
      const colCreds = new Collection({
        name: 'credential_verifications',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
        createRule: "@request.auth.id != '' || @request.body.professional != ''",
        updateRule:
          "@request.auth.role = 'admin' || (@request.auth.id = professional && status = 'pendente')",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'professional',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          {
            name: 'council',
            type: 'select',
            required: true,
            values: ['CREF', 'CRN', 'CREFITO', 'CRP', 'FEDERACAO'],
            maxSelect: 1,
          },
          { name: 'registration_number', type: 'text', required: true },
          {
            name: 'document_file',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760, // 10MB
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
          },
          {
            name: 'document_url_fallback',
            type: 'text',
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'verificado', 'reprovado'],
            maxSelect: 1,
          },
          {
            name: 'reviewed_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'reviewed_at', type: 'date' },
          { name: 'review_notes', type: 'text' },
          { name: 'expires_at', type: 'date' }, // Revalidação anual
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_cred_prof ON credential_verifications (professional)',
          'CREATE INDEX idx_cred_status ON credential_verifications (status)',
        ],
      })
      app.save(colCreds)
    }
  },
  (app) => {
    try {
      const c1 = app.findCollectionByNameOrId('credential_verifications')
      app.delete(c1)
    } catch (_) {}
    try {
      const c2 = app.findCollectionByNameOrId('legal_acceptances')
      app.delete(c2)
    } catch (_) {}
    try {
      const c3 = app.findCollectionByNameOrId('legal_documents')
      app.delete(c3)
    } catch (_) {}
  },
)

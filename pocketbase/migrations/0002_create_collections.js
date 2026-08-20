migrate(
  (app) => {
    // 1. referrals
    const referrals = new Collection({
      name: 'referrals',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'referrer',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'referred',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'level', type: 'number', min: 1, max: 36, required: false },
        { name: 'code', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_referrals_referrer ON referrals (referrer)',
        'CREATE UNIQUE INDEX idx_referrals_referred ON referrals (referred)',
      ],
    })
    app.save(referrals)

    // 2. services
    const services = new Collection({
      name: 'services',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'professional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'student',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'type', type: 'text', required: true },
        { name: 'title', type: 'text', required: false },
        { name: 'value', type: 'number', min: 0, required: true },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'concluido', 'cancelado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'scheduled_at', type: 'date', required: false },
        { name: 'completed_at', type: 'date', required: false },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_services_prof ON services (professional)',
        'CREATE INDEX idx_services_student ON services (student)',
        'CREATE INDEX idx_services_status ON services (status)',
      ],
    })
    app.save(services)

    // 3. workouts
    const workouts = new Collection({
      name: 'workouts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'professional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        },
        {
          name: 'student',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'objective', type: 'text', required: false },
        { name: 'exercises', type: 'json', required: false },
        { name: 'day', type: 'text', required: false },
        { name: 'valid_until', type: 'date', required: false },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'concluido', 'arquivado'],
          maxSelect: 1,
          required: false,
        },
        { name: 'ai_generated', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_workouts_student ON workouts (student)',
        'CREATE INDEX idx_workouts_prof ON workouts (professional)',
      ],
    })
    app.save(workouts)

    // 4. diets
    const diets = new Collection({
      name: 'diets',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'professional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        },
        {
          name: 'student',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'meals', type: 'json', required: false },
        { name: 'calories', type: 'number', required: false },
        { name: 'macros', type: 'json', required: false },
        { name: 'valid_until', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_diets_student ON diets (student)'],
    })
    app.save(diets)

    // 5. protocols
    const protocols = new Collection({
      name: 'protocols',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'professional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        },
        {
          name: 'student',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'steps', type: 'json', required: false },
        { name: 'pain_level', type: 'number', min: 0, max: 10, required: false },
        { name: 'mobility_tests', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_protocols_student ON protocols (student)'],
    })
    app.save(protocols)

    // 6. martial_arts_sessions
    const martialArtsSessions = new Collection({
      name: 'martial_arts_sessions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'professional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        },
        {
          name: 'student',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'modality', type: 'text', required: true },
        { name: 'technique_videos', type: 'json', required: false },
        { name: 'attendance', type: 'bool', required: false },
        { name: 'belt_level', type: 'text', required: false },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_ma_student ON martial_arts_sessions (student)'],
    })
    app.save(martialArtsSessions)

    // 7. wallet_transactions
    const walletTransactions = new Collection({
      name: 'wallet_transactions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'type',
          type: 'select',
          values: ['deposito', 'saque', 'cashback', 'tarifa', 'servico'],
          maxSelect: 1,
          required: true,
        },
        { name: 'amount', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'concluido', 'rejeitado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'comprovante', type: 'text', required: false },
        { name: 'pix_code', type: 'text', required: false },
        { name: 'reference_type', type: 'text', required: false },
        { name: 'reference_id', type: 'text', required: false },
        { name: 'description', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wallet_user ON wallet_transactions (user)',
        'CREATE INDEX idx_wallet_type ON wallet_transactions (type)',
        'CREATE INDEX idx_wallet_status ON wallet_transactions (status)',
      ],
    })
    app.save(walletTransactions)

    // 8. rank_entries
    const rankEntries = new Collection({
      name: 'rank_entries',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'cycle', type: 'text', required: true },
        { name: 'points', type: 'number', required: true },
        { name: 'services_count', type: 'number', required: false },
        { name: 'referrals_count', type: 'number', required: false },
        { name: 'stars', type: 'number', required: false },
        { name: 'ranking_position', type: 'number', required: false },
        { name: 'tie_break_details', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_rank_user ON rank_entries (user)',
        'CREATE INDEX idx_rank_cycle ON rank_entries (cycle)',
      ],
    })
    app.save(rankEntries)

    // 9. cashback_distributions
    const cashbackDistributions = new Collection({
      name: 'cashback_distributions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'service_id',
          type: 'relation',
          collectionId: services.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'level', type: 'number', min: 1, max: 36, required: true },
        { name: 'pool_share', type: 'number', required: false },
        { name: 'variable_pct', type: 'number', required: false },
        { name: 'divisor', type: 'number', required: false },
        { name: 'modifier', type: 'number', required: false },
        { name: 'amount', type: 'number', required: true },
        { name: 'metas', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cb_user ON cashback_distributions (user)',
        'CREATE INDEX idx_cb_service ON cashback_distributions (service_id)',
      ],
    })
    app.save(cashbackDistributions)

    // 10. expert_interactions
    const expertInteractions = new Collection({
      name: 'expert_interactions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'professional',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'expert_slug', type: 'text', required: true },
        { name: 'plan_tier', type: 'text', required: false },
        { name: 'prompt', type: 'text', required: true },
        { name: 'response', type: 'text', required: false },
        { name: 'tokens_used', type: 'number', required: false },
        { name: 'timestamp', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_expert_prof ON expert_interactions (professional)',
        'CREATE INDEX idx_expert_slug ON expert_interactions (expert_slug)',
      ],
    })
    app.save(expertInteractions)

    // 11. notifications
    const notifications = new Collection({
      name: 'notifications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'type', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'text', required: true },
        { name: 'read', type: 'bool', required: false },
        { name: 'action_url', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notif_user ON notifications (user)',
        'CREATE INDEX idx_notif_read ON notifications (read)',
      ],
    })
    app.save(notifications)

    // 12. messages
    const messages = new Collection({
      name: 'messages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'sender',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'receiver',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'content', type: 'text', required: true },
        { name: 'read', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_msg_sender ON messages (sender)',
        'CREATE INDEX idx_msg_receiver ON messages (receiver)',
      ],
    })
    app.save(messages)

    // 13. community_posts
    const communityPosts = new Collection({
      name: 'community_posts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'content', type: 'text', required: true },
        { name: 'images', type: 'json', required: false },
        { name: 'likes', type: 'number', required: false },
        { name: 'category', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_posts_user ON community_posts (user)'],
    })
    app.save(communityPosts)

    // 14. achievements
    const achievements = new Collection({
      name: 'achievements',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'type', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'icon', type: 'text', required: false },
        {
          name: 'tier',
          type: 'select',
          values: ['ouro', 'prata', 'bronze'],
          maxSelect: 1,
          required: false,
        },
        { name: 'awarded_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_achievements_user ON achievements (user)'],
    })
    app.save(achievements)

    // 15. audits
    const audits = new Collection({
      name: 'audits',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'actor',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        },
        { name: 'target_type', type: 'text', required: true },
        { name: 'target_id', type: 'text', required: false },
        { name: 'action', type: 'text', required: true },
        { name: 'details', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_audits_actor ON audits (actor)'],
    })
    app.save(audits)

    // 16. platform_config
    const platformConfig = new Collection({
      name: 'platform_config',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'value', type: 'json', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_config_key ON platform_config (key)'],
    })
    app.save(platformConfig)
  },
  (app) => {
    const names = [
      'platform_config',
      'audits',
      'achievements',
      'community_posts',
      'messages',
      'notifications',
      'expert_interactions',
      'cashback_distributions',
      'rank_entries',
      'wallet_transactions',
      'martial_arts_sessions',
      'protocols',
      'diets',
      'workouts',
      'services',
      'referrals',
    ]
    for (const name of names) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)

migrate(
  (app) => {
    // 1. Coleção wearable_connections
    try {
      app.findCollectionByNameOrId('wearable_connections')
    } catch (_) {
      const wearableConnCol = new Collection({
        name: 'wearable_connections',
        type: 'base',
        listRule: "@request.auth.id != '' && user = @request.auth.id",
        viewRule: "@request.auth.id != '' && user = @request.auth.id",
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "@request.auth.id != '' && user = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user = @request.auth.id",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'provider',
            type: 'select',
            required: true,
            values: [
              'apple_watch',
              'garmin',
              'fitbit',
              'xiaomi',
              'samsung',
              'polar',
              'whoop',
              'suunto',
              'strava',
              'other',
            ],
            maxSelect: 1,
          },
          {
            name: 'aggregator',
            type: 'select',
            required: true,
            values: ['terra', 'spike'],
            maxSelect: 1,
          },
          { name: 'aggregator_user_id', type: 'text', required: false },
          { name: 'reference_id', type: 'text', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pending', 'connected', 'disconnected', 'error'],
            maxSelect: 1,
          },
          { name: 'last_sync_at', type: 'date', required: false },
          { name: 'metadata', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_wc_user ON wearable_connections (user)',
          'CREATE INDEX idx_wc_provider ON wearable_connections (provider)',
          'CREATE INDEX idx_wc_agg_user ON wearable_connections (aggregator_user_id)',
        ],
      })
      app.save(wearableConnCol)
    }

    // 2. Coleção wearable_metrics
    try {
      app.findCollectionByNameOrId('wearable_metrics')
    } catch (_) {
      const wearableMetricsCol = new Collection({
        name: 'wearable_metrics',
        type: 'base',
        listRule: "@request.auth.id != '' && user = @request.auth.id",
        viewRule: "@request.auth.id != '' && user = @request.auth.id",
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "@request.auth.id != '' && user = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user = @request.auth.id",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'provider',
            type: 'text',
            required: false,
          },
          { name: 'date', type: 'text', required: true }, // 'YYYY-MM-DD'
          { name: 'steps', type: 'number', required: false },
          { name: 'heart_rate_avg', type: 'number', required: false },
          { name: 'heart_rate_min', type: 'number', required: false },
          { name: 'heart_rate_max', type: 'number', required: false },
          { name: 'calories_active', type: 'number', required: false },
          { name: 'calories_total', type: 'number', required: false },
          { name: 'sleep_duration_seconds', type: 'number', required: false },
          { name: 'sleep_score', type: 'number', required: false },
          { name: 'workouts_count', type: 'number', required: false },
          { name: 'workouts_summary', type: 'json', required: false },
          { name: 'distance_meters', type: 'number', required: false },
          { name: 'raw_payload', type: 'json', required: false },
          { name: 'synced_at', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_wm_user_date ON wearable_metrics (user, date)',
          'CREATE INDEX idx_wm_date ON wearable_metrics (date)',
        ],
      })
      app.save(wearableMetricsCol)
    }

    // 3. Atualizar platform_config com metadados do Caminho A Smartwatch
    const configCol = app.findCollectionByNameOrId('platform_config')
    try {
      const wearRec = app.findFirstRecordByData('platform_config', 'key', 'smartwatch_integration')
      wearRec.set('value', {
        aggregator: 'terra',
        fallback_aggregator: 'spike',
        supported_brands: [
          'apple_watch',
          'garmin',
          'fitbit',
          'xiaomi',
          'samsung',
          'polar',
          'whoop',
          'suunto',
          'strava',
        ],
        metrics: ['passos', 'batimentos', 'sono', 'calorias', 'treinos', 'distancia'],
        access_rules: {
          aluno: ['gratis', 'basico', 'pro', 'premium'],
          profissional: ['pro', 'premium'],
        },
        setup_instructions:
          'Defina o segredo TERRA_API_KEY e TERRA_DEV_ID (ou SPIKE_API_KEY) para ativar as chamadas de API reais.',
      })
      app.save(wearRec)
    } catch (_) {
      const wearRec = new Record(configCol)
      wearRec.set('key', 'smartwatch_integration')
      wearRec.set('value', {
        aggregator: 'terra',
        fallback_aggregator: 'spike',
        supported_brands: [
          'apple_watch',
          'garmin',
          'fitbit',
          'xiaomi',
          'samsung',
          'polar',
          'whoop',
          'suunto',
          'strava',
        ],
        metrics: ['passos', 'batimentos', 'sono', 'calorias', 'treinos', 'distancia'],
        access_rules: {
          aluno: ['gratis', 'basico', 'pro', 'premium'],
          profissional: ['pro', 'premium'],
        },
        setup_instructions:
          'Defina o segredo TERRA_API_KEY e TERRA_DEV_ID (ou SPIKE_API_KEY) para ativar as chamadas de API reais.',
      })
      wearRec.set(
        'description',
        'Configuração da integração Smartwatch Caminho A (Terra/Spike API)',
      )
      app.save(wearRec)
    }
  },
  (app) => {
    try {
      const mCol = app.findCollectionByNameOrId('wearable_metrics')
      app.delete(mCol)
    } catch (_) {}
    try {
      const cCol = app.findCollectionByNameOrId('wearable_connections')
      app.delete(cCol)
    } catch (_) {}
  },
)

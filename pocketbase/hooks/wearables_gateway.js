// Hook para integração com Smartwatches via API agregadora (Caminho A: Terra API / Spike API)
// PREPARADO MAS INATIVO até cadastro das credenciais de segredo:
// Segredos necessários para ativação automática:
// - TERRA_API_KEY (chave de API da Terra)
// - TERRA_DEV_ID (ID de desenvolvedor da Terra)
// - TERRA_WEBHOOK_SECRET (opcional para checagem de assinatura HMAC)
// ou
// - SPIKE_API_KEY (chave de API da Spike)
//
// Endpoint 1: GET /backend/v1/wearables/status
// Retorna se a integração de smartwatch está ativa (segredos presentes) e os relógios suportados.
routerAdd('GET', '/backend/v1/wearables/status', (c) => {
  const terraKey = $os.getenv('TERRA_API_KEY') || ''
  const terraDevId = $os.getenv('TERRA_DEV_ID') || ''
  const spikeKey = $os.getenv('SPIKE_API_KEY') || ''

  const isConfigured = Boolean((terraKey && terraDevId) || spikeKey)
  const activeAggregator = terraKey && terraDevId ? 'terra' : spikeKey ? 'spike' : 'none'

  return c.json(200, {
    status: 'ok',
    is_configured: isConfigured,
    aggregator: activeAggregator,
    supported_devices: [
      { id: 'apple_watch', name: 'Apple Watch', icon: 'apple' },
      { id: 'garmin', name: 'Garmin', icon: 'watch' },
      { id: 'fitbit', name: 'Fitbit', icon: 'activity' },
      { id: 'xiaomi', name: 'Xiaomi / Mi Band', icon: 'watch' },
      { id: 'samsung', name: 'Samsung Galaxy Watch', icon: 'watch' },
      { id: 'polar', name: 'Polar', icon: 'heart' },
      { id: 'whoop', name: 'Whoop', icon: 'zap' },
      { id: 'suunto', name: 'Suunto', icon: 'compass' },
      { id: 'strava', name: 'Strava', icon: 'flame' },
    ],
    metrics_included: [
      'passos (steps)',
      'batimentos cardíacos (heart rate)',
      'sono (sleep)',
      'calorias ativas e totais (calories)',
      'treinos e atividades (workouts)',
      'distância (distance)',
    ],
    gate_rules: {
      aluno: 'Disponível em todos os planos (Grátis, Básico, Pro, Premium)',
      profissional: 'Disponível a partir do Plano Pro (Pro e Premium)',
    },
    message: isConfigured
      ? 'Integração de smartwatch ativa e pronta para conexões em tempo real.'
      : 'Integração preparada. Aguardando credenciais TERRA_API_KEY ou SPIKE_API_KEY no painel de segredos.',
  })
})

// Endpoint 2: POST /backend/v1/wearables/connect_session
// Gera a sessão de conexão do widget do agregador Terra ou Spike
routerAdd(
  'POST',
  '/backend/v1/wearables/connect_session',
  (c) => {
    const authRecord = c.auth
    if (!authRecord) {
      return c.json(401, { error: 'Usuário não autenticado.' })
    }

    const role = authRecord.get('role') || 'aluno'
    const plan = (authRecord.get('plan') || 'gratis').toLowerCase()

    // Gate de plano confirmado pelo usuário:
    // Alunos: todos os planos
    // Profissionais: a partir do plano Pro (Pro e Premium) — não disponível para Grátis ou Básico
    if (role === 'profissional' && plan !== 'pro' && plan !== 'premium') {
      return c.json(403, {
        error:
          'A sincronização com smartwatch para profissionais está disponível exclusivamente nos planos Pro e Premium.',
        upgrade_required: true,
      })
    }

    const terraKey = $os.getenv('TERRA_API_KEY') || ''
    const terraDevId = $os.getenv('TERRA_DEV_ID') || ''
    const spikeKey = $os.getenv('SPIKE_API_KEY') || ''

    if (!terraKey && !spikeKey) {
      return c.json(200, {
        is_mock_ready: true,
        is_configured: false,
        message:
          'A integração com smartwatch está em fase final de homologação. Quando a chave da API agregadora for registrada, a conexão será ativada instantaneamente.',
      })
    }

    // Se a Terra API estiver configurada
    if (terraKey && terraDevId) {
      try {
        const body = c.requestInfo().body || {}
        const siteUrl = $os.getenv('SITE_URL') || 'https://369training.com.br'

        const terraRes = $http.send({
          url: 'https://api.tryterra.co/v2/auth/generateWidgetSession',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'dev-id': terraDevId,
            'x-api-key': terraKey,
          },
          body: JSON.stringify({
            language: 'pt',
            reference_id: authRecord.id,
            auth_success_redirect_url:
              body.success_url || siteUrl + '/aluno/smartwatch?status=success',
            auth_failure_redirect_url:
              body.failure_url || siteUrl + '/aluno/smartwatch?status=failure',
          }),
          timeout: 15,
        })

        if (terraRes.statusCode >= 200 && terraRes.statusCode < 300) {
          return c.json(200, {
            status: 'ok',
            url: terraRes.json.url,
            session_id: terraRes.json.session_id,
            aggregator: 'terra',
          })
        }
      } catch (err) {
        console.error('Erro ao chamar Terra generateWidgetSession:', err)
      }
    }

    return c.json(200, {
      is_mock_ready: true,
      is_configured: false,
      message: 'Aguardando credenciais do agregador.',
    })
  },
  $apis.requireAuth(),
)

// Endpoint 3: POST /backend/v1/wearables/webhook
// Webhook para receber dados normalizados da API agregadora (Terra ou Spike)
routerAdd('POST', '/backend/v1/wearables/webhook', (c) => {
  const body = c.requestInfo().body || {}
  const rawHeaders = c.requestInfo().headers || {}

  console.log('Wearable Webhook recebido:', JSON.stringify(body))

  // O agregador envia eventos de dados de saúde:
  // No Terra: type: 'activity' | 'daily' | 'sleep' | 'body' | 'athlete'
  // No Spike: event_type: 'record_change' | 'provider_integration_created'
  const eventType = body.type || body.event_type || ''
  const terraUser = body.user || {}
  const referenceId = terraUser.reference_id || body.application_user_id || ''

  if (!referenceId) {
    return c.json(200, { status: 'acknowledged_without_user' })
  }

  try {
    let targetUser = null
    try {
      targetUser = $app.findRecordById('users', referenceId)
    } catch (_) {}

    if (!targetUser) {
      return c.json(200, { status: 'user_not_found', referenceId })
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const metricsCol = $app.findCollectionByNameOrId('wearable_metrics')

    // Tentar localizar registro do dia para o usuário
    let metricRec = null
    try {
      metricRec = $app.findRecordsByFilter(
        'wearable_metrics',
        `user = '${targetUser.id}' && date = '${todayStr}'`,
        '-created',
        1,
        0,
      )[0]
    } catch (_) {}

    if (!metricRec) {
      metricRec = new Record(metricsCol)
      metricRec.set('user', targetUser.id)
      metricRec.set('date', todayStr)
      metricRec.set('provider', terraUser.provider || body.provider_slug || 'smartwatch')
    }

    // Normalizar métricas com base no tipo de payload
    if (body.data) {
      const data = body.data
      // Se vier passos/calorias em daily
      if (data.steps !== undefined) metricRec.set('steps', Number(data.steps))
      if (data.heart_rate_data) {
        const hr = data.heart_rate_data.summary || {}
        if (hr.avg_hr_bpm) metricRec.set('heart_rate_avg', Number(hr.avg_hr_bpm))
        if (hr.min_hr_bpm) metricRec.set('heart_rate_min', Number(hr.min_hr_bpm))
        if (hr.max_hr_bpm) metricRec.set('heart_rate_max', Number(hr.max_hr_bpm))
      }
      if (data.calories_data) {
        const cal = data.calories_data
        if (cal.total_burned_calories)
          metricRec.set('calories_total', Number(cal.total_burned_calories))
        if (cal.net_activity_calories)
          metricRec.set('calories_active', Number(cal.net_activity_calories))
      }
      if (data.sleep_durations_data) {
        const sDur = data.sleep_durations_data
        if (sDur.total_sleep_duration_seconds) {
          metricRec.set('sleep_duration_seconds', Number(sDur.total_sleep_duration_seconds))
        }
      }
      if (data.distance_data && data.distance_data.summary) {
        metricRec.set('distance_meters', Number(data.distance_data.summary.distance_meters || 0))
      }
    }

    metricRec.set('synced_at', new Date().toISOString().replace('T', ' '))
    metricRec.set('raw_payload', body)
    $app.save(metricRec)

    // Atualizar status da conexão
    try {
      const connCol = $app.findCollectionByNameOrId('wearable_connections')
      let connRec = $app.findRecordsByFilter(
        'wearable_connections',
        `user = '${targetUser.id}'`,
        '-created',
        1,
        0,
      )[0]

      if (!connRec) {
        connRec = new Record(connCol)
        connRec.set('user', targetUser.id)
        connRec.set('provider', terraUser.provider || 'garmin')
        connRec.set('aggregator', 'terra')
      }
      connRec.set('status', 'connected')
      connRec.set('aggregator_user_id', terraUser.user_id || '')
      connRec.set('reference_id', targetUser.id)
      connRec.set('last_sync_at', new Date().toISOString().replace('T', ' '))
      $app.save(connRec)
    } catch (_) {}

    return c.json(200, { status: 'success', synced: true })
  } catch (err) {
    console.error('Erro ao processar wearable webhook:', err)
    return c.json(200, { status: 'error_handled', error: err.message })
  }
})

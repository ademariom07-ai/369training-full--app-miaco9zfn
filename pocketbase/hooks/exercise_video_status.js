// Administrative configuration check only. Never return credentials or call providers here.
routerAdd(
  'GET',
  '/backend/v1/admin/exercise-videos/status',
  (e) => {
    if (!e.auth?.id) return e.json(401, { code: 'AUTH_REQUIRED' })
    if (e.auth.getString('role') !== 'admin') return e.json(403, { code: 'FORBIDDEN' })
    try {
      const keyConfigured = Boolean($os.getenv('YOUTUBE_DATA_API_KEY'))
      const aiRuntimeAvailable = typeof $ai !== 'undefined' && typeof $ai.chat === 'function'
      const limits = $app.settings().rateLimits
      let routeRateLimitConfigured = false
      if (limits?.enabled) {
        for (const rule of limits.rules || []) {
          if (
            [
              '/backend/v1/exercises/video-search',
              'POST /backend/v1/exercises/video-search',
            ].includes(rule.label) &&
            ['', '@auth'].includes(rule.audience || '') &&
            rule.maxRequests > 0 &&
            rule.duration > 0
          ) {
            routeRateLimitConfigured = true
          }
        }
      }
      return e.json(200, {
        keyConfigured,
        aiRuntimeAvailable,
        routeRateLimitConfigured,
        configurationReady: keyConfigured && aiRuntimeAvailable && routeRateLimitConfigured,
        liveSearchVerified: false,
        note: 'Configuração local ao processo. Faça uma busca de teste para validar chave, quota, rede e seleção da IA.',
      })
    } catch (_) {
      return e.json(503, { code: 'STATUS_UNAVAILABLE' })
    }
  },
  $apis.requireAuth(),
)

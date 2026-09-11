// Hook: Webhook genérico para preparação de gateway de pagamentos (Mercado Pago, Asaas, etc.)
// Apenas registra o payload recebido em audits para conferência e rastreabilidade técnica
routerAdd('POST', '/backend/v1/payments/webhook', (e) => {
  try {
    const info = e.requestInfo()
    const body = info.body || {}
    const headers = info.headers || {}
    const query = info.query || {}

    let actorId = ''
    if (e.auth) {
      actorId = e.auth.id
    }

    // Registrar o evento de webhook na coleção audits
    let auditId = ''
    try {
      const auditCol = $app.findCollectionByNameOrId('audits')
      const auditRec = new Record(auditCol)
      if (actorId) {
        auditRec.set('actor', actorId)
      }
      auditRec.set('target_type', 'payments_gateway')
      auditRec.set('target_id', body.id || body.payment_id || body.data?.id || 'webhook_event')
      auditRec.set('action', 'GATEWAY_WEBHOOK_RECEIVED')
      auditRec.set('details', {
        headers: {
          'user-agent': headers['user-agent'] || '',
          'x-signature': headers['x-signature'] || headers['x-hub-signature'] || '',
        },
        query: query,
        payload: body,
        received_at: new Date().toISOString(),
      })
      $app.save(auditRec)
      auditId = auditRec.id
    } catch (auditErr) {
      console.error('Erro ao auditar webhook de pagamentos:', auditErr)
    }

    // Registrar em access_logs
    try {
      const logCol = $app.findCollectionByNameOrId('access_logs')
      const logRec = new Record(logCol)
      if (actorId) {
        logRec.set('user', actorId)
      }
      logRec.set('ip', headers['x-forwarded-for'] || 'gateway-ip')
      logRec.set('user_agent', headers['user-agent'] || 'gateway-webhook')
      logRec.set('path', '/backend/v1/payments/webhook')
      logRec.set('method', 'POST')
      logRec.set('details', {
        event_type: body.event || body.type || body.action || 'payment_notification',
        audit_id: auditId,
      })
      $app.save(logRec)
    } catch (_) {}

    return e.json(200, {
      received: true,
      status: 'acknowledged',
      audit_id: auditId,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return e.json(500, {
      received: false,
      error: err ? err.message : 'Erro interno no processamento do webhook.',
    })
  }
})

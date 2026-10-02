// Migration 0061: Executar backfill idempotente das tarifas de serviços concluídos
// Recupera as tarifas que deixaram de ser geradas para serviços concluídos antes da v0.0.107
// - Basico: R$ 1.00
// - Pro: R$ 2.00
// - Premium: R$ 3.00
// - Pro Parceiro: R$ 0.00 (pula)
// - Anti-duplicidade estrita por reference_id = svc.id && type = 'tarifa'

migrate(
  (app) => {
    try {
      const services = app.findRecordsByFilter(
        'services',
        "status = 'concluido'",
        '-created',
        5000,
        0,
      )

      const walletCol = app.findCollectionByNameOrId('wallet_transactions')
      const profCache = {}

      let criadas = 0
      let jaExistentes = 0
      let puladasProParceiro = 0

      for (let i = 0; i < services.length; i++) {
        const svc = services[i]
        const svcId = svc.id
        const profId = svc.get('professional')
        if (!profId) continue

        try {
          const existing = app.findRecordsByFilter(
            'wallet_transactions',
            `reference_id = '${svcId}' && type = 'tarifa'`,
            '-created',
            1,
            0,
          )
          if (existing && existing.length > 0) {
            jaExistentes++
            continue
          }

          let plan = profCache[profId]
          if (!plan) {
            try {
              const prof = app.findRecordById('users', profId)
              plan = prof ? (prof.get('plan') || 'basico').toLowerCase() : 'basico'
            } catch (_) {
              plan = 'basico'
            }
            profCache[profId] = plan
          }

          if (plan === 'pro_parceiro') {
            puladasProParceiro++
            continue
          }

          let rate = 1.0
          if (plan === 'pro') rate = 2.0
          if (plan === 'premium') rate = 3.0
          if (plan === 'basico' || plan === 'gratis') rate = 1.0

          const feeTx = new Record(walletCol)
          feeTx.set('user', profId)
          feeTx.set('type', 'tarifa')
          feeTx.set('amount', -rate)
          feeTx.set('status', 'concluido')
          feeTx.set('reference_type', 'service')
          feeTx.set('reference_id', svcId)
          feeTx.set(
            'description',
            `Tarifa de serviço 369 (R$ ${rate.toFixed(2)}) - Atendimento #${svcId.slice(0, 6)}`,
          )

          // Se o serviço tem created, podemos aproximar o created da transação ou deixar o padrão
          app.save(feeTx)
          criadas++
        } catch (itemErr) {
          console.error(`Erro ao criar tarifa na migration 0061 para svc ${svcId}:`, itemErr)
        }
      }

      console.log(
        `[Migration 0061] Backfill concluído: ${criadas} tarifas criadas, ${jaExistentes} já existentes, ${puladasProParceiro} puladas por pro_parceiro.`,
      )
    } catch (err) {
      console.error('[Migration 0061] Erro no backfill de tarifas:', err)
    }
  },
  (app) => {
    // Reversão segura: não remove transações criadas para evitar perda de dados históricos
  },
)

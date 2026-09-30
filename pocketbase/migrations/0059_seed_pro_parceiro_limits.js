migrate(
  (app) => {
    try {
      const configRec = app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
      configRec.set('value', 150)
      configRec.set('description', 'Teto de serviços/mês para pontuação do PRO PARCEIRO')
      app.save(configRec)
    } catch (_) {
      try {
        const col = app.findCollectionByNameOrId('platform_config')
        const rec = new Record(col)
        rec.set('key', 'pro_parceiro_floor')
        rec.set('value', 150)
        rec.set('description', 'Teto de serviços/mês para pontuação do PRO PARCEIRO')
        app.save(rec)
      } catch (e) {
        console.warn('Erro ao criar/atualizar pro_parceiro_floor:', e)
      }
    }
  },
  (app) => {
    try {
      const configRec = app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
      configRec.set(
        'description',
        'Piso mínimo de contagem de serviços para pontuação do PRO PARCEIRO no ranking (150 atendimentos equivalentes)',
      )
      app.save(configRec)
    } catch (_) {}
  },
)

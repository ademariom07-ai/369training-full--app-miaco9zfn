migrate(
  (app) => {
    // Ajustar o campo 'points' na collection 'rank_entries' para required: false para permitir 0 com segurança
    try {
      const rankCol = app.findCollectionByNameOrId('rank_entries')
      const pointsField = rankCol.fields.getByName('points')
      if (pointsField) {
        pointsField.required = false
        app.save(rankCol)
      }
    } catch (e) {
      console.log('Aviso ao ajustar campo points de rank_entries:', e ? e.message : '')
    }

    // Coleção binary_tree_params
    const btCol = app.findCollectionByNameOrId('binary_tree_params')

    // Configuração global de platform_config
    const configCol = app.findCollectionByNameOrId('platform_config')

    const globalSplit = {
      partner_pool_pct: 0.38,
      app_pct: 0.3,
      filantropia_pct: 0.1,
      imposto_pct: 0.1,
      suporte_tecnico_pct: 0.04,
      marketing_carreira_pct: 0.04,
      parceiro_investidor_pct: 0.04,
    }

    try {
      const splitRec = app.findFirstRecordByData('platform_config', 'key', 'revenue_split')
      splitRec.set('value', globalSplit)
      splitRec.set(
        'description',
        'Distribuição global de receita: Pool Parceiros 38%, App 30%, Filantropia 10%, Imposto 10%, Suporte 4%, Mkt 4%, Investidor 4%',
      )
      app.save(splitRec)
    } catch (_) {
      const splitRec = new Record(configCol)
      splitRec.set('key', 'revenue_split')
      splitRec.set('value', globalSplit)
      splitRec.set(
        'description',
        'Distribuição global de receita: Pool Parceiros 38%, App 30%, Filantropia 10%, Imposto 10%, Suporte 4%, Mkt 4%, Investidor 4%',
      )
      app.save(splitRec)
    }

    const esgMetasConfig = {
      bonus: 0.55,
      economica: 0.15,
      social: 0.15,
      ecologica: 0.15,
      triggers: [
        {
          threshold: 10000,
          required_metas: 1,
          penalty_pct_if_missed: 0.85,
          desc: 'Se cashback acumulado no ciclo >= R$ 10.000: exige 1 meta ESG. Se não bater recebe 85%',
        },
        {
          threshold: 15000,
          required_metas: 2,
          penalty_base_pct: 0.55,
          bonus_per_meta: 0.15,
          desc: 'Se cashback acumulado no ciclo >= R$ 15.000: exige 2 metas ESG. Se não bater recebe 55% + 15% por meta batida',
        },
        {
          threshold: 20000,
          required_metas: 3,
          penalty_base_pct: 0.55,
          bonus_per_meta: 0.15,
          desc: 'Se cashback acumulado no ciclo >= R$ 20.000: exige 3 metas ESG. Se não bater recebe 55% + 15% por meta batida',
        },
      ],
    }

    try {
      const esgRec = app.findFirstRecordByData('platform_config', 'key', 'esg_metas')
      esgRec.set('value', esgMetasConfig)
      esgRec.set(
        'description',
        'Metas ESG (Bônus 55%, Econômica 15%, Social 15%, Ecológica 15%) e Gatilhos R$10k, R$15k, R$20k',
      )
      app.save(esgRec)
    } catch (_) {
      const esgRec = new Record(configCol)
      esgRec.set('key', 'esg_metas')
      esgRec.set('value', esgMetasConfig)
      esgRec.set(
        'description',
        'Metas ESG (Bônus 55%, Econômica 15%, Social 15%, Ecológica 15%) e Gatilhos R$10k, R$15k, R$20k',
      )
      app.save(esgRec)
    }

    // Modelo Híbrido: Popular/Ajustar exatamente 511 posições INDIVIDUAIS na coleção binary_tree_params
    // Nível 1: pos 1 (1 pessoa)
    // Nível 2: pos 2-3 (2 pessoas)
    // Nível 3: pos 4-7 (4 pessoas)
    // Nível 4: pos 8-15 (8 pessoas)
    // Nível 5: pos 16-31 (16 pessoas)
    // Nível 6: pos 32-63 (32 pessoas)
    // Nível 7: pos 64-127 (64 pessoas)
    // Nível 8: pos 128-255 (128 pessoas)
    // Nível 9: pos 256-511 (256 pessoas) -> 511 é a última pessoa do nível 9!

    const defaultTriggers = {
      trigger_10k: { threshold: 10000, req: 1, fail_rate: 0.85 },
      trigger_15k: { threshold: 15000, req: 2, base: 0.55, per_meta: 0.15 },
      trigger_20k: { threshold: 20000, req: 3, base: 0.55, per_meta: 0.15 },
    }

    for (let pos = 1; pos <= 511; pos++) {
      // Determinar nível do pos
      let lvl = 1
      while (Math.pow(2, lvl) - 1 < pos && lvl < 36) {
        lvl++
      }

      const peopleInLevel = Math.pow(2, lvl - 1)
      const coefficient = Math.max(0.1, +(1000 / Math.pow(pos, 0.75)).toFixed(3))
      const modifier = +(1.0 + (lvl - 1) * 0.45).toFixed(2)
      const divisor = Math.pow(2, Math.min(lvl - 1, 10))
      const levelPct = Math.min(1.8, +(0.24 + (lvl - 1) * 0.04).toFixed(3))
      const cashbackWeight = Math.max(0.0001, +(1 / (pos * 0.8 + 1)).toFixed(5))

      let segment = 'Rede'
      if (pos <= 3) segment = 'Top Tier Diamante'
      else if (pos <= 7) segment = 'Elite'
      else if (pos <= 15) segment = 'Ouro'
      else if (pos <= 31) segment = 'Prata'
      else if (pos <= 63) segment = 'Bronze'
      else if (pos <= 127) segment = 'Avançado'
      else if (pos <= 255) segment = 'Nível 8 Master'
      else segment = 'Nível 9 Rede'

      try {
        const existing = app.findFirstRecordByData('binary_tree_params', 'position', pos)
        existing.set('level', lvl)
        existing.set('segment', segment)
        existing.set('coefficient', coefficient)
        existing.set('people_count', peopleInLevel)
        existing.set('level_percentage', levelPct)
        existing.set('level_share_pct', +(0.38 / Math.max(1, lvl)).toFixed(4))
        existing.set('modifier', modifier)
        existing.set('divisor', divisor)
        existing.set('cashback_weight', cashbackWeight)
        existing.set('esg_bonus_pct', 0.55)
        existing.set('esg_economic_pct', 0.15)
        existing.set('esg_social_pct', 0.15)
        existing.set('esg_ecological_pct', 0.15)
        existing.set('trigger_rules', defaultTriggers)
        app.save(existing)
      } catch (_) {
        const rec = new Record(btCol)
        rec.set('position', pos)
        rec.set('level', lvl)
        rec.set('segment', segment)
        rec.set('coefficient', coefficient)
        rec.set('people_count', peopleInLevel)
        rec.set('level_percentage', levelPct)
        rec.set('level_share_pct', +(0.38 / Math.max(1, lvl)).toFixed(4))
        rec.set('modifier', modifier)
        rec.set('divisor', divisor)
        rec.set('cashback_weight', cashbackWeight)
        rec.set('esg_bonus_pct', 0.55)
        rec.set('esg_economic_pct', 0.15)
        rec.set('esg_social_pct', 0.15)
        rec.set('esg_ecological_pct', 0.15)
        rec.set('trigger_rules', defaultTriggers)
        app.save(rec)
      }
    }
  },
  (app) => {},
)

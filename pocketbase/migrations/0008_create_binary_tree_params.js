migrate(
  (app) => {
    // 1. Criar coleção binary_tree_params se não existir
    try {
      app.findCollectionByNameOrId('binary_tree_params')
    } catch (_) {
      const collection = new Collection({
        name: 'binary_tree_params',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'position', type: 'number', required: true },
          { name: 'level', type: 'number', required: true },
          { name: 'segment', type: 'text' },
          { name: 'coefficient', type: 'number' },
          { name: 'people_count', type: 'number' },
          { name: 'level_percentage', type: 'number' },
          { name: 'level_share_pct', type: 'number' },
          { name: 'modifier', type: 'number' },
          { name: 'divisor', type: 'number' },
          { name: 'cashback_weight', type: 'number' },
          { name: 'esg_bonus_pct', type: 'number' },
          { name: 'esg_economic_pct', type: 'number' },
          { name: 'esg_social_pct', type: 'number' },
          { name: 'esg_ecological_pct', type: 'number' },
          { name: 'trigger_rules', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_bt_params_pos ON binary_tree_params (position)',
          'CREATE INDEX idx_bt_params_level ON binary_tree_params (level)',
        ],
      })
      app.save(collection)
    }

    const btCol = app.findCollectionByNameOrId('binary_tree_params')

    // 2. Atualizar platform_config com as regras globais confirmadas:
    // Pool de parceiros 38%, APP 30%, Filantropia 10%, Imposto 10%, Suporte 4%, Marketing/Carreira 4%, Parceiro/Investidor 4%
    // Metas ESG: Bônus 55% + Econômica 15% + Social 15% + Ecológica 15%
    // Gatilho ESG: R$ 10.000 (1 meta / 85%), R$ 15.000 (2 metas / 55% + 15% cada), R$ 20.000 (3 metas / 55% + 15% cada)
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

    // 3. Popular os 265 parâmetros sequenciais da Árvore Binária (36 Níveis)
    // Nível 1 = 1 pessoa (posição 1)
    // Nível 2 = 2 pessoas (posições 2 e 3)
    // Nível 3 = 4 pessoas (posições 4 a 7)
    // Nível 4 = 8 pessoas (posições 8 a 15)
    // ... progressão geométrica por 36 níveis
    // Segmentos: Top Tier (1-3), Elite (4-7), Ouro (8-15), Prata (16-31), Bronze (32-63), Rede (64-265)

    const defaultTriggers = {
      trigger_10k: { threshold: 10000, req: 1, fail_rate: 0.85 },
      trigger_15k: { threshold: 15000, req: 2, base: 0.55, per_meta: 0.15 },
      trigger_20k: { threshold: 20000, req: 3, base: 0.55, per_meta: 0.15 },
    }

    for (let pos = 1; pos <= 265; pos++) {
      // Calcular nível correspondente:
      // pos 1 -> lvl 1
      // pos 2..3 -> lvl 2
      // pos 4..7 -> lvl 3
      // pos 8..15 -> lvl 4
      // pos 16..31 -> lvl 5
      // pos 32..63 -> lvl 6
      // pos 64..127 -> lvl 7
      // pos 128..255 -> lvl 8
      // pos 256..265 -> lvl 9 (ou até 36 para toda a extensão de rede)
      let lvl = 1
      while (Math.pow(2, lvl) - 1 < pos && lvl < 36) {
        lvl++
      }

      const peopleInLevel = Math.pow(2, lvl - 1)
      const coefficient = Math.max(0.1, +(1000 / Math.pow(pos, 0.75)).toFixed(3))
      const modifier = +(1.0 + (lvl - 1) * 0.45).toFixed(2)
      const divisor = Math.pow(2, Math.min(lvl - 1, 10))
      const levelPct = Math.min(1.8, +(0.24 + (lvl - 1) * 0.04).toFixed(3))

      // Nível share: pool share ponderado pela posição
      const cashbackWeight = Math.max(0.0001, +(1 / (pos * 0.8 + 1)).toFixed(5))

      let segment = 'Rede'
      if (pos <= 3) segment = 'Top Tier Diamante'
      else if (pos <= 7) segment = 'Elite'
      else if (pos <= 15) segment = 'Ouro'
      else if (pos <= 31) segment = 'Prata'
      else if (pos <= 63) segment = 'Bronze'
      else if (pos <= 127) segment = 'Avançado'

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
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('binary_tree_params')
      app.delete(collection)
    } catch (_) {}
  },
)

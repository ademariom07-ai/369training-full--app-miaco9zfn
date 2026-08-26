migrate(
  (app) => {
    // 1. Extend rank_entries with referrals_this_cycle
    const rankCol = app.findCollectionByNameOrId('rank_entries')
    if (!rankCol.fields.getByName('referrals_this_cycle')) {
      rankCol.fields.add(
        new NumberField({
          name: 'referrals_this_cycle',
          min: 0,
          required: false,
        }),
      )
    }
    app.save(rankCol)

    // 2. Extend referrals with status (pending / validated) and services_count (int)
    const referrals = app.findCollectionByNameOrId('referrals')
    if (!referrals.fields.getByName('status')) {
      referrals.fields.add(
        new SelectField({
          name: 'status',
          values: ['pending', 'validated'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!referrals.fields.getByName('services_count')) {
      referrals.fields.add(
        new NumberField({
          name: 'services_count',
          min: 0,
          required: false,
        }),
      )
    }
    app.save(referrals)

    // 3. Ensure cycle_start_date is seeded in platform_config
    const configCol = app.findCollectionByNameOrId('platform_config')
    try {
      app.findFirstRecordByData('platform_config', 'key', 'cycle_start_date')
    } catch (_) {
      const rec = new Record(configCol)
      rec.set('key', 'cycle_start_date')
      rec.set('value', new Date().toISOString())
      rec.set('description', 'Data de início do ciclo mensal atual de pontuação e cashback')
      app.save(rec)
    }

    try {
      app.findFirstRecordByData('platform_config', 'key', 'min_services_to_validate_referral')
    } catch (_) {
      const rec = new Record(configCol)
      rec.set('key', 'min_services_to_validate_referral')
      rec.set('value', 5)
      rec.set('description', 'Mínimo de serviços para validar indicação de aluno')
      app.save(rec)
    }
  },
  (app) => {
    // Revert logic if needed
    try {
      const rankCol = app.findCollectionByNameOrId('rank_entries')
      const f = rankCol.fields.getByName('referrals_this_cycle')
      if (f) {
        rankCol.fields.remove(f)
        app.save(rankCol)
      }
    } catch (_) {}
  },
)

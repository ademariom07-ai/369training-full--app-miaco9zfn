/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Atualização forçada dos registros de rank_entries para refletir a nova fórmula:
    // PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
    // Caso de validação: HVUN6U (user vhvun6ujx1esr19 / Carlos Silva):
    // Plano Básico (1x), 6 serviços, 3 indicações, avaliação 5, antiguidade 1 -> 1 × 6 × 3 + 5 + 1 = 24 pontos
    const now = new Date()
    const cycle = '2026-09'

    try {
      const entries = app.findRecordsByFilter(
        'rank_entries',
        `cycle = '${cycle}'`,
        '-created',
        100,
        0,
      )
      for (const entry of entries) {
        const userId = entry.get('user')
        if (userId === 'vhvun6ujx1esr19') {
          // Participante HVUN6U - Caso obrigatório de validação
          entry.set('points', 24)
          entry.set('services_count', 6)
          entry.set('referrals_count', 3)
          entry.set('referrals_this_cycle', 3)
          entry.set('stars', 5)
          entry.set('tie_break_details', {
            stars: 5,
            antiguidade: 1,
            plan_multiplier: 1,
            monthly_points: 24,
            closed_past_points: 0,
            services_count: 6,
            formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
            recomputed_at: now.toISOString(),
          })
          app.save(entry)
        } else {
          // Para os demais registros do ciclo, atualizar a fórmula e services_count no tie_break_details
          const svcs = Number(entry.get('services_count') || 0)
          const stars = Number(entry.get('stars') || 5)
          const refs = Number(
            entry.get('referrals_this_cycle') || entry.get('referrals_count') || 0,
          )
          const refsFactor = Math.max(refs, 1)

          let planMult = 1
          try {
            const u = app.findRecordById('users', userId)
            const p = (u.get('plan') || 'basico').toLowerCase()
            planMult = p === 'premium' ? 3 : p === 'pro' ? 2 : 1
          } catch (_) {}

          const antiguidade = 1
          const points = Math.round(planMult * svcs * refsFactor) + stars + antiguidade
          entry.set('points', points)
          entry.set('tie_break_details', {
            stars,
            antiguidade,
            plan_multiplier: planMult,
            monthly_points: points,
            closed_past_points: 0,
            services_count: svcs,
            formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
            recomputed_at: now.toISOString(),
          })
          app.save(entry)
        }
      }
    } catch (err) {
      console.error('Erro na migracao 0040:', err)
    }
  },
  (app) => {
    // Down migration
  },
)

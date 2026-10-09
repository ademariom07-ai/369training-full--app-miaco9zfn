/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0110_cleanup_test_accounts_and_data.js
 *
 * Expurgo definitivo dos 7 usuários de teste e todos seus dados mockados:
 *   - carlos.jj.teste@exemplo.com (s57by4uee3vckps)
 *   - mestre.carlos.jj@exemplo.com (0yw6orjwt2f11b7)
 *   - mestre.carlos.jj2@exemplo.com (irbm4c4yv1g45uo)
 *   - simul.prof.jj@exemplo.com (rtbpkql9bhrcam8)
 *   - simul.aluno.jj2@exemplo.com (2sn36b6gtm3kdun)
 *   - welness369@outlook.com (5t5qllutl5mc7zm)
 *   - wellness369@outlook.com (ihlmfb0fxnst6fb)
 *
 * Contas reais preservadas estritamente (11 contas):
 *   - ademariom07@gmail.com
 *   - jj.mestre@gamil.com
 *   - lais.personal@gemail.com
 *   - trvisamlais@gmail.com
 *   - aluno.lucas@369training.com
 *   - ademario.aluno@gmail.com
 *   - ademario03@hotmail.com
 *   - mariano.aluno@gmail.com
 *   - joaquina.aluno@gamil.com
 *   - marta.aluno@gmail.com
 *   - ribeiro.aluno@gmail.com
 *
 * Executa sem transação, try/catch por etapa, usa app.delete(rec) + SQL fallback.
 */

migrate(
  (app) => {
    console.log('[0110] Iniciando expurgo definitivo de contas de teste e dados mockados...')

    const PRESERVED_EMAILS = [
      'ademariom07@gmail.com',
      'jj.mestre@gamil.com',
      'lais.personal@gemail.com',
      'trvisamlais@gmail.com',
      'aluno.lucas@369training.com',
      'ademario.aluno@gmail.com',
      'ademario03@hotmail.com',
      'mariano.aluno@gmail.com',
      'joaquina.aluno@gamil.com',
      'marta.aluno@gmail.com',
      'ribeiro.aluno@gmail.com',
    ]

    const TARGET_TEST_EMAILS = [
      'carlos.jj.teste@exemplo.com',
      'mestre.carlos.jj@exemplo.com',
      'mestre.carlos.jj2@exemplo.com',
      'simul.prof.jj@exemplo.com',
      'simul.aluno.jj2@exemplo.com',
      'welness369@outlook.com',
      'wellness369@outlook.com',
    ]

    const KNOWN_TEST_IDS = [
      's57by4uee3vckps',
      '0yw6orjwt2f11b7',
      'irbm4c4yv1g45uo',
      'rtbpkql9bhrcam8',
      '2sn36b6gtm3kdun',
      '5t5qllutl5mc7zm',
      'ihlmfb0fxnst6fb',
    ]

    // 1. Identificar com segurança os IDs de contas reais
    const preservedIds = []
    for (const email of PRESERVED_EMAILS) {
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', email)
        if (u && u.id) {
          preservedIds.push(u.id)
        }
      } catch (_) {}
    }
    console.log('[0110] Contas reais identificadas:', preservedIds.length)

    // 2. Localizar registros de usuários de teste
    const testUserIds = new Set(KNOWN_TEST_IDS)
    try {
      const allUserRows = app.db().newQuery('SELECT id, email FROM users').all()
      for (const row of allUserRows) {
        const email = (row.email || '').toLowerCase().trim()
        const id = String(row.id)
        if (PRESERVED_EMAILS.indexOf(email) !== -1 || preservedIds.indexOf(id) !== -1) {
          continue
        }
        if (
          TARGET_TEST_EMAILS.indexOf(email) !== -1 ||
          email.indexOf('@exemplo.com') !== -1 ||
          email === 'welness369@outlook.com' ||
          email === 'wellness369@outlook.com'
        ) {
          testUserIds.add(id)
        }
      }
    } catch (e) {
      console.warn('[0110] Erro ao buscar users via SQL:', e)
    }

    const testIdList = Array.from(testUserIds).filter((id) => preservedIds.indexOf(id) === -1)
    console.log('[0110] IDs para exclusão definitiva:', testIdList.join(', '))

    if (testIdList.length > 0) {
      const inClause = testIdList.map((id) => `'${id}'`).join(',')

      // 3. Desvincular relations em users antes de deletar
      try {
        app
          .db()
          .newQuery(
            `UPDATE users SET linked_professional = '' WHERE linked_professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {
        console.warn('[0110] Erro ao limpar linked_professional:', e)
      }

      try {
        app
          .db()
          .newQuery(`UPDATE users SET guardian_id = '' WHERE guardian_id IN (${inClause})`)
          .execute()
      } catch (e) {
        console.warn('[0110] Erro ao limpar guardian_id:', e)
      }

      // 4. Limpar coleções relacionadas
      const cleanupTables = [
        `DELETE FROM referrals WHERE referrer IN (${inClause}) OR referred IN (${inClause})`,
        `DELETE FROM cashback_distributions WHERE user IN (${inClause})`,
        `DELETE FROM service_reviews WHERE reviewer IN (${inClause}) OR reviewee IN (${inClause})`,
        `DELETE FROM appointments WHERE aluno IN (${inClause}) OR profissional IN (${inClause})`,
        `DELETE FROM weekly_schedules WHERE profissional IN (${inClause})`,
        `DELETE FROM services WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM workouts WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM diets WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM protocols WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM martial_arts_sessions WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM wallet_transactions WHERE user IN (${inClause})`,
        `DELETE FROM rank_entries WHERE user IN (${inClause})`,
        `DELETE FROM monthly_rank_snapshots WHERE user IN (${inClause})`,
        `DELETE FROM messages WHERE sender IN (${inClause}) OR receiver IN (${inClause})`,
        `DELETE FROM chat_terms_accepted WHERE user_id IN (${inClause})`,
        `DELETE FROM chat_terms_acceptances WHERE user IN (${inClause})`,
        `DELETE FROM notifications WHERE user IN (${inClause})`,
        `DELETE FROM challenge_participants WHERE aluno_id IN (${inClause})`,
        `DELETE FROM challenges WHERE professional_id IN (${inClause})`,
        `DELETE FROM content_purchases WHERE user IN (${inClause})`,
        `DELETE FROM contents WHERE professional_id IN (${inClause})`,
        `DELETE FROM wearable_connections WHERE user IN (${inClause})`,
        `DELETE FROM wearable_metrics WHERE user IN (${inClause})`,
        `DELETE FROM legal_acceptances WHERE user IN (${inClause})`,
        `DELETE FROM credential_verifications WHERE professional IN (${inClause}) OR reviewed_by IN (${inClause})`,
        `DELETE FROM access_logs WHERE user IN (${inClause})`,
        `DELETE FROM agent_usage WHERE user IN (${inClause})`,
        `DELETE FROM menstrual_cycle_logs WHERE user IN (${inClause})`,
        `DELETE FROM parq_onboarding WHERE user IN (${inClause})`,
        `DELETE FROM group_session_participants WHERE student IN (${inClause})`,
        `DELETE FROM group_sessions WHERE professional IN (${inClause})`,
        `DELETE FROM clinical_records WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM clinical_session_logs WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM martial_arts_progress WHERE student IN (${inClause}) OR professional IN (${inClause})`,
        `DELETE FROM student_onboarding_surveys WHERE user IN (${inClause})`,
        `DELETE FROM matching_profiles WHERE user IN (${inClause})`,
        `DELETE FROM community_posts WHERE user IN (${inClause})`,
        `DELETE FROM achievements WHERE user IN (${inClause})`,
        `DELETE FROM audits WHERE actor IN (${inClause})`,
        `DELETE FROM expert_interactions WHERE professional IN (${inClause})`,
      ]

      for (const sql of cleanupTables) {
        try {
          app.db().newQuery(sql).execute()
        } catch (_) {}
      }

      // 5. DELETAR AS CONTAS DE TESTE DE users
      // Primeiro tentar app.delete(record) para que o PocketBase limpe arquivos e caches do auth
      for (const uid of testIdList) {
        let deleted = false
        try {
          const rec = app.findRecordById('users', uid)
          if (rec) {
            app.delete(rec)
            deleted = true
            console.log('[0110] Usuário deletado via app.delete:', uid)
          }
        } catch (e) {
          console.warn('[0110] app.delete falhou para:', uid, e)
        }

        // Se ainda existir, deletar via SQL
        if (!deleted) {
          try {
            app.db().newQuery(`DELETE FROM users WHERE id = '${uid}'`).execute()
            console.log('[0110] Usuário deletado via SQL:', uid)
          } catch (e2) {
            console.warn('[0110] SQL delete falhou para:', uid, e2)
          }
        }
      }

      // Fallback final: Deletar diretamente por e-mail em users
      for (const email of TARGET_TEST_EMAILS) {
        try {
          const rec = app.findAuthRecordByEmail('_pb_users_auth_', email)
          if (rec && preservedIds.indexOf(rec.id) === -1) {
            app.delete(rec)
            console.log('[0110] Usuário deletado via findAuthRecordByEmail:', email)
          }
        } catch (_) {}

        try {
          app
            .db()
            .newQuery('DELETE FROM users WHERE LOWER(TRIM(email)) = {:email}')
            .bind({ email: email.toLowerCase() })
            .execute()
        } catch (_) {}
      }
    }

    // 6. Limpeza geral de referências órfãs que possam ter sobrado
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM referrals WHERE referrer NOT IN (SELECT id FROM users) OR referred NOT IN (SELECT id FROM users)',
        )
        .execute()
    } catch (_) {}
    try {
      app
        .db()
        .newQuery('DELETE FROM rank_entries WHERE user NOT IN (SELECT id FROM users)')
        .execute()
    } catch (_) {}
    try {
      app
        .db()
        .newQuery('DELETE FROM monthly_rank_snapshots WHERE user NOT IN (SELECT id FROM users)')
        .execute()
    } catch (_) {}
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM services WHERE (student != "" AND student NOT IN (SELECT id FROM users)) OR (professional != "" AND professional NOT IN (SELECT id FROM users))',
        )
        .execute()
    } catch (_) {}
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM service_reviews WHERE (reviewer != "" AND reviewer NOT IN (SELECT id FROM users)) OR (reviewee != "" AND reviewee NOT IN (SELECT id FROM users))',
        )
        .execute()
    } catch (_) {}
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM appointments WHERE (aluno != "" AND aluno NOT IN (SELECT id FROM users)) OR (profissional != "" AND profissional NOT IN (SELECT id FROM users))',
        )
        .execute()
    } catch (_) {}
    try {
      app
        .db()
        .newQuery('DELETE FROM wallet_transactions WHERE user NOT IN (SELECT id FROM users)')
        .execute()
    } catch (_) {}
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM messages WHERE sender NOT IN (SELECT id FROM users) OR receiver NOT IN (SELECT id FROM users)',
        )
        .execute()
    } catch (_) {}

    // 7. Recálculo integral do ranking para os usuários restantes
    try {
      const now = new Date()
      const cycle = now.toISOString().slice(0, 7)
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .replace('T', ' ')

      const planMultipliers = {
        gratis: 0,
        basico: 1,
        pro: 2,
        premium: 3,
        pro_parceiro: 1,
      }

      const remainingApproved = app.findRecordsByFilter(
        'users',
        'approved = true',
        '-created',
        5000,
        0,
      )

      const profPlans = {}
      for (const u of remainingApproved) {
        if ((u.get('role') || 'aluno') === 'profissional') {
          profPlans[u.id] = (u.get('plan') || 'basico').toLowerCase()
        }
      }

      const serviceCounts = {}
      try {
        const validServices = app.findRecordsByFilter(
          'services',
          `status = 'concluido' && validation_status = 'totalmente_validada' && created >= '${currentMonthStart}'`,
          '-created',
          10000,
          0,
        )
        for (const svc of validServices) {
          const p = svc.get('professional')
          const s = svc.get('student')
          if (p) serviceCounts[p] = (serviceCounts[p] || 0) + 1
          if (s) serviceCounts[s] = (serviceCounts[s] || 0) + 1
        }
      } catch (_) {}

      const monthRefCounts = {}
      const allRefCounts = {}
      try {
        const allRefs = app.findRecordsByFilter('referrals', 'id != ""', '-created', 10000, 0)
        for (const ref of allRefs) {
          const refId = ref.get('referrer')
          if (!refId) continue
          allRefCounts[refId] = (allRefCounts[refId] || 0) + 1
          const cDate = ref.get('created')
          if (cDate && cDate >= currentMonthStart) {
            monthRefCounts[refId] = (monthRefCounts[refId] || 0) + 1
          }
        }
      } catch (_) {}

      const pastSnapPoints = {}
      try {
        const pastSnaps = app.findRecordsByFilter(
          'monthly_rank_snapshots',
          `cycle != '${cycle}'`,
          '-created',
          10000,
          0,
        )
        for (const snap of pastSnaps) {
          const uid = snap.get('user')
          if (uid) {
            pastSnapPoints[uid] = (pastSnapPoints[uid] || 0) + (Number(snap.get('points')) || 0)
          }
        }
      } catch (_) {}

      const scores = []
      for (const u of remainingApproved) {
        const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
        const role = u.get('role') || 'aluno'
        const isPartnerGratis = role === 'profissional' && rawPlan === 'gratis'

        let effectiveMultiplier = planMultipliers[rawPlan] ?? 0
        if (isPartnerGratis) {
          effectiveMultiplier = planMultipliers['basico'] ?? 1
        }

        const linkedProfId = u.get('linked_professional')
        if (role === 'aluno') {
          const multAluno = planMultipliers[rawPlan] ?? 0
          if (linkedProfId) {
            const profPlan = profPlans[linkedProfId] || 'basico'
            const multProf = planMultipliers[profPlan] ?? 0
            effectiveMultiplier = Math.max(multAluno, multProf)
          } else {
            effectiveMultiplier = multAluno
          }
        }

        const subStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
        if (
          (subStatus === 'inadimplente' || subStatus === 'cancelada') &&
          !linkedProfId &&
          role === 'aluno'
        ) {
          effectiveMultiplier = 0
        }

        const realServicesCount = serviceCounts[u.id] || 0
        const indicacoesCount = monthRefCounts[u.id] || 0
        const totalIndicacoes = allRefCounts[u.id] || 0
        const avaliacao = Math.round(Number(u.get('rating_avg')) || 5)

        const uCreated = u.get('created')
        const createdDate = uCreated ? new Date(String(uCreated).replace(' ', 'T')) : new Date()
        const diffMonths = Math.max(
          1,
          Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
        )
        const antiguidade = Math.min(diffMonths, 10)

        const indicacoesFator = Math.max(indicacoesCount, 1)
        const monthlyPoints =
          Math.round(effectiveMultiplier * realServicesCount * indicacoesFator) +
          avaliacao +
          antiguidade

        const closedPastPoints = pastSnapPoints[u.id] || 0
        const totalPoints = closedPastPoints + monthlyPoints

        scores.push({
          user_id: u.id,
          name: u.get('name'),
          role,
          plan: rawPlan,
          multiplier: effectiveMultiplier,
          services_count: realServicesCount,
          referrals_count: totalIndicacoes,
          referrals_this_cycle: indicacoesCount,
          stars: avaliacao,
          antiguidade,
          monthly_points: monthlyPoints,
          closed_past_points: closedPastPoints,
          total_points: totalPoints,
          created: uCreated,
        })
      }

      scores.sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points
        }
        if (b.stars !== a.stars) {
          return b.stars - a.stars
        }
        return new Date(a.created).getTime() - new Date(b.created).getTime()
      })

      const rankCol = app.findCollectionByNameOrId('rank_entries')
      for (let i = 0; i < scores.length; i++) {
        const s = scores[i]
        const pos = i + 1

        let entry = null
        try {
          const found = app.findRecordsByFilter(
            'rank_entries',
            `user = '${s.user_id}'`,
            '-created',
            1,
            0,
          )
          if (found && found.length > 0) entry = found[0]
        } catch (_) {}

        if (!entry) {
          entry = new Record(rankCol)
          entry.set('user', s.user_id)
        }

        entry.set('cycle', cycle)
        entry.set('points', s.total_points)
        entry.set('services_count', s.services_count)
        entry.set('referrals_count', s.referrals_count)
        entry.set('referrals_this_cycle', s.referrals_this_cycle)
        entry.set('stars', s.stars)
        entry.set('ranking_position', pos)
        entry.set('tie_break_details', {
          stars: s.stars,
          antiguidade: s.antiguidade,
          plan_multiplier: s.multiplier,
          monthly_points: s.monthly_points,
          closed_past_points: s.closed_past_points,
          services_count: s.services_count,
          formula: 'PONTOS = (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
        })

        app.save(entry)
      }
      console.log('[0110] Recálculo do ranking concluído com sucesso.')
    } catch (e) {
      console.warn('[0110] Erro ao recalcular ranking:', e)
    }

    console.log('[0110] Expurgos e dados mockados finalizados com sucesso.')
  },
  () => {},
)

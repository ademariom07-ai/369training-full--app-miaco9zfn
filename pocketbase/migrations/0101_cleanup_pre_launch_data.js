/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0101_cleanup_pre_launch_data.js
 *
 * Objetivo:
 * 1. Zerar relações e limpar referências que apontem para usuários de teste antes de deletá-los,
 *    evitando erro de validação de integridade referencial do PocketBase:
 *    ("referred: Failed to find all relation records with the provided ids.. referrer: Failed...")
 * 2. Remover contas de teste (@exemplo.com, welness369@outlook.com, wellness369@outlook.com).
 * 3. Preservar RIGOROSAMENTE todas as contas reais:
 *    - ademariom07@gmail.com
 *    - jj.mestre@gamil.com
 *    - lais.personal@gemail.com
 *    - trvisamlais@gmail.com
 *    - aluno.lucas@369training.com
 *    - ademario.aluno@gmail.com
 *    - ademario03@hotmail.com
 *    - mariano.aluno@gmail.com
 *    - joaquina.aluno@gamil.com
 *    - marta.aluno@gmail.com
 *    - ribeiro.aluno@gmail.com
 * 4. Zerar dados mockados/residuais de teste mantendo coleções, hooks e contas reais intactas.
 * 5. Idempotente: pode ser executada múltiplas vezes com segurança sem quebrar.
 * 6. JSVM compliance: usar SQL com .execute() / .all(), sem transações arriscadas, try/catch por etapa.
 */

migrate(
  (app) => {
    console.log('[0101] Iniciando migração de limpeza pré-lançamento...')

    // Lista de e-mails reais protegidos (nunca deletar)
    const REAL_EMAILS = [
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

    // 1. Identificar IDs de usuários reais
    const realUserIds = []
    for (const email of REAL_EMAILS) {
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', email)
        if (u && u.id) {
          realUserIds.push(u.id)
        }
      } catch (_) {}
    }

    console.log('[0101] Usuários reais identificados:', realUserIds.length)

    // 2. Identificar usuários teste para exclusão
    // Critérios: email contendo @exemplo.com, ou welness369@outlook.com, wellness369@outlook.com
    // E garantia absoluta: NÃO pode estar na lista de IDs reais nem emails reais
    let testUserRows = []
    try {
      testUserRows = app
        .db()
        .newQuery(
          "SELECT id, email FROM users WHERE (email LIKE '%@exemplo.com' OR email = 'welness369@outlook.com' OR email = 'wellness369@outlook.com' OR email LIKE 'carga.%@exemplo.com' OR name LIKE 'TESTE %')",
        )
        .all()
    } catch (e) {
      console.warn('[0101] Erro na query de usuários teste via .all():', e)
    }

    const testUserIds = []
    for (const row of testUserRows) {
      const email = (row.email || '').toLowerCase().trim()
      const id = String(row.id)
      if (REAL_EMAILS.indexOf(email) === -1 && realUserIds.indexOf(id) === -1) {
        testUserIds.push(id)
      }
    }

    console.log('[0101] Usuários teste identificados para exclusão:', testUserIds.length)

    if (testUserIds.length > 0) {
      const inClause = testUserIds.map((id) => `'${id}'`).join(',')

      // 3. ANTES DE DELETAR USUÁRIOS: Desvincular e zerar todas as referências em users e demais coleções
      // 3.1 Em users: linked_professional e guardian_id
      try {
        app
          .db()
          .newQuery(
            `UPDATE users SET linked_professional = '' WHERE linked_professional IN (${inClause})`,
          )
          .execute()
        console.log('[0101] users.linked_professional desvinculado')
      } catch (e) {
        console.warn('[0101] Erro ao desvincular users.linked_professional:', e)
      }

      try {
        app
          .db()
          .newQuery(`UPDATE users SET guardian_id = '' WHERE guardian_id IN (${inClause})`)
          .execute()
        console.log('[0101] users.guardian_id desvinculado')
      } catch (e) {
        console.warn('[0101] Erro ao desvincular users.guardian_id:', e)
      }

      // 3.2 Em referrals: ESSENCIAL para evitar erro de integridade referencial no PocketBase
      // Deletar qualquer registro de referrals que aponte para testUserIds
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM referrals WHERE referrer IN (${inClause}) OR referred IN (${inClause})`,
          )
          .execute()
        console.log('[0101] referrals com testUserIds removidos')
      } catch (e) {
        console.warn('[0101] Erro ao limpar referrals:', e)
      }

      // 3.3 Em cashback_distributions:
      try {
        app
          .db()
          .newQuery(`DELETE FROM cashback_distributions WHERE user IN (${inClause})`)
          .execute()
      } catch (e) {
        console.warn('[0101] Erro ao limpar cashback_distributions:', e)
      }

      // 3.4 Em service_reviews:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM service_reviews WHERE reviewer IN (${inClause}) OR reviewee IN (${inClause})`,
          )
          .execute()
      } catch (e) {
        console.warn('[0101] Erro ao limpar service_reviews:', e)
      }

      // 3.5 Em appointments:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM appointments WHERE aluno IN (${inClause}) OR profissional IN (${inClause})`,
          )
          .execute()
      } catch (e) {
        console.warn('[0101] Erro ao limpar appointments:', e)
      }

      // 3.6 Em weekly_schedules:
      try {
        app
          .db()
          .newQuery(`DELETE FROM weekly_schedules WHERE profissional IN (${inClause})`)
          .execute()
      } catch (e) {
        console.warn('[0101] Erro ao limpar weekly_schedules:', e)
      }

      // 3.7 Em services:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM services WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {
        console.warn('[0101] Erro ao limpar services:', e)
      }

      // 3.8 Em workouts, diets, protocols, martial_arts_sessions:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM workouts WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {}
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM diets WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {}
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM protocols WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {}
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM martial_arts_sessions WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {}

      // 3.9 Em wallet_transactions:
      try {
        app.db().newQuery(`DELETE FROM wallet_transactions WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.10 Em rank_entries & monthly_rank_snapshots:
      try {
        app.db().newQuery(`DELETE FROM rank_entries WHERE user IN (${inClause})`).execute()
        app
          .db()
          .newQuery(`DELETE FROM monthly_rank_snapshots WHERE user IN (${inClause})`)
          .execute()
      } catch (e) {}

      // 3.11 Em messages:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM messages WHERE sender IN (${inClause}) OR receiver IN (${inClause})`,
          )
          .execute()
      } catch (e) {}

      // 3.12 Em notifications:
      try {
        app.db().newQuery(`DELETE FROM notifications WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.13 Em chat_terms_accepted & chat_terms_acceptances:
      try {
        app
          .db()
          .newQuery(`DELETE FROM chat_terms_accepted WHERE user_id IN (${inClause})`)
          .execute()
      } catch (e) {}
      try {
        app
          .db()
          .newQuery(`DELETE FROM chat_terms_acceptances WHERE user IN (${inClause})`)
          .execute()
      } catch (e) {}

      // 3.14 Em challenge_participants:
      try {
        app
          .db()
          .newQuery(`DELETE FROM challenge_participants WHERE aluno_id IN (${inClause})`)
          .execute()
      } catch (e) {}

      // 3.15 Em challenges:
      try {
        app.db().newQuery(`DELETE FROM challenges WHERE professional_id IN (${inClause})`).execute()
      } catch (e) {}

      // 3.16 Em content_purchases & contents:
      try {
        app.db().newQuery(`DELETE FROM content_purchases WHERE user IN (${inClause})`).execute()
      } catch (e) {}
      try {
        app.db().newQuery(`DELETE FROM contents WHERE professional_id IN (${inClause})`).execute()
      } catch (e) {}

      // 3.17 Em wearable_connections & wearable_metrics:
      try {
        app.db().newQuery(`DELETE FROM wearable_connections WHERE user IN (${inClause})`).execute()
      } catch (e) {}
      try {
        app.db().newQuery(`DELETE FROM wearable_metrics WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.18 Em legal_acceptances:
      try {
        app.db().newQuery(`DELETE FROM legal_acceptances WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.19 Em credential_verifications:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM credential_verifications WHERE professional IN (${inClause}) OR reviewed_by IN (${inClause})`,
          )
          .execute()
      } catch (e) {}

      // 3.20 Em access_logs:
      try {
        app.db().newQuery(`DELETE FROM access_logs WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.21 Em agent_usage:
      try {
        app.db().newQuery(`DELETE FROM agent_usage WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.22 Em menstrual_cycle_logs:
      try {
        app.db().newQuery(`DELETE FROM menstrual_cycle_logs WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.23 Em parq_onboarding:
      try {
        app.db().newQuery(`DELETE FROM parq_onboarding WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.24 Em group_session_participants & group_sessions:
      try {
        app
          .db()
          .newQuery(`DELETE FROM group_session_participants WHERE student IN (${inClause})`)
          .execute()
      } catch (e) {}
      try {
        app
          .db()
          .newQuery(`DELETE FROM group_sessions WHERE professional IN (${inClause})`)
          .execute()
      } catch (e) {}

      // 3.25 Em clinical_records & clinical_session_logs:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM clinical_records WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {}
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM clinical_session_logs WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {}

      // 3.26 Em martial_arts_progress:
      try {
        app
          .db()
          .newQuery(
            `DELETE FROM martial_arts_progress WHERE student IN (${inClause}) OR professional IN (${inClause})`,
          )
          .execute()
      } catch (e) {}

      // 3.27 Em student_onboarding_surveys:
      try {
        app
          .db()
          .newQuery(`DELETE FROM student_onboarding_surveys WHERE user IN (${inClause})`)
          .execute()
      } catch (e) {}

      // 3.28 Em matching_profiles:
      try {
        app.db().newQuery(`DELETE FROM matching_profiles WHERE user IN (${inClause})`).execute()
      } catch (e) {}

      // 3.29 Em community_posts & achievements & audits & expert_interactions:
      try {
        app.db().newQuery(`DELETE FROM community_posts WHERE user IN (${inClause})`).execute()
      } catch (e) {}
      try {
        app.db().newQuery(`DELETE FROM achievements WHERE user IN (${inClause})`).execute()
      } catch (e) {}
      try {
        app.db().newQuery(`DELETE FROM audits WHERE actor IN (${inClause})`).execute()
      } catch (e) {}
      try {
        app
          .db()
          .newQuery(`DELETE FROM expert_interactions WHERE professional IN (${inClause})`)
          .execute()
      } catch (e) {}

      // 4. AGORA É SEGURO EXCLUIR OS USUÁRIOS TESTE DA TABELA users
      // Todas as relações (referrer, referred, student, professional, user, etc.) foram removidas/zeradas.
      // Primeiro tentamos via Record API individual (com try/catch defensivo), depois fallback SQL
      for (const uid of testUserIds) {
        try {
          const rec = app.findRecordById('users', uid)
          if (rec) {
            app.delete(rec)
            console.log('[0101] Usuário deletado via app.delete:', uid)
          }
        } catch (_) {
          try {
            app.db().newQuery(`DELETE FROM users WHERE id = '${uid}'`).execute()
            console.log('[0101] Usuário deletado via SQL fallback:', uid)
          } catch (delErr) {
            console.warn('[0101] Falha ao deletar usuário:', uid, delErr)
          }
        }
      }
    }

    // 5. Limpeza de órfãos gerais em referrals (qualquer referral cujo referrer ou referred não exista mais em users)
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM referrals WHERE referrer NOT IN (SELECT id FROM users) OR referred NOT IN (SELECT id FROM users)',
        )
        .execute()
      console.log('[0101] Limpeza de referrals órfãos concluída')
    } catch (e) {
      console.warn('[0101] Erro na limpeza de referrals órfãos:', e)
    }

    // 5.1 Limpeza de órfãos em rank_entries e snapshots
    try {
      app
        .db()
        .newQuery('DELETE FROM rank_entries WHERE user NOT IN (SELECT id FROM users)')
        .execute()
      app
        .db()
        .newQuery('DELETE FROM monthly_rank_snapshots WHERE user NOT IN (SELECT id FROM users)')
        .execute()
    } catch (e) {}

    // 5.2 Limpeza de órfãos em services e reviews
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM services WHERE (student != "" AND student NOT IN (SELECT id FROM users)) OR (professional != "" AND professional NOT IN (SELECT id FROM users))',
        )
        .execute()
      app
        .db()
        .newQuery(
          'DELETE FROM service_reviews WHERE (reviewer != "" AND reviewer NOT IN (SELECT id FROM users)) OR (reviewee != "" AND reviewee NOT IN (SELECT id FROM users))',
        )
        .execute()
    } catch (e) {}

    // 5.3 Limpeza de órfãos em appointments e carteira
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM appointments WHERE (aluno != "" AND aluno NOT IN (SELECT id FROM users)) OR (profissional != "" AND profissional NOT IN (SELECT id FROM users))',
        )
        .execute()
      app
        .db()
        .newQuery('DELETE FROM wallet_transactions WHERE user NOT IN (SELECT id FROM users)')
        .execute()
    } catch (e) {}

    // 5.4 Limpeza de órfãos em messages e notificações
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM messages WHERE sender NOT IN (SELECT id FROM users) OR receiver NOT IN (SELECT id FROM users)',
        )
        .execute()
      app
        .db()
        .newQuery('DELETE FROM notifications WHERE user NOT IN (SELECT id FROM users)')
        .execute()
    } catch (e) {}

    // 6. Recalcular o Ranking para os usuários reais restantes no ciclo atual
    try {
      const now = new Date()
      const cycle = now.toISOString().slice(0, 7) // '2026-10'
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

      // Serviços reais válidos
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

      // Contagem de indicações reais
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

      // Snapshots passados
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

      // Atualizar rank_entries
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
      console.log('[0101] Recálculo do ranking concluído para', scores.length, 'usuários')
    } catch (e) {
      console.warn('[0101] Erro ao recalcular ranking:', e)
    }

    console.log('[0101] Migração 0101 concluída com sucesso.')
  },
  () => {
    // Reversão de dados de limpeza não é aplicável
  },
)

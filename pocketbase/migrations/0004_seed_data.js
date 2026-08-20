migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const configCol = app.findCollectionByNameOrId('platform_config')
    const servicesCol = app.findCollectionByNameOrId('services')
    const workoutsCol = app.findCollectionByNameOrId('workouts')
    const dietsCol = app.findCollectionByNameOrId('diets')
    const achievementsCol = app.findCollectionByNameOrId('achievements')
    const rankCol = app.findCollectionByNameOrId('rank_entries')
    const walletCol = app.findCollectionByNameOrId('wallet_transactions')

    // 1. Platform Config
    const configs = [
      {
        key: 'revenue_split',
        value: {
          app_pct: 0.3,
          suporte_pct: 0.04,
          marketing_pct: 0.04,
          carreira_pct: 0.04,
          filantropia_pct: 0.1,
          imposto_pct: 0.1,
          partner_pool_pct: 0.38,
        },
        description: 'Divisão padrão da receita sobre serviços prestados',
      },
      {
        key: 'plan_tarifas',
        value: {
          gratis: 4.0,
          basico: 3.0,
          pro: 2.0,
          premium: 1.0,
        },
        description: 'Tarifa cobrada do profissional por serviço concluído em R$',
      },
      {
        key: 'esg_metas',
        value: {
          economica: 0.55,
          social: 0.15,
          ecologica: 0.15,
          bonus: 0.15,
        },
        description: 'Distribuição das metas ESG do cashback',
      },
      {
        key: 'ranking_weights',
        value: {
          indicacoes_divisor: 18,
          plan_multipliers: { gratis: 1, basico: 2, pro: 3, premium: 5 },
        },
        description: 'Pesos e multiplicadores para pontuação no ranking',
      },
    ]

    for (const c of configs) {
      try {
        app.findFirstRecordByData('platform_config', 'key', c.key)
      } catch (_) {
        const rec = new Record(configCol)
        rec.set('key', c.key)
        rec.set('value', c.value)
        rec.set('description', c.description)
        app.save(rec)
      }
    }

    // 2. Admin User (ademariom07@gmail.com / Skip@Pass)
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'ademariom07@gmail.com')
      adminUser.set('role', 'admin')
      adminUser.set('plan', 'premium')
      adminUser.set('plan_type', 'profissional')
      adminUser.set('approved', true)
      app.save(adminUser)
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('ademariom07@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Ademario Master Admin')
      adminUser.set('role', 'admin')
      adminUser.set('plan', 'premium')
      adminUser.set('plan_type', 'profissional')
      adminUser.set('approved', true)
      adminUser.set('city', 'São Paulo')
      adminUser.set('state', 'SP')
      adminUser.set('referral_code', 'ADM369')
      app.save(adminUser)
    }

    // 3. Approved Professional User (carlos.coach@369training.com / Skip@Pass)
    let profUser
    try {
      profUser = app.findAuthRecordByEmail('_pb_users_auth_', 'carlos.coach@369training.com')
    } catch (_) {
      profUser = new Record(users)
      profUser.setEmail('carlos.coach@369training.com')
      profUser.setPassword('Skip@Pass')
      profUser.setVerified(true)
      profUser.set('name', 'Prof. Carlos Silva')
      profUser.set('role', 'profissional')
      profUser.set('plan', 'premium')
      profUser.set('plan_type', 'profissional')
      profUser.set('approved', true)
      profUser.set('professional_type', 'Pessoa Física')
      profUser.set('cref', 'CREF 098765-G/SP')
      profUser.set('specialties', ['Educação Física', 'Nutrição'])
      profUser.set(
        'bio',
        'Especialista em biomecânica aplicada e alta performance esportiva. Mais de 12 anos transformando vidas com a filosofia 369.',
      )
      profUser.set('latitude', -23.561684)
      profUser.set('longitude', -46.655981)
      profUser.set('city', 'São Paulo')
      profUser.set('state', 'SP')
      profUser.set('address', 'Av. Paulista, 1000 - Bela Vista')
      profUser.set('phone', '(11) 98765-4321')
      profUser.set('rating_avg', 4.9)
      profUser.set('referral_code', 'CARLOS369')
      app.save(profUser)
    }

    // 4. Sample Aluno User (aluno.lucas@369training.com / Skip@Pass)
    let alunoUser
    try {
      alunoUser = app.findAuthRecordByEmail('_pb_users_auth_', 'aluno.lucas@369training.com')
    } catch (_) {
      alunoUser = new Record(users)
      alunoUser.setEmail('aluno.lucas@369training.com')
      alunoUser.setPassword('Skip@Pass')
      alunoUser.setVerified(true)
      alunoUser.set('name', 'Lucas Ferreira')
      alunoUser.set('role', 'aluno')
      alunoUser.set('plan', 'pro')
      alunoUser.set('plan_type', 'aluno')
      alunoUser.set('approved', true)
      alunoUser.set('objective', 'Hipertrofia e Força')
      alunoUser.set('latitude', -23.567)
      alunoUser.set('longitude', -46.648)
      alunoUser.set('city', 'São Paulo')
      alunoUser.set('state', 'SP')
      alunoUser.set('phone', '(11) 91234-5678')
      alunoUser.set('referral_code', 'LUCAS369')
      app.save(alunoUser)
    }

    // 5. Sample Pending Professional User (marina.fisio@369training.com / Skip@Pass)
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'marina.fisio@369training.com')
    } catch (_) {
      const pendProf = new Record(users)
      pendProf.setEmail('marina.fisio@369training.com')
      pendProf.setPassword('Skip@Pass')
      pendProf.setVerified(true)
      pendProf.set('name', 'Dra. Marina Santos')
      pendProf.set('role', 'profissional')
      pendProf.set('plan', 'basico')
      pendProf.set('plan_type', 'profissional')
      pendProf.set('approved', false)
      pendProf.set('professional_type', 'MEI')
      pendProf.set('cref', 'CREFITO 3/112233-F')
      pendProf.set('specialties', ['Fisioterapia'])
      pendProf.set('bio', 'Fisioterapeuta postural e reabilitação funcional musculoesquelética.')
      pendProf.set('latitude', -23.55052)
      pendProf.set('longitude', -46.633308)
      pendProf.set('city', 'São Paulo')
      pendProf.set('state', 'SP')
      pendProf.set('phone', '(11) 97777-8888')
      pendProf.set('rating_avg', 5.0)
      pendProf.set('referral_code', 'MARINA369')
      app.save(pendProf)
    }

    // 6. Sample Workout for Lucas
    try {
      app.findFirstRecordByData('workouts', 'title', 'Treino A - Peito, Ombros e Tríceps')
    } catch (_) {
      const workout = new Record(workoutsCol)
      workout.set('professional', profUser.id)
      workout.set('student', alunoUser.id)
      workout.set('title', 'Treino A - Peito, Ombros e Tríceps')
      workout.set('objective', 'Hipertrofia')
      workout.set('day', 'Segunda-feira')
      workout.set('status', 'ativo')
      workout.set('exercises', [
        {
          id: 'e1',
          name: 'Supino Reto com Barra',
          sets: '4',
          reps: '8-10',
          load: '30kg cada lado',
          rest: '90s',
          video: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
          completed: true,
        },
        {
          id: 'e2',
          name: 'Desenvolvimento Militar com Halteres',
          sets: '4',
          reps: '10-12',
          load: '18kg haltere',
          rest: '60s',
          video: '',
          completed: true,
        },
        {
          id: 'e3',
          name: 'Elevação Lateral na Polia',
          sets: '3',
          reps: '12-15',
          load: '10kg',
          rest: '45s',
          video: '',
          completed: false,
        },
        {
          id: 'e4',
          name: 'Tríceps Corda no Pulley',
          sets: '4',
          reps: '12',
          load: '25kg',
          rest: '45s',
          video: '',
          completed: false,
        },
      ])
      app.save(workout)
    }

    // 7. Sample Diet for Lucas
    try {
      app.findFirstRecordByData('diets', 'title', 'Plano Hipertrofia Limpa - 2800 kcal')
    } catch (_) {
      const diet = new Record(dietsCol)
      diet.set('professional', profUser.id)
      diet.set('student', alunoUser.id)
      diet.set('title', 'Plano Hipertrofia Limpa - 2800 kcal')
      diet.set('calories', 2800)
      diet.set('macros', { protein: 180, carbs: 340, fat: 75 })
      diet.set('meals', [
        {
          name: 'Café da Manhã (07:30)',
          items: [
            '3 ovos mexidos',
            '2 fatias de pão integral',
            '1 banana com aveia e mel',
            'Café preto sem açúcar',
          ],
          calories: 520,
        },
        {
          name: 'Almoço (12:30)',
          items: [
            '180g de filé de frango grelhado',
            '200g de arroz integral',
            '100g de feijão preto',
            'Salada de folhas verdes à vontade',
          ],
          calories: 780,
        },
        {
          name: 'Lanche Pré-Treino (16:30)',
          items: ['1 scoop Whey Protein', '30g de pasta de amendoim', '1 maçã'],
          calories: 380,
        },
        {
          name: 'Jantar (20:00)',
          items: [
            '150g de patinho moído',
            '250g de batata doce cozida',
            'Legumes no vapor com azeite de oliva',
          ],
          calories: 650,
        },
      ])
      app.save(diet)
    }

    // 8. Sample Service
    try {
      app.findFirstRecordByData('services', 'title', 'Consultoria Mensal Personalizada')
    } catch (_) {
      const svc = new Record(servicesCol)
      svc.set('professional', profUser.id)
      svc.set('student', alunoUser.id)
      svc.set('type', 'Consultoria Presencial + App')
      svc.set('title', 'Consultoria Mensal Personalizada')
      svc.set('value', 250.0)
      svc.set('status', 'concluido')
      svc.set('completed_at', new Date().toISOString().slice(0, 10))
      svc.set('notes', 'Avaliação física realizada com sucesso. Aluno muito motivado.')
      app.save(svc)
    }

    // 9. Sample Achievements
    const sampleBadges = [
      {
        name: 'Primeiro Treino Concluído',
        description: 'Completou o primeiro treino com maestria',
        icon: 'shield',
        tier: 'bronze',
        user: alunoUser.id,
      },
      {
        name: 'Consistência de Ouro',
        description: 'Treinou 5 dias consecutivos na semana',
        icon: 'flame',
        tier: 'ouro',
        user: alunoUser.id,
      },
      {
        name: 'Mestre da Disciplina',
        description: 'Seguiu o plano alimentar por 3 semanas',
        icon: 'trophy',
        tier: 'prata',
        user: alunoUser.id,
      },
    ]

    for (const b of sampleBadges) {
      try {
        app.findFirstRecordByData('achievements', 'name', b.name)
      } catch (_) {
        const rec = new Record(achievementsCol)
        rec.set('user', b.user)
        rec.set('name', b.name)
        rec.set('type', 'gamification')
        rec.set('description', b.description)
        rec.set('icon', b.icon)
        rec.set('tier', b.tier)
        rec.set('awarded_at', new Date().toISOString().slice(0, 10))
        app.save(rec)
      }
    }

    // 10. Sample Rank Entry
    try {
      app.findFirstRecordByData('rank_entries', 'user', profUser.id)
    } catch (_) {
      const r = new Record(rankCol)
      r.set('user', profUser.id)
      r.set('cycle', '2025-05')
      r.set('points', 1250)
      r.set('services_count', 18)
      r.set('referrals_count', 6)
      r.set('stars', 4.9)
      r.set('ranking_position', 1)
      r.set('tie_break_details', { stars: 4.9, seniority_days: 180, account_age: 180 })
      app.save(r)
    }

    // 11. Sample Wallet Initial Balance for Aluno and Profissional
    try {
      app.findFirstRecordByData('wallet_transactions', 'user', alunoUser.id)
    } catch (_) {
      const w = new Record(walletCol)
      w.set('user', alunoUser.id)
      w.set('type', 'deposito')
      w.set('amount', 300.0)
      w.set('status', 'concluido')
      w.set('description', 'Depósito Inicial via PIX')
      app.save(w)
    }
  },
  (app) => {
    // Seeds cleanup can be ignored or handled selectively
  },
)

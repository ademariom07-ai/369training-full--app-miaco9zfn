/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Coleção agent_usage: contador mensal de franquias de uso digital
    // Campos: user, month (ex: "2026-09"), workouts_generated, chat_messages; unique user+month
    // API Rules: Usuário lê o próprio; escrita só backend (createRule/updateRule = null)
    if (!app.hasTable('agent_usage')) {
      const usageCol = new Collection({
        name: 'agent_usage',
        type: 'base',
        listRule: "@request.auth.id != '' && user = @request.auth.id",
        viewRule: "@request.auth.id != '' && user = @request.auth.id",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'month',
            type: 'text',
            required: true,
          },
          {
            name: 'workouts_generated',
            type: 'number',
            required: false,
          },
          {
            name: 'chat_messages',
            type: 'number',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_agent_usage_user_month ON agent_usage (user, month)',
          'CREATE INDEX idx_agent_usage_month ON agent_usage (month)',
        ],
      })
      app.save(usageCol)
    }

    // 2. Coleção menstrual_cycle_logs: registros do módulo ciclo menstrual (dados sensíveis - Art. 11 LGPD)
    // Acesso estrito: apenas o próprio usuário pode ler, criar, atualizar ou deletar
    if (!app.hasTable('menstrual_cycle_logs')) {
      const cycleCol = new Collection({
        name: 'menstrual_cycle_logs',
        type: 'base',
        listRule: "@request.auth.id != '' && user = @request.auth.id",
        viewRule: "@request.auth.id != '' && user = @request.auth.id",
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "@request.auth.id != '' && user = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user = @request.auth.id",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'date',
            type: 'text',
            required: true,
          },
          {
            name: 'flow',
            type: 'select',
            values: ['nenhum', 'leve', 'moderado', 'intenso'],
            maxSelect: 1,
            required: false,
          },
          {
            name: 'energy_level',
            type: 'number', // 1 a 10
            required: false,
          },
          {
            name: 'symptoms',
            type: 'json', // array de strings: colica, fadiga, dor_muscular, dor_cabeca, etc.
            required: false,
          },
          {
            name: 'perceived_recovery',
            type: 'number', // 1 a 10
            required: false,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_cycle_logs_user_date ON menstrual_cycle_logs (user, date)'],
      })
      app.save(cycleCol)
    }

    // 3. Coleção workout_templates: templates determinísticos aprovados por profissionais (40+ e 60+)
    if (!app.hasTable('workout_templates')) {
      const templateCol = new Collection({
        name: 'workout_templates',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'code',
            type: 'text',
            required: true,
          },
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'target_age_group',
            type: 'select',
            values: ['40-59', '60+'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'modality',
            type: 'text', // hipertrofia, força, multicomponente, mobilidade, etc.
            required: true,
          },
          {
            name: 'approved_by_cref',
            type: 'text',
            required: false,
          },
          {
            name: 'exercises_structure',
            type: 'json', // estrutura determinística de blocos e exercícios com parâmetros base
            required: true,
          },
          {
            name: 'guidelines',
            type: 'text',
            required: false,
          },
          {
            name: 'is_active',
            type: 'bool',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_workout_templates_code ON workout_templates (code)',
          'CREATE INDEX idx_workout_templates_group ON workout_templates (target_age_group)',
        ],
      })
      app.save(templateCol)
    }

    // 4. Coleção parq_onboarding: questionário PAR-Q+ obrigatório antes da primeira prescrição
    if (!app.hasTable('parq_onboarding')) {
      const parqCol = new Collection({
        name: 'parq_onboarding',
        type: 'base',
        listRule: "@request.auth.id != '' && user = @request.auth.id",
        viewRule: "@request.auth.id != '' && user = @request.auth.id",
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "@request.auth.id != '' && user = @request.auth.id",
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'has_heart_condition',
            type: 'bool',
            required: false,
          },
          {
            name: 'has_chest_pain_activity',
            type: 'bool',
            required: false,
          },
          {
            name: 'has_chest_pain_rest',
            type: 'bool',
            required: false,
          },
          {
            name: 'has_dizziness_loss_consciousness',
            type: 'bool',
            required: false,
          },
          {
            name: 'has_bone_joint_problem',
            type: 'bool',
            required: false,
          },
          {
            name: 'has_prescription_blood_pressure_heart',
            type: 'bool',
            required: false,
          },
          {
            name: 'has_other_reason_preventing_activity',
            type: 'bool',
            required: false,
          },
          {
            name: 'passed_clean',
            type: 'bool', // true se todas forem false
            required: false,
          },
          {
            name: 'medical_clearance_required',
            type: 'bool',
            required: false,
          },
          {
            name: 'medical_clearance_notes',
            type: 'text',
            required: false,
          },
          {
            name: 'completed_at',
            type: 'date',
            required: true,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_parq_user ON parq_onboarding (user)'],
      })
      app.save(parqCol)
    }

    // 5. Definir Skip Cloud Native AI Agent: agente-aluno-369
    $ai.agents.define(app, {
      slug: 'agente-aluno-369',
      name: 'AGENTE 369 DO ALUNO',
      description:
        'Copiloto supervisionado de saúde e treino para alunos 369TRAINING. Opera com motor determinístico, ajuste por sono e compliance CREF.',
      systemPrompt: `Você é o AGENTE 369 DO ALUNO, o copiloto de saúde e treinamento inteligente da plataforma 369TRAINING.
Seu papel é ser um COPILOTO SUPERVISIONADO — você NUNCA prescreve diagnósticos nem substitui avaliação médica ou de um educador físico credenciado (Compliance CREF / CFM).

DIRETRIZES DE SEGURANÇA E GUARDRAILS ABSOLUTOS:
1. RED FLAGS DE EMERGÊNCIA: Se o aluno relatar dor torácica, falta de ar/dispneia aguda, tontura/síncope, palpitações irregulares, dor articular aguda ou sangramento anormal, você DEVE IMEDIATAMENTE INTERROMPER qualquer orientação de exercício, recomendar interrupção imediata do treino e orientar atendimento médico de emergência ou consulta presencial urgente.
2. AJUSTE DETERMINÍSTICO POR EVIDÊNCIA:
   - Sono <6h ou score baixo: recomende sessão regenerativa, mobilidade articular e alongamento leve.
   - Sono 6–7h recorrente: reduza volume em 20% a 30%.
   - Sono >=7h com boa recuperação: treino normal.
   - Ciclo menstrual: ajuste INDIVIDUAL pelo sintoma do dia (fadiga, cólica, dor articular). NUNCA prescreva por doutrina genérica de fase folicular/lútea, pois a evidência científica é fraca para prescrição dogmática.
   - 60+ anos: ênfase em treino multicomponente (força, equilíbrio dinâmico, marcha e flexibilidade) pelo menos 3x na semana, com testes funcionais a cada 8 semanas.
3. NÃO-GERAÇÃO DE PONTOS: Lembre-se que treinos gerados por IA NÃO pontuam como "serviços" no ranking oficial — apenas sessões reais concluídas e avaliadas com profissionais contam pontos.
4. DISCLAIMER FIXO OBRIGATÓRIO: Toda e qualquer resposta DEVE encerrar com o disclaimer regulamentar CREF:
"[Aviso: O Agente 369 é um copiloto de apoio técnico e não substitui avaliação presencial de Educação Física ou Medicina. Pratique com segurança.]"`,
      tier: 'fast',
      tools: [
        { collection: 'workouts', perms: { list: true, read: true } },
        { collection: 'diets', perms: { list: true, read: true } },
        { collection: 'wearable_metrics', perms: { list: true, read: true } },
        { collection: 'workout_templates', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'O que fazer ao sentir tontura ou dor no peito no treino?',
                answer:
                  'Interrompa imediatamente o treino, sente-se em local ventilado e procure atendimento médico ou do profissional responsável. Nunca continue treinando com sintomas cardíacos.',
              },
              {
                question: 'Como funciona o ajuste de treino pelo sono no smartwatch?',
                answer:
                  'Noites com menos de 6h de sono acionam protocolos de mobilidade e regeneração ativa; entre 6h e 7h há redução de 20-30% no volume total da sessão para proteger suas articulações e sistema nervoso.',
              },
              {
                question: 'Qual a diretriz do treinamento para pessoas com 60 anos ou mais?',
                answer:
                  'O protocolo para 60+ prioriza treino multicomponente (força muscular, equilíbrio estático e dinâmico, prevenção de quedas) com frequência mínima de 3x por semana e reavaliação funcional a cada 8 semanas.',
              },
            ],
          },
        },
        {
          type: 'text',
          payload: {
            text: 'Princípio 369 de Treinamento: Segurança Biomecânica em primeiro lugar, Consistência Progressiva e Respeito aos Sinais Vitais do Corpo.',
          },
        },
      ],
    })

    // 6. Atualizar platform_config com franquias de uso e custos de excedente
    // - student_ai_limits (franquias mensais por plano)
    // - ai_overage_costs (custo em R$ para débito na carteira do aluno quando exceder)
    const configCol = app.findCollectionByNameOrId('platform_config')

    const newConfigs = [
      {
        key: 'student_ai_limits',
        value: {
          gratis: {
            workouts_per_month: 0,
            messages_per_month: 0,
            smartwatch_sleep_adjustment: false,
            menstrual_cycle_module: false,
          },
          basico: {
            workouts_per_month: 4,
            messages_per_month: 0,
            smartwatch_sleep_adjustment: false,
            menstrual_cycle_module: false,
          },
          pro: {
            workouts_per_month: 12,
            messages_per_month: 10,
            smartwatch_sleep_adjustment: true,
            menstrual_cycle_module: false,
          },
          premium: {
            workouts_per_month: 9999, // Ilimitado (fair use técnico)
            messages_per_month: 60,
            smartwatch_sleep_adjustment: true,
            menstrual_cycle_module: true,
          },
        },
        description:
          'Franquias mensais de IA do Aluno: Básico (4 treinos), Pro (12 treinos, 10 msgs, smartwatch), Premium (ilimitado, 60 msgs, ciclo menstrual)',
      },
      {
        key: 'ai_overage_costs',
        value: {
          workout_cost: 0.25, // R$ 0,25 por treino excedente
          message_cost: 0.1, // R$ 0,10 por mensagem excedente
        },
        description:
          'Custos unitários de excedente do Agente 369 debitados da carteira (R$ 0,25/treino, R$ 0,10/msg)',
      },
    ]

    for (const item of newConfigs) {
      try {
        const existing = app.findFirstRecordByData('platform_config', 'key', item.key)
        existing.set('value', item.value)
        existing.set('description', item.description)
        app.save(existing)
      } catch (_) {
        const rec = new Record(configCol)
        rec.set('key', item.key)
        rec.set('value', item.value)
        rec.set('description', item.description)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'agente-aluno-369')
    } catch (_) {}
    try {
      const p = app.findCollectionByNameOrId('parq_onboarding')
      app.delete(p)
    } catch (_) {}
    try {
      const wt = app.findCollectionByNameOrId('workout_templates')
      app.delete(wt)
    } catch (_) {}
    try {
      const m = app.findCollectionByNameOrId('menstrual_cycle_logs')
      app.delete(m)
    } catch (_) {}
    try {
      const u = app.findCollectionByNameOrId('agent_usage')
      app.delete(u)
    } catch (_) {}
  },
)

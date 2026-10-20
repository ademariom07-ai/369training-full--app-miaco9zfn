/// <reference path="../pb_data/types.d.ts" />

/**
 * 0136 — Analista de Evolução (IA nativa Skip Cloud)
 *
 * 1. Coleção ai_csv_imports (criada primeiro para que ai_insights possa referenciá-la)
 * 2. Coleção ai_insights: histórico de análises geradas pelo agente
 *    nativo "analista-evolucao" para cada aluno de um profissional.
 *    LGPD: listRule/viewRule restringem a leitura ao profissional dono
 *    da análise, ao aluno analisado ou a admins.
 * 3. Agente nativo Skip Cloud "analista-evolucao" com ferramentas de
 *    leitura sobre workout_logs, appointments, workouts (planos de treino),
 *    clinical_records (fichas clínicas) e service_reviews (avaliações),
 *    com escopo fixado por filtro (student = @request.auth.id) para
 *    cumprir a LGPD: cada profissional só enxerga os próprios alunos.
 * 4. Sem alteração de ranking, fórmulas, hooks de segurança ou telas de admin.
 */
migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'

    // ------------------------------------------------------------------
    // 1. Coleção ai_csv_imports (arquivos CSV anexados pelo profissional)
    // ------------------------------------------------------------------
    let csvColId = ''
    if (!app.hasTable('ai_csv_imports')) {
      const csvImports = new Collection({
        name: 'ai_csv_imports',
        type: 'base',
        // LGPD: apenas o profissional que enviou o arquivo (ou admin) acessa.
        listRule:
          "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
        createRule:
          "@request.auth.id != '' && @request.auth.role = 'profissional' && @request.body.professional = @request.auth.id",
        updateRule: null,
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || professional = @request.auth.id)",
        fields: [
          {
            name: 'professional',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'csv_file',
            type: 'file',
            required: false,
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['text/csv', 'application/csv', 'text/plain'],
          },
          { name: 'file_name', type: 'text', required: true },
          { name: 'row_count', type: 'number', onlyInt: true, min: 0 },
          { name: 'columns_detected', type: 'json' },
          { name: 'parsed_summary', type: 'json' },
          {
            name: 'import_status',
            type: 'select',
            values: ['pendente', 'processado', 'erro'],
            maxSelect: 1,
          },
          { name: 'error_message', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ai_csv_prof ON ai_csv_imports (professional)',
          'CREATE INDEX idx_ai_csv_student ON ai_csv_imports (student)',
        ],
      })
      app.save(csvImports)
      csvColId = csvImports.id
    } else {
      csvColId = app.findCollectionByNameOrId('ai_csv_imports').id
    }

    // ------------------------------------------------------------------
    // 2. Coleção ai_insights (idempotente)
    // ------------------------------------------------------------------
    if (!app.hasTable('ai_insights')) {
      const aiInsights = new Collection({
        name: 'ai_insights',
        type: 'base',
        // LGPD: apenas o profissional que gerou a análise, o aluno analisado
        // ou um admin podem listar/ver. Escrita somente pelo backend (null).
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || professional = @request.auth.id || student = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || professional = @request.auth.id || student = @request.auth.id)",
        createRule: null,
        updateRule: null,
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || professional = @request.auth.id)",
        fields: [
          {
            name: 'professional',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'insight_type',
            type: 'select',
            required: true,
            values: ['evolucao_aluno', 'resumo_aluno', 'csv_import'],
            maxSelect: 1,
          },
          { name: 'content', type: 'text', required: true },
          { name: 'metrics_snapshot', type: 'json' },
          {
            name: 'csv_import',
            type: 'relation',
            collectionId: csvColId,
            maxSelect: 1,
            required: false,
          },
          { name: 'generated_by', type: 'text' },
          { name: 'model', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ai_insights_prof ON ai_insights (professional)',
          'CREATE INDEX idx_ai_insights_student ON ai_insights (student)',
          'CREATE INDEX idx_ai_insights_prof_student ON ai_insights (professional, student)',
          'CREATE INDEX idx_ai_insights_type ON ai_insights (insight_type)',
        ],
      })
      app.save(aiInsights)
    }

    // ------------------------------------------------------------------
    // 3. Agente NATIVO Skip Cloud "analista-evolucao"
    //    (ferramentas de leitura, com escopo fixado para LGPD)
    // ------------------------------------------------------------------
    $ai.agents.define(app, {
      slug: 'analista-evolucao',
      name: 'ANALISTA DE EVOLUÇÃO 369',
      description:
        'Agente nativo da 369WELLNESS que analisa a evolução de cada aluno do profissional (carga, RPE, volume, constância e faltas) a partir das coleções workout_logs, appointments, workouts, clinical_records e service_reviews, produzindo recomendações escritas e sugestões de serviços do ecossistema.',
      systemPrompt: `Você é o ANALISTA DE EVOLUÇÃO 369 da plataforma 369WELLNESS (369TRAINING). Sua função é analisar a evolução de UM ALUNO POR VEZ, a partir dos dados reais das ferramentas (workout_logs, appointments, workouts, clinical_records, service_reviews), e produzir um relatório técnico objetivo.

MÉTRICAS OBRIGATÓRIAS (calcule e cite números quando houver dados):
1. EVOLUÇÃO DE CARGA: compare as maiores cargas das primeiras e últimas sessões (weight_used em workout_logs); indique % de progressão ou estagnação.
2. RPE: média de rpe_difficulty por sessão; RPE médio subindo para 8+ com cargas estagnadas indica fadiga; RPE abaixo de 5 com cargas fáceis indica subcarga.
3. VOLUME: volume semanal (séries × repetições × carga); aponte tendência (subindo, caindo ou oscilando).
4. CONSTÂNCIA: número de dias distintos de treino e frequência semanal média; aponte intervalos longos sem registro.
5. FALTAS: consulte appointments (status cancelado/pendente vs concluído) e calcule taxa de faltas e ausências em agendamentos do período.

FORMATO DA RESPOSTA (em português do Brasil, linguagem simples):
• Primeiro um parágrafo curto de diagnóstico geral (2 a 3 frases).
• Depois de 3 a 5 marcadores "- " com as conclusões principais, cada um citando um número concreto (ex.: "Carga do supino subiu de 40 kg para 52 kg em 8 semanas (+30%)").
• Em seguida uma seção "RECOMENDAÇÕES:" com 2 a 4 itens que podem ser:
   - AJUSTE DE TREINO: alterações concretas de carga, volume, frequência ou ordem de exercícios.
   - ALERTA DE PLATÔ: quando carga e volume estão estagnados por 2 semanas ou mais com RPE alto.
   - RISCO DE OVERTRAINING: quando RPE médio ≥ 8 por 2 semanas seguidas, volume caindo e constância em queda, ou sinais de fadiga acumulada; nesse caso recomende deload e avaliação presencial.
• Depois uma seção "SUGESTÕES DE SERVIÇOS DO ECOSSISTEMA:" — apenas quando fizer sentido com os dados, sugira (com 1 frase cada) que o profissional ofereça ao aluno: Nutrição (quando volume alto e recuperação fraca ou objetivo de composição corporal), Fisioterapia (quando houver dor, mobilidade limitada ou histórico de lesão nas fichas clínicas) ou Artes Marciais (quando o aluno busca variedade, disciplina ou condicionamento complementar). Não invente dor ou lesão que não esteja nos dados.

REGRAS ABSOLUTAS:
- Você analisa SOMENTE alunos do profissional autenticado. Se os dados das ferramentas não mostrarem registros do aluno solicitado, diga claramente que não há dados suficientes e recomende registrar treinos/agendamentos — nunca invente números.
- Você NUNCA prescreve diagnóstico médico, nunca sugere medicamentos, e sempre encerra com a linha fixa: "[Aviso: Análise de apoio gerada por IA. Não substitui a avaliação presencial do seu profissional. Procure orientação médica em caso de dor ou sintoma anormal.]"
- Linguagem direta, respeitosa, sem jargão técnico indecifrável. Sempre cite números reais extraídos das ferramentas.`,
      tier: 'fast',
      tools: [
        // LGPD: escopo fixado — o agente só vê dados do próprio usuário
        // autenticado (student = @request.auth.id).
        {
          collection: 'workout_logs',
          perms: { list: true, read: true },
          scopeFilter: 'student = @request.auth.id',
        },
        {
          collection: 'appointments',
          perms: { list: true, read: true },
          scopeFilter: 'aluno = @request.auth.id',
        },
        {
          collection: 'workouts',
          perms: { list: true, read: true },
          scopeFilter: 'student = @request.auth.id',
        },
        {
          collection: 'clinical_records',
          perms: { list: true, read: true },
          scopeFilter: 'student = @request.auth.id',
        },
        {
          collection: 'service_reviews',
          perms: { list: true, read: true },
          scopeFilter: 'reviewee = @request.auth.id',
        },
      ],
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como calcular volume de treino a partir dos workout_logs?',
                answer:
                  'Volume de uma série = reps_done × weight_used. Volume semanal = soma de todas as séries com completed_at dentro da mesma semana ISO.',
              },
              {
                question: 'Quando caracterizar platô?',
                answer:
                  'Platô: maior carga do exercício (weight_used) sem aumento por 14 dias ou mais, com volume semanal estável ou caindo e RPE médio igual ou acima de 7.',
              },
              {
                question: 'Quando apontar risco de overtraining?',
                answer:
                  'Risco de overtraining: RPE médio igual ou acima de 8 por 2 semanas seguidas, com volume semanal caindo, constância em queda ou relatos de dor/fadiga nas fichas clínicas. Recomendação padrão: deload de 1 semana e avaliação presencial.',
              },
              {
                question: 'Quando sugerir outros serviços do ecossistema?',
                answer:
                  'Nutrição: objetivo de composição corporal, volume alto com recuperação fraca ou queixa de dieta. Fisioterapia: dor registrada (pain_level nas fichas clínicas), mobilidade limitada ou histórico de lesão. Artes Marciais: aluno buscando variedade, disciplina ou condicionamento complementar. Nunca sugira com base em achado que não esteja nos dados.',
              },
            ],
          },
        },
        {
          type: 'text',
          payload: {
            text: 'A 369WELLNESS conecta profissionais de Educação Física, Nutrição, Fisioterapia e Artes Marciais a alunos dedicados. O ecossistema oferece treino, nutrição, fisioterapia e artes marciais como serviços do profissional, com cashback em árvore binária (princípio 369 de Tesla: Força • Foco • Evolução).',
          },
        },
      ],
    })

    // ------------------------------------------------------------------
    // 4. plataforma_config: parâmetros de janela de análise
    // ------------------------------------------------------------------
    try {
      const configCol = app.findCollectionByNameOrId('platform_config')
      let exists = null
      try {
        exists = app.findFirstRecordByData('platform_config', 'key', 'analista_evolucao_config')
      } catch (_) {}

      if (!exists) {
        const rec = new Record(configCol)
        rec.set('key', 'analista_evolucao_config')
        rec.set('value', {
          analysis_window_days: 90,
          max_logs_analyzed: 2000,
          agent_slug: 'analista-evolucao',
        })
        rec.set(
          'description',
          'Configuração do Analista de Evolução (IA): janela de análise, limite de séries lidas e slug do agente nativo.',
        )
        app.save(rec)
      }
    } catch (err) {
      console.log('[0136] platform_config analista_evolucao_config: ' + err.message)
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'analista-evolucao')
    } catch (_) {}
    try {
      const insights = app.findCollectionByNameOrId('ai_insights')
      app.delete(insights)
    } catch (_) {}
    try {
      const csv = app.findCollectionByNameOrId('ai_csv_imports')
      app.delete(csv)
    } catch (_) {}
    try {
      const cfg = app.findFirstRecordByData('platform_config', 'key', 'analista_evolucao_config')
      if (cfg) app.delete(cfg)
    } catch (_) {}
  },
)

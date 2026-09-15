/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar platform_config com:
    // - pro_parceiro_price_monthly: 149
    // - pro_parceiro_price_annual: 1490 (10x anual)
    // - pro_parceiro_floor: 150
    // - partner_ai_limits: alunos ilimitados (ex: 99999) e franquias altas
    const configCol = app.findCollectionByNameOrId('platform_config')

    const proParceiroConfigs = [
      {
        key: 'pro_parceiro_price_monthly',
        value: 149,
        description: 'Mensalidade do plano PRO PARCEIRO (R$ 149/mês)',
      },
      {
        key: 'pro_parceiro_price_annual',
        value: 1490,
        description: 'Anuidade do plano PRO PARCEIRO (R$ 1.490 = 10x mensalidade)',
      },
      {
        key: 'pro_parceiro_floor',
        value: 150,
        description:
          'Piso mínimo de contagem de serviços para pontuação do PRO PARCEIRO no ranking (150 atendimentos equivalentes)',
      },
      {
        key: 'partner_ai_limits',
        value: {
          workouts_per_month: 500,
          messages_per_month: 1000,
          max_students: 999999, // Alunos ilimitados na carteira do parceiro PRO
        },
        description: 'Franquias e capacidade de alunos para parceiros PRO (alunos ilimitados)',
      },
      {
        key: 'plan_multipliers',
        value: {
          gratis: 0,
          basico: 1,
          pro: 2,
          premium: 3,
          pro_parceiro: 1, // Multiplicador de plano 1X para parceiro e aluno vinculado
        },
        description:
          'Multiplicadores oficiais de plano: Grátis 0x, Básico 1x, Pro 2x, Premium 3x, PRO PARCEIRO 1x',
      },
    ]

    for (const item of proParceiroConfigs) {
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

    // 2. Semear templates determinísticos aprovados por profissionais (40+ e 60+)
    const templatesCol = app.findCollectionByNameOrId('workout_templates')

    const seedTemplates = [
      // Template 1: 40-59 anos - Hipertrofia Funcional e Preservação Articular
      {
        code: 'TPL-4059-HIPERTROFIA-A',
        title: '[TESTE] Hipertrofia Funcional & Longevidade Articular (40-59 anos)',
        target_age_group: '40-59',
        modality: 'Hipertrofia Funcional',
        approved_by_cref: 'CREF 089412-G/SP — Dr. Rodrigo M. Silveira',
        guidelines:
          'Controle de cadência excêntrica (3s), intervalo de 60-90s, progressão semanal de repetições antes de subir carga.',
        is_active: true,
        exercises_structure: [
          {
            block: 'Aquecimento e Ativação',
            exercises: [
              {
                name: 'Mobilidade Torácica no Solo',
                sets: '2',
                reps: '10 cada lado',
                load: 'Peso corporal',
                rest: '45s',
              },
              {
                name: 'Ativação Glútea com Miniband',
                sets: '2',
                reps: '15',
                load: 'Elástico leve',
                rest: '45s',
              },
            ],
          },
          {
            block: 'Pilar Principal de Força',
            exercises: [
              {
                name: 'Agachamento Goblet com Halter',
                sets: '4',
                reps: '10-12',
                load: 'Moderada progressiva',
                rest: '75s',
              },
              {
                name: 'Supino Reto com Halteres e Pegada Neutra',
                sets: '4',
                reps: '10',
                load: 'Moderada',
                rest: '75s',
              },
              {
                name: 'Puxada Articulada Aberta',
                sets: '4',
                reps: '10-12',
                load: 'Moderada',
                rest: '75s',
              },
            ],
          },
          {
            block: 'Resistência e Estabilidade do Core',
            exercises: [
              {
                name: 'Prancha Abdominal com Apoio nos Antebraços',
                sets: '3',
                reps: '40s',
                load: 'Peso corporal',
                rest: '60s',
              },
              {
                name: 'Farmer Walk Unilateral com Halter',
                sets: '3',
                reps: '20 passos',
                load: 'Moderada a alta',
                rest: '60s',
              },
            ],
          },
        ],
      },
      // Template 2: 40-59 anos - Condicionamento Metabólico e Densidade Óssea
      {
        code: 'TPL-4059-COND-B',
        title: '[TESTE] Condicionamento e Saúde Óssea / Metabólica (40-59 anos)',
        target_age_group: '40-59',
        modality: 'Força & Condicionamento',
        approved_by_cref: 'CREF 051289-G/RJ — Profa. Camila V. Diniz',
        guidelines:
          'Estímulo de impacto moderado e tração axial para mineralização óssea com segurança articular.',
        is_active: true,
        exercises_structure: [
          {
            block: 'Aquecimento Dinâmico',
            exercises: [
              {
                name: 'Polichinelo Baixo Impacto / Passada Lateral',
                sets: '2',
                reps: '20',
                load: 'Livre',
                rest: '30s',
              },
              {
                name: 'Alongamento Dinâmico de Isquiotibiais',
                sets: '2',
                reps: '10 cada lado',
                load: 'Livre',
                rest: '45s',
              },
            ],
          },
          {
            block: 'Força Axial',
            exercises: [
              {
                name: 'Levantamento Terra Romeno com Barra',
                sets: '3',
                reps: '10-12',
                load: 'Moderada controlada',
                rest: '90s',
              },
              {
                name: 'Desenvolvimento Militar Sentado com Halteres',
                sets: '3',
                reps: '10',
                load: 'Moderada',
                rest: '75s',
              },
              {
                name: 'Remada Curvada com Halteres',
                sets: '3',
                reps: '12',
                load: 'Moderada',
                rest: '75s',
              },
            ],
          },
          {
            block: 'Metabólico e Coordenação',
            exercises: [
              {
                name: 'Remo Seco ou Bike Ergométrica (Intervalos)',
                sets: '5',
                reps: '45s ativo / 45s leve',
                load: 'RPE 7/10',
                rest: '45s',
              },
            ],
          },
        ],
      },
      // Template 3: 60+ anos - Multicomponente (Força + Equilíbrio + Marcha)
      {
        code: 'TPL-60PLUS-MULTICOMP-A',
        title: '[TESTE] Multicomponente 60+ (Força Funcional + Equilíbrio + Autonomia)',
        target_age_group: '60+',
        modality: 'Multicomponente Geriátrico',
        approved_by_cref:
          'CREF 010452-G/SP — Dr. Marcelo B. Antunes (Especialista em Envelhecimento Ativo)',
        guidelines:
          'Diretriz OMS / ACSM para 60+: frequência mínima 3x/semana. Ênfase em força de membros inferiores para prevenção de quedas. Testes funcionais a cada 8 semanas (Timed Up and Go + Sentar e Levantar).',
        is_active: true,
        exercises_structure: [
          {
            block: 'Aquecimento e Propriocepção',
            exercises: [
              {
                name: 'Circundução de Tornozelos e Ombros',
                sets: '2',
                reps: '10 giros',
                load: 'Livre',
                rest: '30s',
              },
              {
                name: 'Equilíbrio Unipodal com Apoio Leve na Barra/Cadeira',
                sets: '3',
                reps: '20s cada perna',
                load: 'Livre',
                rest: '45s',
              },
            ],
          },
          {
            block: 'Força Funcional e Autonomia Diária',
            exercises: [
              {
                name: 'Sentar e Levantar da Cadeira com Controle',
                sets: '3',
                reps: '10-12',
                load: 'Peso corporal ou halter 2kg',
                rest: '60s',
              },
              {
                name: 'Elevação de Panturrilha em Pé com Apoio',
                sets: '3',
                reps: '15',
                load: 'Peso corporal',
                rest: '45s',
              },
              {
                name: 'Remada Baixa Sentada no Elástico',
                sets: '3',
                reps: '12',
                load: 'Tensão moderada',
                rest: '60s',
              },
              {
                name: 'Press de Peito no Elástico em Pé',
                sets: '3',
                reps: '12',
                load: 'Tensão moderada',
                rest: '60s',
              },
            ],
          },
          {
            block: 'Treino de Marcha e Coordenação Motora',
            exercises: [
              {
                name: 'Marcha Tandem (Pé ante Pé em Linha Reta)',
                sets: '3',
                reps: '10 passos ida e volta',
                load: 'Livre',
                rest: '45s',
              },
              {
                name: 'Respiração Diafragmática e Relaxamento',
                sets: '1',
                reps: '3 minutos',
                load: 'Livre',
                rest: '0s',
              },
            ],
          },
        ],
      },
      // Template 4: 60+ anos - Estabilidade de Tronco e Força Resistida
      {
        code: 'TPL-60PLUS-MULTICOMP-B',
        title: '[TESTE] Fortalecimento & Estabilidade Central 60+',
        target_age_group: '60+',
        modality: 'Multicomponente & Postura',
        approved_by_cref: 'CREF 010452-G/SP — Dr. Marcelo B. Antunes',
        guidelines:
          'Manutenção da massa muscular esquelética, marcha estável e postura ereta. Reavaliação a cada 8 semanas.',
        is_active: true,
        exercises_structure: [
          {
            block: 'Mobilidade Ativa',
            exercises: [
              {
                name: 'Mobilidade de Quadril Sentado',
                sets: '2',
                reps: '10 cada lado',
                load: 'Livre',
                rest: '30s',
              },
              {
                name: 'Gato-Camelo Suave no Solo ou Cadeira',
                sets: '2',
                reps: '8 ciclos',
                load: 'Livre',
                rest: '45s',
              },
            ],
          },
          {
            block: 'Treinamento Resistido',
            exercises: [
              {
                name: 'Leg Press Horizontal ou Cadeira Extensora Leve',
                sets: '3',
                reps: '10-12',
                load: 'Leve a moderada',
                rest: '75s',
              },
              {
                name: 'Puxada Aberta na Polia',
                sets: '3',
                reps: '10-12',
                load: 'Moderada controlada',
                rest: '60s',
              },
              {
                name: 'Passada Lateral com Apoio de Segurança',
                sets: '3',
                reps: '8 cada lado',
                load: 'Livre',
                rest: '60s',
              },
            ],
          },
          {
            block: 'Equilíbrio Dinâmico',
            exercises: [
              {
                name: 'Desvio de Obstáculos Baixos no Solo (Cones)',
                sets: '3',
                reps: '4 voltas guiadas',
                load: 'Livre',
                rest: '60s',
              },
            ],
          },
        ],
      },
    ]

    for (const tpl of seedTemplates) {
      try {
        const existing = app.findFirstRecordByData('workout_templates', 'code', tpl.code)
        existing.set('title', tpl.title)
        existing.set('target_age_group', tpl.target_age_group)
        existing.set('modality', tpl.modality)
        existing.set('approved_by_cref', tpl.approved_by_cref)
        existing.set('guidelines', tpl.guidelines)
        existing.set('exercises_structure', tpl.exercises_structure)
        existing.set('is_active', tpl.is_active)
        app.save(existing)
      } catch (_) {
        const rec = new Record(templatesCol)
        rec.set('code', tpl.code)
        rec.set('title', tpl.title)
        rec.set('target_age_group', tpl.target_age_group)
        rec.set('modality', tpl.modality)
        rec.set('approved_by_cref', tpl.approved_by_cref)
        rec.set('guidelines', tpl.guidelines)
        rec.set('exercises_structure', tpl.exercises_structure)
        rec.set('is_active', tpl.is_active)
        app.save(rec)
      }
    }

    // 3. Atualizar o Regulamento Oficial de Planos e Mensalidades (slug: regulamento-planos-mensalidades)
    // Atualizar PRO PARCEIRO para R$ 149,00 / R$ 1.490 / piso 150 / alunos ilimitados / multiplicador 1x
    // Incrementar versão do documento para disparar modal de re-aceite aos usuários
    try {
      const legalDocs = app.findCollectionByNameOrId('legal_documents')
      const nowIso = new Date().toISOString()
      const nowIsoPb = nowIso.replace('T', ' ').slice(0, 19)

      const updatedRegulamentoBody = `## Regulamento Oficial de Planos, Mensalidades e Recorrência 369TRAINING

### 1. Estrutura de Planos e Mensalidades do Aluno
A partir da versão v2 de Precificação aprovada em 14/09, o aluno/cliente da plataforma 369TRAINING passa a pagar mensalidade fixa de acesso ao ecossistema, sem incidência de tarifa avulsa por serviço:
- **Plano Grátis:** R$ 0,00/mês — Multiplicador 0x no ranking (sem pontuação e sem repasse de cashback). Sem acesso ao Agente 369.
- **Plano Básico:** R$ 10,00/mês (ou R$ 100,00 na assinatura Anual de 10×) — Multiplicador 1x no ranking. Inclui 4 treinos/mês gerados pelo Agente 369.
- **Plano Pro:** R$ 20,00/mês (ou R$ 200,00 na assinatura Anual de 10×) — Multiplicador 2x no ranking. Inclui 12 treinos/mês, 10 mensagens de chat com o Agente 369, ajuste por sono (smartwatch) e progressão de carga.
- **Plano Premium:** R$ 30,00/mês (ou R$ 300,00 na assinatura Anual de 10×) — Multiplicador 3x no ranking. Inclui treinos ilimitados via IA (fair use), 60 mensagens de chat, ajuste por sono, progressão automática e módulo exclusivo de ciclo menstrual com ajuste por sintomas do dia.

### 2. Regra Especial de Vínculo com Profissional
O aluno que estiver ativamente vinculado a um profissional credenciado na plataforma:
- **Isenção de Mensalidade:** Não paga mensalidade durante a vigência do vínculo ("Grátis enquanto vinculado a um profissional").
- **Pontuação no Plano do Profissional:** O aluno vinculado pontua no ranking mensal com o multiplicador correspondente ao plano do seu profissional mentor (ex: mentor PRO PARCEIRO garante multiplicador 1x e franquias equivalentes ao aluno).
- **Tarifa do Atendimento:** A tarifa do serviço concluído é de responsabilidade integral do profissional credenciado (R$ 1,00 a R$ 3,00 conforme o plano do profissional).

### 3. Plano PRO PARCEIRO do Profissional (Atualização Oficial)
O profissional credenciado pode optar pela modalidade de alta performance **PRO PARCEIRO**:
- **Valor da Assinatura:** R$ 149,00 por mês (ou R$ 1.490,00 no plano Anual de 10×).
- **Alunos Ilimitados:** Sem restrição de quantidade de alunos gerenciados na carteira do parceiro PRO.
- **Multiplicador do Plano:** Multiplicador 1x para o parceiro PRO e para todos os alunos a ele vinculados.
- **Piso Garantido no Ranking:** Piso equivalente a 150 atendimentos/serviços mensais computados para o cálculo de pontuação (\`max(serviços reais, 150)\`).
- **Fórmula de Pontuação:** PONTOS = PLANO × max(serviços_reais, 150) × INDICAÇÕES + AVALIAÇÃO + ANTIGUIDADE.
- **Tarifa de Atendimento:** Tarifa de R$ 2,00 por serviço concluído permanece ativa e alimenta diretamente o pool de cashback de 38%, além da contribuição percentual da mensalidade fixa.
- **Recursos Exclusivos:** Acesso ao Radar 369 semanal com evidências científicas, selo "Parceiro PRO" em destaque, painel preditivo de aderência da carteira com IA e franquias multi-aluno expandidas.

### 4. Franquias Digitais do Agente 369 e Cobrança de Excedente
O uso do Agente 369 obedece a franquias mensais computadas por calendário civil.
- **Excedente:** Caso o usuário esgote sua franquia mensal de treinos ou mensagens, poderá continuar gerando mediante débito automático do saldo em sua carteira digital da plataforma:
  • R$ 0,25 por treino adicional gerado;
  • R$ 0,10 por mensagem adicional de chat com o Agente 369.
- Os treinos gerados pelo Agente IA são instrumentos de apoio e **NÃO contabilizam pontos como serviços no Ranking 369** (apenas atendimentos concluídos com profissionais credenciados pontuam).

### 5. Módulo Ciclo Menstrual e Proteção de Dados Sensíveis (Art. 11 LGPD)
O módulo de ciclo menstrual é restrito a assinantes do Plano Premium e exige consentimento específico prévio para tratamento de dados sensíveis de saúde (Art. 11 da Lei 13.709/2018). Caso o consentimento seja revogado pelo usuário no painel LGPD, o módulo será bloqueado e o registro histórico protegido. O motor do agente ajusta o treino exclusivamente com base em sintomas relatados no dia (fadiga, cólica, dores), rejeitando prescrições automáticas por dogmas de fases hormonais sem comprovação clínica individual.

### 6. Direito de Arrependimento e Cancelamento (CDC Art. 49)
Em estrita observância ao **Artigo 49 do Código de Defesa do Consumidor (Lei Federal nº 8.078/1990)**, o contratante de qualquer assinatura mensal ou anual poderá exercer o direito de arrependimento no prazo improrrogável de até **7 (sete) dias corridos** a contar da data de contratação ou do primeiro pagamento, com reembolso integral dos valores despendidos.

### 7. Inadimplência e Suspensão Temporária
Caso a mensalidade não seja liquidada até o vencimento:
- O status da assinatura passará a \`inadimplente\`.
- O usuário sofrerá downgrade automático temporário para o **Plano Grátis (0x)**, mantendo acesso às rotinas básicas, com suspensão da pontuação no ranking e da participação no rateio do pool até a regularização.`

      try {
        const doc = app.findFirstRecordByData(
          'legal_documents',
          'slug',
          'regulamento-planos-mensalidades',
        )
        const oldVersion = doc.getInt('version') || 1
        const newVersion = oldVersion + 1
        doc.set('body', updatedRegulamentoBody)
        doc.set('version', newVersion)
        doc.set('status', 'publicado')
        doc.set('audience', 'todos')
        doc.set('published_at', nowIsoPb)

        let history = []
        try {
          history = doc.get('version_history') || []
        } catch (_) {}
        if (!Array.isArray(history)) history = []
        history.push({
          version: newVersion,
          published_at: nowIsoPb,
          summary:
            'Atualização Rodada 3: PRO PARCEIRO R$ 149/mês (anual 10x), piso de 150 serviços, alunos ilimitados, multiplicador 1x e regras do Agente 369.',
        })
        doc.set('version_history', history)
        app.save(doc)
      } catch (_) {
        const newDoc = new Record(legalDocs)
        newDoc.set('slug', 'regulamento-planos-mensalidades')
        newDoc.set('title', 'Regulamento de Planos e Mensalidades')
        newDoc.set('body', updatedRegulamentoBody)
        newDoc.set('version', 2)
        newDoc.set('status', 'publicado')
        newDoc.set('audience', 'todos')
        newDoc.set('published_at', nowIsoPb)
        newDoc.set('version_history', [
          {
            version: 2,
            published_at: nowIsoPb,
            summary:
              'Atualização Rodada 3: PRO PARCEIRO R$ 149/mês, piso 150, alunos ilimitados, multiplicador 1x.',
          },
        ])
        app.save(newDoc)
      }
    } catch (errDoc) {
      console.log('Aviso ao atualizar regulamento de planos:', errDoc.message)
    }

    // 4. Atualizar também Regulamento do Cashback se citar valores do PRO PARCEIRO
    try {
      const cbDoc = app.findFirstRecordByData('legal_documents', 'slug', 'regulamento-cashback')
      const currentCb = cbDoc.getString('body') || ''
      if (!currentCb.includes('piso mínimo de 150 serviços')) {
        const updatedCb = `${currentCb}

### Atualização — Plano PRO PARCEIRO (R$ 149/mês & Piso de 150 Serviços)
Para efeitos de equalização e distribuição colaborativa, o plano PRO PARCEIRO passa a contar com piso de 150 serviços equivalentes (\`max(serviços reais, 150)\`), multiplicador de plano 1x e contribuição percentual de sua mensalidade fixa para o Pool 38%.`
        cbDoc.set('body', updatedCb)
        cbDoc.set('version', (cbDoc.getInt('version') || 1) + 1)
        cbDoc.set('published_at', new Date().toISOString().replace('T', ' ').slice(0, 19))
        app.save(cbDoc)
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter valores para a versão anterior se necessário
    try {
      const pMonthly = app.findFirstRecordByData(
        'platform_config',
        'key',
        'pro_parceiro_price_monthly',
      )
      pMonthly.set('value', 49)
      app.save(pMonthly)
    } catch (_) {}
    try {
      const pAnnual = app.findFirstRecordByData(
        'platform_config',
        'key',
        'pro_parceiro_price_annual',
      )
      pAnnual.set('value', 490)
      app.save(pAnnual)
    } catch (_) {}
    try {
      const pFloor = app.findFirstRecordByData('platform_config', 'key', 'pro_parceiro_floor')
      pFloor.set('value', 10)
      app.save(pFloor)
    } catch (_) {}
  },
)

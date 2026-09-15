migrate(
  (app) => {
    // 1. Criar novo documento legal: "Regulamento de Planos e Mensalidades"
    // Slug: regulamento-planos-mensalidades
    // Audience: todos
    const legalCol = app.findCollectionByNameOrId('legal_documents')
    const nowIso = new Date().toISOString()
    const nowIsoPb = nowIso.replace('T', ' ').slice(0, 19)

    const regulamentoBody = `## Regulamento Oficial de Planos, Mensalidades e Recorrência 369TRAINING

### 1. Estrutura de Planos e Mensalidades do Aluno
A partir da versão v2 de Precificação aprovada em 14/09, o aluno/cliente da plataforma 369TRAINING passa a pagar mensalidade fixa de acesso ao ecossistema, sem incidência de tarifa avulsa por serviço:
- **Plano Grátis:** R$ 0,00/mês — Multiplicador 0x no ranking (sem pontuação e sem repasse de cashback).
- **Plano Básico:** R$ 10,00/mês (ou R$ 100,00 na assinatura Anual de 10×) — Multiplicador 1x no ranking.
- **Plano Pro:** R$ 20,00/mês (ou R$ 200,00 na assinatura Anual de 10×) — Multiplicador 2x no ranking.
- **Plano Premium:** R$ 30,00/mês (ou R$ 300,00 na assinatura Anual de 10×) — Multiplicador 3x no ranking.

### 2. Regra Especial de Vínculo com Profissional
O aluno que estiver ativamente vinculado a um profissional credenciado na plataforma:
- **Isenção de Mensalidade:** Não paga mensalidade durante a vigência do vínculo ("Grátis enquanto vinculado a um profissional").
- **Pontuação no Plano do Profissional:** O aluno vinculado pontua no ranking mensal com o multiplicador correspondente ao plano do seu profissional mentor.
- **Tarifa do Atendimento:** A tarifa do serviço concluído é de responsabilidade integral do profissional credenciado (R$ 1,00 a R$ 3,00 conforme o plano do profissional).

### 3. Regras de Borda, Desvinculação e Transição
- **Desvinculação Voluntária:** Em caso de cancelamento do vínculo pelo aluno ou pelo profissional, o aluno gozará de aviso prévio de 30 (trinta) dias sem cobrança. A mensalidade do plano correspondente passará a ser exigida apenas a partir do ciclo mensal imediatamente seguinte.
- **Profissional Desligado ou Suspenso:** Na hipótese de o profissional ter seu credenciamento suspenso ou cancelado, os alunos da sua carteira receberão notificação imediata com janela de tolerância de 15 (quinze) dias para escolha de um novo profissional credenciado ou formalização de assinatura direta de plano de aluno.

### 4. Plano PRO PARCEIRO do Profissional
O profissional credenciado pode optar pela modalidade fixa **PRO PARCEIRO**:
- **Valor:** R$ 49,00 por mês (ou R$ 490,00 no plano Anual de 10×).
- **Piso Garantido no Ranking:** Piso fixo de pontuação equivalente a 10 atendimentos concluídos, utilizando no cálculo do ranking \`max(serviços reais, 10)\`.
- **Alimentação do Pool:** A tarifa de R$ 2,00 por serviço concluído permanece ativa e alimenta diretamente o pool de cashback de 38%, além da contribuição percentual da mensalidade fixa.
- **Recursos Exclusivos:** Acesso ao Radar 369 semanal com evidências científicas, selo "Parceiro PRO" em destaque e painel preditivo de aderência da carteira.

### 5. Direito de Arrependimento e Cancelamento (CDC Art. 49)
Em estrita observância ao **Artigo 49 do Código de Defesa do Consumidor (Lei Federal nº 8.078/1990)**, o contratante de qualquer assinatura mensal ou anual poderá exercer o direito de arrependimento no prazo improrrogável de até **7 (sete) dias corridos** a contar da data de contratação ou do primeiro pagamento, com reembolso integral dos valores despendidos.

### 6. Inadimplência e Suspensão Temporária
Caso a mensalidade não seja liquidada até o vencimento:
- O status da assinatura passará a \`inadimplente\`.
- O usuário sofrerá downgrade automático temporário para o **Plano Grátis (0x)**, mantendo acesso às rotinas básicas, com suspensão da pontuação no ranking e da participação no rateio do pool até a regularização.`

    try {
      const doc = app.findFirstRecordByData(
        'legal_documents',
        'slug',
        'regulamento-planos-mensalidades',
      )
      doc.set('body', regulamentoBody)
      doc.set('version', doc.getInt('version') + 1)
      doc.set('status', 'publicado')
      doc.set('audience', 'todos')
      doc.set('published_at', nowIsoPb)
      app.save(doc)
    } catch (_) {
      const newDoc = new Record(legalCol)
      newDoc.set('slug', 'regulamento-planos-mensalidades')
      newDoc.set('title', 'Regulamento de Planos e Mensalidades')
      newDoc.set('body', regulamentoBody)
      newDoc.set('version', 1)
      newDoc.set('status', 'publicado')
      newDoc.set('audience', 'todos')
      newDoc.set('published_at', nowIsoPb)
      newDoc.set('version_history', [
        {
          version: 1,
          published_at: nowIsoPb,
          summary: 'Publicação oficial do Regulamento de Planos e Mensalidades v2 (14/09)',
        },
      ])
      app.save(newDoc)
    }

    // 2. Atualizar "Regulamento do Cashback" (slug: regulamento-cashback) e Termos de Uso
    // para registrar que o Pool 38% é alimentado por mensalidades de alunos não vinculados + % PRO PARCEIRO + tarifas
    try {
      const cbDoc = app.findFirstRecordByData('legal_documents', 'slug', 'regulamento-cashback')
      const currentBody = cbDoc.getString('body')
      const updatedBody = `${currentBody}

### Atualização v2 — Alimentação do Pool 38% Colaborativo
A partir de 14/09, o Pool Global de 38% é alimentado por:
1. Mensalidades fixas pagas pelos alunos não vinculados a profissionais (R$ 10, R$ 20, R$ 30);
2. Percentual da mensalidade do plano PRO PARCEIRO (default 38%);
3. Tarifas de todos os serviços concluídos na plataforma debitadas dos profissionais (R$ 1,00 a R$ 3,00).

O fechamento mensal mantém a exigência de lastro financeiro real comprovado: na ausência de entradas efetivas no ciclo, nenhum cashback é distribuído.`

      cbDoc.set('body', updatedBody)
      cbDoc.set('version', cbDoc.getInt('version') + 1)
      cbDoc.set('published_at', nowIsoPb)
      app.save(cbDoc)
    } catch (_) {}

    // 3. Semear dados de teste do Radar 369 na coleção radar_briefings com prefixo "TESTE"
    const radarCol = app.findCollectionByNameOrId('radar_briefings')
    const testCycle = new Date().toISOString().slice(0, 7) + '-W1'

    const testBriefings = [
      {
        specialty: 'Educação Física',
        cycle: testCycle,
        items: [
          {
            title: '[TESTE] Evidências sobre Volume vs. Intensidade na Hipertrofia de Quadríceps',
            evidence_level: 'Evidência Forte (Metanálise)',
            source_name: 'Sports Medicine Journal (2026)',
            source_url: 'https://doi.org/10.1007/s40279-026-02000-x',
            summary:
              '[TESTE] Estudo randomizado demonstrou que séries próximas à falha concêntrica com 6-12 repetições otimizam síntese proteica sem sobrecarga tendínea.',
            council_update:
              'Atualização CONFEF: registro obrigatório de prescrição individualizada em prontuário eletrônico.',
            content_suggestion:
              'Post carrossel: "3 erros clássicos no agachamento profundo respaldados pela ciência".',
          },
          {
            title: '[TESTE] Efeito do Treinamento Resistido na Densidade Mineral Óssea em Idosos',
            evidence_level: 'Evidência Forte (Ensaio Clínico)',
            source_name: 'Journal of Bone and Mineral Research',
            source_url: 'https://doi.org/10.1002/jbmr.4800',
            summary:
              '[TESTE] Cargas progressivas de 70-85% 1RM aumentaram osteocalcina sérica em 18% após 16 semanas.',
            council_update: 'Recomendação técnica para anamnese de fragilidade óssea.',
            content_suggestion: 'Vídeo curto de 30s demonstrando progressão de carga segura.',
          },
        ],
      },
      {
        specialty: 'Nutrição',
        cycle: testCycle,
        items: [
          {
            title:
              '[TESTE] Timing de Creatina Monohidratada no Pós-Treino com Carboidratos Simples',
            evidence_level: 'Evidência Forte (Revisão Sistemática)',
            source_name: 'American Journal of Clinical Nutrition',
            source_url: 'https://doi.org/10.1016/j.ajcnut.2026.01.010',
            summary:
              '[TESTE] Ingestão pós-treino associada a carboidrato de alto índice glicêmico elevou saturação muscular em 12% a mais do que pré-treino.',
            council_update:
              'Resolução CFN: diretrizes para conduta em suplementação de creatina pura.',
            content_suggestion:
              'Dica do dia: "Quando e como tomar creatina para máximo aproveitamento celular".',
          },
        ],
      },
      {
        specialty: 'Fisioterapia',
        cycle: testCycle,
        items: [
          {
            title: '[TESTE] Exercícios Excêntricos na Tendinopatia Patelar Refratária',
            evidence_level: 'Evidência Forte (Cochrane Review)',
            source_name: 'British Journal of Sports Medicine',
            source_url: 'https://doi.org/10.1136/bjsports-2026-107000',
            summary:
              '[TESTE] Protocolo Heavy Slow Resistance mostrou superioridade de desfecho em 6 meses comparado a repouso e anti-inflamatórios.',
            council_update:
              'CREFITO: normativas de telereabilitação e registro assinado digitalmente.',
            content_suggestion:
              'Checklist para alunos: como identificar desconforto patelar precoce.',
          },
        ],
      },
    ]

    for (const b of testBriefings) {
      try {
        const existing = app.findRecordsByFilter(
          'radar_briefings',
          `specialty = '${b.specialty}' && cycle = '${b.cycle}'`,
          '-created',
          1,
          0,
        )
        if (existing && existing.length > 0) continue
      } catch (_) {}

      const rec = new Record(radarCol)
      rec.set('specialty', b.specialty)
      rec.set('cycle', b.cycle)
      rec.set('items', b.items)
      rec.set('published_at', nowIsoPb)
      rec.set('is_mock', true)
      app.save(rec)
    }
  },
  (app) => {
    try {
      const doc = app.findFirstRecordByData(
        'legal_documents',
        'slug',
        'regulamento-planos-mensalidades',
      )
      app.delete(doc)
    } catch (_) {}
  },
)

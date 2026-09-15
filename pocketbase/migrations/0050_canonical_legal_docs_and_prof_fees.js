migrate(
  (app) => {
    const nowIso = new Date().toISOString()
    const nowIsoPb = nowIso.replace('T', ' ').slice(0, 19)

    // ==========================================
    // PARTE 1 — RODADA A: CONTRATOS CANÔNICOS & DADOS SENSÍVEIS
    // ==========================================
    let canonicalDoc = null
    try {
      const records = app.findRecordsByFilter(
        'legal_documents',
        "slug = 'lgpd-consentimentos'",
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        canonicalDoc = records[0]
      }
    } catch (_) {}

    let duplicateDoc = null
    try {
      const records = app.findRecordsByFilter(
        'legal_documents',
        "slug = 'consentimento-dados-sensiveis-saude'",
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        duplicateDoc = records[0]
      }
    } catch (_) {}

    if (duplicateDoc) {
      // Despublicar o duplicado
      duplicateDoc.set('status', 'arquivado')
      app.save(duplicateDoc)
    }

    if (canonicalDoc) {
      canonicalDoc.set('status', 'publicado')
      canonicalDoc.set('audience', 'todos')
      canonicalDoc.set(
        'title',
        'Consentimento Específico para Tratamento de Dados Sensíveis de Saúde (Art. 11 LGPD)',
      )
      app.save(canonicalDoc)

      // Migrar aceites de consentimento-dados-sensiveis-saude -> lgpd-consentimentos
      try {
        app
          .db()
          .newQuery(
            `UPDATE legal_acceptances
             SET document = {:canonicalId},
                 document_slug = 'lgpd-consentimentos'
             WHERE document_slug = 'consentimento-dados-sensiveis-saude'
                OR (document = {:duplicateId} AND {:duplicateId} != '')`,
          )
          .bind({
            canonicalId: canonicalDoc.id,
            duplicateId: duplicateDoc ? duplicateDoc.id : '',
          })
          .execute()
      } catch (errAcc) {
        console.log('Aviso ao migrar aceites de dados sensíveis:', errAcc.message)
      }
    }

    // ==========================================
    // PARTE 2 — RODADA B: REGULAMENTO DE PLANOS & MENSALIDADES
    // ==========================================
    const updatedRegulamentoBody = `## Regulamento Oficial de Planos, Mensalidades e Tarifas de Serviços 369TRAINING

### 1. Estrutura de Planos e Mensalidades Fixas do ALUNO
A mensalidade fixa é exclusiva para alunos/clientes da plataforma 369TRAINING, sem cobrança de tarifas avulsas por serviço concluído:
- **Plano Grátis:** R$ 0,00/mês — Multiplicador 0x no ranking (sem pontuação e sem rateio de cashback). Acesso a rotinas essenciais.
- **Plano Básico:** R$ 10,00/mês (ou R$ 100,00 na assinatura Anual de 10×) — Multiplicador 1.0x no ranking mensal. Inclui 4 treinos/mês pelo Agente 369.
- **Plano Pro:** R$ 20,00/mês (ou R$ 200,00 na assinatura Anual de 10×) — Multiplicador 2.0x no ranking. Inclui 12 treinos/mês, 10 mensagens de chat com o Agente 369, ajuste por sono (smartwatch) e progressão de carga.
- **Plano Premium:** R$ 30,00/mês (ou R$ 300,00 na assinatura Anual de 10×) — Multiplicador 3.0x no ranking (aceleração máxima). Inclui treinos ilimitados via IA (fair use), 60 mensagens de chat, ajuste por sono, progressão automática e módulo exclusivo de ciclo menstrual.

### 2. Regra Especial de Isenção do Aluno Vinculado
O aluno que estiver ativamente vinculado a um profissional credenciado na plataforma:
- **Isenção Total:** Fica 100% isento de mensalidade durante todo o período do vínculo ("Grátis enquanto vinculado a um profissional").
- **Pontuação no Plano do Mentor:** O aluno pontua no ranking mensal com o multiplicador do profissional mentor.
- **Tarifa do Atendimento:** A tarifa do serviço concluído é de responsabilidade integral do profissional credenciado contratado.

### 3. Estrutura de Planos do PROFISSIONAL (Por Tarifa de Serviço — SEM Mensalidade Fixa)
Os planos Básico, Pro e Premium do Profissional operam por modelo de tarifa por serviço concluído, **SEM cobrança de qualquer mensalidade fixa**:
- **Profissional Básico:** SEM MENSALIDADE FIXA. Tarifa operacional de **R$ 1,00** por serviço concluído debitada na conclusão. Multiplicador 1.0x no ranking.
- **Profissional Pro:** SEM MENSALIDADE FIXA. Tarifa operacional de **R$ 2,00** por serviço concluído debitada na conclusão. Multiplicador 2.0x no ranking.
- **Profissional Premium:** SEM MENSALIDADE FIXA. Tarifa operacional de **R$ 3,00** por serviço concluído debitada na conclusão. Multiplicador 3.0x no ranking e IA Experts ilimitada.

### 4. Assinatura PRO PARCEIRO do Profissional
Modalidade premium de alta performance e parceria institucional da plataforma:
- **Assinatura Fixa:** R$ 149,00/mês (ou R$ 1.490,00 no plano Anual de 10×, configurável no painel administrativo).
- **Alunos Ilimitados:** Capacidade ilimitada de alunos vinculados na carteira do parceiro PRO.
- **Multiplicador do Plano:** Multiplicador 1.0x para o parceiro PRO e para todos os alunos a ele vinculados.
- **Piso Garantido no Ranking:** Piso equivalente a 150 atendimentos mensais computados para pontuação: \`max(serviços reais, 150)\`.
- **Fórmula de Pontuação:** PONTOS = PLANO × max(serviços_reais, 150) × INDICAÇÕES + AVALIAÇÃO + ANTIGUIDADE.
- **Tarifa de Atendimento:** Tarifa de R$ 2,00 por serviço concluído (alimenta diretamente o Pool de 38%).
- **Recursos Exclusivos:** Acesso exclusivo ao Radar 369 semanal com evidências científicas compiladas, selo oficial "Parceiro PRO" em destaque nas buscas e perfil, painel de carteira com inteligência preditiva e alertas preditivos de aderência.

### 5. Alimentação do Pool de 38% e Fechamento Mensal
- As tarifas de todos os serviços concluídos (R$ 1, R$ 2 ou R$ 3) e o percentual da assinatura PRO PARCEIRO e de mensalidades de alunos não vinculados alimentam de forma colaborativa o Pool Global de 38%.
- **Bloqueio Sem Lastro:** Na ausência de entradas financeiras reais no ciclo mensal, nenhum cashback é gerado ou distribuído ("sem lastro para distribuição").

### 6. Direito Legal de Arrependimento (CDC Art. 49) e Cancelamento
Nos termos do Artigo 49 do Código de Defesa do Consumidor (Lei Federal nº 8.078/1990), o contratante de qualquer assinatura de aluno ou parceiro PRO possui até 7 (sete) dias corridos para cancelamento com estorno integral.`

    let regDoc = null
    try {
      const records = app.findRecordsByFilter(
        'legal_documents',
        "slug = 'regulamento-planos-mensalidades'",
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        regDoc = records[0]
      }
    } catch (_) {}

    if (regDoc) {
      const currentVersion = regDoc.getInt('version') || 1
      const newVersion = currentVersion + 1

      regDoc.set('body', updatedRegulamentoBody)
      regDoc.set('version', newVersion)
      regDoc.set('status', 'publicado')
      regDoc.set('audience', 'todos')
      regDoc.set('published_at', nowIsoPb)

      let history = []
      try {
        const rawHistory = regDoc.get('version_history')
        if (typeof rawHistory === 'string') {
          history = JSON.parse(rawHistory || '[]')
        } else if (Array.isArray(rawHistory)) {
          history = rawHistory
        }
      } catch (_) {}
      if (!Array.isArray(history)) history = []
      history.push({
        version: newVersion,
        published_at: nowIsoPb,
        summary:
          'Reversão parcial de precificação: planos do profissional voltam a ser por tarifa de serviço (Básico R$ 1, Pro R$ 2, Premium R$ 3) sem mensalidade fixa. PRO PARCEIRO mantido (R$ 149/mês, piso 150, alunos ilimitados, Radar 369). Mensalidades fixas exclusivas do aluno.',
      })
      regDoc.set('version_history', JSON.stringify(history))
      app.save(regDoc)
    } else {
      const legalDocs = app.findCollectionByNameOrId('legal_documents')
      const newDoc = new Record(legalDocs)
      newDoc.set('slug', 'regulamento-planos-mensalidades')
      newDoc.set('title', 'Regulamento de Planos e Mensalidades')
      newDoc.set('body', updatedRegulamentoBody)
      newDoc.set('version', 2)
      newDoc.set('status', 'publicado')
      newDoc.set('audience', 'todos')
      newDoc.set('published_at', nowIsoPb)
      newDoc.set(
        'version_history',
        JSON.stringify([
          {
            version: 2,
            published_at: nowIsoPb,
            summary:
              'Planos do profissional por tarifa de serviço (R$ 1, R$ 2, R$ 3) sem mensalidade fixa. PRO PARCEIRO R$ 149/mês. Mensalidade exclusiva do aluno.',
          },
        ]),
      )
      app.save(newDoc)
    }
  },
  (app) => {},
)

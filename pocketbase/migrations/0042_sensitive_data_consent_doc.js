migrate(
  (app) => {
    const legalDocCol = app.findCollectionByNameOrId('legal_documents')

    try {
      app.findFirstRecordByData('legal_documents', 'slug', 'consentimento-dados-sensiveis-saude')
    } catch (_) {
      const doc = new Record(legalDocCol)
      doc.set('slug', 'consentimento-dados-sensiveis-saude')
      doc.set(
        'title',
        'Termo de Consentimento Específico e Destacado para Tratamento de Dados Pessoais Sensíveis de Saúde (LGPD Art. 11, I)',
      )
      doc.set(
        'body',
        '# Termo de Consentimento Específico e Destacado — Dados Pessoais Sensíveis de Saúde\n\n' +
          '**Lei Geral de Proteção de Dados (Lei Federal nº 13.709/2018 — LGPD, Art. 11, Inciso I)**\n\n' +
          'Este consentimento é **específico, informado, inequívoco e destacado** do aceite dos Termos de Uso gerais da plataforma 369TRAINING.\n\n' +
          '### 1. Dados Pessoais Sensíveis Coletados\n' +
          'Para a prestação de serviços nas áreas de **Treinamento Físico, Nutrição, Fisioterapia e Psicologia/Comportamento**, podemos coletar e tratar os seguintes dados referentes à sua saúde e condições biométricas:\n' +
          '- Histórico de lesões musculares, articulares, patologias e limitações osteoarticulares;\n' +
          '- Dados antropométricos (peso, altura, medidas corporais, percentual de gordura);\n' +
          '- Registro de sintomas de dor, desconforto e mobilidade física;\n' +
          '- Hábitos alimentares, restrições calóricas, alergias e intolerâncias nutricionais;\n' +
          '- Questionários de anamnese esportiva, metas físicas e bem-estar comportamental.\n\n' +
          '### 2. Finalidade Exclusiva do Tratamento\n' +
          'Os dados sensíveis serão estritamente utilizados para:\n' +
          '1. Elaboração de rotinas de treino e dietas personalizadas através dos nossos sistemas de apoio e inteligência artificial assistida;\n' +
          '2. Compartilhamento exclusivo e seguro com o profissional habilitado (CREF, CRN, CRP ou CREFITO) que você contratou ou agendou consulta na plataforma;\n' +
          '3. Prevenção de lesões e acompanhamento da evolução clínica e física do aluno.\n\n' +
          '### 3. Compartilhamento e Sigilo Profissional\n' +
          'Seus dados de saúde **jamais serão vendidos, monetizados ou compartilhados com terceiros para fins publicitários**.\n' +
          'O acesso é restrito aos profissionais devidamente vinculados ao seu atendimento, sujeitos a sigilo ético-profissional.\n\n' +
          '### 4. Direito de Revogação do Consentimento\n' +
          'Conforme o **Artigo 18 da LGPD**, você pode revogar este consentimento a qualquer momento na página **/lgpd-consentimentos**.\n' +
          '**Aviso importante:** A revogação do consentimento acarretará o bloqueio imediato do acesso às áreas clínicas (Treino, Nutrição e Fisioterapia) até que um novo consentimento seja concedido, pois a prescrição sem acesso aos dados de saúde apresenta riscos à segurança física do usuário.',
      )
      doc.set('version', 1)
      doc.set('status', 'publicado')
      doc.set('audience', 'todos')
      doc.set('published_at', new Date().toISOString().replace('T', ' '))
      app.save(doc)
    }

    // Permitir aos usuários autenticados excluírem (revogarem) seu próprio consentimento
    const accCol = app.findCollectionByNameOrId('legal_acceptances')
    accCol.deleteRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    app.save(accCol)
  },
  (app) => {},
)

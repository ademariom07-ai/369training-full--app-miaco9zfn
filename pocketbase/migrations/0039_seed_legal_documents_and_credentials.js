migrate(
  (app) => {
    const legalDocsCol = app.findCollectionByNameOrId('legal_documents')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const credsCol = app.findCollectionByNameOrId('credential_verifications')

    // Obter um admin para relacionar updated_by
    let adminId = ''
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'ademariom07@gmail.com')
      if (adminUser) adminId = adminUser.id
    } catch (_) {}

    const nowIso = new Date().toISOString()
    const nowIsoPb = nowIso.replace('T', ' ').slice(0, 19)

    // 1. SEED LEGAL DOCUMENTS
    const docsSeed = [
      {
        slug: 'termos-aluno',
        title: 'Termos de Uso do Aluno e Cliente',
        version: 1,
        status: 'publicado',
        audience: 'aluno',
        published_at: nowIsoPb,
        body: `## 1. Intermediação de Serviços e Natureza da Plataforma
A **369TRAINING LTDA** opera exclusivamente como plataforma digital tecnológica de intermediação independente entre alunos/clientes e profissionais autônomos habilitados de saúde, condicionamento físico, nutrição, psicologia e fisioterapia.

## 2. Disclaimer Clínico de Emergência e Responsabilidade Médica
> **ATENÇÃO — AVISO MÉDICO E CLÍNICO IMPORTANTE:**
> A plataforma 369TRAINING **não presta serviços médicos de urgência ou emergência médica nem substitui consultas hospitalares presenciais**.
> O profissional autônomo contratado é o **único responsável técnico e ético** pelas orientações, prescrições de exercícios e planos alimentares formulados.
> **Em caso de dor torácica, falta de ar súbita, perda de consciência, lesão traumática aguda ou qualquer sintoma clínico de emergência, procure imediatamente o pronto-socorro mais próximo ou acione o SAMU (192) / Corpo de Bombeiros (193). O aplicativo 369TRAINING não é e nunca operará como canal de pronto-socorro ou urgência médica.**

## 3. Direito de Arrependimento de 7 Dias (CDC art. 49)
Em conformidade integral com o **Artigo 49 do Código de Defesa do Consumidor (Lei Federal nº 8.078/1990)**, o aluno tem o direito incondicional de desistir da contratação de planos de assinatura digital no prazo de até **7 (sete) dias corridos** a contar da data de confirmação do pagamento inicial, com devolução integral e imediata dos valores pagos via PIX ou estorno no cartão.

## 4. Política de Reembolso e Cancelamento de Consultas
- Cancelamentos de sessões agendadas com mais de **24 horas de antecedência**: crédito de 100% restituído na carteira digital para reagendamento.
- Cancelamentos com menos de 24 horas: o profissional tem a faculdade de reter até 50% da taxa de reserva em razão do bloqueio de grade horária.
- Planos mensais podem ser cancelados a qualquer momento pelo painel do aluno sem multas rescisórias adicionais para os ciclos subsequentes.

## 5. Regras de Conduta e Ética na Comunidade
É estritamente vedado aos usuários publicar conteúdos discriminatórios, assediar outros membros ou profissionais, fraudar comprovantes de pagamento ou utilizar ferramentas automatizadas de scraping na plataforma, sob pena de suspensão imediata da conta e responsabilização civil/penal.`,
      },
      {
        slug: 'contrato-parceria-profissional',
        title: 'Contrato de Parceria Comercial e Credenciamento do Profissional',
        version: 1,
        status: 'publicado',
        audience: 'profissional',
        published_at: nowIsoPb,
        body: `## 1. Natureza da Parceria e Ausência de Vínculo Empregatício
O presente Contrato de Parceria Comercial rege a cooperação digital entre a **369TRAINING LTDA** e o **Profissional Parceiro Cadastrado**. As partes reconhecem expressamente que inexiste subordinação jurídica, habitualidade compulsória, exclusividade ou dependência econômica, não se configurando vínculo de emprego nos termos dos Arts. 2º e 3º da CLT.

## 2. Verificação Obrigatória de Credenciais e Habilitação
- O profissional deve manter registro profissional ativo e regular perante o respectivo conselho regional de classe (**CREF, CRN, CRP, CREFITO ou Federação Esportiva Reconhecida** para instrutores de Artes Marciais).
- A aprovação e permanência na plataforma exige a submissão de documento oficial comprobatório com foto (Cédula de Identidade Profissional do Conselho) submetida a verificação periódica anual.
- Em cumprimento à **Resolução CONFEF nº 542/2024**, o nome completo, número de registro profissional e conselho regional competente serão permanentemente exibidos no perfil público do profissional na plataforma.

## 3. Não Exclusividade e Liberdade de Agenda
O profissional possui ampla e irrestrita autonomia para fixar seus próprios horários disponíveis, períodos de recesso, modalidades de atendimento e valores particulares de consulta, bem como a total liberdade de aceitar ou recusar novos alunos de acordo com sua conveniência técnica.

## 4. Responsabilidade Técnica e Emissão de NFS-e
- Toda prescrição de treino, dieta, avaliação biomecânica ou suporte psicológico é de **responsabilidade técnica exclusiva e personalíssima do profissional**.
- O profissional é o único responsável pelo recolhimento de tributos federais, estaduais e municipais decorrentes de seus honorários, bem como pela **emissão de Nota Fiscal de Serviços Eletrônica (NFS-e)** ou recibo fiscal diretamente ao aluno contratante.

## 5. Indenidade da Plataforma
O profissional obriga-se a defender, indenizar e manter a 369TRAINING, seus sócios e colaboradores indenes de quaisquer reivindicações judiciais, procedimentos ético-disciplinares nos conselhos ou autuações fiscais decorrentes de negligência, imprudência ou imperícia na prestação de seus serviços.

## 6. Regras de Suspensão com Direito de Defesa
A plataforma poderá suspender preventivamente o credenciamento do profissional em caso de denúncia grave de imperícia ou conduta antiética. O profissional terá prazo de até 5 (cinco) dias úteis para apresentar sua manifestação formal e contraprovas antes de qualquer decisão de rescisão definitiva.`,
      },
      {
        slug: 'regulamento-cashback',
        title: 'Regulamento do Programa de Recompensas, Indicações e Cashback Colaborativo 369',
        version: 1,
        status: 'publicado',
        audience: 'todos',
        published_at: nowIsoPb,
        body: `## 1. Finalidade e Mecânica de Acúmulo de Cashback
O Programa de Cashback da 369TRAINING consiste em um modelo de bonificação colaborativa gerado por **serviços efetivamente prestados, validados e pagos** dentro da plataforma.

## 2. Prevenção à Pirâmide Financeira (Lei Federal nº 1.521/1951)
> **DECLARAÇÃO DE COMPLIANCE JURÍDICO E LEGALIDADE:**
> - O cashback e as bonificações do ecossistema 369TRAINING são decorrentes **exclusivamente do consumo real de serviços de treinamento, consultas e assinaturas ativas**.
> - **NÃO há qualquer tipo de remuneração por recrutamento puro de participantes.** A mera indicação de um novo usuário não gera nenhum valor monetário se não houver contratação e consumo de serviços reais.
> - **Taxa de adesão NUNCA é cobrada.** O acesso inicial é garantido por plano gratuito e não há exigência de aporte financeiro para ingressar na rede de indicações.
> - **Inexistência de promessa de renda ou garantia de ganho fácil:** As estimativas de cashback dependem diretamente do mérito individual, da pontuação no ranking (serviços concluídos) e da distribuição do pool percentual aprovado.

## 3. Pool 38% e Regras de Validade
- O pool global de cashback é composto por 38% das tarifas operacionais geradas no ecossistema durante o ciclo mensal.
- O fechamento do ciclo ocorre no último dia de cada mês, apurando os saldos para resgate conforme metas ESG (Econômica, Social e Ecológica).
- Os créditos de cashback possuem validade de 12 (doze) meses a contar do fechamento do ciclo correspondente.

## 4. Teto e Resgate
Os valores disponíveis podem ser utilizados para abater pagamentos de novos treinos, contratação de conteúdos e mentorias, ou resgatados via transferência PIX diretamente para a conta bancária do participante, respeitados os limites mínimos operacionais de R$ 10,00.`,
      },
      {
        slug: 'politica-privacidade',
        title: 'Política de Privacidade e Proteção de Dados Pessoais',
        version: 1,
        status: 'publicado',
        audience: 'todos',
        published_at: nowIsoPb,
        body: `## 1. Compromisso com a Privacidade e LGPD
A **369TRAINING LTDA** adota rígidos padrões de segurança da informação e governança corporativa em conformidade integral com a **Lei Geral de Proteção de Dados (Lei Federal nº 13.709/2018 — LGPD)**.

## 2. Dados Coletados e Finalidades
Coletamos dados cadastrais (nome, e-mail, telefone, CPF, cidade/UF), métricas biométricas e de performance esportiva coletadas via smartwatches e registros de atendimentos para viabilizar a entrega dos serviços e a pontuação do ranking.

## 3. Compartilhamento Restrito
Seus dados jamais serão comercializados para terceiros. O compartilhamento ocorre unicamente com o profissional de saúde responsável pelo seu acompanhamento e com processadores essenciais de pagamento seguro.

## 4. Direitos do Titular (Art. 18 LGPD)
O titular pode exercer seus direitos de confirmação de existência, acesso, correção, anonimização, portabilidade e revogação de consentimento a qualquer momento entrando em contato com nosso Encarregado de Proteção de Dados (DPO) através do e-mail: **dpo@369training.com**.`,
      },
      {
        slug: 'lgpd-consentimentos',
        title:
          'Consentimento Específico para Tratamento de Dados Sensíveis de Saúde (Art. 11 LGPD)',
        version: 1,
        status: 'publicado',
        audience: 'todos',
        published_at: nowIsoPb,
        body: `## Termo de Consentimento Livre, Informado e Inequívoco (Art. 11 da LGPD)
Em cumprimento ao **Artigo 11 da Lei nº 13.709/2018**, o tratamento de **dados pessoais sensíveis de saúde** (como frequência cardíaca, histórico de lesões musculoesqueléticas, dores, composição corporal, calorias gastas, padrões de sono e anamneses clínicas) exige consentimento prévio, expresso e destacado do titular.

## Finalidade Específica
A coleta dessas informações destina-se **exclusivamente**:
1. À prescrição individualizada e segura de treinos e dietas pelo profissional contratado;
2. À geração de insights de recuperação muscular e biomecânica pelos assistentes de IA da plataforma;
3. Ao acompanhamento preventivo do risco de lesões decorrentes de sobrecarga esportiva.

O titular pode revogar este consentimento a qualquer momento nas configurações do seu perfil de usuário.`,
      },
      {
        slug: 'politica-reembolso',
        title: 'Política Geral de Cancelamentos e Reembolso',
        version: 1,
        status: 'publicado',
        audience: 'todos',
        published_at: nowIsoPb,
        body: `## Diretrizes Transparentes de Reembolso
Na 369TRAINING, priorizamos o relacionamento ético e de longo prazo com nossos membros.

### 1. Direito Legal de Arrependimento (CDC Art. 49)
Solicitações realizadas em até 7 dias corridos após a contratação de planos de assinatura digital serão 100% reembolsadas sem qualquer questionamento ou desconto.

### 2. Atendimentos Individuais e Agendamentos
- **Até 24h antes do horário marcado:** Reembolso integral na carteira digital para reagendamento imediato.
- **Não comparecimento do profissional:** O aluno recebe reembolso integral com compensação adicional de crédito de R$ 15,00 na carteira digital.
- **Não comparecimento do aluno (no-show):** Retenção de 50% do valor em favor do parceiro profissional para cobertura dos custos de hora reservada.`,
      },
    ]

    for (const d of docsSeed) {
      try {
        let rec = null
        try {
          rec = app.findFirstRecordByData('legal_documents', 'slug', d.slug)
        } catch (_) {}

        if (!rec) {
          rec = new Record(legalDocsCol)
          rec.set('slug', d.slug)
        }

        rec.set('title', d.title)
        rec.set('body', d.body)
        rec.set('version', d.version)
        rec.set('status', d.status)
        rec.set('audience', d.audience)
        rec.set('published_at', d.published_at)
        if (adminId) rec.set('updated_by', adminId)
        rec.set('version_history', [
          {
            version: d.version,
            title: d.title,
            body: d.body,
            published_at: d.published_at,
            published_by: adminId || 'admin_initial_seed',
          },
        ])
        app.save(rec)
      } catch (e) {
        console.log('Erro ao semear legal_documents:', e)
      }
    }

    // 2. SEED DE TESTE PARA USUÁRIOS E CREDENCIAIS (PREFIXO "TESTE")
    // Garantir 3-4 profissionais verificados e 2 profissionais pendentes com prefixo TESTE
    const testProsData = [
      {
        email: 'teste.carlos@369training.com',
        name: 'TESTE Prof. Carlos Silva (Verificado)',
        council: 'CREF',
        reg: '098765-G/SP',
        status: 'verificado',
        specialties: ['Educação Física', 'Nutrição'],
        approved: true,
        doc_url: 'https://img.usecurling.com/p/800/600?q=id+card+cref&color=gold',
        notes: 'Registro no CONFEF/CREF-SP conferido e ativo.',
      },
      {
        email: 'teste.marina@369training.com',
        name: 'TESTE Dra. Marina Santos (Verificada)',
        council: 'CREFITO',
        reg: 'CREFITO 3/112233-F',
        status: 'verificado',
        specialties: ['Fisioterapia'],
        approved: true,
        doc_url: 'https://img.usecurling.com/p/800/600?q=id+card+medical&color=blue',
        notes: 'Registro no CREFITO-3 verificado com certidão de regularidade.',
      },
      {
        email: 'teste.fernando@369training.com',
        name: 'TESTE Mestre Fernando Ramos (Verificado)',
        council: 'FEDERACAO',
        reg: 'CBJJ-883492',
        status: 'verificado',
        specialties: ['Artes Marciais'],
        approved: true,
        doc_url: 'https://img.usecurling.com/p/800/600?q=diploma+martial+arts&color=black',
        notes:
          'Certificado de Faixa Preta chancelado pela CBJJ + Antecedentes Criminais sem apontamentos.',
      },
      {
        email: 'teste.patricia@369training.com',
        name: 'TESTE Dra. Patrícia Lima (Verificada)',
        council: 'CRN',
        reg: 'CRN-3 44556',
        status: 'verificado',
        specialties: ['Nutrição'],
        approved: true,
        doc_url: 'https://img.usecurling.com/p/800/600?q=id+card+nutrition&color=green',
        notes: 'Habilitação profissional em Nutrição Esportiva validada com sucesso.',
      },
      {
        email: 'teste.pendente1@369training.com',
        name: 'TESTE Prof. Rodrigo Alves (Pendente)',
        council: 'CREF',
        reg: '087654-G/SP',
        status: 'pendente',
        specialties: ['Educação Física'],
        approved: false,
        doc_url: 'https://img.usecurling.com/p/800/600?q=document+cref+pending',
        notes: 'Aguardando validação da foto da cédula profissional enviada.',
      },
      {
        email: 'teste.pendente2@369training.com',
        name: 'TESTE Dra. Camila Rocha (Pendente)',
        council: 'CRP',
        reg: 'CRP 06/998877',
        status: 'pendente',
        specialties: ['Educação Física'],
        approved: false,
        doc_url: 'https://img.usecurling.com/p/800/600?q=document+crp+pending',
        notes: 'Aguardando conferência do registro no Conselho Regional de Psicologia.',
      },
    ]

    for (const tp of testProsData) {
      try {
        let uRec = null
        try {
          uRec = app.findAuthRecordByEmail('_pb_users_auth_', tp.email)
        } catch (_) {}

        if (!uRec) {
          uRec = new Record(usersCol)
          uRec.setEmail(tp.email)
          uRec.setPassword('Skip@Pass')
          uRec.setVerified(true)
        }

        uRec.set('name', tp.name)
        uRec.set('role', 'profissional')
        uRec.set('plan', 'pro')
        uRec.set('plan_type', 'profissional')
        uRec.set('approved', tp.approved)
        uRec.set('cref', tp.reg)
        uRec.set('city', 'São Paulo')
        uRec.set('state', 'SP')
        uRec.set('specialties', tp.specialties)
        app.save(uRec)

        // Criar ou atualizar registro em credential_verifications
        let credRec = null
        try {
          credRec = app.findFirstRecordByData('credential_verifications', 'professional', uRec.id)
        } catch (_) {}

        if (!credRec) {
          credRec = new Record(credsCol)
          credRec.set('professional', uRec.id)
        }

        credRec.set('council', tp.council)
        credRec.set('registration_number', tp.reg)
        credRec.set('document_url_fallback', tp.doc_url)
        credRec.set('status', tp.status)
        if (tp.status === 'verificado') {
          if (adminId) credRec.set('reviewed_by', adminId)
          credRec.set('reviewed_at', nowIsoPb)
          const exp = new Date()
          exp.setFullYear(exp.getFullYear() + 1)
          credRec.set('expires_at', exp.toISOString().slice(0, 10))
        }
        credRec.set('review_notes', tp.notes)
        app.save(credRec)
      } catch (err) {
        console.log('Erro ao semear profissional de teste:', err)
      }
    }

    // Também garantir que o usuário padrão carlos Silva (vhvun6ujx1esr19) tenha sua credencial verificada
    try {
      let carlosRec = null
      try {
        carlosRec = app.findRecordById('users', 'vhvun6ujx1esr19')
      } catch (_) {
        try {
          carlosRec = app.findAuthRecordByEmail('_pb_users_auth_', 'carlos.coach@369training.com')
        } catch (_) {}
      }

      if (carlosRec) {
        let carlosCred = null
        try {
          carlosCred = app.findFirstRecordByData(
            'credential_verifications',
            'professional',
            carlosRec.id,
          )
        } catch (_) {}

        if (!carlosCred) {
          carlosCred = new Record(credsCol)
          carlosCred.set('professional', carlosRec.id)
        }
        carlosCred.set('council', 'CREF')
        carlosCred.set('registration_number', carlosRec.getString('cref') || 'CREF 098765-G/SP')
        carlosCred.set(
          'document_url_fallback',
          'https://img.usecurling.com/p/800/600?q=id+card+cref&color=gold',
        )
        carlosCred.set('status', 'verificado')
        if (adminId) carlosCred.set('reviewed_by', adminId)
        carlosCred.set('reviewed_at', nowIsoPb)
        const exp = new Date()
        exp.setFullYear(exp.getFullYear() + 1)
        carlosCred.set('expires_at', exp.toISOString().slice(0, 10))
        carlosCred.set('review_notes', 'Registro CONFEF Res. 542/2024 ativo e regularizado.')
        app.save(carlosCred)
      }
    } catch (err) {
      console.log('Erro ao garantir credencial de Carlos Silva:', err)
    }
  },
  (app) => {
    // down: não deletar dados críticos
  },
)

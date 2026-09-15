migrate(
  (app) => {
    const nowIso = new Date().toISOString()
    const nowIsoPb = nowIso.replace('T', ' ').slice(0, 19)

    // 1. Atualizar "termos-aluno" (Termos de Uso do Aluno e Cliente)
    try {
      const doc = app.findFirstRecordByData('legal_documents', 'slug', 'termos-aluno')
      const currentBody = doc.getString('body')
      const poolNote = `\n\n## 6. Pool Global de 38% e Mecânica de Recompensas\nO ecossistema 369TRAINING mantém um Pool Colaborativo de 38% alimentado conjuntamente por: (1) mensalidades fixas de alunos não vinculados a profissionais (R$ 10, R$ 20 e R$ 30); (2) percentual da mensalidade do plano PRO PARCEIRO do profissional (38%); e (3) tarifas operacionais debitadas sobre serviços concluídos na plataforma (R$ 1,00 a R$ 3,00). O rateio segue a modelagem de árvore binária com lastro financeiro real estritamente verificado em cada ciclo mensal.`

      if (!currentBody.includes('Pool Global de 38%')) {
        doc.set('body', currentBody + poolNote)
        doc.set('version', doc.getInt('version') + 1)
        doc.set('published_at', nowIsoPb)
        app.save(doc)
      }
    } catch (_) {}

    // 2. Garantir que regulamento-cashback contenha a alimentação do Pool 38%
    try {
      const cbDoc = app.findFirstRecordByData('legal_documents', 'slug', 'regulamento-cashback')
      const cbBody = cbDoc.getString('body')
      if (!cbBody.includes('mensalidades de alunos não vinculados + % PRO PARCEIRO')) {
        const updated = `${cbBody}

### Atualização v2 — Alimentação do Pool 38% Colaborativo
A partir da versão v2 de Precificação aprovada em 14/09, o Pool Global de 38% é alimentado conjuntamente por:
1. Mensalidades fixas pagas pelos alunos não vinculados a profissionais (R$ 10, R$ 20, R$ 30);
2. Percentual regulamentar da mensalidade do plano PRO PARCEIRO (38%);
3. Tarifas operacionais de todos os serviços concluídos na plataforma debitadas dos profissionais (R$ 1,00 a R$ 3,00).

O fechamento mensal mantém a exigência de lastro financeiro real comprovado: na ausência de entradas monetárias efetivas no ciclo, nenhum cashback é distribuído.`
        cbDoc.set('body', updated)
        cbDoc.set('published_at', nowIsoPb)
        app.save(cbDoc)
      }
    } catch (_) {}
  },
  (app) => {},
)

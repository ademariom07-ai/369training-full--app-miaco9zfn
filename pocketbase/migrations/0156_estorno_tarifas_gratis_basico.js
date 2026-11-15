// 0156 — Estorno REAL das tarifas antigas dos planos GRATIS e BASICO (corrige o no-op de 0154/0155).
//
// Regra confirmada pelo admin (4 planos de profissional):
//   gratis R$ 0 | basico R$ 1 | pro R$ 2 | premium R$ 3 | pro_parceiro R$ 0.
// As tarifas antigas eram todas de R$ 1 (o código antigo tratava grátis e básico juntos),
// então o valor sozinho não distingue grátis de básico — o estorno é feito pelo PLANO do
// profissional: qualquer tarifa de serviço com status 'concluido' e valor exato de R$ 1
// cujo profissional está no plano 'gratis' OU 'basico' é estornada.
// Pro (R$ 2) e premium (R$ 3) NUNCA são tocados.
//
// Por que 0154/0155 foram no-op: a busca do plano usava
//   app.findRecordsByFilter('users', "id = '<id>'", ...) dentro de try/catch(_){}
// — filtro por 'id' via findRecordsByFilter na coleção de auth não é confiável na JSVM,
// o erro era engolido, o plano ficava null e TODAS as linhas eram puladas com continue.
// Aqui usamos app.findRecordById('users', id) (padrão comprovado da migração 0061) e
// qualquer falha de lookup/save é CONTABILIZADA e lançada ao final — nada silencioso.
//
// Rastreabilidade (nada é deletado): status vira 'rejeitado', a descrição recebe o
// marcador "[ESTORNO TARIFA 369]" com o valor original preservado no texto e o amount
// fica em R$ -1 (zero viola a constraint min do campo — 2ª causa do no-op de 0154/0155).
// admin_financial_summary.js soma apenas status='concluido', então o Total Tarifas do
// /admin passa a refletir automaticamente só básico/pro/premium.
//
// Idempotente: linhas já estornadas (marcador na descrição) são ignoradas; no-op em base vazia.

migrate(
  (app) => {
    const ESTORNO_TAG = '[ESTORNO TARIFA 369]'
    let estornadas = 0
    let jaEstornadas = 0
    let outrosPlanos = 0
    let valorNaoEh1 = 0
    let semUsuario = 0
    let usuariosNaoEncontrados = 0
    let erros = []
    const profPlanCache = {}

    const getProfInfo = function (userId) {
      if (profPlanCache[userId] !== undefined) return profPlanCache[userId]
      let info = null
      try {
        const rec = app.findRecordById('users', userId)
        if (rec) {
          info = {
            role: String(rec.get('role') || 'aluno').toLowerCase(),
            plan: String(rec.get('plan') || 'gratis').toLowerCase(),
          }
        }
      } catch (_) {
        info = { notFound: true }
      }
      profPlanCache[userId] = info
      return info
    }

    let tarifas = []
    try {
      tarifas = app.findRecordsByFilter(
        'wallet_transactions',
        "type = 'tarifa' && status = 'concluido'",
        '-created',
        10000,
        0,
      )
    } catch (err) {
      throw new Error('0156: erro ao buscar tarifas em wallet_transactions: ' + err)
    }

    console.log('0156: candidatas (tarifa, concluido) = ' + tarifas.length)

    for (let i = 0; i < tarifas.length; i++) {
      const tx = tarifas[i]
      const txId = tx.id
      try {
        const desc = String(tx.get('description') || '')
        if (desc.indexOf(ESTORNO_TAG) !== -1) {
          jaEstornadas++
          continue
        }

        const originalAmount = Number(tx.get('amount')) || 0
        // Estorno só para tarifas de exatamente R$ 1 (antiga tarifa de grátis/básico).
        // Pro (R$ 2) e premium (R$ 3) ficam intocados.
        if (Math.abs(originalAmount) !== 1) {
          valorNaoEh1++
          continue
        }

        const userId = tx.get('user')
        if (!userId) {
          semUsuario++
          continue
        }

        const info = getProfInfo(userId)
        if (!info) {
          usuariosNaoEncontrados++
          continue
        }
        if (info.notFound) {
          usuariosNaoEncontrados++
          console.warn('0156: usuário ' + userId + ' não encontrado (tarifa ' + txId + ')')
          continue
        }
        if (info.role !== 'profissional') {
          outrosPlanos++
          continue
        }
        if (info.plan !== 'gratis' && info.plan !== 'basico') {
          outrosPlanos++
          continue
        }

        tx.set('status', 'rejeitado')
        // amount é preservado em R$ -1 (o campo tem min >= 1 em módulo: zero é rejeitado
        // pelo schema — essa foi a SEGUNDA causa do no-op de 0154/0155). O estorno é dado
        // pelo status 'rejeitado', que o admin_financial_summary.js já exclui da soma.
        tx.set(
          'description',
          'Estorno de tarifa — plano ' +
            info.plan.toUpperCase() +
            ' (regra: ' +
            (info.plan === 'gratis'
              ? 'plano grátis não possui tarifa por serviço'
              : 'lançamento antigo do plano básico revertido pelo admin') +
            '; valor original R$ ' +
            Math.abs(originalAmount).toFixed(2).replace('.', ',') +
            ') ' +
            ESTORNO_TAG +
            ' ' +
            desc,
        )
        app.save(tx)
        estornadas++
      } catch (txErr) {
        erros.push(txId + ': ' + (txErr && txErr.message ? txErr.message : String(txErr)))
      }
    }

    const resumo =
      '0156: estornadas=' +
      estornadas +
      ', ja_estornadas=' +
      jaEstornadas +
      ', outros_planos=' +
      outrosPlanos +
      ', valor_nao_eh_1=' +
      valorNaoEh1 +
      ', sem_usuario=' +
      semUsuario +
      ', usuarios_nao_encontrados=' +
      usuariosNaoEncontrados +
      ', erros=' +
      erros.length
    console.log(resumo)

    // NADA silencioso: falha real de save aborta a migração e aparece no apply_migrations.
    if (erros.length > 0) {
      throw new Error('0156: falhas ao estornar tarifas -> ' + erros.slice(0, 10).join(' | '))
    }
  },
  (app) => {
    // Down: remove apenas o marcador de estorno da descrição; não recria o valor original
    // (rastreabilidade — o valor anterior ficou registrado no texto).
    const ESTORNO_TAG = '[ESTORNO TARIFA 369]'
    try {
      const tarifas = app.findRecordsByFilter(
        'wallet_transactions',
        "type = 'tarifa' && status = 'rejeitado'",
        '-created',
        10000,
        0,
      )
      for (let i = 0; i < tarifas.length; i++) {
        const tx = tarifas[i]
        try {
          const desc = String(tx.get('description') || '')
          if (desc.indexOf(ESTORNO_TAG) === -1) continue
          tx.set('description', desc.split(ESTORNO_TAG).join('').trim())
          app.save(tx)
        } catch (_) {}
      }
    } catch (err) {
      console.error('0156 (down): erro ao limpar marcador de estorno:', err)
    }
  },
)

// 0154 — Estorna as tarifas de serviço existentes de profissionais nos planos GRATIS e BASICO.
//
// Nova regra do admin: "se o profissional está no plano grátis, não existe nenhuma
// tarifa de desconto, e nada deve aparecer no total de tarifas". O código e o básico
// compartilham a mesma tarifa simbólica de R$ 1,00 no sistema — ambos passam a ZERO
// (nenhum lançamento novo e estorno dos existentes). Planos pro/premium/pro_parceiro
// não são afetados.
//
// Estratégia (rastreabilidade: nada é deletado):
//   - wallet_transactions type='tarifa' com status='concluido' cujo usuário é
//     profissional (role='profissional') com plan='gratis' ou 'basico' viram
//     status='rejeitado', amount=0 e descrição com o marcador "[ESTORNO PLANO GRATIS]"
//     — o resumo financeiro (/backend/v1/admin/financial_summary) soma apenas
//     status='concluido', então o Total Tarifas para de exibir esses valores.
//
// Idempotente: tarifas já estornadas (status 'rejeitado' com o marcador na descrição)
// são ignoradas; no-op em base vazia. Sem transação (JSVM): .all()/.execute() com
// .bind() e try/catch por etapa.

migrate(
  (app) => {
    const ESTORNO_TAG = '[ESTORNO PLANO GRATIS]'
    let estornadas = 0
    let jaEstornadas = 0
    let semUsuario = 0
    let erros = 0

    const profPlanCache = {}

    const getProfPlan = function (userId) {
      if (profPlanCache[userId] !== undefined) return profPlanCache[userId]
      let plan = null
      let role = null
      try {
        const recs = app.findRecordsByFilter('users', `id = '${userId}'`, '-created', 1, 0)
        if (recs && recs.length > 0) {
          role = String(recs[0].get('role') || 'aluno').toLowerCase()
          plan = String(recs[0].get('plan') || 'gratis').toLowerCase()
        }
      } catch (_) {}
      profPlanCache[userId] = { role, plan }
      return profPlanCache[userId]
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
      console.error('0154: erro ao buscar tarifas de wallet_transactions:', err)
      return
    }

    for (let i = 0; i < tarifas.length; i++) {
      const tx = tarifas[i]
      try {
        const desc = String(tx.get('description') || '')
        if (desc.indexOf(ESTORNO_TAG) !== -1) {
          jaEstornadas++
          continue
        }

        const userId = tx.get('user')
        if (!userId) {
          semUsuario++
          continue
        }

        const info = getProfPlan(userId)
        if (!info || info.role !== 'profissional') continue
        if (info.plan !== 'gratis' && info.plan !== 'basico') continue

        const originalAmount = Number(tx.get('amount')) || 0
        tx.set('status', 'rejeitado')
        tx.set('amount', 0)
        tx.set(
          'description',
          `Estorno de tarifa — plano grátis não possui tarifa por serviço (valor original R$ ${Math.abs(
            originalAmount,
          )
            .toFixed(2)
            .replace('.', ',')}) ${ESTORNO_TAG} ${desc}`.trim(),
        )
        app.save(tx)
        estornadas++
      } catch (txErr) {
        erros++
        console.error(`0154: erro ao estornar tarifa ${tx.id}:`, txErr)
      }
    }

    console.log(
      `0154: tarifas estornadas=${estornadas}, ja_estornadas=${jaEstornadas}, sem_usuario=${semUsuario}, erros=${erros}`,
    )
  },
  (app) => {
    // Down: apenas remove o marcador de estorno da descrição; não recria o valor
    // original (rastreabilidade — o valor anterior ficou registrado no texto).
    const ESTORNO_TAG = '[ESTORNO PLANO GRATIS]'
    try {
      const tarifas = $app.findRecordsByFilter(
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
      console.error('0154 (down): erro ao limpar marcador de estorno:', err)
    }
  },
)

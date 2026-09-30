// Hook: Executar fechamento mensal e cálculo de Cashback da Rede Única Global
// REGRAS DO CAMINHO C (v2 Precificação 14/09):
// 1. POOL 38% = 38% x (mensalidades dos alunos não vinculados + % da mensalidade PRO PARCEIRO [default 38%, configurável] + tarifas de todos os serviços concluídos).
// 2. Número de níveis habitados: max level habitado na árvore única (até 36)
// 3. VALOR DO NÍVEL = POOL / níveis habitados
// 4. CORRETOR DO NÍVEL:
//    Para nível 1: 0.8 / (próximo_nível / 2) + 0.2
//    A cada nível soma-se + 0.8 / (próximo_nível / 2), até chegar a 1.8 no último nível
// 5. VALOR EQUALIZADO(nível) = VALOR DO NÍVEL x CORRETOR DO NÍVEL
// 6. VALOR POR PESSOA = VALOR EQUALIZADO / PESSOAS NO NÍVEL (progressão 2^(n-1))
// 7. Cashback creditado na carteira apenas no fechamento!
// CRITÉRIO DE ACEITE: Fechamento mensal sem entradas reais NÃO distribui cashback e avisa "sem lastro para distribuição".
routerAdd('POST', '/backend/v1/admin/fechamento_mensal', (c) => {
  const now = new Date()
  const cycle = now.toISOString().slice(0, 7) // 'YYYY-MM'
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .replace('T', ' ')

  // 1. Carregar regras de pool_feed_config de platform_config
  let poolFeedConfig = {
    partner_pool_pct: 0.38,
    student_monthly_pct: 1.0,
    pro_parceiro_monthly_pct: 0.38,
    service_tarifa_pct: 1.0,
  }
  try {
    const pfcRec = $app.findFirstRecordByData('platform_config', 'key', 'pool_feed_config')
    if (pfcRec) {
      const v = pfcRec.get('value')
      if (typeof v === 'object' && v !== null) {
        poolFeedConfig = Object.assign(poolFeedConfig, v)
      }
    }
  } catch (_) {}

  // 2. Totalizar tarifas de serviços no mês corrente
  let totalTarifasEntrada = 0
  const tarifaTxs = $app.findRecordsByFilter(
    'wallet_transactions',
    `type = 'tarifa' && status = 'concluido' && created >= '${currentMonthStart}'`,
    '-created',
    5000,
    0,
  )
  for (const t of tarifaTxs) {
    totalTarifasEntrada += Math.abs(Number(t.get('amount')) || 0)
  }

  // 3. Totalizar mensalidades pagas no mês (tipo 'mensalidade' e status 'concluido')
  // Distinguindo:
  // a) Mensalidades de alunos NÃO vinculados
  // b) Mensalidades de PRO PARCEIRO
  let totalMensalidadesAlunos = 0
  let totalMensalidadesProParceiro = 0

  const mensalidadeTxs = $app.findRecordsByFilter(
    'wallet_transactions',
    `type = 'mensalidade' && status = 'concluido' && created >= '${currentMonthStart}'`,
    '-created',
    5000,
    0,
  )

  for (const m of mensalidadeTxs) {
    const amt = Math.abs(Number(m.get('amount')) || 0)
    const userId = m.get('user')
    let isStudentUnlinked = false
    let isProParceiroTx = false

    if (userId) {
      try {
        const u = $app.findRecordById('users', userId)
        const role = u.get('role') || 'aluno'
        const plan = (u.get('plan') || '').toLowerCase()
        const linkedProf = u.get('linked_professional')

        if (role === 'aluno' && !linkedProf) {
          isStudentUnlinked = true
        } else if (plan === 'pro_parceiro' || role === 'profissional') {
          isProParceiroTx = true
        }
      } catch (_) {}
    }

    if (isStudentUnlinked) {
      totalMensalidadesAlunos += amt
    } else if (isProParceiroTx) {
      totalMensalidadesProParceiro += amt
    } else {
      // Fallback: se for de aluno sem vínculo registrado na tx
      totalMensalidadesAlunos += amt
    }
  }

  // 4. Base de alimentação do Pool 38%
  // Pool Base = (mensalidades alunos não vinculados * student_monthly_pct) +
  //             (mensalidades PRO PARCEIRO * pro_parceiro_monthly_pct) +
  //             (tarifas de serviços * service_tarifa_pct)
  const baseAlunos = totalMensalidadesAlunos * (poolFeedConfig.student_monthly_pct ?? 1.0)
  const baseProParceiro =
    totalMensalidadesProParceiro * (poolFeedConfig.pro_parceiro_monthly_pct ?? 0.38)
  const baseTarifas = totalTarifasEntrada * (poolFeedConfig.service_tarifa_pct ?? 1.0)

  const baseTotalEntradas = baseAlunos + baseProParceiro + baseTarifas
  const totalEntradasReais =
    totalTarifasEntrada + totalMensalidadesAlunos + totalMensalidadesProParceiro

  // Bloqueio "sem lastro": se não houver entradas reais no mês
  if (totalEntradasReais <= 0 || baseTotalEntradas <= 0) {
    return c.json(400, {
      status: 'error',
      code: 'SEM_LASTRO',
      cycle,
      total_entradas_reais: totalEntradasReais,
      total_tarifas_entrada: totalTarifasEntrada,
      total_mensalidades_alunos: totalMensalidadesAlunos,
      total_mensalidades_pro_parceiro: totalMensalidadesProParceiro,
      partner_pool_38_pct: 0,
      usuarios_beneficiados: 0,
      message: 'sem lastro para distribuição',
    })
  }

  // 5. Pool 38% final
  const partnerPool = baseTotalEntradas * (poolFeedConfig.partner_pool_pct ?? 0.38)

  // 6. Descobrir níveis habitados na rede única global
  const allUsersWithPos = $app.findRecordsByFilter(
    'users',
    'tree_position > 0',
    'tree_level',
    2000,
    0,
  )

  let maxLevelHabitado = 1
  for (const u of allUsersWithPos) {
    const lvl = Number(u.get('tree_level')) || 1
    if (lvl > maxLevelHabitado && lvl <= 36) {
      maxLevelHabitado = lvl
    }
  }

  const niveisHabitados = Math.max(1, Math.min(36, maxLevelHabitado))
  const proximoNivel = niveisHabitados + 1
  const step = 0.8 / (proximoNivel / 2)
  const valorDoNivel = partnerPool / niveisHabitados

  // 7. Calcular corretores e valores equalizados por nível
  const levelDetails = []
  let totalDistribuidoEqualizado = 0

  for (let lvl = 1; lvl <= niveisHabitados; lvl++) {
    const corretor = Number((step * lvl + 0.2).toFixed(4))
    const valorEqualizado = Number((valorDoNivel * corretor).toFixed(2))
    const pessoasNoNivel = Math.pow(2, lvl - 1)
    const valorPorPessoa = Number((valorEqualizado / pessoasNoNivel).toFixed(4))

    totalDistribuidoEqualizado += valorEqualizado

    levelDetails.push({
      level: lvl,
      corretor,
      pessoasNoNivel,
      valorDoNivel,
      valorEqualizado,
      valorPorPessoa,
    })
  }

  // 8. Distribuir Cashback aos Usuários Ativos da Rede Única com REDISTRIBUIÇÃO
  // HOTFIX 369 v2:
  // - Grátis (aluno ou parceiro) não recebe cashback.
  // - Inadimplente/cancelada sem vínculo não recebe.
  // - Aluno vinculado a parceiro PAGO recebe (effectivePlanForCashback é do parceiro).
  // - Aluno vinculado a parceiro GRÁTIS não recebe (effectivePlanForCashback === 'gratis').
  // - O valor que os excluídos receberiam é redistribuído entre os elegíveis do mesmo nível (divisor real).
  // - Se não houver elegíveis em um nível, o valor fica retido no pool para ajuste final no último beneficiário.
  const cbCol = $app.findCollectionByNameOrId('cashback_distributions')
  const walletCol = $app.findCollectionByNameOrId('wallet_transactions')

  // Mapear elegíveis por nível
  const eligibleUsersByLevel = {}
  for (let lvl = 1; lvl <= niveisHabitados; lvl++) {
    eligibleUsersByLevel[lvl] = []
  }

  for (const u of allUsersWithPos) {
    const rawPlan = (u.get('plan') || 'gratis').toLowerCase()
    const role = u.get('role') || 'aluno'
    const subStatus = (u.get('subscription_status') || 'ativa').toLowerCase()
    const linkedProf = u.get('linked_professional')

    // Determinar plano efetivo para cashback
    let effectivePlanForCashback = rawPlan
    if (role === 'aluno' && linkedProf) {
      try {
        const profUser = $app.findRecordById('users', linkedProf)
        effectivePlanForCashback = (profUser.get('plan') || 'basico').toLowerCase()
      } catch (_) {
        effectivePlanForCashback = 'basico'
      }
    }

    // Filtro 4A: quem NÃO recebe
    if (effectivePlanForCashback === 'gratis') continue
    if ((subStatus === 'inadimplente' || subStatus === 'cancelada') && !linkedProf) continue

    const userLevel = Math.min(niveisHabitados, Math.max(1, Number(u.get('tree_level')) || 1))
    eligibleUsersByLevel[userLevel].push(u)
  }

  // Atualizar levelDetails com elegíveis e divisor real
  let totalDistributedCashbackCents = 0
  const distributionQueue = [] // { u, level, amount, divisorReal, divisorTeorico, valorEqualizado }

  for (let lvl = 1; lvl <= niveisHabitados; lvl++) {
    const lvlInfo = levelDetails[lvl - 1]
    const elegiveis = eligibleUsersByLevel[lvl] || []
    const elegiveisNoNivel = elegiveis.length
    lvlInfo.elegiveisNoNivel = elegiveisNoNivel
    lvlInfo.divisorReal = elegiveisNoNivel
    lvlInfo.divisorTeorico = lvlInfo.pessoasNoNivel

    if (elegiveisNoNivel > 0) {
      // Redistribuição: os elegíveis dividem o valor TOTAL equalizado do nível
      const levelTotalCents = Math.round(lvlInfo.valorEqualizado * 100)
      const basePerEligibleCents = Math.floor(levelTotalCents / elegiveisNoNivel)
      let remainderCents = levelTotalCents - basePerEligibleCents * elegiveisNoNivel

      lvlInfo.valorPorElegivel = Number((lvlInfo.valorEqualizado / elegiveisNoNivel).toFixed(4))
      lvlInfo.valorRedistribuido = Number(
        Math.max(
          0,
          lvlInfo.valorEqualizado -
            (lvlInfo.valorEqualizado / lvlInfo.pessoasNoNivel) * elegiveisNoNivel,
        ).toFixed(2),
      )

      for (let idx = 0; idx < elegiveisNoNivel; idx++) {
        const u = elegiveis[idx]
        let personCents = basePerEligibleCents
        if (remainderCents > 0) {
          personCents += 1
          remainderCents--
        }
        const amountUser = personCents / 100
        totalDistributedCashbackCents += personCents

        distributionQueue.push({
          user: u,
          level: lvl,
          amount: amountUser,
          amountCents: personCents,
          divisorReal: elegiveisNoNivel,
          divisorTeorico: lvlInfo.pessoasNoNivel,
          valorEqualizado: lvlInfo.valorEqualizado,
          corretor: lvlInfo.corretor,
        })
      }
    } else {
      lvlInfo.valorPorElegivel = 0
      lvlInfo.valorRedistribuido = 0
    }
  }

  // Ajuste fino global de centavos: garantir que a soma feche EXATA com partnerPool
  const targetPoolCents = Math.round(partnerPool * 100)
  const diffCents = targetPoolCents - totalDistributedCashbackCents

  if (diffCents !== 0 && distributionQueue.length > 0) {
    const lastItem = distributionQueue[distributionQueue.length - 1]
    lastItem.amountCents += diffCents
    lastItem.amount = Number((lastItem.amountCents / 100).toFixed(2))
    totalDistributedCashbackCents += diffCents
  }

  let countDistribuicoes = 0
  for (const item of distributionQueue) {
    const u = item.user
    const userLevel = item.level
    const amountUser = item.amount

    if (amountUser <= 0) continue

    // Idempotência: verificar se já foi creditado cashback deste ciclo para este usuário
    let alreadyCredited = false
    try {
      const existingTxs = $app.findRecordsByFilter(
        'wallet_transactions',
        `user = '${u.id}' && type = 'cashback' && reference_id = '${cycle}'`,
        '-created',
        1,
        0,
      )
      if (existingTxs && existingTxs.length > 0) {
        alreadyCredited = true
      }
    } catch (_) {}

    if (!alreadyCredited) {
      // Registrar distribuição de cashback
      const cb = new Record(cbCol)
      cb.set('user', u.id)
      cb.set('service_id', null)
      cb.set('level', userLevel)
      cb.set('pool_share', partnerPool)
      cb.set('variable_pct', item.corretor)
      cb.set('divisor', item.divisorReal)
      cb.set('modifier', item.corretor)
      cb.set('amount', amountUser)
      cb.set('metas', {
        cycle,
        niveis_habitados: niveisHabitados,
        corretor: item.corretor,
        valor_equalizado_nivel: item.valorEqualizado,
        divisor_real: item.divisorReal,
        divisor_teorico: item.divisorTeorico,
        redistribuicao_ativa: true,
        fechamento_mensal: true,
        pool_components: {
          total_tarifas: totalTarifasEntrada,
          mensalidades_alunos: totalMensalidadesAlunos,
          mensalidades_pro_parceiro: totalMensalidadesProParceiro,
        },
      })
      $app.save(cb)

      // Creditar na carteira (wallet_transactions)
      const w = new Record(walletCol)
      w.set('user', u.id)
      w.set('type', 'cashback')
      w.set('amount', amountUser)
      w.set('status', 'concluido')
      w.set('reference_type', 'fechamento_mensal')
      w.set('reference_id', cycle)
      w.set(
        'description',
        `Cashback Fechamento Mensal (${cycle}) - Nível ${userLevel} (Rede Única 369)`,
      )
      $app.save(w)
    }

    countDistribuicoes++
  }

  const finalDistributedTotal = totalDistributedCashbackCents / 100

  return c.json(200, {
    status: 'ok',
    cycle,
    total_entradas_reais: totalEntradasReais,
    total_tarifas_entrada: totalTarifasEntrada,
    total_mensalidades_alunos: totalMensalidadesAlunos,
    total_mensalidades_pro_parceiro: totalMensalidadesProParceiro,
    partner_pool_38_pct: partnerPool,
    niveis_habitados: niveisHabitados,
    valor_base_por_nivel: valorDoNivel,
    total_distribuido_equalizado: finalDistributedTotal,
    usuarios_beneficiados: countDistribuicoes,
    tabela_equalizada: levelDetails,
    message: `Fechamento do ciclo ${cycle} executado com sucesso (Pool 38% R$ ${partnerPool.toFixed(2)}, redistribuição ativa entre elegíveis com divisor real).`,
  })
})

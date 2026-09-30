/**
 * Utilitários da Planilha de Distribuição de Cashback — Atualização 0.065
 * 369TRAINING
 *
 * Regras:
 * - Pool = 38% da base de tarifas do mês
 * - Níveis habitados: cada nível n tem 2^(n-1) pessoas
 *   Nível 1: pos 1 (1 pessoa)
 *   Nível 2: pos 2-3 (2 pessoas)
 *   Nível 3: pos 4-7 (4 pessoas)
 *   ...
 *   Nível 10: pos 512-1023 (512 pessoas)
 *   Nível n: 2^(n-1) posições
 *
 * - Equalizador Caminho C por nível habitado:
 *   corretor(lvl) = 0.2 + (1.6 / (nHab + 1)) * lvl
 *   (passo = 1.6 / (nHab + 1))
 *   valorEqualizado(lvl) = (Pool / nHab) * corretor(lvl)
 *   valorPorPessoa(lvl) = valorEqualizado(lvl) / pessoasNoNivel(lvl)
 *
 * - Fatores de individualização POR FÓRMULA (dentro do nível):
 *   * Nível 1 (pos 1): fator 1.0
 *   * Nível 2 (pos 2-3): fatores 1.1 e 0.9 (soma = 2.0)
 *   * Nível 3 (pos 4-7): fatores normalizados [1.14, 1.04, 0.94, 0.88] (soma = 4.0, distribuindo 100% do nível)
 *   * Níveis 4 a 9: fatores lineares de 1.2 (primeira posição) a 0.8 (última posição), com passo uniforme dentro do nível.
 *     Para K pessoas: factor(i) = 1.2 - (0.4 / (K - 1)) * i, com i de 0 a K-1.
 *     A média é exatamente 1.0 e a soma é exatamente K.
 *   * Nível 10+ (posições 512+): divisão IGUAL do valor do nível para todos que habitam o nível (fator 1.0 para todos).
 *
 * - O total distribuído NUNCA pode ultrapassar 38% da base.
 *   Ajuste fino de resíduo de arredondamento garante soma = pool 38% sem ultrapassar.
 */

export interface CashbackParticipant {
  position: number
  level: number
  userCode: string
  name: string
  email?: string
  role?: string
  plan?: string
  points: number
  factor: number
  baseLevelPerPerson: number
  cashbackMonth: number
  isRealUser?: boolean
  isExcluded?: boolean
  exclusionReason?: string
}

export interface CashbackLevelSummary {
  level: number
  peopleCount: number
  startPos: number
  endPos: number
  corretor: number
  valorEqualizado: number
  valorPorPessoa: number
  totalDistribuidoNivel: number
  divisorTeorico: number
  divisorReal: number
  excluidosCount: number
  valorRedistribuido: number
}

export interface CashbackDistributionResult {
  totalTarifasBase: number
  pool38: number
  maxHabitedLevel: number
  totalOccupiedPositions: number
  totalDistributed: number
  differenceToPool: number
  totalRedistributed: number
  levelsSummary: CashbackLevelSummary[]
  participants: CashbackParticipant[]
}

/**
 * Retorna o nível de uma dada posição 1-based (1 -> lvl 1, 2-3 -> lvl 2, etc.)
 */
export function getLevelForPosition(pos: number): number {
  if (pos <= 1) return 1
  let lvl = 1
  while (Math.pow(2, lvl) - 1 < pos && lvl < 36) {
    lvl++
  }
  return Math.min(36, lvl)
}

/**
 * Retorna o range de posições de um nível (start, end, count)
 */
export function getLevelBounds(lvl: number): { startPos: number; endPos: number; count: number } {
  const safeLvl = Math.max(1, Math.min(36, Math.floor(lvl)))
  const startPos = Math.pow(2, safeLvl - 1)
  const count = Math.pow(2, safeLvl - 1)
  const endPos = startPos + count - 1
  return { startPos, endPos, count }
}

/**
 * Retorna o fator de individualização de uma posição dentro do seu nível
 * @param pos Posição 1-based
 * @param level Nível (opcional, calculado se não fornecido)
 */
export function getPositionFactor(pos: number, level?: number): number {
  const lvl = level || getLevelForPosition(pos)

  if (lvl === 1) {
    return 1.0
  }

  if (lvl === 2) {
    // Posições 2 e 3
    return pos === 2 ? 1.1 : 0.9
  }

  if (lvl === 3) {
    // Posições 4 a 7 (4 pessoas).
    // Fatores normalizados confirmados: 1.14, 1.04, 0.94, 0.88 (soma = 4.00)
    const offset = pos - 4
    const n3Factors = [1.14, 1.04, 0.94, 0.88]
    return n3Factors[offset] !== undefined ? n3Factors[offset] : 1.0
  }

  if (lvl >= 4 && lvl <= 9) {
    // Fatores lineares de 1.2 a 0.8 com passo uniforme
    const { startPos, count } = getLevelBounds(lvl)
    const indexInLevel = pos - startPos // 0 a count - 1
    if (count <= 1) return 1.0
    const factor = 1.2 - (0.4 / (count - 1)) * indexInLevel
    return Number(factor.toFixed(6))
  }

  // Nível 10 e todos os seguintes (10+): divisão IGUAL (fator 1.0 para todos)
  return 1.0
}

/**
 * Calcula a distribuição completa de Cashback Caminho C
 * @param totalTarifas Valor total da base de tarifas em R$ (ex: 1.000.000)
 * @param occupiedPositions Número de posições ocupadas (ex: 1023)
 * @param realParticipants Lista opcional de participantes reais vindos do ranking
 */
export function calculateCashbackDistribution(
  totalTarifas: number,
  occupiedPositions: number = 1023,
  realParticipants: Array<{
    ranking_position?: number
    userCode?: string
    name?: string
    email?: string
    role?: string
    plan?: string
    subscription_status?: string
    linked_professional?: string
    points?: number
    isExcluded?: boolean
  }> = [],
  excludedRatePerLevel: number = 0, // Taxa simulada de excluídos quando não houver dado real (0 a 1)
): CashbackDistributionResult {
  const safeBase = Math.max(0, Number(totalTarifas) || 0)
  const pool = Number((safeBase * 0.38).toFixed(2))
  const maxPos = Math.max(1, Math.min(68719476735, Math.floor(occupiedPositions) || 1))
  const maxHabitedLevel = getLevelForPosition(maxPos)

  // Step do Corretor Caminho C:
  // Corretor Nível = 0.2 + (1.6 / (nHab + 1)) * lvl
  const proximoNivel = maxHabitedLevel + 1
  const step = 0.8 / Math.max(0.5, proximoNivel / 2) // = 1.6 / (maxHabitedLevel + 1)
  const valorDoNivelBase = maxHabitedLevel > 0 ? pool / maxHabitedLevel : 0

  // Mapa de participantes reais por posição
  const realMap = new Map<number, (typeof realParticipants)[0]>()
  if (Array.isArray(realParticipants)) {
    for (const p of realParticipants) {
      if (p && p.ranking_position) {
        realMap.set(p.ranking_position, p)
      }
    }
  }

  const levelsSummary: CashbackLevelSummary[] = []
  const participants: CashbackParticipant[] = []
  let totalDistributedCents = 0
  let totalRedistributedCents = 0

  const MAX_GENERATE_PARTICIPANTS = 5000
  const shouldLimitParticipantsArray = maxPos > MAX_GENERATE_PARTICIPANTS

  for (let lvl = 1; lvl <= maxHabitedLevel; lvl++) {
    const { startPos, endPos, count } = getLevelBounds(lvl)
    const corretor = Number((step * lvl + 0.2).toFixed(4))
    const valorEqualizado = Number((valorDoNivelBase * corretor).toFixed(2))

    // Quantas pessoas deste nível estão de fato ocupadas até maxPos
    const effectivePeopleInLevel = Math.max(0, Math.min(endPos, maxPos) - startPos + 1)
    if (effectivePeopleInLevel <= 0) continue

    const currentLevelEnd = Math.min(endPos, maxPos)
    const divisorTeorico = effectivePeopleInLevel

    // Identificar elegibilidade de cada participante do nível
    // Regra 4A: Grátis (aluno ou parceiro) não recebe. Inadimplente sem vínculo não recebe.
    // Aluno vinculado a parceiro PAGO recebe.
    interface PosInfo {
      pos: number
      rawFactor: number
      isRealUser: boolean
      isExcluded: boolean
      exclusionReason?: string
      userCode: string
      name: string
      email: string
      role: string
      plan: string
      points: number
    }

    const levelPositions: PosInfo[] = []
    let eligibleCount = 0

    for (let pos = startPos; pos <= currentLevelEnd; pos++) {
      const real = realMap.get(pos)
      let userCode = `369-P${pos}`
      let name = `Participante #${pos}`
      let email = `posicao${pos}@369training.com`
      let role = 'profissional'
      let plan = 'pro'
      let points = Math.max(1, 1000 - pos)
      const isRealUser = !!real
      let isExcluded = false
      let exclusionReason = ''

      if (real) {
        if (real.userCode) userCode = real.userCode
        if (real.name) name = real.name
        if (real.email) email = real.email
        if (real.role) role = real.role
        if (real.plan) plan = real.plan
        if (real.points !== undefined) points = real.points

        const rawPlan = (plan || 'gratis').toLowerCase()
        const userRole = (role || 'aluno').toLowerCase()
        const subStatus = (real.subscription_status || 'ativa').toLowerCase()
        const linkedProf = real.linked_professional

        let effectivePlanForCashback = rawPlan
        if (userRole === 'aluno' && linkedProf) {
          // Se tiver plano do parceiro mapeado
          effectivePlanForCashback = rawPlan === 'gratis' ? 'basico' : rawPlan
        }

        if (effectivePlanForCashback === 'gratis') {
          isExcluded = true
          exclusionReason = 'Plano Grátis (redistribuído)'
        } else if ((subStatus === 'inadimplente' || subStatus === 'cancelada') && !linkedProf) {
          isExcluded = true
          exclusionReason = 'Inadimplente (redistribuído)'
        }
      } else {
        // Participante simulado: se excludedRatePerLevel foi configurada
        if (excludedRatePerLevel > 0) {
          // Marca determinística conforme a taxa informada
          const pseudoHash = ((pos * 9301 + 49297) % 233280) / 233280
          if (pseudoHash < excludedRatePerLevel) {
            isExcluded = true
            plan = 'gratis'
            exclusionReason = 'Plano Grátis (simulado)'
          }
        }
      }

      if (!isExcluded) {
        eligibleCount++
      }

      const rawFactor = lvl >= 10 ? 1.0 : getPositionFactor(pos, lvl)

      levelPositions.push({
        pos,
        rawFactor,
        isRealUser,
        isExcluded,
        exclusionReason,
        userCode,
        name,
        email,
        role,
        plan,
        points,
      })
    }

    // Divisor Real = elegíveis no nível (se houver pelo menos 1 elegível)
    // Se nenhum for elegível (ex: todos grátis), divisorReal = 0
    const divisorReal = eligibleCount
    const excluidosCount = effectivePeopleInLevel - eligibleCount

    // Valor teórico por pessoa vs valor real por pessoa elegível
    const valorTeoricoPorPessoa = valorEqualizado / divisorTeorico
    const valorPorElegivel = divisorReal > 0 ? valorEqualizado / divisorReal : 0
    const valorRedistribuidoNivel =
      divisorReal > 0 && excluidosCount > 0
        ? Math.max(0, valorEqualizado - valorTeoricoPorPessoa * divisorReal)
        : 0

    totalRedistributedCents += Math.round(valorRedistribuidoNivel * 100)

    // Distribuir entre os elegíveis do nível
    const levelTotalCents = Math.round(valorEqualizado * 100)
    let sumLevelDistributedCents = 0

    if (divisorReal > 0) {
      if (lvl >= 10) {
        // Divisão rigorosamente igual entre os elegíveis
        const baseCents = Math.floor(levelTotalCents / divisorReal)
        let remainder = levelTotalCents - baseCents * divisorReal

        let eligibleIndex = 0
        for (const pInfo of levelPositions) {
          let individualAmount = 0
          if (!pInfo.isExcluded) {
            let personCents = baseCents
            if (remainder > 0) {
              personCents += 1
              remainder--
            }
            individualAmount = personCents / 100
            sumLevelDistributedCents += personCents
            eligibleIndex++
          }

          if (!shouldLimitParticipantsArray || pInfo.pos <= MAX_GENERATE_PARTICIPANTS) {
            participants.push({
              position: pInfo.pos,
              level: lvl,
              userCode: pInfo.userCode,
              name: pInfo.name,
              email: pInfo.email,
              role: pInfo.role,
              plan: pInfo.plan,
              points: pInfo.points,
              factor: pInfo.rawFactor,
              baseLevelPerPerson: Number(valorPorElegivel.toFixed(4)),
              cashbackMonth: individualAmount,
              isRealUser: pInfo.isRealUser,
              isExcluded: pInfo.isExcluded,
              exclusionReason: pInfo.exclusionReason,
            })
          }
        }
      } else {
        // Níveis 1 a 9: fatores dos elegíveis normalizados
        let sumEligibleFactors = 0
        for (const pInfo of levelPositions) {
          if (!pInfo.isExcluded) {
            sumEligibleFactors += pInfo.rawFactor
          }
        }

        let allocatedCents = 0
        let eligibleIndex = 0

        for (const pInfo of levelPositions) {
          let individualAmount = 0
          if (!pInfo.isExcluded) {
            eligibleIndex++
            const isLastEligible = eligibleIndex === divisorReal
            let personCents = 0
            if (isLastEligible) {
              personCents = levelTotalCents - allocatedCents
            } else {
              const proportion =
                sumEligibleFactors > 0 ? pInfo.rawFactor / sumEligibleFactors : 1 / divisorReal
              personCents = Math.round(levelTotalCents * proportion)
              allocatedCents += personCents
            }
            individualAmount = personCents / 100
            sumLevelDistributedCents += personCents
          }

          if (!shouldLimitParticipantsArray || pInfo.pos <= MAX_GENERATE_PARTICIPANTS) {
            participants.push({
              position: pInfo.pos,
              level: lvl,
              userCode: pInfo.userCode,
              name: pInfo.name,
              email: pInfo.email,
              role: pInfo.role,
              plan: pInfo.plan,
              points: pInfo.points,
              factor: pInfo.rawFactor,
              baseLevelPerPerson: Number(valorPorElegivel.toFixed(4)),
              cashbackMonth: individualAmount,
              isRealUser: pInfo.isRealUser,
              isExcluded: pInfo.isExcluded,
              exclusionReason: pInfo.exclusionReason,
            })
          }
        }
      }
    } else {
      // Nenhum elegível no nível: participantes entram com 0
      for (const pInfo of levelPositions) {
        if (!shouldLimitParticipantsArray || pInfo.pos <= MAX_GENERATE_PARTICIPANTS) {
          participants.push({
            position: pInfo.pos,
            level: lvl,
            userCode: pInfo.userCode,
            name: pInfo.name,
            email: pInfo.email,
            role: pInfo.role,
            plan: pInfo.plan,
            points: pInfo.points,
            factor: pInfo.rawFactor,
            baseLevelPerPerson: 0,
            cashbackMonth: 0,
            isRealUser: pInfo.isRealUser,
            isExcluded: pInfo.isExcluded,
            exclusionReason: pInfo.exclusionReason,
          })
        }
      }
    }

    totalDistributedCents += sumLevelDistributedCents

    levelsSummary.push({
      level: lvl,
      peopleCount: effectivePeopleInLevel,
      startPos,
      endPos: currentLevelEnd,
      corretor,
      valorEqualizado,
      valorPorPessoa: Number(valorPorElegivel.toFixed(4)),
      totalDistribuidoNivel: Number((sumLevelDistributedCents / 100).toFixed(2)),
      divisorTeorico,
      divisorReal,
      excluidosCount,
      valorRedistribuido: Number(valorRedistribuidoNivel.toFixed(2)),
    })
  }

  // Ajuste fino global de centavos: soma total = pool 38%
  let totalDistributed = totalDistributedCents / 100
  let diff = Number((pool - totalDistributed).toFixed(2))

  if (Math.abs(diff) > 0 && participants.length > 0) {
    // Alocar no último participante ELEGÍVEL
    for (let idx = participants.length - 1; idx >= 0; idx--) {
      if (!participants[idx].isExcluded && participants[idx].cashbackMonth > 0) {
        const adjusted = Number((participants[idx].cashbackMonth + diff).toFixed(2))
        if (adjusted >= 0) {
          participants[idx].cashbackMonth = adjusted
          totalDistributedCents += Math.round(diff * 100)
          totalDistributed = totalDistributedCents / 100
          diff = 0
          break
        }
      }
    }
  }

  return {
    totalTarifasBase: safeBase,
    pool38: pool,
    maxHabitedLevel,
    totalOccupiedPositions: maxPos,
    totalDistributed,
    differenceToPool: diff,
    totalRedistributed: Number((totalRedistributedCents / 100).toFixed(2)),
    levelsSummary,
    participants,
  }
}

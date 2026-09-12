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
}

export interface CashbackDistributionResult {
  totalTarifasBase: number
  pool38: number
  maxHabitedLevel: number
  totalOccupiedPositions: number
  totalDistributed: number
  differenceToPool: number
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
    points?: number
  }> = [],
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

  // Resumo por nível
  const levelsSummary: CashbackLevelSummary[] = []
  const participants: CashbackParticipant[] = []
  let totalDistributedCents = 0

  // Se maxPos for muito grande (ex: nível 36 com 68 bilhões), não instanciamos
  // 68 bilhões de objetos no array em memória. Geramos até MAX_GENERATE_PARTICIPANTS (ex: 5.000),
  // garantindo fluidez instantânea e permitindo a renderização dos primeiros milhares de posições.
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
    const isLevelFull = effectivePeopleInLevel === count

    // Cálculo do valor por pessoa e individualização por nível:
    // Nível 10 em diante (10+): divisão IGUAL entre as pessoas efetivamente ocupadas do nível
    // Níveis 1 a 9: individualização por fórmula; se o nível estiver parcialmente ocupado,
    // normalizar fatores para que a soma dos valores pagos no nível = valorEqualizado exato.
    const valorPorPessoa = valorEqualizado / effectivePeopleInLevel

    let sumLevelDistributedCents = 0

    if (lvl >= 10) {
      // Divisão igualitária entre todos os ocupados do nível 10+
      const valorPorPessoaCents = Math.floor((valorEqualizado * 100) / effectivePeopleInLevel)
      const centsRemainder =
        Math.round(valorEqualizado * 100) - valorPorPessoaCents * effectivePeopleInLevel

      if (!shouldLimitParticipantsArray || startPos <= MAX_GENERATE_PARTICIPANTS) {
        const loopEnd = shouldLimitParticipantsArray
          ? Math.min(currentLevelEnd, MAX_GENERATE_PARTICIPANTS)
          : currentLevelEnd

        for (let pos = startPos; pos <= loopEnd; pos++) {
          const factor = 1.0
          // Para os primeiros centavos de resto, somar 1 centavo
          const indexInLevel = pos - startPos
          const personCents = valorPorPessoaCents + (indexInLevel < centsRemainder ? 1 : 0)
          const individualAmount = personCents / 100

          const real = realMap.get(pos)
          let userCode = `369-P${pos}`
          let name = `Participante #${pos}`
          let email = `posicao${pos}@369training.com`
          let role = 'profissional'
          let plan = 'pro'
          let points = Math.max(1, 1000 - pos)
          const isRealUser = !!real

          if (real) {
            if (real.userCode) userCode = real.userCode
            if (real.name) name = real.name
            if (real.email) email = real.email
            if (real.role) role = real.role
            if (real.plan) plan = real.plan
            if (real.points !== undefined) points = real.points
          }

          participants.push({
            position: pos,
            level: lvl,
            userCode,
            name,
            email,
            role,
            plan,
            points,
            factor,
            baseLevelPerPerson: Number(valorPorPessoa.toFixed(4)),
            cashbackMonth: individualAmount,
            isRealUser,
          })
        }
      }

      sumLevelDistributedCents = Math.round(valorEqualizado * 100)
      totalDistributedCents += sumLevelDistributedCents
    } else {
      // Níveis 1 a 9:
      // Fatores teóricos
      const rawFactors: number[] = []
      let sumRawFactors = 0
      for (let pos = startPos; pos <= currentLevelEnd; pos++) {
        const f = getPositionFactor(pos, lvl)
        rawFactors.push(f)
        sumRawFactors += f
      }

      // Se o nível estiver incompleto (ou mesmo completo), normalizamos os fatores:
      // individualAmount_i = valorEqualizado * (factor_i / soma_dos_fatores_das_pessoas_ocupadas)
      const levelTotalCents = Math.round(valorEqualizado * 100)
      let allocatedLevelCents = 0

      for (let i = 0; i < rawFactors.length; i++) {
        const pos = startPos + i
        const rawFactor = rawFactors[i]
        // Fator proporcional normalizado
        const proportion = sumRawFactors > 0 ? rawFactor / sumRawFactors : 1 / rawFactors.length
        const isLastInLevel = i === rawFactors.length - 1

        let personCents = 0
        if (isLastInLevel) {
          // Última pessoa do nível absorve o resíduo de arredondamento para fechar em exato levelTotalCents
          personCents = levelTotalCents - allocatedLevelCents
        } else {
          personCents = Math.round(levelTotalCents * proportion)
          allocatedLevelCents += personCents
        }

        const individualAmount = personCents / 100
        sumLevelDistributedCents += personCents

        const real = realMap.get(pos)
        let userCode = `369-P${pos}`
        let name = `Participante #${pos}`
        let email = `posicao${pos}@369training.com`
        let role = 'profissional'
        let plan = 'pro'
        let points = Math.max(1, 1000 - pos)
        const isRealUser = !!real

        if (real) {
          if (real.userCode) userCode = real.userCode
          if (real.name) name = real.name
          if (real.email) email = real.email
          if (real.role) role = real.role
          if (real.plan) plan = real.plan
          if (real.points !== undefined) points = real.points
        }

        participants.push({
          position: pos,
          level: lvl,
          userCode,
          name,
          email,
          role,
          plan,
          points,
          factor: rawFactor,
          baseLevelPerPerson: Number(valorPorPessoa.toFixed(4)),
          cashbackMonth: individualAmount,
          isRealUser,
        })
      }

      totalDistributedCents += sumLevelDistributedCents
    }

    levelsSummary.push({
      level: lvl,
      peopleCount: effectivePeopleInLevel,
      startPos,
      endPos: currentLevelEnd,
      corretor,
      valorEqualizado,
      valorPorPessoa: Number(valorPorPessoa.toFixed(4)),
      totalDistribuidoNivel: Number((sumLevelDistributedCents / 100).toFixed(2)),
    })
  }

  // Ajuste de resíduo global:
  // A soma dos níveis equalizados deve fechar exatamente no Pool 38%.
  // A diferença entre o pool e o total distribuído (centavos de arredondamento)
  // é alocada na última posição habitada (ou última disponível em participants) para totalDistributed === pool38.
  let totalDistributed = totalDistributedCents / 100
  let diff = Number((pool - totalDistributed).toFixed(2))

  if (Math.abs(diff) > 0 && participants.length > 0) {
    const lastIndex = participants.length - 1
    const adjustedAmount = Number((participants[lastIndex].cashbackMonth + diff).toFixed(2))
    if (adjustedAmount >= 0) {
      participants[lastIndex].cashbackMonth = adjustedAmount
      totalDistributedCents += Math.round(diff * 100)
      totalDistributed = totalDistributedCents / 100
      diff = 0
    }
  }

  return {
    totalTarifasBase: safeBase,
    pool38: pool,
    maxHabitedLevel,
    totalOccupiedPositions: maxPos,
    totalDistributed,
    differenceToPool: diff,
    levelsSummary,
    participants,
  }
}

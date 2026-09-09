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
  while ((1 << lvl) - 1 < pos && lvl < 36) {
    lvl++
  }
  return lvl
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

  for (let lvl = 1; lvl <= maxHabitedLevel; lvl++) {
    const { startPos, endPos, count } = getLevelBounds(lvl)
    const corretor = Number((step * lvl + 0.2).toFixed(4))
    const valorEqualizado = Number((valorDoNivelBase * corretor).toFixed(2))

    // Quantas pessoas deste nível estão de fato ocupadas até maxPos
    const effectivePeopleInLevel = Math.max(0, Math.min(endPos, maxPos) - startPos + 1)
    if (effectivePeopleInLevel <= 0) continue

    // Valor por pessoa no nível (base antes do fator de individualização)
    // O valor do nível é dividido pela capacidade total do nível ocupado
    const valorPorPessoa = effectivePeopleInLevel > 0 ? valorEqualizado / count : 0

    let sumLevelDistributed = 0

    const currentLevelEnd = Math.min(endPos, maxPos)
    for (let pos = startPos; pos <= currentLevelEnd; pos++) {
      const factor = getPositionFactor(pos, lvl)
      let individualAmount = Number((valorPorPessoa * factor).toFixed(2))

      // Buscar dados reais ou mock de posição
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

      sumLevelDistributed += individualAmount
      totalDistributedCents += Math.round(individualAmount * 100)

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

    levelsSummary.push({
      level: lvl,
      peopleCount: effectivePeopleInLevel,
      startPos,
      endPos: currentLevelEnd,
      corretor,
      valorEqualizado,
      valorPorPessoa: Number(valorPorPessoa.toFixed(4)),
      totalDistribuidoNivel: Number(sumLevelDistributed.toFixed(2)),
    })
  }

  // Ajuste fino de resíduo:
  // Se a simulação ocupou todas as posições dos níveis habitados (ex: 1023 posições para 10 níveis),
  // a soma teórica é exatamente o Pool de 38% (R$ 380.000 para base R$ 1.000.000).
  // Arredondamentos de centavos podem dar uma discreta sobra ou resíduo.
  // Regra: o total NUNCA pode ultrapassar o Pool (38%).
  let totalDistributed = totalDistributedCents / 100
  let diff = Number((pool - totalDistributed).toFixed(2))

  // Se houver resíduo em simulação plena (até R$ 5,00 de diferença por arredondamento de centavos em 1023 registros)
  // distribuímos ou ajustamos na última ou primeira posição para fechar em exatos 38% ou manter sem ultrapassar.
  if (Math.abs(diff) > 0 && Math.abs(diff) < 5.0 && participants.length > 0) {
    if (diff > 0) {
      // Sobrou centavos: podemos alocar no primeiro colocado ou manter estritamente <= pool
      // Para conferência perfeita de R$ 380.000, adicionamos a diferença no nível 1 posição 1
      participants[0].cashbackMonth = Number((participants[0].cashbackMonth + diff).toFixed(2))
      totalDistributed = Number((totalDistributed + diff).toFixed(2))
      diff = 0
    } else if (diff < 0) {
      // Ultrapassou: removemos o excesso da posição 1 para NUNCA ultrapassar 38%
      const excess = Math.abs(diff)
      participants[0].cashbackMonth = Number((participants[0].cashbackMonth - excess).toFixed(2))
      totalDistributed = Number((totalDistributed - excess).toFixed(2))
      diff = 0
    }
  }

  return {
    totalTarifasBase: safeBase,
    pool38: pool,
    maxHabitedLevel,
    totalOccupiedPositions: participants.length,
    totalDistributed,
    differenceToPool: diff,
    levelsSummary,
    participants,
  }
}

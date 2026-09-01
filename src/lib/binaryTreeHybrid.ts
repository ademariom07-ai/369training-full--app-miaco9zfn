/**
 * Utilitários do Modelo Caminho C da Rede Única Global 369TRAINING
 * - 36 Níveis
 * - Nível 1: 1 pessoa (acumulado 1)
 * - Nível 2: 2 pessoas (acumulado 3)
 * - Nível 3: 4 pessoas (acumulado 7)
 * - Nível 4: 8 pessoas (acumulado 15)
 * - Progressão 2^(n-1) por nível, acumulado 2^n - 1 até nível 36 (68.719.476.735)
 * - Equalização com corretor:
 *   Nível 1: 0.8 / (próximo_nível / 2) + 0.2
 *   A cada nível soma-se + 0.8 / (próximo_nível / 2) até chegar a 1.8 no último nível
 */

export interface LevelInfo {
  level: number
  peopleInLevel: number | bigint
  startPos: number | bigint
  endPos: number | bigint
  segment: string
  levelPercentage: number
  divisor: number
  modifier: number
  mode: 'individual' | 'nivel_matematico'
}

export const TOTAL_POSITIONS_BIGINT = 68719476735n // 2^36 - 1
export const TOTAL_POSITIONS_STR = '68.719.476.735'
export const TOTAL_LEVELS = 36
export const HYBRID_THRESHOLD = 511

/**
 * Retorna especificações de níveis da Rede Única Global
 */
export function getBinaryTreeLevelsOverview(): LevelInfo[] {
  const levels: LevelInfo[] = []
  let cumulativeStart = 1n

  for (let lvl = 1; lvl <= 36; lvl++) {
    const people = 1n << BigInt(lvl - 1) // 2^(lvl-1)
    const cumulativeEnd = cumulativeStart + people - 1n

    let segment = 'Rede Única Global'
    if (lvl === 1) segment = 'Nível 1 (Top Diamante - 1 pessoa)'
    else if (lvl === 2) segment = 'Nível 2 (Top Tier - 2 pessoas)'
    else if (lvl === 3) segment = 'Nível 3 (Elite - 4 pessoas)'
    else if (lvl === 4) segment = 'Nível 4 (Ouro - 8 pessoas)'
    else if (lvl === 5) segment = 'Nível 5 (Prata - 16 pessoas)'
    else if (lvl === 6) segment = 'Nível 6 (Bronze - 32 pessoas)'
    else if (lvl === 7) segment = 'Nível 7 (Avançado - 64 pessoas)'
    else if (lvl === 8) segment = 'Nível 8 (Master - 128 pessoas)'
    else if (lvl === 9) segment = 'Nível 9 (Base Individual - 256 pessoas)'
    else if (lvl <= 15) segment = `Nível ${lvl} (Expansão Regional)`
    else if (lvl <= 25) segment = `Nível ${lvl} (Expansão Nacional)`
    else segment = `Nível ${lvl} (Escala Global)`

    const levelPct = Math.min(1.8, +(0.24 + (lvl - 1) * 0.04).toFixed(3))
    const modifier = +(1.0 + (lvl - 1) * 0.45).toFixed(2)
    const divisor = Math.pow(2, Math.min(lvl - 1, 10))

    levels.push({
      level: lvl,
      peopleInLevel: people,
      startPos: cumulativeStart,
      endPos: cumulativeEnd,
      segment,
      levelPercentage: levelPct,
      divisor,
      modifier,
      mode: lvl <= 9 ? 'individual' : 'nivel_matematico',
    })

    cumulativeStart = cumulativeEnd + 1n
  }

  return levels
}

/**
 * Determina o nível e parâmetros da Rede Única para qualquer posição até 68 bilhões
 */
export function calculateHybridPositionParams(pos: number | bigint) {
  const posBig = typeof pos === 'bigint' ? pos : BigInt(pos || 1)
  const posNum = Number(pos)

  let lvl = 1
  while (lvl < 36 && (1n << BigInt(lvl)) - 1n < posBig) {
    lvl++
  }

  const peopleInLevel = 1n << BigInt(lvl - 1)
  const modifier = +(1.0 + (lvl - 1) * 0.45).toFixed(2)
  const divisor = Math.pow(2, Math.min(lvl - 1, 10))
  const levelPct = Math.min(1.8, +(0.24 + (lvl - 1) * 0.04).toFixed(3))
  const isIndividual = posBig <= 511n

  let coefficient = 0.1
  let cashbackWeight = 0.0001

  if (posNum > 0 && posNum < 1e12) {
    coefficient = Math.max(0.1, +(1000 / Math.pow(posNum, 0.75)).toFixed(3))
    cashbackWeight = Math.max(0.0001, +(1 / (posNum * 0.8 + 1)).toFixed(5))
  }

  let segment = `Nível ${lvl} (Rede Única Global)`
  if (posBig <= 1n) segment = 'Nível 1 (1 pessoa)'
  else if (posBig <= 3n) segment = 'Nível 2 (2 pessoas)'
  else if (posBig <= 7n) segment = 'Nível 3 (4 pessoas)'
  else if (posBig <= 15n) segment = 'Nível 4 (8 pessoas)'
  else if (posBig <= 31n) segment = 'Nível 5 (16 pessoas)'
  else if (posBig <= 63n) segment = 'Nível 6 (32 pessoas)'
  else if (posBig <= 127n) segment = 'Nível 7 (64 pessoas)'
  else if (posBig <= 255n) segment = 'Nível 8 (128 pessoas)'
  else if (posBig <= 511n) segment = 'Nível 9 (256 pessoas)'
  else segment = `Nível ${lvl} (Cálculo Rede Única)`

  return {
    position: posBig,
    level: lvl,
    segment,
    peopleInLevel,
    coefficient,
    levelPercentage: levelPct,
    levelSharePct: +(0.38 / Math.max(1, lvl)).toFixed(4),
    modifier,
    divisor,
    cashbackWeight,
    isIndividual,
    mode: isIndividual ? ('individual' as const) : ('nivel_matematico' as const),
  }
}

/**
 * Equalizador Caminho C: calcula distribuição por níveis habitados
 */
export function calculateCaminhoCEqualization(
  totalEntradaTarifas: number,
  niveisHabitados: number = 9,
) {
  const pool = totalEntradaTarifas * 0.38
  const nHab = Math.max(1, Math.min(36, niveisHabitados))
  const proximoNivel = nHab + 1
  const step = 0.8 / (proximoNivel / 2)
  const pctDoNivel = 0.38 / nHab
  const valorDoNivel = pool / nHab

  const levels = []
  let somaEqualizados = 0
  let somaCorretor = 0

  for (let lvl = 1; lvl <= nHab; lvl++) {
    const corretor = Number((step * lvl + 0.2).toFixed(4))
    somaCorretor += corretor
    const valorEqualizado = Number((valorDoNivel * corretor).toFixed(2))
    const pessoasNoNivel = Math.pow(2, lvl - 1)
    const valorPorPessoa = Number((valorEqualizado / pessoasNoNivel).toFixed(4))

    somaEqualizados += valorEqualizado

    levels.push({
      level: lvl,
      pessoasNoNivel,
      pctDoNivel: +(pctDoNivel * 100).toFixed(3),
      valorDoNivel: +valorDoNivel.toFixed(2),
      corretor,
      limitadorNivel: +somaCorretor.toFixed(4),
      valorEqualizado,
      valorPorPessoa,
    })
  }

  return {
    totalEntradaTarifas,
    pool,
    niveisHabitados: nHab,
    pctDoNivel: +(pctDoNivel * 100).toFixed(3),
    valorDoNivel: +valorDoNivel.toFixed(2),
    somaEqualizados: +somaEqualizados.toFixed(2),
    levels,
  }
}

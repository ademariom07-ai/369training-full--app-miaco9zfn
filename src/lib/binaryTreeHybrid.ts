/**
 * Utilitários do Modelo Híbrido da Árvore Binária 369TRAINING
 * - 36 Níveis
 * - 68.719.476.735 posições no total (2^36 - 1)
 * - Posições 1ª a 511ª: parâmetros individuais da coleção binary_tree_params (última pessoa do nível 9)
 * - Posições 512ª a 68.719.476.735: calculadas matematicamente por nível
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
 * Retorna as especificações de todos os 36 níveis
 */
export function getBinaryTreeLevelsOverview(): LevelInfo[] {
  const levels: LevelInfo[] = []
  let cumulativeStart = 1n

  for (let lvl = 1; lvl <= 36; lvl++) {
    const people = 1n << BigInt(lvl - 1) // 2^(lvl-1)
    const cumulativeEnd = cumulativeStart + people - 1n

    let segment = 'Rede Binária'
    if (lvl === 1) segment = 'Nível 1 (Top Diamante)'
    else if (lvl === 2) segment = 'Nível 2 (Top Tier)'
    else if (lvl === 3) segment = 'Nível 3 (Elite)'
    else if (lvl === 4) segment = 'Nível 4 (Ouro)'
    else if (lvl === 5) segment = 'Nível 5 (Prata)'
    else if (lvl === 6) segment = 'Nível 6 (Bronze)'
    else if (lvl === 7) segment = 'Nível 7 (Avançado)'
    else if (lvl === 8) segment = 'Nível 8 (Master)'
    else if (lvl === 9) segment = 'Nível 9 (Base Individual)'
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
 * Determina o nível e parâmetros matemáticos para qualquer posição até 68 bilhões
 */
export function calculateHybridPositionParams(pos: number | bigint) {
  const posBig = typeof pos === 'bigint' ? pos : BigInt(pos || 1)
  const posNum = Number(pos)

  // Encontrar nível (1 a 36)
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

  let segment = `Nível ${lvl} (Rede)`
  if (posBig <= 3n) segment = 'Top Tier Diamante'
  else if (posBig <= 7n) segment = 'Elite'
  else if (posBig <= 15n) segment = 'Ouro'
  else if (posBig <= 31n) segment = 'Prata'
  else if (posBig <= 63n) segment = 'Bronze'
  else if (posBig <= 127n) segment = 'Avançado'
  else if (posBig <= 255n) segment = 'Nível 8 Master'
  else if (posBig <= 511n) segment = 'Nível 9 Rede'
  else segment = `Nível ${lvl} (Cálculo Matemático)`

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

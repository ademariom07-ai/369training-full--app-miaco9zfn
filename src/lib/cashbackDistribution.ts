// Simulation only. Does not create ledger entries or approve financial rules.
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
  simulationOnly: true
  rulesVersion: string

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

export interface CashbackInputParticipant {
 ranking_position?:number;userCode?:string;name?:string;email?:string;role?:string;plan?:string;
 subscription_status?:string;linked_professional?:string;linked_professional_plan?:string;points?:number;isExcluded?:boolean
}
const MAX_POSITIONS=500000
function cents(value:number):bigint{
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||!/^\d+(?:\.\d{1,2})?$/.test(String(value)))throw Error('Informe um valor não negativo com até duas casas decimais.')
 const [whole,fraction='']=String(value).split('.'),result=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))
 if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Valor fora do limite da simulação.')
 return result
}
function allocate(total:bigint,weights:bigint[]):bigint[]{
 const sum=weights.reduce((a,b)=>a+b,0n)
 if(sum===0n)return weights.map(()=>0n)
 const rows=weights.map((weight,index)=>({index,value:total*weight/sum,remainder:total*weight%sum}))
 let left=total-rows.reduce((s,r)=>s+r.value,0n)
 const order=[...rows].filter(r=>weights[r.index]>0n).sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)
 for(let i=0;left>0n;i++,left--)order[i].value++
 return rows.map(r=>r.value)
}
function eligibility(row:CashbackInputParticipant):string{
 if(row.isExcluded)return 'Exclusão informada'
 if(!['aluno','profissional'].includes(row.role||''))return 'Perfil não confirmado'
 let plan=row.plan
 if(row.role==='aluno'&&row.linked_professional){
  if(!row.linked_professional_plan)return 'Plano do profissional não confirmado'
  plan=row.linked_professional_plan
 }
 if(!['basico','pro','premium','pro_parceiro'].includes(plan||''))return 'Plano gratuito ou não confirmado'
 if(!['ativa','inadimplente','cancelada'].includes(row.subscription_status||''))return 'Assinatura não confirmada'
 if(row.subscription_status!=='ativa'&&!row.linked_professional)return 'Assinatura inativa'
 return ''
}
/** Preview of Caminho C. Empty levels retain their allocation until a redistribution policy is approved. */
export function calculateCashbackDistribution(totalTarifas:number,occupiedPositions=1023,realParticipants:CashbackInputParticipant[]=[],excludedRatePerLevel=0,participantMode: 'real' | 'synthetic' = realParticipants.length ? 'real' : 'synthetic'):CashbackDistributionResult{
 const base=cents(totalTarifas)
 if(!Number.isSafeInteger(occupiedPositions)||occupiedPositions<0||occupiedPositions>MAX_POSITIONS)throw Error('Informe entre 0 e 500.000 posições.')
 if(!Number.isFinite(excludedRatePerLevel)||excludedRatePerLevel<0||excludedRatePerLevel>1||!Array.isArray(realParticipants)||realParticipants.length>occupiedPositions)throw Error('Participantes inválidos.')
 if(!['real','synthetic'].includes(participantMode)||participantMode==='synthetic'&&realParticipants.length>0)throw Error('Modo de participantes inválido.')
 const realMap=new Map<number,CashbackInputParticipant>()
 for(const row of realParticipants){const position=row?.ranking_position;if(!Number.isSafeInteger(position)||position!<1||position!>occupiedPositions||realMap.has(position!)||row.points!==undefined&&(!Number.isFinite(row.points)||row.points<0))throw Error('Posições inválidas ou repetidas.');realMap.set(position!,{...row})}
 const pool=(base*38n+50n)/100n,h=occupiedPositions ? getLevelForPosition(occupiedPositions) : 0
 const budgets=allocate(pool,Array.from({length:h},(_,i)=>BigInt(h+1+8*(i+1))))
 const participants:CashbackParticipant[]=[],levelsSummary:CashbackLevelSummary[]=[]
 let distributed=0n,redistributed=0n
 for(let level=1;level<=h;level++){
  const bounds=getLevelBounds(level),end=Math.min(bounds.endPos,occupiedPositions),rows:CashbackParticipant[]=[]
  for(let position=bounds.startPos;position<=end;position++){
   const real=realMap.get(position),simulation=participantMode==='synthetic'
   let reason=real?eligibility(real):simulation?'':'Posição sem participante confirmado'
   if(simulation&&((position*9301+49297)%233280)/233280<excludedRatePerLevel)reason='Exclusão simulada'
   rows.push({position,level,userCode:real?.userCode||`369-P${position}`,name:real?.name||`Participante ${simulation?'simulado':'não confirmado'} #${position}`,email:real?.email||'',role:real?.role||'',plan:real?.plan||'',points:real?.points??0,factor:getPositionFactor(position,level),baseLevelPerPerson:0,cashbackMonth:0,isRealUser:!!real,isExcluded:!!reason,exclusionReason:reason||undefined})
  }
  const budget=budgets[level-1],weights=rows.map(r=>r.isExcluded?0n:BigInt(Math.round(r.factor*1000000))),amounts=allocate(budget,weights)
  const eligible=rows.filter(r=>!r.isExcluded).length,count=rows.length,total=amounts.reduce((a,b)=>a+b,0n)
  // Measure redistribution within this level against allocation with everyone eligible.
  const baseline=allocate(budget,rows.map(r=>BigInt(Math.round(r.factor*1000000))))
  const moved=eligible?baseline.reduce((sum,amount,i)=>sum+(rows[i].isExcluded?amount:0n),0n):0n
  rows.forEach((r,i)=>{r.cashbackMonth=Number(amounts[i])/100;r.baseLevelPerPerson=eligible?Number(budget)/100/eligible:0})
  for(const row of rows)participants.push(row);distributed+=total;redistributed+=moved
  levelsSummary.push({level,peopleCount:count,startPos:bounds.startPos,endPos:end,corretor:0.2+1.6*level/(h+1),valorEqualizado:Number(budget)/100,valorPorPessoa:eligible?Number(budget)/100/eligible:0,totalDistribuidoNivel:Number(total)/100,divisorTeorico:count,divisorReal:eligible,excluidosCount:count-eligible,valorRedistribuido:Number(moved)/100})
 }
 return{simulationOnly:true,rulesVersion:'caminho-c-preview-3',totalTarifasBase:totalTarifas,pool38:Number(pool)/100,maxHabitedLevel:h,totalOccupiedPositions:occupiedPositions,totalDistributed:Number(distributed)/100,differenceToPool:Number(pool-distributed)/100,totalRedistributed:Number(redistributed)/100,levelsSummary,participants}
}

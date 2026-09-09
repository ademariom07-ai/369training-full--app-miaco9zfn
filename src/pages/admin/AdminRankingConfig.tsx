import React, { useState, useEffect, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  DollarSign,
  GitFork,
  Save,
  RotateCw,
  Calculator,
  ShieldCheck,
  Leaf,
  Users,
  Target,
  Sparkles,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  Layers,
  HeartHandshake,
  PieChart,
  Cpu,
  Search,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { BinaryTreeParamRecord } from '@/services/api'
import {
  TOTAL_POSITIONS_STR,
  TOTAL_LEVELS,
  HYBRID_THRESHOLD,
  getBinaryTreeLevelsOverview,
  calculateHybridPositionParams,
  calculateCaminhoCEqualization,
} from '@/lib/binaryTreeHybrid'
import { PlanilhaCashbackDistribuicao } from '@/components/PlanilhaCashbackDistribuicao'
import ErrorBoundary from '@/components/ErrorBoundary'

interface RankItem {
  id: string
  user: string
  points: number
  ranking_position: number
  services_count: number
  referrals_count: number
  referrals_this_cycle?: number
  stars: number
  tie_break_details?: {
    position?: number
    level?: number
    segment?: string
    cashback_weight?: number
    stars?: number
    antiguidade?: number
    tarifa_rs?: number
    services_tarifa_rs?: number
    cycle?: string
    formula?: string
    is_hybrid_calculated?: boolean
  }
  expand?: {
    user?: {
      id?: string
      name: string
      plan: string
      email: string
      role?: string
      referral_code?: string
    }
  }
}
export default function AdminRankingConfig() {
  // Distribuição Global de Receita Confirmada
  const [partnerPoolPct, setPartnerPoolPct] = useState('38')
  const [appPct, setAppPct] = useState('30')
  const [philanthropyPct, setPhilanthropyPct] = useState('10')
  const [taxPct, setTaxPct] = useState('10')
  const [supportPct, setSupportPct] = useState('4')
  const [mktPct, setMktPct] = useState('4')
  const [investorPct, setInvestorPct] = useState('4')

  // Tarifa real por plano em R$ (Básico R$1, Pro R$2, Premium R$3)
  const [tarifaBasico, setTarifaBasico] = useState('1.00')
  const [tarifaPro, setTarifaPro] = useState('2.00')
  const [tarifaPremium, setTarifaPremium] = useState('3.00')

  // Regra de Indicação e Validação (default: 5 serviços)
  const [minServicesReferral, setMinServicesReferral] = useState('5')

  // Metas ESG por Nível Confirmadas: Bônus 55% + Econômica 15% + Social 15% + Ecológica 15%
  const [esgBonus, setEsgBonus] = useState('55')
  const [esgEcon, setEsgEcon] = useState('15')
  const [esgSoc, setEsgSoc] = useState('15')
  const [esgEco, setEsgEco] = useState('15')

  // Loading, Rankings & Binary Tree Params
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [rankings, setRankings] = useState<RankItem[]>([])
  const [treeParams, setTreeParams] = useState<BinaryTreeParamRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalIndividualCount, setTotalIndividualCount] = useState(511)
  const [activeTab, setActiveTab] = useState<
    | 'ranking'
    | 'rankingAlunos'
    | 'planilhaCashback'
    | 'tree'
    | 'levels'
    | 'esg'
    | 'split'
    | 'simulador'
    | 'caminhoC'
  >('ranking')
  const [caminhoCEntrada, setCaminhoCEntrada] = useState(1000)
  const [caminhoCNiveis, setCaminhoCNiveis] = useState(9)
  const [searchPos, setSearchPos] = useState('')

  // Simulador interativo de posições > 511
  const [simulatorPosInput, setSimulatorPosInput] = useState('1000')

  const PAGE_SIZE = 25

  useEffect(() => {
    loadData()
  }, [page])

  // Polling automático de 15 segundos para manter o ranking atualizado em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      loadRankingsOnly()
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  const loadRankingsOnly = async () => {
    try {
      const rankList = await pb.collection('rank_entries').getList<RankItem>(1, 50, {
        sort: 'ranking_position',
        expand: 'user',
      })
      if (Array.isArray(rankList?.items)) {
        setRankings(rankList.items)
      }
    } catch {
      // Falha silenciosa no polling periódico
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      // Carregar configurações da plataforma
      try {
        const configs = await pb.collection('platform_config').getFullList()
        if (Array.isArray(configs)) {
          configs.forEach((c) => {
            if (!c) return
            if (c.key === 'plan_tarifas' && c.value && typeof c.value === 'object') {
              if (c.value.basico !== undefined && c.value.basico !== null) {
                const n = Number(c.value.basico)
                if (!isNaN(n)) setTarifaBasico(n.toFixed(2))
              }
              if (c.value.pro !== undefined && c.value.pro !== null) {
                const n = Number(c.value.pro)
                if (!isNaN(n)) setTarifaPro(n.toFixed(2))
              }
              if (c.value.premium !== undefined && c.value.premium !== null) {
                const n = Number(c.value.premium)
                if (!isNaN(n)) setTarifaPremium(n.toFixed(2))
              }
            } else if (c.key === 'revenue_split' && c.value && typeof c.value === 'object') {
              if (c.value.partner_pool_pct !== undefined && c.value.partner_pool_pct !== null) {
                const n = Number(c.value.partner_pool_pct)
                if (!isNaN(n)) setPartnerPoolPct((n * 100).toString())
              }
              if (c.value.app_pct !== undefined && c.value.app_pct !== null) {
                const n = Number(c.value.app_pct)
                if (!isNaN(n)) setAppPct((n * 100).toString())
              }
              if (c.value.filantropia_pct !== undefined && c.value.filantropia_pct !== null) {
                const n = Number(c.value.filantropia_pct)
                if (!isNaN(n)) setPhilanthropyPct((n * 100).toString())
              }
              if (c.value.imposto_pct !== undefined && c.value.imposto_pct !== null) {
                const n = Number(c.value.imposto_pct)
                if (!isNaN(n)) setTaxPct((n * 100).toString())
              }
              if (
                c.value.suporte_tecnico_pct !== undefined &&
                c.value.suporte_tecnico_pct !== null
              ) {
                const n = Number(c.value.suporte_tecnico_pct)
                if (!isNaN(n)) setSupportPct((n * 100).toString())
              }
              if (
                c.value.marketing_carreira_pct !== undefined &&
                c.value.marketing_carreira_pct !== null
              ) {
                const n = Number(c.value.marketing_carreira_pct)
                if (!isNaN(n)) setMktPct((n * 100).toString())
              }
              if (
                c.value.parceiro_investidor_pct !== undefined &&
                c.value.parceiro_investidor_pct !== null
              ) {
                const n = Number(c.value.parceiro_investidor_pct)
                if (!isNaN(n)) setInvestorPct((n * 100).toString())
              }
            } else if (c.key === 'esg_metas' && c.value && typeof c.value === 'object') {
              if (c.value.bonus !== undefined && c.value.bonus !== null) {
                const n = Number(c.value.bonus)
                if (!isNaN(n)) setEsgBonus((n * 100).toString())
              }
              if (c.value.economica !== undefined && c.value.economica !== null) {
                const n = Number(c.value.economica)
                if (!isNaN(n)) setEsgEcon((n * 100).toString())
              }
              if (c.value.social !== undefined && c.value.social !== null) {
                const n = Number(c.value.social)
                if (!isNaN(n)) setEsgSoc((n * 100).toString())
              }
              if (c.value.ecologica !== undefined && c.value.ecologica !== null) {
                const n = Number(c.value.ecologica)
                if (!isNaN(n)) setEsgEco((n * 100).toString())
              }
            } else if (
              c.key === 'min_services_to_validate_referral' &&
              c.value !== undefined &&
              c.value !== null
            ) {
              setMinServicesReferral(String(c.value))
            }
          })
        }
      } catch (err) {
        console.warn('Aviso ao carregar platform_config:', err)
      }

      // Carregar ranking atual
      try {
        const rankList = await pb.collection('rank_entries').getList<RankItem>(1, 50, {
          sort: 'ranking_position',
          expand: 'user',
        })
        if (Array.isArray(rankList?.items)) {
          setRankings(rankList.items)
        }
      } catch (err) {
        console.warn('Aviso ao carregar rank_entries:', err)
      }

      // Carregar 511 parâmetros individuais da Árvore Binária paginados
      try {
        const paramsList = await pb
          .collection('binary_tree_params')
          .getList<BinaryTreeParamRecord>(page, PAGE_SIZE, {
            sort: 'position',
          })
        if (Array.isArray(paramsList?.items)) {
          setTreeParams(paramsList.items)
        }
        setTotalIndividualCount(paramsList?.totalItems || 511)
        setTotalPages(paramsList?.totalPages || Math.ceil(511 / PAGE_SIZE))
      } catch (err) {
        console.warn('Aviso ao carregar binary_tree_params:', err)
      }
    } catch (err) {
      console.error('Erro em loadData de AdminRankingConfig:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const tarifaB = parseFloat(tarifaBasico) || 1.0
      const tarifaP = parseFloat(tarifaPro) || 2.0
      const tarifaPrem = parseFloat(tarifaPremium) || 3.0

      const pPool = (parseFloat(partnerPoolPct) || 38) / 100
      const pApp = (parseFloat(appPct) || 30) / 100
      const pFilan = (parseFloat(philanthropyPct) || 10) / 100
      const pTax = (parseFloat(taxPct) || 10) / 100
      const pSup = (parseFloat(supportPct) || 4) / 100
      const pMkt = (parseFloat(mktPct) || 4) / 100
      const pInv = (parseFloat(investorPct) || 4) / 100

      const eBonus = (parseFloat(esgBonus) || 55) / 100
      const eEcon = (parseFloat(esgEcon) || 15) / 100
      const eSoc = (parseFloat(esgSoc) || 15) / 100
      const eEco = (parseFloat(esgEco) || 15) / 100

      // 1. Atualizar plan_tarifas
      try {
        const tarifaRec = await pb
          .collection('platform_config')
          .getFirstListItem('key = "plan_tarifas"')
        await pb.collection('platform_config').update(tarifaRec.id, {
          value: { gratis: tarifaB, basico: tarifaB, pro: tarifaP, premium: tarifaPrem },
          description: 'Tarifa cobrada por serviço em R$ (Básico R$1, Pro R$2, Premium R$3)',
        })
      } catch {
        await pb.collection('platform_config').create({
          key: 'plan_tarifas',
          value: { gratis: tarifaB, basico: tarifaB, pro: tarifaP, premium: tarifaPrem },
          description: 'Tarifa cobrada por serviço em R$ (Básico R$1, Pro R$2, Premium R$3)',
        })
      }

      // 2. Atualizar revenue_split
      try {
        const revRec = await pb
          .collection('platform_config')
          .getFirstListItem('key = "revenue_split"')
        await pb.collection('platform_config').update(revRec.id, {
          value: {
            partner_pool_pct: pPool,
            app_pct: pApp,
            filantropia_pct: pFilan,
            imposto_pct: pTax,
            suporte_tecnico_pct: pSup,
            marketing_carreira_pct: pMkt,
            parceiro_investidor_pct: pInv,
          },
          description: 'Split global de receita 369 confirmada',
        })
      } catch {
        await pb.collection('platform_config').create({
          key: 'revenue_split',
          value: {
            partner_pool_pct: pPool,
            app_pct: pApp,
            filantropia_pct: pFilan,
            imposto_pct: pTax,
            suporte_tecnico_pct: pSup,
            marketing_carreira_pct: pMkt,
            parceiro_investidor_pct: pInv,
          },
          description: 'Split global de receita 369 confirmada',
        })
      }

      // 3. Atualizar esg_metas
      try {
        const esgRec = await pb.collection('platform_config').getFirstListItem('key = "esg_metas"')
        await pb.collection('platform_config').update(esgRec.id, {
          value: {
            bonus: eBonus,
            economica: eEcon,
            social: eSoc,
            ecologica: eEco,
            triggers: [
              { threshold: 10000, required_metas: 1, penalty_pct_if_missed: 0.85 },
              { threshold: 15000, required_metas: 2, penalty_base_pct: 0.55, bonus_per_meta: 0.15 },
              { threshold: 20000, required_metas: 3, penalty_base_pct: 0.55, bonus_per_meta: 0.15 },
            ],
          },
          description: 'Metas ESG e Gatilhos mensais acumulados R$10k, R$15k, R$20k',
        })
      } catch {
        await pb.collection('platform_config').create({
          key: 'esg_metas',
          value: {
            bonus: eBonus,
            economica: eEcon,
            social: eSoc,
            ecologica: eEco,
            triggers: [
              { threshold: 10000, required_metas: 1, penalty_pct_if_missed: 0.85 },
              { threshold: 15000, required_metas: 2, penalty_base_pct: 0.55, bonus_per_meta: 0.15 },
              { threshold: 20000, required_metas: 3, penalty_base_pct: 0.55, bonus_per_meta: 0.15 },
            ],
          },
          description: 'Metas ESG e Gatilhos mensais acumulados R$10k, R$15k, R$20k',
        })
      }

      // 4. Atualizar min_services_to_validate_referral
      const minServ = parseInt(minServicesReferral, 10) || 5
      try {
        const refRec = await pb
          .collection('platform_config')
          .getFirstListItem('key = "min_services_to_validate_referral"')
        await pb.collection('platform_config').update(refRec.id, {
          value: minServ,
          description:
            'Mínimo de serviços concluídos para validar indicação e liberar cashback de referral',
        })
      } catch {
        await pb.collection('platform_config').create({
          key: 'min_services_to_validate_referral',
          value: minServ,
          description:
            'Mínimo de serviços concluídos para validar indicação e liberar cashback de referral',
        })
      }

      toast.success(
        'Parâmetros de tarifas, divisão de receita, indicação e ESG atualizados com sucesso!',
      )
    } catch {
      toast.error('Erro ao salvar parâmetros na nuvem.')
    }
  }

  const handleRecalculateRanking = async () => {
    setRecalculating(true)
    try {
      await pb.send('/backend/v1/admin/recalculate_rank', {
        method: 'POST',
      })
      toast.success('Ranking recalculado com sucesso conforme fórmula do Caminho C!')
      await loadData()
    } catch {
      await clientSideRecalculate()
      await loadData()
    } finally {
      setRecalculating(false)
    }
  }

  const clientSideRecalculate = async () => {
    try {
      const planMultipliers: Record<string, number> = {
        gratis: 0,
        basico: 1,
        pro: 2,
        premium: 3,
      }
      const tarifasMap: Record<string, number> = {
        gratis: 1.0,
        basico: 1.0,
        pro: 2.0,
        premium: 3.0,
      }

      const users = await pb.collection('users').getFullList({
        filter: 'approved = true',
      })

      const currentCycle = new Date().toISOString().slice(0, 7)
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .replace('T', ' ')

      const scored: Array<{
        user_id: string
        role: string
        plan: string
        points: number
        services_count: number
        services_tarifa_rs: number
        referrals_count: number
        referrals_this_cycle: number
        stars: number
        antiguidade: number
        created: string
      }> = []

      for (const u of users) {
        const rawPlan = ((u.plan as string) || 'gratis').toLowerCase()
        const role = (u.role as string) || 'aluno'
        const multiplier = planMultipliers[rawPlan] ?? 0
        if (multiplier === 0) continue

        let effectiveMultiplier = multiplier
        if (
          role === 'aluno' &&
          u.linked_professional &&
          u.linked_prof_fee_mode === 'prof_sponsored'
        ) {
          try {
            const prof = await pb.collection('users').getOne(u.linked_professional as string)
            const profPlan = ((prof.plan as string) || 'basico').toLowerCase()
            effectiveMultiplier = planMultipliers[profPlan] ?? 1
          } catch {
            // mantém
          }
        }

        const serviceFilter =
          role === 'profissional'
            ? `professional = "${u.id}" && status = "concluido" && created >= "${currentMonthStart}"`
            : `student = "${u.id}" && status = "concluido" && created >= "${currentMonthStart}"`

        let svcs: any[] = []
        try {
          svcs = await pb.collection('services').getFullList({
            filter: serviceFilter,
          })
        } catch {
          svcs = []
        }

        let servicesTarifaRS = 0
        const userTarifa = tarifasMap[rawPlan] ?? 1.0
        servicesTarifaRS = svcs.length * userTarifa

        let refsMonth: any[] = []
        let allRefs: any[] = []
        try {
          allRefs = await pb.collection('referrals').getFullList({
            filter: `referrer = "${u.id}"`,
          })
          refsMonth = allRefs.filter((r) => r.created >= currentMonthStart)
        } catch {
          allRefs = []
          refsMonth = []
        }

        const avaliacao = Math.round(Number(u.rating_avg) || 5)
        const userCreated = u.created ? new Date(u.created as string) : new Date()
        const diffMonths = Math.max(
          1,
          Math.floor((now.getTime() - userCreated.getTime()) / (1000 * 60 * 60 * 24 * 30)),
        )
        const antiguidade = Math.min(diffMonths, 10)

        const indicacoesFator = Math.max(refsMonth.length, 1)
        const monthlyPoints =
          Math.round(effectiveMultiplier * servicesTarifaRS * indicacoesFator) +
          avaliacao +
          antiguidade

        scored.push({
          user_id: u.id,
          role,
          plan: rawPlan,
          points: monthlyPoints,
          services_count: svcs.length,
          services_tarifa_rs: servicesTarifaRS,
          referrals_count: allRefs.length,
          referrals_this_cycle: refsMonth.length,
          stars: avaliacao,
          antiguidade,
          created: (u.created as string) || new Date().toISOString(),
        })
      }

      scored.sort((a, b) => b.points - a.points || b.stars - a.stars)

      for (let i = 0; i < scored.length; i++) {
        const item = scored[i]
        const pos = i + 1

        try {
          const existing = await pb
            .collection('rank_entries')
            .getFirstListItem(`user = "${item.user_id}"`)
          await pb.collection('rank_entries').update(existing.id, {
            cycle: currentCycle,
            points: item.points,
            services_count: item.services_count,
            referrals_count: item.referrals_count,
            referrals_this_cycle: item.referrals_this_cycle,
            stars: item.stars,
            ranking_position: pos,
            tie_break_details: {
              position: pos,
              stars: item.stars,
              antiguidade: item.antiguidade,
              services_tarifa_rs: item.services_tarifa_rs,
              cycle: currentCycle,
              formula: 'PONTOS = (PLANO) × (SERVIÇOS R$) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
              recomputed_at: new Date().toISOString(),
            },
          })
        } catch {
          await pb.collection('rank_entries').create({
            user: item.user_id,
            cycle: currentCycle,
            points: item.points,
            services_count: item.services_count,
            referrals_count: item.referrals_count,
            referrals_this_cycle: item.referrals_this_cycle,
            stars: item.stars,
            ranking_position: pos,
            tie_break_details: {
              position: pos,
              stars: item.stars,
              antiguidade: item.antiguidade,
              services_tarifa_rs: item.services_tarifa_rs,
              cycle: currentCycle,
              formula: 'PONTOS = (PLANO) × (SERVIÇOS R$) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE',
              recomputed_at: new Date().toISOString(),
            },
          })
        }
      }
      toast.success('Ranking recalculado conforme fórmula confirmada!')
    } catch {
      toast.error('Erro ao recalcular ranking localmente')
    }
  }

  const filteredTreeParams = useMemo(() => {
    if (!Array.isArray(treeParams)) return []
    if (!searchPos) return treeParams
    const q = searchPos.toLowerCase().trim()
    return treeParams.filter((p) => {
      if (!p) return false
      const posStr = p.position != null ? String(p.position) : ''
      const lvlStr = p.level != null ? String(p.level) : ''
      const segStr = p.segment ? String(p.segment).toLowerCase() : ''
      return posStr.includes(q) || lvlStr.includes(q) || segStr.includes(q)
    })
  }, [treeParams, searchPos])

  const totalSplitSum = useMemo(() => {
    const sum =
      (Number(partnerPoolPct) || 0) +
      (Number(appPct) || 0) +
      (Number(philanthropyPct) || 0) +
      (Number(taxPct) || 0) +
      (Number(supportPct) || 0) +
      (Number(mktPct) || 0) +
      (Number(investorPct) || 0)
    return Math.round(sum)
  }, [partnerPoolPct, appPct, philanthropyPct, taxPct, supportPct, mktPct, investorPct])

  const totalEsgSum = useMemo(() => {
    const sum =
      (Number(esgBonus) || 0) +
      (Number(esgEcon) || 0) +
      (Number(esgSoc) || 0) +
      (Number(esgEco) || 0)
    return Math.round(sum)
  }, [esgBonus, esgEcon, esgSoc, esgEco])

  const levelsOverview = useMemo(() => {
    try {
      const overview = getBinaryTreeLevelsOverview()
      return Array.isArray(overview) ? overview : []
    } catch (e) {
      console.warn('Erro ao calcular levelsOverview:', e)
      return []
    }
  }, [])

  const simulatedParams = useMemo(() => {
    try {
      const clean = String(simulatorPosInput || '').replace(/\D/g, '')
      const num = clean ? BigInt(clean) : 1n
      return calculateHybridPositionParams(num)
    } catch {
      return calculateHybridPositionParams(1n)
    }
  }, [simulatorPosInput])

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="p-8 bg-[#181818] border border-[#D4AF37]/40 rounded-2xl max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold font-montserrat text-white mb-2">
              Módulo de Ranking Protegido
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              Houve uma inconsistência ao processar os parâmetros do modelo híbrido. Seus dados
              estão seguros.
            </p>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold text-xs uppercase py-3 rounded-xl"
            >
              Recarregar Módulo
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
              <Cpu className="w-3.5 h-3.5 text-[#D4AF37]" />
              Modelo Híbrido da Árvore Binária • 36 Níveis • {TOTAL_POSITIONS_STR} Posições
            </div>
            <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
              Configuração de Ranking & Árvore Binária Híbrida
            </h1>
            <p className="text-sm text-gray-400 font-inter mt-1">
              <strong>1ª a 511ª posição:</strong> parâmetros individuais armazenados no banco
              (Níveis 1 ao 9). <strong>512ª em diante (até 68,7 bilhões):</strong> cálculo
              matemático instantâneo por nível no motor.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleRecalculateRanking}
            disabled={recalculating}
            className="bg-[#0057FF] hover:bg-[#0047D4] text-white font-bold text-xs uppercase px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 self-start md:self-auto"
          >
            {recalculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCw className="w-4 h-4" />
            )}
            {recalculating ? 'Recalculando...' : 'Recalcular Ranking Agora'}
          </Button>
        </div>

        {/* MODELO HÍBRIDO EXPLAINER BANNER */}
        <Card className="bg-gradient-to-r from-[#141824] via-[#10141f] to-[#141824] border border-[#0057FF]/40 p-5 rounded-2xl shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-[#0057FF]/20 rounded-xl border border-[#0057FF]/40 text-[#0057FF]">
                <GitFork className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-montserrat uppercase text-[#0057FF]">
                    Arquitetura do Modelo Híbrido
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10"
                  >
                    Alta Escalabilidade (2³⁶ − 1)
                  </Badge>
                </div>
                <h3 className="text-lg font-bold font-montserrat text-white mt-0.5">
                  511 Posições Individuais + 36 Níveis Calculados ({TOTAL_POSITIONS_STR} posições)
                </h3>
                <p className="text-xs text-gray-300 font-inter mt-1">
                  A <strong>511ª posição</strong> encerra com precisão a última pessoa do{' '}
                  <strong>Nível 9</strong> (256 pessoas). A partir da posição 512ª (Nível 10 até
                  36), o motor aplica as equações geométricas e distribui os 38% do pool de
                  parceiros com zero sobrecarga de banco de dados.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('simulador')}
                className="border-[#0057FF]/50 text-[#0057FF] hover:bg-[#0057FF]/10 text-xs font-bold uppercase rounded-xl"
              >
                <Calculator className="w-3.5 h-3.5 mr-1.5" /> Testar Simulador 68B
              </Button>
            </div>
          </div>
        </Card>

        {/* KPI METRIC CARDS ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
            <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
              <span>Pool de Parceiros</span>
              <PieChart className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="text-2xl font-black font-montserrat text-[#D4AF37] mt-1">
              {partnerPoolPct}%
            </div>
            <span className="text-[10px] text-gray-500 font-inter">
              Distribuído em todos os níveis habitados
            </span>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
            <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
              <span>Capacidade da Árvore</span>
              <GitFork className="w-4 h-4 text-[#0057FF]" />
            </div>
            <div className="text-2xl font-black font-montserrat text-white mt-1">68,7 Bilhões</div>
            <span className="text-[10px] text-gray-500 font-inter">
              2³⁶ − 1 posições em 36 níveis
            </span>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
            <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
              <span>Faixa Individual (DB)</span>
              <Layers className="w-4 h-4 text-[#22C55E]" />
            </div>
            <div className="text-2xl font-black font-montserrat text-[#22C55E] mt-1">1ª a 511ª</div>
            <span className="text-[10px] text-gray-500 font-inter">
              511 registros (Nível 1 ao 9)
            </span>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
            <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
              <span>Gatilhos ESG Mensais</span>
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black font-montserrat text-amber-400 mt-1">
              10k / 15k / 20k
            </div>
            <span className="text-[10px] text-gray-500 font-inter">
              Bônus 55% + 15% Econ + 15% Soc + 15% Eco
            </span>
          </Card>
        </div>

        {/* NOVA FÓRMULA HIGHLIGHT CARD */}
        <Card className="bg-gradient-to-r from-[#181818] via-[#1c1a14] to-[#181818] border-2 border-[#D4AF37] p-6 rounded-2xl shadow-[0_0_25px_rgba(212,175,55,0.15)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold font-montserrat text-[#D4AF37] uppercase">
                <Calculator className="w-4 h-4" /> Motor de Ranking Exclusivamente por Pontos
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                pontos = <span className="text-[#D4AF37]">tarifa_R$</span> ×{' '}
                <span className="text-[#0057FF]">serviços</span> ×{' '}
                <span className="text-[#22C55E]">max(indicações, 1)</span>
              </div>
              <p className="text-xs text-gray-300 font-inter">
                Classificação <strong>exclusivamente por pontuação</strong>. Se posição ≤ 511: busca
                parâmetros individuais na coleção. Se posição &gt; 511: o motor determina o nível e
                aplica as fórmulas do modelo híbrido.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center min-w-[90px]">
                <span className="block text-[10px] uppercase text-gray-400 font-semibold">
                  Básico
                </span>
                <span className="text-sm font-bold text-white font-mono">R$ {tarifaBasico}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center min-w-[90px]">
                <span className="block text-[10px] uppercase text-gray-400 font-semibold">Pro</span>
                <span className="text-sm font-bold text-[#0057FF] font-mono">R$ {tarifaPro}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-[#D4AF37]/50 text-center min-w-[90px]">
                <span className="block text-[10px] uppercase text-[#D4AF37] font-semibold">
                  Premium
                </span>
                <span className="text-sm font-bold text-[#D4AF37] font-mono">
                  R$ {tarifaPremium}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-[#2A2A2A] gap-2 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ranking')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ranking'
                ? 'bg-[#181818] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" /> Ranking Geral (Alunos + Profissionais)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rankingAlunos')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'rankingAlunos'
                ? 'bg-[#181818] text-[#0057FF] border-t-2 border-[#0057FF]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-[#0057FF]" /> Ranking Alunos/Clientes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('planilhaCashback')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'planilhaCashback'
                ? 'bg-[#181818] text-[#22C55E] border-t-2 border-[#22C55E]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4 text-[#22C55E]" /> Planilha de Distribuição de Cashback
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tree')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'tree'
                ? 'bg-[#181818] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <GitFork className="w-4 h-4" /> Faixa Individual (1ª a 511ª)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('levels')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'levels'
                ? 'bg-[#181818] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Visão Geral dos 36 Níveis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulador')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'simulador'
                ? 'bg-[#181818] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" /> Simulador Híbrido (até 68B)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('esg')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'esg'
                ? 'bg-[#181818] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Leaf className="w-4 h-4" /> Regras ESG & Gatilhos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('split')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'split'
                ? 'bg-[#181818] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" /> Split 38%
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('caminhoC')}
            className={`px-4 py-2 text-xs font-bold font-montserrat uppercase rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'caminhoC'
                ? 'bg-[#181818] text-[#22C55E] border-t-2 border-[#22C55E]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#22C55E]" /> Equalizador Caminho C
          </button>
        </div>

        {/* TAB 1: RANKING GERAL (ALUNOS + PROFISSIONAIS JUNTOS) */}
        {activeTab === 'ranking' && (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#D4AF37]" /> Classificação Geral (Alunos/Clientes
                  + Profissionais/Parceiros)
                </h3>
                <p className="text-xs text-gray-400 font-inter">
                  Fórmula confirmada:{' '}
                  <code>
                    PONTOS = (PLANO) × (SERVIÇOS R$) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
                  </code>
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-mono text-[#22C55E] bg-[#22C55E]/10 px-3 py-1 rounded-full border border-[#22C55E]/30">
                  Rede Única Global
                </span>
                <span className="text-[11px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 rounded-full border border-[#D4AF37]/30">
                  Ciclo {new Date().toISOString().slice(0, 7)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-inter">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                    <th className="pb-3">RANK</th>
                    <th className="pb-3">CÓDIGO + PRIMEIRO NOME</th>
                    <th className="pb-3 text-center">TIPO</th>
                    <th className="pb-3 text-center">PLANO</th>
                    <th className="pb-3 text-center">SERVIÇOS (R$)</th>
                    <th className="pb-3 text-center">INDICAÇÕES</th>
                    <th className="pb-3 text-center">PONTOS</th>
                    <th className="pb-3 text-center">AVALIAÇÃO</th>
                    <th className="pb-3 text-right">ANTIGUIDADE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D4AF37]" />
                        Carregando dados do ranking geral...
                      </td>
                    </tr>
                  ) : rankings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-gray-400">
                        Nenhum participante pontuado ainda. Clique em &ldquo;Recalcular Ranking
                        Agora&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    rankings.map((r, index) => {
                      const u = r.expand?.user
                      const rawPlan = typeof u?.plan === 'string' ? u.plan : 'basico'
                      const plan = rawPlan.toLowerCase()
                      const pos = Number(r.ranking_position) || index + 1
                      const userRole = u?.role || 'profissional'

                      // CÓDIGO + PRIMEIRO NOME (ex: "174928A — Carlos")
                      const fallbackCode =
                        typeof r.user === 'string' && r.user
                          ? r.user.slice(0, 7).toUpperCase()
                          : '369'
                      const userCode = u?.referral_code || fallbackCode
                      const rawName =
                        typeof u?.name === 'string' && u.name ? u.name : 'Participante'
                      const firstName =
                        rawName
                          .replace(/^(Prof\.|Dra\.|Dr\.)\s*/i, '')
                          .trim()
                          .split(' ')[0] || 'Participante'
                      const codeAndName = `${userCode} — ${firstName}`

                      // SERVIÇOS EM R$
                      const planRate = plan === 'premium' ? 3.0 : plan === 'pro' ? 2.0 : 1.0
                      const rawSvcTarifa = r.tie_break_details?.services_tarifa_rs
                      const servicesRS =
                        rawSvcTarifa !== undefined && rawSvcTarifa !== null
                          ? Number(rawSvcTarifa) || 0
                          : (Number(r.services_count) || 0) * planRate

                      // INDICAÇÕES
                      const indicacoes =
                        r.referrals_this_cycle !== undefined && r.referrals_this_cycle !== null
                          ? Number(r.referrals_this_cycle) || 0
                          : Number(r.referrals_count) || 0

                      // AVALIAÇÃO
                      const avaliacao = Number(r.stars) || 5

                      // ANTIGUIDADE
                      const antiguidade = Number(r.tie_break_details?.antiguidade) || 1

                      // PONTOS
                      const pointsNum = Number(r.points) || 0

                      return (
                        <tr
                          key={r.id || `rank-${index}`}
                          className="hover:bg-[#141414] transition-colors"
                        >
                          <td className="py-3 font-bold font-mono text-[#D4AF37]">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                pos === 1
                                  ? 'bg-[#D4AF37] text-black font-extrabold shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                                  : pos === 2
                                    ? 'bg-gray-300 text-black font-bold'
                                    : pos === 3
                                      ? 'bg-amber-700 text-white font-bold'
                                      : 'bg-[#2A2A2A] text-gray-300'
                              }`}
                            >
                              #{pos}
                            </span>
                          </td>
                          <td className="py-3 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#D4AF37]">
                                {codeAndName}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono block">
                              {u?.email || r.user || '—'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-montserrat ${
                                userRole === 'aluno'
                                  ? 'bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/30'
                                  : 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                              }`}
                            >
                              {userRole === 'aluno' ? 'Aluno' : 'Parceiro'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-montserrat ${
                                plan === 'premium'
                                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                                  : plan === 'pro'
                                    ? 'bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/40'
                                    : 'bg-gray-800 text-gray-300 border border-gray-700'
                              }`}
                            >
                              {plan}
                            </span>
                          </td>
                          <td className="py-3 text-center font-mono font-bold text-white">
                            R$ {servicesRS.toFixed(2)}
                            <span className="block text-[10px] text-gray-500 font-normal">
                              ({Number(r.services_count) || 0} svcs)
                            </span>
                          </td>
                          <td className="py-3 text-center font-mono font-bold text-[#22C55E]">
                            {indicacoes}
                            <span className="text-[10px] text-gray-500 font-normal block">
                              (Total: {Number(r.referrals_count) || 0})
                            </span>
                          </td>
                          <td className="py-3 text-center font-mono font-black text-[#D4AF37] text-sm">
                            {pointsNum.toLocaleString('pt-BR')} pts
                          </td>
                          <td className="py-3 text-center font-mono text-amber-300 font-bold">
                            ★ {avaliacao.toFixed(1)}
                          </td>
                          <td className="py-3 text-right font-mono text-gray-300 font-semibold">
                            {antiguidade} {antiguidade === 1 ? 'mês' : 'meses'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 1.5: RANKING EXCLUSIVO DE ALUNOS/CLIENTES */}
        {activeTab === 'rankingAlunos' && (
          <Card className="bg-[#181818] border border-[#0057FF]/30 p-6 rounded-2xl shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-1">
                  <Users className="w-3.5 h-3.5" />
                  Aba Separada — Exclusivo Alunos / Clientes
                </div>
                <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#0057FF]" /> Classificação Somente de Alunos /
                  Clientes
                </h3>
                <p className="text-xs text-gray-400 font-inter">
                  Exibe exclusivamente alunos ativos pontuados conforme a fórmula oficial (PLANO ×
                  SERVIÇOS R$ × INDICAÇÕES + AVALIAÇÃO + ANTIGUIDADE).
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-mono text-[#0057FF] bg-[#0057FF]/10 px-3 py-1 rounded-full border border-[#0057FF]/30 font-bold">
                  Filtro: role = aluno
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-inter">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                    <th className="pb-3">RANK</th>
                    <th className="pb-3">CÓDIGO + PRIMEIRO NOME</th>
                    <th className="pb-3 text-center">PLANO</th>
                    <th className="pb-3 text-center">SERVIÇOS (R$)</th>
                    <th className="pb-3 text-center">INDICAÇÕES</th>
                    <th className="pb-3 text-center">PONTOS</th>
                    <th className="pb-3 text-center">AVALIAÇÃO</th>
                    <th className="pb-3 text-right">ANTIGUIDADE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0057FF]" />
                        Carregando dados dos alunos...
                      </td>
                    </tr>
                  ) : rankings.filter((r) => r.expand?.user?.role === 'aluno').length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400">
                        Nenhum aluno com plano ativo pontuou neste ciclo ainda.
                      </td>
                    </tr>
                  ) : (
                    rankings
                      .filter((r) => r.expand?.user?.role === 'aluno')
                      .map((r, subIndex) => {
                        const u = r.expand?.user
                        const rawPlan = typeof u?.plan === 'string' ? u.plan : 'basico'
                        const plan = rawPlan.toLowerCase()
                        const posAluno = subIndex + 1

                        const fallbackCode =
                          typeof r.user === 'string' && r.user
                            ? r.user.slice(0, 7).toUpperCase()
                            : '369'
                        const userCode = u?.referral_code || fallbackCode
                        const rawName = typeof u?.name === 'string' && u.name ? u.name : 'Aluno'
                        const firstName =
                          rawName
                            .replace(/^(Prof\.|Dra\.|Dr\.)\s*/i, '')
                            .trim()
                            .split(' ')[0] || 'Aluno'
                        const codeAndName = `${userCode} — ${firstName}`

                        const planRate = plan === 'premium' ? 3.0 : plan === 'pro' ? 2.0 : 1.0
                        const rawSvcTarifa = r.tie_break_details?.services_tarifa_rs
                        const servicesRS =
                          rawSvcTarifa !== undefined && rawSvcTarifa !== null
                            ? Number(rawSvcTarifa) || 0
                            : (Number(r.services_count) || 0) * planRate

                        const indicacoes =
                          r.referrals_this_cycle !== undefined && r.referrals_this_cycle !== null
                            ? Number(r.referrals_this_cycle) || 0
                            : Number(r.referrals_count) || 0
                        const avaliacao = Number(r.stars) || 5
                        const antiguidade = Number(r.tie_break_details?.antiguidade) || 1
                        const pointsNum = Number(r.points) || 0

                        return (
                          <tr
                            key={r.id || `aluno-${subIndex}`}
                            className="hover:bg-[#141414] transition-colors"
                          >
                            <td className="py-3 font-bold font-mono text-[#0057FF]">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                  posAluno === 1
                                    ? 'bg-[#0057FF] text-white font-extrabold shadow-[0_0_12px_rgba(0,87,255,0.4)]'
                                    : posAluno === 2
                                      ? 'bg-blue-300 text-black font-bold'
                                      : posAluno === 3
                                        ? 'bg-blue-900 text-blue-100 font-bold'
                                        : 'bg-[#2A2A2A] text-gray-300'
                                }`}
                              >
                                #{posAluno}
                              </span>
                            </td>
                            <td className="py-3 font-semibold text-white">
                              <span className="font-mono text-xs font-bold text-[#0057FF]">
                                {codeAndName}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono block">
                                {u?.email || r.user || '—'}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-montserrat ${
                                  plan === 'premium'
                                    ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
                                    : plan === 'pro'
                                      ? 'bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/40'
                                      : 'bg-gray-800 text-gray-300 border border-gray-700'
                                }`}
                              >
                                {plan}
                              </span>
                            </td>
                            <td className="py-3 text-center font-mono font-bold text-white">
                              R$ {servicesRS.toFixed(2)}
                              <span className="block text-[10px] text-gray-500 font-normal">
                                ({Number(r.services_count) || 0} svcs)
                              </span>
                            </td>
                            <td className="py-3 text-center font-mono font-bold text-[#22C55E]">
                              {indicacoes}
                              <span className="text-[10px] text-gray-500 font-normal block">
                                (Total: {Number(r.referrals_count) || 0})
                              </span>
                            </td>
                            <td className="py-3 text-center font-mono font-black text-[#D4AF37] text-sm">
                              {pointsNum.toLocaleString('pt-BR')} pts
                            </td>
                            <td className="py-3 text-center font-mono text-amber-300 font-bold">
                              ★ {avaliacao.toFixed(1)}
                            </td>
                            <td className="py-3 text-right font-mono text-gray-300 font-semibold">
                              {antiguidade} {antiguidade === 1 ? 'mês' : 'meses'}
                            </td>
                          </tr>
                        )
                      })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 2: 511 PARÂMETROS INDIVIDUAIS */}
        {activeTab === 'tree' && (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                  <GitFork className="w-5 h-5 text-[#D4AF37]" /> Faixa Individual: 511 Posições
                  (Coleção <code>binary_tree_params</code>)
                </h3>
                <p className="text-xs text-gray-400 font-inter">
                  Posições 1ª a 511ª (Níveis 1 ao 9). A 511ª posição é o último registro individual
                  no banco de dados.
                </p>
              </div>
              <div className="w-full sm:w-64">
                <Input
                  value={searchPos}
                  onChange={(e) => setSearchPos(e.target.value)}
                  placeholder="Filtrar por posição, nível ou segmento..."
                  className="bg-[#141414] border-[#2A2A2A] text-xs text-white rounded-xl"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-inter">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                    <th className="pb-3">Posição</th>
                    <th className="pb-3 text-center">Nível</th>
                    <th className="pb-3">Segmento</th>
                    <th className="pb-3 text-center">Pessoas no Nível</th>
                    <th className="pb-3 text-center">% Nível</th>
                    <th className="pb-3 text-center">Divisor</th>
                    <th className="pb-3 text-center">Modificador</th>
                    <th className="pb-3 text-right">Peso Cashback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D4AF37]" />
                        Carregando 511 parâmetros da árvore...
                      </td>
                    </tr>
                  ) : filteredTreeParams.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400">
                        Nenhum parâmetro encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredTreeParams.map((p, pIdx) => {
                      const posNum = Number(p.position) || pIdx + 1
                      const lvlNum = Number(p.level) || 1
                      const peopleCount =
                        p.people_count != null
                          ? Number(p.people_count)
                          : Math.pow(2, Math.max(0, lvlNum - 1))
                      const lvlPct = p.level_percentage != null ? Number(p.level_percentage) : 0.24
                      const divisorVal =
                        p.divisor != null
                          ? Number(p.divisor)
                          : Math.pow(2, Math.min(Math.max(0, lvlNum - 1), 10))
                      const modifierVal = p.modifier != null ? Number(p.modifier) : 1.0
                      const cbWeight = p.cashback_weight != null ? Number(p.cashback_weight) : 0.005

                      return (
                        <tr
                          key={p.id || `param-${posNum}`}
                          className="hover:bg-[#141414] transition-colors"
                        >
                          <td className="py-3 font-bold font-mono text-[#D4AF37]">
                            #{posNum}ª
                            {posNum === 511 && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-[9px] border-[#D4AF37]/40 text-[#D4AF37]"
                              >
                                Fim Faixa Individual
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 text-center font-mono">
                            <Badge
                              variant="outline"
                              className="border-[#0057FF]/30 text-[#0057FF] text-[10px]"
                            >
                              Nível {lvlNum}
                            </Badge>
                          </td>
                          <td className="py-3 font-semibold text-white">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                posNum <= 3
                                  ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                                  : posNum <= 7
                                    ? 'bg-[#0057FF]/20 text-[#0057FF]'
                                    : posNum <= 15
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : posNum <= 31
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'bg-gray-800 text-gray-300'
                              }`}
                            >
                              {p.segment || `Posição ${posNum}`}
                            </span>
                          </td>
                          <td className="py-3 text-center font-mono text-gray-300">
                            {peopleCount}
                          </td>
                          <td className="py-3 text-center font-mono text-gray-300">
                            {(lvlPct * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 text-center font-mono text-gray-300">{divisorVal}</td>
                          <td className="py-3 text-center font-mono text-gray-300">
                            {modifierVal.toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-[#22C55E]">
                            {(cbWeight * 100).toFixed(3)}%
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t border-[#2A2A2A]">
              <span className="text-xs text-gray-400 font-inter">
                Página {page} de {totalPages} (Mostrando {treeParams.length} de{' '}
                {totalIndividualCount} posições individuais)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="border-[#2A2A2A] text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="border-[#2A2A2A] text-xs"
                >
                  Próxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* TAB 3: VISÃO GERAL DOS 36 NÍVEIS */}
        {activeTab === 'levels' && (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl space-y-4">
            <div>
              <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0057FF]" /> Progressão Geométrica da Árvore
                Binária (36 Níveis)
              </h3>
              <p className="text-xs text-gray-400 font-inter">
                Estrutura global completa com <strong>{TOTAL_POSITIONS_STR} posições</strong>.
                Níveis 1 a 9 possuem registros individuais dedicados; Níveis 10 a 36 são calculados
                matematicamente.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-inter">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                    <th className="pb-3">Nível</th>
                    <th className="pb-3">Segmento / Descrição</th>
                    <th className="pb-3 text-center">Pessoas no Nível</th>
                    <th className="pb-3 text-center">Faixa de Posições</th>
                    <th className="pb-3 text-center">% Nível</th>
                    <th className="pb-3 text-center">Divisor / Modificador</th>
                    <th className="pb-3 text-right">Armazenamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {levelsOverview.map((lvl) => {
                    const lvlNum = Number(lvl.level) || 1
                    const isDbStored = lvlNum <= 9
                    const peopleStr =
                      typeof lvl.peopleInLevel === 'bigint' || typeof lvl.peopleInLevel === 'number'
                        ? lvl.peopleInLevel.toLocaleString('pt-BR')
                        : String(lvl.peopleInLevel || '0')
                    const startStr =
                      typeof lvl.startPos === 'bigint' || typeof lvl.startPos === 'number'
                        ? lvl.startPos.toLocaleString('pt-BR')
                        : String(lvl.startPos || '1')
                    const endStr =
                      typeof lvl.endPos === 'bigint' || typeof lvl.endPos === 'number'
                        ? lvl.endPos.toLocaleString('pt-BR')
                        : String(lvl.endPos || '1')
                    const pctVal = Number(lvl.levelPercentage) || 0.24
                    const modVal = Number(lvl.modifier) || 1.0

                    return (
                      <tr key={lvl.level} className="hover:bg-[#141414] transition-colors">
                        <td className="py-3 font-bold font-mono text-[#D4AF37]">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              isDbStored
                                ? 'border-[#D4AF37]/40 text-[#D4AF37] bg-[#D4AF37]/10'
                                : 'border-[#0057FF]/40 text-[#0057FF] bg-[#0057FF]/10'
                            }`}
                          >
                            Nível {lvlNum}
                          </Badge>
                        </td>
                        <td className="py-3 font-semibold text-white">
                          {lvl.segment || `Nível ${lvlNum}`}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-gray-200">
                          {peopleStr}
                        </td>
                        <td className="py-3 text-center font-mono text-gray-300">
                          {startStr} ➔ {endStr}
                        </td>
                        <td className="py-3 text-center font-mono text-gray-300">
                          {(pctVal * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 text-center font-mono text-gray-400">
                          Div: {lvl.divisor ?? 1} | Mod: {modVal.toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-mono font-bold">
                          {isDbStored ? (
                            <span className="text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded text-[10px]">
                              Individual (DB)
                            </span>
                          ) : (
                            <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded text-[10px]">
                              Cálculo Motor (68B)
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 4: SIMULADOR INTERATIVO */}
        {activeTab === 'simulador' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl space-y-4">
              <div>
                <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#0057FF]" /> Simulador Instantâneo do Motor
                  Híbrido
                </h3>
                <p className="text-xs text-gray-400 font-inter">
                  Digite qualquer posição de <strong>1 até 68.719.476.735</strong> para verificar o
                  nível binário, coeficiente, modificadores e divisão de cashback calculados pelo
                  motor em tempo real.
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase text-gray-300 font-semibold mb-2">
                  Posição a Simular:
                </label>
                <div className="flex gap-2">
                  <Input
                    value={simulatorPosInput}
                    onChange={(e) => setSimulatorPosInput(e.target.value)}
                    placeholder="Ex: 512, 1000, 1000000..."
                    className="bg-[#141414] border-[#2A2A2A] text-white font-mono text-sm rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSimulatorPosInput('1')}
                  className="px-2.5 py-1 bg-[#141414] hover:bg-[#202020] border border-[#2A2A2A] rounded-lg text-[10px] font-mono text-gray-300"
                >
                  Pos #1 (Diamante)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorPosInput('511')}
                  className="px-2.5 py-1 bg-[#141414] hover:bg-[#202020] border border-[#2A2A2A] rounded-lg text-[10px] font-mono text-[#D4AF37]"
                >
                  Pos #511 (Último DB)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorPosInput('512')}
                  className="px-2.5 py-1 bg-[#141414] hover:bg-[#202020] border border-[#2A2A2A] rounded-lg text-[10px] font-mono text-[#0057FF]"
                >
                  Pos #512 (1º Nível 10)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorPosInput('10000')}
                  className="px-2.5 py-1 bg-[#141414] hover:bg-[#202020] border border-[#2A2A2A] rounded-lg text-[10px] font-mono text-purple-400"
                >
                  Pos #10.000
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorPosInput('68719476735')}
                  className="px-2.5 py-1 bg-[#141414] hover:bg-[#202020] border border-[#2A2A2A] rounded-lg text-[10px] font-mono text-[#22C55E]"
                >
                  Pos #68.719.476.735 (Max)
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs text-gray-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Info className="w-4 h-4 text-[#0057FF]" /> Como funciona a resolução?
                </div>
                <p>
                  Quando uma transação de serviço é concluída, o cashback de 38% é distribuído aos
                  uplines. Se o upline ocupar a posição ≤ 511, os parâmetros vêm da coleção{' '}
                  <code>binary_tree_params</code>. Caso esteja na posição 512 em diante, os valores
                  são calculados dinamicamente pelas fórmulas geométricas padrão do nível
                  correspondente.
                </p>
              </div>
            </Card>

            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" /> Resultado da Simulação
                  </h4>
                  <Badge
                    variant="outline"
                    className={`${
                      simulatedParams.isIndividual
                        ? 'border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10'
                        : 'border-purple-500/40 text-purple-400 bg-purple-500/10'
                    }`}
                  >
                    {simulatedParams.isIndividual
                      ? 'Regime Individual (DB)'
                      : 'Regime Nível Matemático'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A] flex justify-between items-center">
                    <span className="text-xs text-gray-400">Posição Solicitada:</span>
                    <span className="font-mono font-black text-white text-base">
                      #
                      {typeof simulatedParams?.position === 'bigint' ||
                      typeof simulatedParams?.position === 'number'
                        ? simulatedParams.position.toLocaleString('pt-BR')
                        : String(simulatedParams?.position || '1')}
                      ª
                    </span>
                  </div>

                  <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A] flex justify-between items-center">
                    <span className="text-xs text-gray-400">Nível na Árvore Binária:</span>
                    <span className="font-mono font-bold text-[#0057FF] text-sm">
                      Nível {Number(simulatedParams?.level) || 1} de 36
                    </span>
                  </div>

                  <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A] flex justify-between items-center">
                    <span className="text-xs text-gray-400">Segmento Atribuído:</span>
                    <span className="font-mono font-bold text-[#D4AF37] text-sm">
                      {simulatedParams?.segment || 'Nível'}
                    </span>
                  </div>

                  <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A] flex justify-between items-center">
                    <span className="text-xs text-gray-400">Pessoas Habitantes no Nível:</span>
                    <span className="font-mono font-bold text-gray-200 text-sm">
                      {typeof simulatedParams?.peopleInLevel === 'bigint' ||
                      typeof simulatedParams?.peopleInLevel === 'number'
                        ? simulatedParams.peopleInLevel.toLocaleString('pt-BR')
                        : String(simulatedParams?.peopleInLevel || '1')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                      <span className="text-[10px] uppercase text-gray-400 block">
                        % Nível Variável:
                      </span>
                      <span className="font-mono font-bold text-white text-sm">
                        {((Number(simulatedParams?.levelPercentage) || 0.24) * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                      <span className="text-[10px] uppercase text-gray-400 block">
                        Modificador:
                      </span>
                      <span className="font-mono font-bold text-white text-sm">
                        {(Number(simulatedParams?.modifier) || 1.0).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                      <span className="text-[10px] uppercase text-gray-400 block">
                        Divisor do Nível:
                      </span>
                      <span className="font-mono font-bold text-white text-sm">
                        {simulatedParams?.divisor ?? 1}
                      </span>
                    </div>

                    <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                      <span className="text-[10px] uppercase text-gray-400 block">
                        Peso Cashback:
                      </span>
                      <span className="font-mono font-bold text-[#22C55E] text-sm">
                        {((Number(simulatedParams?.cashbackWeight) || 0.0001) * 100).toFixed(3)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: REGRAS ESG E GATILHOS */}
        {activeTab === 'esg' && (
          <div className="space-y-6">
            {/* Metas ESG por Nível */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
              <h3 className="text-base font-bold font-montserrat text-white uppercase mb-2 flex items-center gap-2">
                <Leaf className="w-5 h-5 text-[#22C55E]" /> Metas ESG por Nível Confirmadas
              </h3>
              <p className="text-xs text-gray-400 font-inter mb-6">
                Distribuição obrigatória do cashback:{' '}
                <strong>
                  Bônus 55% + Meta Econômica 15% + Meta Social 15% + Meta Ecológica 15%
                </strong>{' '}
                (Total: 100%).
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/30">
                  <span className="text-[10px] font-bold text-[#D4AF37] uppercase block mb-1">
                    Bônus Mérito
                  </span>
                  <div className="text-2xl font-black font-montserrat text-white">{esgBonus}%</div>
                  <span className="text-[10px] text-gray-400 font-inter mt-1 block">
                    Recompensa direta de engajamento
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-[#0057FF]/30">
                  <span className="text-[10px] font-bold text-[#0057FF] uppercase block mb-1">
                    Meta Econômica
                  </span>
                  <div className="text-2xl font-black font-montserrat text-white">{esgEcon}%</div>
                  <span className="text-[10px] text-gray-400 font-inter mt-1 block">
                    Autonomia financeira e carreira
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-blue-400/30">
                  <span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">
                    Meta Social
                  </span>
                  <div className="text-2xl font-black font-montserrat text-white">{esgSoc}%</div>
                  <span className="text-[10px] text-gray-400 font-inter mt-1 block">
                    Inclusão esportiva na comunidade
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-[#22C55E]/30">
                  <span className="text-[10px] font-bold text-[#22C55E] uppercase block mb-1">
                    Meta Ecológica
                  </span>
                  <div className="text-2xl font-black font-montserrat text-white">{esgEco}%</div>
                  <span className="text-[10px] text-gray-400 font-inter mt-1 block">
                    Preservação e impacto verde
                  </span>
                </div>
              </div>
            </Card>

            {/* Gatilhos ESG Mensais */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
              <h3 className="text-base font-bold font-montserrat text-white uppercase mb-2 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" /> Gatilhos ESG (Ciclo Mensal Acumulado)
              </h3>
              <p className="text-xs text-gray-400 font-inter mb-4">
                Penalidades e bonificações aplicadas automaticamente sobre o cashback mensal
                acumulado:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-inter">
                  <thead>
                    <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                      <th className="pb-3">Cashback Mensal Acumulado</th>
                      <th className="pb-3 text-center">Exigência ESG</th>
                      <th className="pb-3 text-center">Se bater todas</th>
                      <th className="pb-3">Regra se não bater</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    <tr className="hover:bg-[#141414]">
                      <td className="py-3 font-mono font-bold text-white">R$ 10.000,00</td>
                      <td className="py-3 text-center">
                        <Badge variant="outline" className="border-amber-400/40 text-amber-400">
                          1 Meta ESG Exigida
                        </Badge>
                      </td>
                      <td className="py-3 text-center font-bold text-[#22C55E]">
                        100% do cashback
                      </td>
                      <td className="py-3 text-red-400 font-medium">Recebe 85% do cashback</td>
                    </tr>
                    <tr className="hover:bg-[#141414]">
                      <td className="py-3 font-mono font-bold text-white">R$ 15.000,00</td>
                      <td className="py-3 text-center">
                        <Badge variant="outline" className="border-amber-400/40 text-amber-400">
                          2 Metas ESG Exigidas
                        </Badge>
                      </td>
                      <td className="py-3 text-center font-bold text-[#22C55E]">
                        100% do cashback
                      </td>
                      <td className="py-3 text-amber-300 font-medium">
                        Recebe 55% + 15% por meta batida
                      </td>
                    </tr>
                    <tr className="hover:bg-[#141414]">
                      <td className="py-3 font-mono font-bold text-white">R$ 20.000,00</td>
                      <td className="py-3 text-center">
                        <Badge variant="outline" className="border-amber-400/40 text-amber-400">
                          3 Metas ESG Exigidas
                        </Badge>
                      </td>
                      <td className="py-3 text-center font-bold text-[#22C55E]">
                        100% do cashback
                      </td>
                      <td className="py-3 text-amber-300 font-medium">
                        Recebe 55% + 15% por meta batida
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 6: CONFIGURAÇÃO DE SPLIT E TARIFAS */}
        {activeTab === 'split' && (
          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* REVENUE SPLIT GLOBAL */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold font-montserrat text-white uppercase flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#D4AF37]" /> Distribuição Global de Receita
                  (%)
                </h2>
                <span
                  className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                    totalSplitSum === 100
                      ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}
                >
                  Soma: {totalSplitSum}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#D4AF37] font-semibold mb-1">
                    Parceiro (38%)
                  </label>
                  <Input
                    value={partnerPoolPct}
                    onChange={(e) => setPartnerPoolPct(e.target.value)}
                    className="bg-[#141414] border-[#D4AF37]/40 rounded-xl text-xs text-[#D4AF37] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    APP (30%)
                  </label>
                  <Input
                    value={appPct}
                    onChange={(e) => setAppPct(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Filantropia (10%)
                  </label>
                  <Input
                    value={philanthropyPct}
                    onChange={(e) => setPhilanthropyPct(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#22C55E] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Imposto (10%)
                  </label>
                  <Input
                    value={taxPct}
                    onChange={(e) => setTaxPct(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-red-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Suporte (4%)
                  </label>
                  <Input
                    value={supportPct}
                    onChange={(e) => setSupportPct(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-blue-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Mkt/Carreira (4%)
                  </label>
                  <Input
                    value={mktPct}
                    onChange={(e) => setMktPct(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-purple-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Investidor (4%)
                  </label>
                  <Input
                    value={investorPct}
                    onChange={(e) => setInvestorPct(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-amber-400 font-bold"
                  />
                </div>
              </div>
            </Card>

            {/* TARIFAS POR SERVIÇO & METAS ESG */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tarifas de Serviço Reais em R$ */}
              <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-[#D4AF37]" /> Tarifas Reais por Serviço
                    Concluído (R$)
                  </h3>
                  <p className="text-xs text-gray-400 font-inter mb-4">
                    Valores em Reais aplicados na fórmula de pontos do ranking (tarifa_R$).
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                        Plano Básico (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">
                          R$
                        </span>
                        <Input
                          value={tarifaBasico}
                          onChange={(e) => setTarifaBasico(e.target.value)}
                          className="pl-9 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                        Plano Pro (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">
                          R$
                        </span>
                        <Input
                          value={tarifaPro}
                          onChange={(e) => setTarifaPro(e.target.value)}
                          className="pl-9 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#0057FF] font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-[#D4AF37] font-semibold mb-1">
                        Plano Premium (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#D4AF37] font-mono">
                          R$
                        </span>
                        <Input
                          value={tarifaPremium}
                          onChange={(e) => setTarifaPremium(e.target.value)}
                          className="pl-9 bg-[#141414] border-[#D4AF37]/50 rounded-xl text-xs text-[#D4AF37] font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Regra de Indicação & Metas ESG Percentuais */}
              <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-[#0057FF]" /> Regra de Validação de Indicação
                  </h3>
                  <p className="text-xs text-gray-400 font-inter mb-3">
                    Número mínimo de serviços concluídos pelo aluno indicado para validar a
                    indicação e creditar o cashback de referral ao profissional indicador.
                  </p>
                  <div>
                    <label className="block text-[10px] uppercase text-[#0057FF] font-semibold mb-1">
                      Mínimo de Serviços para Validar Indicação (Padrão: 5)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={minServicesReferral}
                      onChange={(e) => setMinServicesReferral(e.target.value)}
                      className="bg-[#141414] border-[#0057FF]/40 rounded-xl text-xs text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#2A2A2A]">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-bold font-montserrat text-white uppercase">
                        Metas ESG do Cashback (%)
                      </h3>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          totalEsgSum === 100
                            ? 'bg-[#22C55E]/10 text-[#22C55E]'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        Soma: {totalEsgSum}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-inter mb-4">
                      Bônus 55% + Meta Econômica 15% + Meta Social 15% + Meta Ecológica 15%.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase text-[#FF7A00] font-semibold mb-1">
                          Bônus Mérito (%)
                        </label>
                        <Input
                          value={esgBonus}
                          onChange={(e) => setEsgBonus(e.target.value)}
                          className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#FF7A00] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-[#D4AF37] font-semibold mb-1">
                          Econômica (%)
                        </label>
                        <Input
                          value={esgEcon}
                          onChange={(e) => setEsgEcon(e.target.value)}
                          className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#D4AF37] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-[#0057FF] font-semibold mb-1">
                          Social (%)
                        </label>
                        <Input
                          value={esgSoc}
                          onChange={(e) => setEsgSoc(e.target.value)}
                          className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#0057FF] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-[#22C55E] font-semibold mb-1">
                          Ecológica (%)
                        </label>
                        <Input
                          value={esgEco}
                          onChange={(e) => setEsgEco(e.target.value)}
                          className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#22C55E] font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-sm uppercase py-6 rounded-xl shadow-xl flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" /> Salvar Configurações de Parâmetros
            </Button>
          </form>
        )}

        {/* TAB 7: EQUALIZADOR CAMINHO C */}
        {activeTab === 'caminhoC' && (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#22C55E]" /> Equalizador do Caminho C (Pool 38%
                  + Corretor de Nível)
                </h3>
                <p className="text-xs text-gray-400 font-inter mt-1">
                  Fórmula oficial: <code>Corretor Nível 1 = 0,8 / (próx_nível / 2) + 0,2</code>. A
                  cada nível habitado soma-se o passo até atingir 1,8 no último nível.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#141414] border border-[#2A2A2A]">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Entrada Total de Tarifas (R$)
                </label>
                <Input
                  type="number"
                  value={caminhoCEntrada}
                  onChange={(e) => setCaminhoCEntrada(Number(e.target.value) || 0)}
                  className="bg-[#181818] border-[#2A2A2A] text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Níveis Habitados na Rede (1 a 36)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="36"
                  value={caminhoCNiveis}
                  onChange={(e) =>
                    setCaminhoCNiveis(Math.max(1, Math.min(36, Number(e.target.value) || 1)))
                  }
                  className="bg-[#181818] border-[#2A2A2A] text-white font-mono"
                />
              </div>
            </div>

            {/* Resultado da Equalização */}
            {(() => {
              try {
                const res = calculateCaminhoCEqualization(
                  Math.max(0, Number(caminhoCEntrada) || 0),
                  Math.max(1, Math.min(36, Number(caminhoCNiveis) || 9)),
                )
                const levelsList = Array.isArray(res?.levels) ? res.levels : []
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          Pool da Rede (38%)
                        </span>
                        <p className="text-lg font-bold text-[#D4AF37] font-mono">
                          R$ {(Number(res.pool) || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          % por Nível
                        </span>
                        <p className="text-lg font-bold text-[#0057FF] font-mono">
                          {(Number(res.pctDoNivel) || 0).toFixed(3)}%
                        </p>
                      </div>
                      <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          Valor Base por Nível
                        </span>
                        <p className="text-lg font-bold text-white font-mono">
                          R$ {(Number(res.valorDoNivel) || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A]">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          Soma Equalizada
                        </span>
                        <p className="text-lg font-bold text-[#22C55E] font-mono">
                          R$ {(Number(res.somaEqualizados) || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-inter">
                        <thead>
                          <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                            <th className="pb-3">Nível</th>
                            <th className="pb-3 text-center">Pessoas no Nível</th>
                            <th className="pb-3 text-center">Corretor (Equalizador)</th>
                            <th className="pb-3 text-center">Limitador Acumulado</th>
                            <th className="pb-3 text-center">Valor Equalizado</th>
                            <th className="pb-3 text-right">Valor Aprox. / Pessoa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2A2A2A]">
                          {levelsList.map((lvl) => (
                            <tr key={lvl.level} className="hover:bg-[#141414] transition-colors">
                              <td className="py-2.5 font-bold text-white font-montserrat">
                                Nível {lvl.level}
                              </td>
                              <td className="py-2.5 text-center font-mono text-gray-300">
                                {lvl.pessoasNoNivel}{' '}
                                {lvl.pessoasNoNivel === 1 ? 'pessoa' : 'pessoas'}
                              </td>
                              <td className="py-2.5 text-center font-mono font-bold text-[#0057FF]">
                                {(Number(lvl.corretor) || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 text-center font-mono text-gray-400">
                                {(Number(lvl.limitadorNivel) || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 text-center font-mono font-bold text-[#D4AF37]">
                                R$ {(Number(lvl.valorEqualizado) || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold text-[#22C55E]">
                                R$ {(Number(lvl.valorPorPessoa) || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              } catch (err) {
                console.warn('Erro ao renderizar equalizador:', err)
                return (
                  <div className="p-4 bg-[#141414] rounded-xl border border-red-500/20 text-xs text-gray-400">
                    Não foi possível calcular a simulação com os valores atuais.
                  </div>
                )
              }
            })()}
          </Card>
        )}

        {/* TAB 8: PLANILHA DE DISTRIBUIÇÃO DE CASHBACK (v0.065) */}
        {activeTab === 'planilhaCashback' && (
          <PlanilhaCashbackDistribuicao
            realRankings={rankings}
            defaultBaseTarifas={1000000}
            defaultPositionsCount={1023}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

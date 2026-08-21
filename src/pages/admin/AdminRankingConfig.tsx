import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import type { BinaryTreeParamRecord } from '@/services/api'

interface RankItem {
  id: string
  user: string
  points: number
  ranking_position: number
  services_count: number
  referrals_count: number
  stars: number
  tie_break_details?: {
    position?: number
    level?: number
    segment?: string
    cashback_weight?: number
    stars?: number
    tarifa_rs?: number
    cycle?: string
    formula?: string
  }
  expand?: {
    user?: {
      name: string
      plan: string
      email: string
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
  const [activeTab, setActiveTab] = useState<'ranking' | 'tree' | 'esg' | 'split'>('ranking')
  const [searchPos, setSearchPos] = useState('')

  const PAGE_SIZE = 20

  useEffect(() => {
    loadData()
  }, [page])

  const loadData = async () => {
    try {
      setLoading(true)
      // Carregar configurações da plataforma
      const configs = await pb.collection('platform_config').getFullList()
      configs.forEach((c) => {
        if (c.key === 'plan_tarifas' && c.value) {
          if (c.value.basico !== undefined) setTarifaBasico(Number(c.value.basico).toFixed(2))
          if (c.value.pro !== undefined) setTarifaPro(Number(c.value.pro).toFixed(2))
          if (c.value.premium !== undefined) setTarifaPremium(Number(c.value.premium).toFixed(2))
        } else if (c.key === 'revenue_split' && c.value) {
          if (c.value.partner_pool_pct !== undefined)
            setPartnerPoolPct((Number(c.value.partner_pool_pct) * 100).toString())
          if (c.value.app_pct !== undefined) setAppPct((Number(c.value.app_pct) * 100).toString())
          if (c.value.filantropia_pct !== undefined)
            setPhilanthropyPct((Number(c.value.filantropia_pct) * 100).toString())
          if (c.value.imposto_pct !== undefined)
            setTaxPct((Number(c.value.imposto_pct) * 100).toString())
          if (c.value.suporte_tecnico_pct !== undefined)
            setSupportPct((Number(c.value.suporte_tecnico_pct) * 100).toString())
          if (c.value.marketing_carreira_pct !== undefined)
            setMktPct((Number(c.value.marketing_carreira_pct) * 100).toString())
          if (c.value.parceiro_investidor_pct !== undefined)
            setInvestorPct((Number(c.value.parceiro_investidor_pct) * 100).toString())
        } else if (c.key === 'esg_metas' && c.value) {
          if (c.value.bonus !== undefined) setEsgBonus((Number(c.value.bonus) * 100).toString())
          if (c.value.economica !== undefined)
            setEsgEcon((Number(c.value.economica) * 100).toString())
          if (c.value.social !== undefined) setEsgSoc((Number(c.value.social) * 100).toString())
          if (c.value.ecologica !== undefined)
            setEsgEco((Number(c.value.ecologica) * 100).toString())
        }
      })

      // Carregar ranking atual
      const rankList = await pb.collection('rank_entries').getList<RankItem>(1, 50, {
        sort: 'ranking_position',
        expand: 'user',
      })
      setRankings(rankList.items)

      // Carregar 265 parâmetros da Árvore Binária paginados
      const paramsList = await pb
        .collection('binary_tree_params')
        .getList<BinaryTreeParamRecord>(page, PAGE_SIZE, {
          sort: 'position',
        })
      setTreeParams(paramsList.items)
      setTotalPages(paramsList.totalPages || Math.ceil(265 / PAGE_SIZE))
    } catch {
      // Defaults mantidos
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

      toast.success('Parâmetros de tarifas, divisão de receita e ESG atualizados com sucesso!')
    } catch {
      toast.error('Erro ao salvar parâmetros na nuvem.')
    }
  }

  const handleRecalculateRanking = async () => {
    setRecalculating(true)
    try {
      const response = await fetch('/api/custom/admin/recalculate-ranking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
      })

      if (response.ok) {
        toast.success(
          'Ranking recalculado com sucesso utilizando a coleção binary_tree_params e pontuação em R$!',
        )
      } else {
        await clientSideRecalculate()
      }
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
      const tarifaB = parseFloat(tarifaBasico) || 1.0
      const tarifaP = parseFloat(tarifaPro) || 2.0
      const tarifaPrem = parseFloat(tarifaPremium) || 3.0
      const tarifasMap: Record<string, number> = {
        gratis: tarifaB,
        basico: tarifaB,
        pro: tarifaP,
        premium: tarifaPrem,
      }

      const users = await pb.collection('users').getFullList({
        filter: 'role = "profissional" && approved = true',
      })

      const allParams = await pb
        .collection('binary_tree_params')
        .getFullList<BinaryTreeParamRecord>({
          sort: 'position',
        })
      const paramMap: Record<number, BinaryTreeParamRecord> = {}
      allParams.forEach((p) => {
        paramMap[p.position] = p
      })

      const currentCycle = new Date().toISOString().slice(0, 7)
      const scored: Array<{
        user_id: string
        points: number
        services_count: number
        referrals_count: number
        stars: number
        tarifa_rs: number
      }> = []

      for (const u of users) {
        const plan = (u.plan as string) || 'basico'
        const stars = Number(u.rating_avg) || 5.0
        const tarifaRS = tarifasMap[plan] || 1.0

        let referralsCount = 0
        try {
          const refs = await pb.collection('referrals').getFullList({
            filter: `referrer = "${u.id}"`,
          })
          referralsCount = refs.length
        } catch {
          referralsCount = 0
        }

        let servicesCount = 0
        try {
          const svcs = await pb.collection('services').getFullList({
            filter: `professional = "${u.id}" && status = "concluido"`,
          })
          servicesCount = svcs.length
        } catch {
          servicesCount = 0
        }

        const variavel = referralsCount / 18 + 1
        const points = Math.round(tarifaRS * Math.max(1, servicesCount) * variavel)

        scored.push({
          user_id: u.id,
          points,
          services_count: servicesCount,
          referrals_count: referralsCount,
          stars,
          tarifa_rs: tarifaRS,
        })
      }

      scored.sort((a, b) => b.points - a.points || b.stars - a.stars)

      for (let i = 0; i < scored.length; i++) {
        const item = scored[i]
        const pos = i + 1
        const pRecord = paramMap[pos]

        try {
          const existing = await pb
            .collection('rank_entries')
            .getFirstListItem(`user = "${item.user_id}"`)
          await pb.collection('rank_entries').update(existing.id, {
            cycle: currentCycle,
            points: item.points,
            services_count: item.services_count,
            referrals_count: item.referrals_count,
            stars: item.stars,
            ranking_position: pos,
            tie_break_details: {
              position: pos,
              level: pRecord?.level || Math.floor(Math.log2(pos || 1)) + 1,
              segment: pRecord?.segment || 'Rede',
              cashback_weight: pRecord?.cashback_weight,
              stars: item.stars,
              tarifa_rs: item.tarifa_rs,
              cycle: currentCycle,
              formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
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
            stars: item.stars,
            ranking_position: pos,
            tie_break_details: {
              position: pos,
              level: pRecord?.level || Math.floor(Math.log2(pos || 1)) + 1,
              segment: pRecord?.segment || 'Rede',
              cashback_weight: pRecord?.cashback_weight,
              stars: item.stars,
              tarifa_rs: item.tarifa_rs,
              cycle: currentCycle,
              formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
              recomputed_at: new Date().toISOString(),
            },
          })
        }
      }
      toast.success('Ranking recalculado e sincronizado com os 265 parâmetros!')
    } catch {
      toast.error('Erro ao recalcular ranking localmente')
    }
  }

  const filteredTreeParams = searchPos
    ? treeParams.filter(
        (p) =>
          p.position.toString().includes(searchPos) ||
          p.level.toString().includes(searchPos) ||
          p.segment?.toLowerCase().includes(searchPos.toLowerCase()),
      )
    : treeParams

  const totalSplitSum =
    Number(partnerPoolPct) +
    Number(appPct) +
    Number(philanthropyPct) +
    Number(taxPct) +
    Number(supportPct) +
    Number(mktPct) +
    Number(investorPct)

  const totalEsgSum = Number(esgBonus) + Number(esgEcon) + Number(esgSoc) + Number(esgEco)

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <Trophy className="w-3.5 h-3.5" />
            Árvore Binária Completa & Motor ESG 369
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Configuração de Ranking & Cashback Binário
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            265 posições sequenciais, 36 níveis, Pool de Parceiros 38%, Gatilhos ESG mensais e
            ranking cumulativo por pontos.
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

      {/* KPI METRIC CARDS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
            <span>Pool Parceiros</span>
            <PieChart className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl font-black font-montserrat text-[#D4AF37] mt-1">
            {partnerPoolPct}%
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            Distribuído por níveis habitados
          </span>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
            <span>Árvore Binária</span>
            <GitFork className="w-4 h-4 text-[#0057FF]" />
          </div>
          <div className="text-2xl font-black font-montserrat text-white mt-1">
            265 <span className="text-sm text-gray-400 font-normal">posições / 36 níveis</span>
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            Nível 1=1, N2=2, N3=4, N4=8...
          </span>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
            <span>Metas ESG Base</span>
            <Leaf className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="text-2xl font-black font-montserrat text-[#22C55E] mt-1">
            55% <span className="text-sm text-gray-400 font-normal">+ 15% + 15% + 15%</span>
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            Bônus + Econômica + Social + Ecológica
          </span>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-gray-400 font-montserrat uppercase">
            <span>Gatilhos ESG</span>
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-montserrat text-amber-400 mt-1">
            10k / 15k / 20k
          </div>
          <span className="text-[10px] text-gray-500 font-inter">Gatilhos mensais acumulados</span>
        </Card>
      </div>

      {/* NOVA FÓRMULA HIGHLIGHT CARD */}
      <Card className="bg-gradient-to-r from-[#181818] via-[#1c1a14] to-[#181818] border-2 border-[#D4AF37] p-6 rounded-2xl shadow-[0_0_25px_rgba(212,175,55,0.15)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold font-montserrat text-[#D4AF37] uppercase">
              <Calculator className="w-4 h-4" /> Fórmula de Pontuação Oficial do Ranking
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              pontos = <span className="text-[#D4AF37]">tarifa_R$</span> ×{' '}
              <span className="text-[#0057FF]">serviços</span> × (
              <span className="text-[#22C55E]">indicações / 18</span> + 1)
            </div>
            <p className="text-xs text-gray-300 font-inter">
              Ranking <strong>exclusivamente por pontos</strong> (cumulativos mês a mês). O cashback
              do parceiro é definido pela sua <strong>posição no ranking</strong> (quanto melhor a
              posição, maior o percentual).
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
              <span className="text-sm font-bold text-[#D4AF37] font-mono">R$ {tarifaPremium}</span>
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
          <Trophy className="w-4 h-4" /> Leaderboard Oficial
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
          <GitFork className="w-4 h-4" /> Árvore Binária (265 Posições & 36 Níveis)
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
          <Leaf className="w-4 h-4" /> Regras ESG & Gatilhos (10k/15k/20k)
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
          <DollarSign className="w-4 h-4" /> Distribuição Global (Split 38% Pool)
        </button>
      </div>

      {/* TAB 1: RANKING LEADERBOARD */}
      {activeTab === 'ranking' && (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#D4AF37]" /> Classificação Geral por Pontos
              </h3>
              <p className="text-xs text-gray-400 font-inter">
                Pontuação cumulativa mês a mês:{' '}
                <code>tarifa_R$ × serviços × (indicações/18 + 1)</code>
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 rounded-full border border-[#D4AF37]/30 self-start sm:self-auto">
              Ciclo {new Date().toISOString().slice(0, 7)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-inter">
              <thead>
                <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                  <th className="pb-3">Posição</th>
                  <th className="pb-3">Profissional</th>
                  <th className="pb-3">Plano</th>
                  <th className="pb-3 text-center">Nível Binário</th>
                  <th className="pb-3 text-center">Tarifa (R$)</th>
                  <th className="pb-3 text-center">Serviços</th>
                  <th className="pb-3 text-center">Indicações</th>
                  <th className="pb-3 text-right">Pontuação Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D4AF37]" />
                      Carregando dados do ranking...
                    </td>
                  </tr>
                ) : rankings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-400">
                      Nenhum profissional pontuado ainda. Clique em &ldquo;Recalcular Ranking
                      Agora&rdquo;.
                    </td>
                  </tr>
                ) : (
                  rankings.map((r, index) => {
                    const plan = r.expand?.user?.plan || 'basico'
                    const tarifaDisplay =
                      plan === 'premium' ? 'R$ 3,00' : plan === 'pro' ? 'R$ 2,00' : 'R$ 1,00'
                    const pos = r.ranking_position || index + 1
                    const lvl =
                      r.tie_break_details?.level ||
                      Math.min(36, Math.floor(Math.log2(pos || 1)) + 1)
                    return (
                      <tr key={r.id || index} className="hover:bg-[#141414] transition-colors">
                        <td className="py-3 font-bold font-mono text-[#D4AF37]">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              pos === 1
                                ? 'bg-[#D4AF37] text-black font-extrabold'
                                : pos === 2
                                  ? 'bg-gray-300 text-black'
                                  : pos === 3
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-[#2A2A2A] text-gray-300'
                            }`}
                          >
                            #{pos}
                          </span>
                        </td>
                        <td className="py-3 font-semibold text-white">
                          <div>
                            <span className="block">
                              {r.expand?.user?.name || `Profissional (${r.user?.slice(0, 8)})`}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {r.expand?.user?.email}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              plan === 'premium'
                                ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                                : plan === 'pro'
                                  ? 'bg-[#0057FF]/10 text-[#0057FF]'
                                  : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            {plan}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <Badge
                            variant="outline"
                            className="border-[#0057FF]/40 text-[#0057FF] text-[10px]"
                          >
                            Nível {lvl}
                          </Badge>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-gray-300">
                          {tarifaDisplay}
                        </td>
                        <td className="py-3 text-center font-mono text-gray-300">
                          {r.services_count || 0}
                        </td>
                        <td className="py-3 text-center font-mono text-gray-300">
                          {r.referrals_count || 0}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-[#D4AF37] text-sm">
                          {r.points.toLocaleString('pt-BR')} pts
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

      {/* TAB 2: 265 PARÂMETROS DA ÁRVORE BINÁRIA */}
      {activeTab === 'tree' && (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                <GitFork className="w-5 h-5 text-[#D4AF37]" /> Parâmetros da Árvore Binária (265
                Posições / 36 Níveis)
              </h3>
              <p className="text-xs text-gray-400 font-inter">
                Coleção <code>binary_tree_params</code> com progressão geométrica por nível (Nível
                1=1 pessoa, Nível 2=2, Nível 3=4, Nível 4=8...)
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Input
                value={searchPos}
                onChange={(e) => setSearchPos(e.target.value)}
                placeholder="Filtrar por posição ou segmento..."
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
                      Carregando 265 parâmetros da árvore...
                    </td>
                  </tr>
                ) : filteredTreeParams.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-400">
                      Nenhum parâmetro encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredTreeParams.map((p) => (
                    <tr key={p.id} className="hover:bg-[#141414] transition-colors">
                      <td className="py-3 font-bold font-mono text-[#D4AF37]">#{p.position}ª</td>
                      <td className="py-3 text-center font-mono">
                        <Badge
                          variant="outline"
                          className="border-[#0057FF]/30 text-[#0057FF] text-[10px]"
                        >
                          Nível {p.level}
                        </Badge>
                      </td>
                      <td className="py-3 font-semibold text-white">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.position <= 3
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                              : p.position <= 7
                                ? 'bg-[#0057FF]/20 text-[#0057FF]'
                                : p.position <= 15
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          {p.segment || `Posição ${p.position}`}
                        </span>
                      </td>
                      <td className="py-3 text-center font-mono text-gray-300">
                        {p.people_count || Math.pow(2, p.level - 1)}
                      </td>
                      <td className="py-3 text-center font-mono text-gray-300">
                        {((p.level_percentage || 0.24) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 text-center font-mono text-gray-300">
                        {p.divisor || Math.pow(2, Math.min(p.level - 1, 10))}
                      </td>
                      <td className="py-3 text-center font-mono text-gray-300">
                        {p.modifier ? p.modifier.toFixed(2) : '1.00'}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-[#22C55E]">
                        {(p.cashback_weight ? p.cashback_weight * 100 : 0.5).toFixed(3)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-[#2A2A2A]">
            <span className="text-xs text-gray-400 font-inter">
              Página {page} de {totalPages} (Mostrando {treeParams.length} de 265 posições)
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

      {/* TAB 3: REGRAS ESG E GATILHOS */}
      {activeTab === 'esg' && (
        <div className="space-y-6">
          {/* Metas ESG por Nível */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
            <h3 className="text-base font-bold font-montserrat text-white uppercase mb-2 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-[#22C55E]" /> Metas ESG por Nível Confirmadas
            </h3>
            <p className="text-xs text-gray-400 font-inter mb-6">
              Distribuição obrigatória do cashback:{' '}
              <strong>Bônus 55% + Meta Econômica 15% + Meta Social 15% + Meta Ecológica 15%</strong>{' '}
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
              Penalidades e bonificações aplicadas automaticamente sobre o cashback mensal:
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
                        1 Meta ESG
                      </Badge>
                    </td>
                    <td className="py-3 text-center font-bold text-[#22C55E]">100% do cashback</td>
                    <td className="py-3 text-red-400 font-medium">Recebe 85% do cashback</td>
                  </tr>
                  <tr className="hover:bg-[#141414]">
                    <td className="py-3 font-mono font-bold text-white">R$ 15.000,00</td>
                    <td className="py-3 text-center">
                      <Badge variant="outline" className="border-amber-400/40 text-amber-400">
                        2 Metas ESG
                      </Badge>
                    </td>
                    <td className="py-3 text-center font-bold text-[#22C55E]">100% do cashback</td>
                    <td className="py-3 text-amber-300 font-medium">
                      Recebe 55% + 15% por meta batida
                    </td>
                  </tr>
                  <tr className="hover:bg-[#141414]">
                    <td className="py-3 font-mono font-bold text-white">R$ 20.000,00</td>
                    <td className="py-3 text-center">
                      <Badge variant="outline" className="border-amber-400/40 text-amber-400">
                        3 Metas ESG
                      </Badge>
                    </td>
                    <td className="py-3 text-center font-bold text-[#22C55E]">100% do cashback</td>
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

      {/* TAB 4: CONFIGURAÇÃO DE SPLIT E TARIFAS */}
      {activeTab === 'split' && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* REVENUE SPLIT GLOBAL */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold font-montserrat text-white uppercase flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#D4AF37]" /> Distribuição Global de Receita (%)
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

            {/* Metas ESG Percentuais */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
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
    </div>
  )
}

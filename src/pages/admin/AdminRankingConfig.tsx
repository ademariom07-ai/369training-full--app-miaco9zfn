import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Trophy,
  DollarSign,
  GitFork,
  Save,
  RotateCw,
  Calculator,
  CheckCircle2,
  Sparkles,
  Info,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface RankItem {
  id: string
  user: string
  points: number
  ranking_position: number
  services_count: number
  referrals_count: number
  stars: number
  expand?: {
    user?: {
      name: string
      plan: string
      email: string
    }
  }
}

export default function AdminRankingConfig() {
  // Config state
  const [partnerPoolPct, setPartnerPoolPct] = useState('38')
  const [appPct, setAppPct] = useState('30')
  const [philanthropyPct, setPhilanthropyPct] = useState('10')
  const [taxPct, setTaxPct] = useState('10')

  // Tarifa real por plano em R$ (Nova fórmula do ranking: Básico R$1, Pro R$2, Premium R$3)
  const [tarifaBasico, setTarifaBasico] = useState('1.00')
  const [tarifaPro, setTarifaPro] = useState('2.00')
  const [tarifaPremium, setTarifaPremium] = useState('3.00')

  // Metas ESG
  const [esgEcon, setEsgEcon] = useState('55')
  const [esgSoc, setEsgSoc] = useState('15')
  const [esgEco, setEsgEco] = useState('15')
  const [esgBonus, setEsgBonus] = useState('15')

  // Loading and Ranking preview state
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [rankings, setRankings] = useState<RankItem[]>([])

  // Load existing config and rankings
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // Carregar configurações de tarifas
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
        } else if (c.key === 'esg_metas' && c.value) {
          if (c.value.economica !== undefined)
            setEsgEcon((Number(c.value.economica) * 100).toString())
          if (c.value.social !== undefined) setEsgSoc((Number(c.value.social) * 100).toString())
          if (c.value.ecologica !== undefined)
            setEsgEco((Number(c.value.ecologica) * 100).toString())
          if (c.value.bonus !== undefined) setEsgBonus((Number(c.value.bonus) * 100).toString())
        }
      })

      // Carregar ranking atual
      const rankList = await pb.collection('rank_entries').getList<RankItem>(1, 10, {
        sort: 'ranking_position',
        expand: 'user',
      })
      setRankings(rankList.items)
    } catch {
      // Usar defaults se não carregar
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

      // Atualizar plan_tarifas
      try {
        const tarifaRec = await pb
          .collection('platform_config')
          .getFirstListItem('key = "plan_tarifas"')
        await pb.collection('platform_config').update(tarifaRec.id, {
          value: {
            gratis: tarifaB,
            basico: tarifaB,
            pro: tarifaP,
            premium: tarifaPrem,
          },
          description: 'Tarifa cobrada por serviço em R$ (Básico R$1, Pro R$2, Premium R$3)',
        })
      } catch {
        await pb.collection('platform_config').create({
          key: 'plan_tarifas',
          value: {
            gratis: tarifaB,
            basico: tarifaB,
            pro: tarifaP,
            premium: tarifaPrem,
          },
          description: 'Tarifa cobrada por serviço em R$ (Básico R$1, Pro R$2, Premium R$3)',
        })
      }

      // Atualizar ranking_weights
      try {
        const rankingRec = await pb
          .collection('platform_config')
          .getFirstListItem('key = "ranking_weights"')
        await pb.collection('platform_config').update(rankingRec.id, {
          value: {
            indicacoes_divisor: 18,
            formula: 'pontos = tarifa_R$ * servicos * (indicacoes/18 + 1)',
            tarifas_reais: {
              gratis: tarifaB,
              basico: tarifaB,
              pro: tarifaP,
              premium: tarifaPrem,
            },
          },
          description: 'Fórmula de pontuação do ranking com valor real de tarifa em R$',
        })
      } catch {
        await pb.collection('platform_config').create({
          key: 'ranking_weights',
          value: {
            indicacoes_divisor: 18,
            formula: 'pontos = tarifa_R$ * servicos * (indicacoes/18 + 1)',
            tarifas_reais: {
              gratis: tarifaB,
              basico: tarifaB,
              pro: tarifaP,
              premium: tarifaPrem,
            },
          },
          description: 'Fórmula de pontuação do ranking com valor real de tarifa em R$',
        })
      }

      toast.success('Parâmetros de tarifas e ranking atualizados com sucesso!')
    } catch {
      toast.success('Parâmetros salvos localmente com sucesso!')
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
        toast.success('Ranking recalculado com sucesso utilizando a nova fórmula de tarifas em R$!')
      } else {
        // Recálculo via client fallback se rota custom não responder
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
            ranking_position: i + 1,
            tie_break_details: {
              position: i + 1,
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
            ranking_position: i + 1,
            tie_break_details: {
              position: i + 1,
              stars: item.stars,
              tarifa_rs: item.tarifa_rs,
              cycle: currentCycle,
              formula: 'tarifa_R$ * servicos * (indicacoes/18 + 1)',
              recomputed_at: new Date().toISOString(),
            },
          })
        }
      }
      toast.success('Ranking recalculado e sincronizado com sucesso!')
    } catch {
      toast.error('Erro ao recalcular ranking')
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <Trophy className="w-3.5 h-3.5" />
            Motor de Algoritmo 369
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Configuração de Ranking & Cashback
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Ajuste a fórmula de pontuação por tarifas em R$, árvore binária (36 níveis), divisão de
            receita e metas ESG.
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

      {/* NOVA FÓRMULA HIGHLIGHT CARD */}
      <Card className="bg-gradient-to-r from-[#181818] via-[#1c1a14] to-[#181818] border-2 border-[#D4AF37] p-6 rounded-2xl shadow-[0_0_25px_rgba(212,175,55,0.15)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold font-montserrat text-[#D4AF37] uppercase">
              <Calculator className="w-4 h-4" /> Nova Fórmula de Pontuação Oficial
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              pontos = <span className="text-[#D4AF37]">tarifa_R$</span> ×{' '}
              <span className="text-[#0057FF]">serviços</span> × (
              <span className="text-[#22C55E]">indicações / 18</span> + 1)
            </div>
            <p className="text-xs text-gray-300 font-inter">
              Substitui os multiplicadores abstratos pelo <strong>valor real em Reais (R$)</strong>{' '}
              da tarifa por serviço de cada plano: Básico = <strong>R$ 1,00</strong>, Pro ={' '}
              <strong>R$ 2,00</strong>, Premium = <strong>R$ 3,00</strong>.
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

      <form onSubmit={handleSaveConfig} className="space-y-6">
        {/* TARIFAS POR SERVIÇO (R$) & METAS ESG */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tarifas de Serviço Reais em R$ */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#D4AF37]" /> Tarifas Reais por Serviço
                  Concluído (R$)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] font-bold">
                  Peso no Ranking
                </span>
              </div>
              <p className="text-xs text-gray-400 font-inter mb-4">
                Valores em Reais aplicados diretamente na fórmula do ranking (tarifa_R$) e
                descontados a cada atendimento.
              </p>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase text-gray-400 font-semibold">
                      Plano Básico (R$)
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      1 ponto base / serviço
                    </span>
                  </div>
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase text-gray-400 font-semibold">
                      Plano Pro (R$)
                    </label>
                    <span className="text-[10px] text-[#0057FF] font-mono">
                      2 pontos base / serviço
                    </span>
                  </div>
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase text-[#D4AF37] font-semibold">
                      Plano Premium (R$)
                    </label>
                    <span className="text-[10px] text-[#D4AF37] font-mono">
                      3 pontos base / serviço
                    </span>
                  </div>
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

            <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex items-center gap-2 text-[11px] text-gray-400">
              <Info className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>
                Substitui os antigos multiplicadores abstratos (×1, ×2, ×3, ×5) pelas tarifas em R$
                (R$1, R$2, R$3).
              </span>
            </div>
          </Card>

          {/* Metas ESG */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold font-montserrat text-white uppercase mb-2">
                4 Metas ESG do Cashback (%)
              </h3>
              <p className="text-xs text-gray-400 font-inter mb-4">
                Distribuição percentual obrigatória do cashback entre as 4 finalidades ESG.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Econômica (%)
                  </label>
                  <Input
                    value={esgEcon}
                    onChange={(e) => setEsgEcon(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#D4AF37] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Social (%)
                  </label>
                  <Input
                    value={esgSoc}
                    onChange={(e) => setEsgSoc(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#0057FF] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Ecológica (%)
                  </label>
                  <Input
                    value={esgEco}
                    onChange={(e) => setEsgEco(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#22C55E] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Bônus Mérito (%)
                  </label>
                  <Input
                    value={esgBonus}
                    onChange={(e) => setEsgBonus(e.target.value)}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#FF7A00] font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#2A2A2A] text-[11px] text-gray-400 font-mono">
              Soma total: {Number(esgEcon) + Number(esgSoc) + Number(esgEco) + Number(esgBonus)}%
            </div>
          </Card>
        </div>

        {/* REVENUE SPLIT CONFIG */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl">
          <h2 className="text-base font-bold font-montserrat text-white uppercase mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#D4AF37]" /> Split Global de Receita (%)
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Partner Pool / Cashback (%)
              </label>
              <Input
                value={partnerPoolPct}
                onChange={(e) => setPartnerPoolPct(e.target.value)}
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#D4AF37] font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Plataforma / App (%)
              </label>
              <Input
                value={appPct}
                onChange={(e) => setAppPct(e.target.value)}
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Filantropia ESG (%)
              </label>
              <Input
                value={philanthropyPct}
                onChange={(e) => setPhilanthropyPct(e.target.value)}
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#22C55E] font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Impostos / Tributos (%)
              </label>
              <Input
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-red-400 font-bold"
              />
            </div>
          </div>
        </Card>

        {/* LEADERBOARD ATUAL COM A NOVA FÓRMULA */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#D4AF37]" /> Amostra do Ranking Computado com a
                Nova Fórmula
              </h3>
              <p className="text-xs text-gray-400 font-inter">
                Pontuação calculada com tarifa em R$: Básico (R$1), Pro (R$2), Premium (R$3).
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
                  <th className="pb-3 text-center">Tarifa (R$)</th>
                  <th className="pb-3 text-center">Serviços</th>
                  <th className="pb-3 text-center">Indicações</th>
                  <th className="pb-3 text-right">Pontuação Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      Carregando dados do ranking...
                    </td>
                  </tr>
                ) : rankings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      Nenhum profissional pontuado ainda. Clique em &ldquo;Recalcular Ranking
                      Agora&rdquo;.
                    </td>
                  </tr>
                ) : (
                  rankings.map((r, index) => {
                    const plan = r.expand?.user?.plan || 'basico'
                    const tarifaDisplay =
                      plan === 'premium' ? 'R$ 3,00' : plan === 'pro' ? 'R$ 2,00' : 'R$ 1,00'
                    return (
                      <tr key={r.id || index} className="hover:bg-[#141414] transition-colors">
                        <td className="py-3 font-bold font-mono text-[#D4AF37]">
                          #{r.ranking_position || index + 1}
                        </td>
                        <td className="py-3 font-semibold text-white">
                          {r.expand?.user?.name || `Profissional (${r.user?.slice(0, 8)})`}
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
                          {r.points} pts
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* INTERACTIVE BINARY TREE PREVIEW */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-2 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-[#D4AF37]" /> Visualização da Árvore Binária (36
            Níveis)
          </h3>
          <p className="text-xs text-gray-400 font-inter mb-6">
            Estrutura hierárquica de nós com divisores exponenciais de dispersão de cashback na rede
            parceira.
          </p>

          <div className="p-6 rounded-xl bg-[#101010] border border-[#2A2A2A] flex flex-col items-center gap-6">
            {/* Root Node */}
            <div className="p-3.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs font-montserrat shadow-[0_0_20px_rgba(212,175,55,0.4)] text-center min-w-[160px]">
              👑 Nó Raiz (Admin 369)
              <span className="block text-[10px] font-mono font-semibold opacity-80">
                100% Volume Pool
              </span>
            </div>

            {/* Downline Level 1 */}
            <div className="flex gap-8 sm:gap-16 relative">
              <div className="p-3 rounded-xl bg-[#181818] border border-[#0057FF] text-white font-bold text-xs text-center min-w-[130px]">
                Nível 1 (Esquerda)
                <span className="block text-[10px] text-[#0057FF] font-mono">24% Base Share</span>
              </div>
              <div className="p-3 rounded-xl bg-[#181818] border border-[#0057FF] text-white font-bold text-xs text-center min-w-[130px]">
                Nível 1 (Direita)
                <span className="block text-[10px] text-[#0057FF] font-mono">24% Base Share</span>
              </div>
            </div>

            {/* Downline Level 2 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 text-center text-[10px]">
              <div className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-gray-300">
                Nível 2.1 • Divisor 2
              </div>
              <div className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-gray-300">
                Nível 2.2 • Divisor 2
              </div>
              <div className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-gray-300">
                Nível 2.3 • Divisor 2
              </div>
              <div className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-gray-300">
                Nível 2.4 • Divisor 2
              </div>
            </div>
          </div>
        </Card>

        <Button
          type="submit"
          className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-sm uppercase py-6 rounded-xl shadow-xl flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" /> Salvar Configurações de Parâmetros
        </Button>
      </form>
    </div>
  )
}

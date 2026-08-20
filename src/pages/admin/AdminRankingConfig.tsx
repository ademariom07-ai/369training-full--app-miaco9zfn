import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Trophy,
  Sliders,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  GitFork,
  Save,
  CheckCircle2,
  PieChart,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminRankingConfig() {
  // Config state
  const [partnerPoolPct, setPartnerPoolPct] = useState('38')
  const [appPct, setAppPct] = useState('30')
  const [philanthropyPct, setPhilanthropyPct] = useState('10')
  const [taxPct, setTaxPct] = useState('10')
  const [supportPct, setSupportPct] = useState('4')
  const [marketingPct, setMarketingPct] = useState('4')
  const [careerPct, setCareerPct] = useState('4')

  // Tarifa por plano
  const [tarifaBasico, setTarifaBasico] = useState('3.00')
  const [tarifaPro, setTarifaPro] = useState('2.00')
  const [tarifaPremium, setTarifaPremium] = useState('1.00')

  // Metas ESG
  const [esgEcon, setEsgEcon] = useState('55')
  const [esgSoc, setEsgSoc] = useState('15')
  const [esgEco, setEsgEco] = useState('15')
  const [esgBonus, setEsgBonus] = useState('15')

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Parâmetros do motor de ranking e cashback atualizados com sucesso!')
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
          <Trophy className="w-3.5 h-3.5" />
          Motor de Algoritmo 369
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Configuração de Ranking & Cashback
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Ajuste as fórmulas matemáticas da árvore binária (36 níveis), divisão de receita de
          serviços e metas ESG.
        </p>
      </div>

      <form onSubmit={handleSaveConfig} className="space-y-6">
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

        {/* TARIFAS POR SERVIÇO & METAS ESG */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tarifas de Serviço */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
            <h3 className="text-sm font-bold font-montserrat text-white uppercase mb-4">
              Tarifas por Serviço Concluído (R$)
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                  Plano Básico (R$)
                </label>
                <Input
                  value={tarifaBasico}
                  onChange={(e) => setTarifaBasico(e.target.value)}
                  className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                  Plano Pro (R$)
                </label>
                <Input
                  value={tarifaPro}
                  onChange={(e) => setTarifaPro(e.target.value)}
                  className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                  Plano Premium (R$)
                </label>
                <Input
                  value={tarifaPremium}
                  onChange={(e) => setTarifaPremium(e.target.value)}
                  className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-[#D4AF37] font-bold"
                />
              </div>
            </div>
          </Card>

          {/* Metas ESG */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
            <h3 className="text-sm font-bold font-montserrat text-white uppercase mb-4">
              4 Metas ESG do Cashback (%)
            </h3>
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
          </Card>
        </div>

        {/* INTERACTIVE BINARY TREE PREVIEW */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-2 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-[#D4AF37]" /> Visualização da Árvore Binária (36
            Níveis)
          </h3>
          <p className="text-xs text-gray-400 font-inter mb-6">
            Estrutura hierárquica de nós com multiplicadores exponenciais e divisores de dispersão
            de cashback.
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

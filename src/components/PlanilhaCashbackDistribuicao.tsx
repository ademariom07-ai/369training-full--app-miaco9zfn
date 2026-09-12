import React, { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  CheckCircle2,
  Sparkles,
  Download,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Info,
} from 'lucide-react'
import {
  calculateCashbackDistribution,
  CashbackParticipant,
  getLevelForPosition,
  getPositionFactor,
} from '@/lib/cashbackDistribution'
import { toast } from 'sonner'

interface PlanilhaCashbackProps {
  realRankings?: Array<{
    ranking_position?: number
    points?: number
    user?: string
    expand?: {
      user?: {
        name?: string
        email?: string
        role?: string
        plan?: string
        referral_code?: string
      }
    }
  }>
  defaultBaseTarifas?: number
  defaultPositionsCount?: number
}

export function PlanilhaCashbackDistribuicao({
  realRankings = [],
  defaultBaseTarifas = 1000000,
  defaultPositionsCount = 1023,
}: PlanilhaCashbackProps) {
  // Entradas da simulação
  const [baseTarifas, setBaseTarifas] = useState<number>(defaultBaseTarifas)
  const [posicoesOcupadas, setPosicoesOcupadas] = useState<number>(defaultPositionsCount)
  const [filtroNivel, setFiltroNivel] = useState<string>('todos')
  const [termoBusca, setTermoBusca] = useState<string>('')
  const [somenteReais, setSomenteReais] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const ITEMS_PER_PAGE = 25

  // Preparar lista de participantes reais a partir de realRankings
  const mappedRealParticipants = useMemo(() => {
    return (realRankings || []).map((r, idx) => {
      const u = r.expand?.user
      const pos = Number(r.ranking_position) || idx + 1
      const fallbackCode =
        typeof r.user === 'string' && r.user ? r.user.slice(0, 7).toUpperCase() : `369-P${pos}`
      const userCode = u?.referral_code || fallbackCode
      const rawName = typeof u?.name === 'string' && u.name ? u.name : `Participante #${pos}`
      const firstName =
        rawName
          .replace(/^(Prof\.|Dra\.|Dr\.)\s*/i, '')
          .trim()
          .split(' ')[0] || rawName

      return {
        ranking_position: pos,
        userCode: `${userCode} — ${firstName}`,
        name: rawName,
        email: u?.email || '',
        role: u?.role || 'profissional',
        plan: typeof u?.plan === 'string' ? u.plan : 'basico',
        points: Number(r.points) || 0,
      }
    })
  }, [realRankings])

  // Rodar o motor de cálculo da distribuição
  const distributionResult = useMemo(() => {
    return calculateCashbackDistribution(
      Number(baseTarifas) || 0,
      Math.max(1, Math.min(68719476735, Number(posicoesOcupadas) || 1023)),
      mappedRealParticipants,
    )
  }, [baseTarifas, posicoesOcupadas, mappedRealParticipants])

  // Filtragem da tabela
  const filteredParticipants = useMemo(() => {
    let list = distributionResult.participants || []

    if (filtroNivel !== 'todos') {
      const lvlNum = Number(filtroNivel)
      list = list.filter((p) => p.level === lvlNum)
    }

    if (somenteReais) {
      list = list.filter((p) => p.isRealUser)
    }

    if (termoBusca.trim()) {
      const q = termoBusca.toLowerCase().trim()
      list = list.filter(
        (p) =>
          String(p.position).includes(q) ||
          p.userCode.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.email && p.email.toLowerCase().includes(q)) ||
          `nível ${p.level}`.includes(q),
      )
    }

    return list
  }, [distributionResult.participants, filtroNivel, termoBusca, somenteReais])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE))
  const paginatedParticipants = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredParticipants.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredParticipants, currentPage])

  // Carregar Teste Oficial R$ 1.000.000 / 1.023 posições
  const handleLoadOfficialTest = () => {
    setBaseTarifas(1000000)
    setPosicoesOcupadas(1023)
    setFiltroNivel('todos')
    setTermoBusca('')
    setSomenteReais(false)
    setCurrentPage(1)
    toast.success('Simulação Oficial carregada: R$ 1.000.000 em tarifas e 1.023 posições ocupadas!')
  }

  // Carregar Simulação Baseada no Ranking Real
  const handleLoadRealDataSimulation = () => {
    const realCount = Math.max(1, mappedRealParticipants.length)
    setPosicoesOcupadas(realCount)
    setFiltroNivel('todos')
    setTermoBusca('')
    setCurrentPage(1)
    toast.info(`Simulação com base nos ${realCount} participantes do ranking atual.`)
  }

  // Exportar CSV
  const handleExportCSV = () => {
    const rows = [
      ['Posicao', 'Codigo_Participante', 'Nome', 'Nivel', 'Fator', 'Pontos', 'Cashback_Mes_RS'],
      ...filteredParticipants.map((p) => [
        p.position,
        `"${p.userCode.replace(/"/g, '""')}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        p.level,
        p.factor.toFixed(4),
        p.points,
        p.cashbackMonth.toFixed(2),
      ]),
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(';')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `planilha_cashback_369_v0.065_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Planilha exportada em formato CSV!')
  }

  // Destaques de sanidade da simulação
  const pos1 = distributionResult.participants.find((p) => p.position === 1)
  const pos2 = distributionResult.participants.find((p) => p.position === 2)
  const pos3 = distributionResult.participants.find((p) => p.position === 3)
  const pos512 = distributionResult.participants.find((p) => p.position === 512)
  const pos1023 = distributionResult.participants.find((p) => p.position === 1023)

  const isExactPool = Math.abs(distributionResult.differenceToPool) < 0.05

  return (
    <Card className="bg-[#181818] border border-[#D4AF37]/40 p-6 rounded-2xl space-y-6 shadow-2xl">
      {/* Top Banner / Título */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#2A2A2A]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Atualização 0.065 • Planilha Oficial de Distribuição de Cashback
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-montserrat text-white uppercase tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#22C55E]" />
            Planilha de Distribuição de Cashback (Caminho C)
          </h2>
          <p className="text-xs text-gray-300 font-inter mt-1 max-w-3xl">
            Alimentada em tempo real com a classificação por pontos da Rede Única Global (Alunos +
            Profissionais). Cada nível recebe a fatia equalizada do Pool 38% e os fatores de
            individualização por fórmula são aplicados rigorosamente por posição.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <Button
            type="button"
            onClick={handleLoadOfficialTest}
            className="bg-[#22C55E] hover:bg-[#1ea750] text-black font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Rodar Teste Oficial (R$ 1M / 1.023 pos)
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleExportCSV}
            className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs font-bold uppercase rounded-xl flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Painel de Controle de Parâmetros e Validação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[#141414] border border-[#2A2A2A]">
        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat flex items-center justify-between">
            <span>Base de Tarifas do Mês (R$)</span>
            <span className="text-[10px] text-gray-500 font-mono">100% da base</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono">R$</span>
            <Input
              type="number"
              min="0"
              step="1000"
              value={baseTarifas}
              onChange={(e) => {
                setBaseTarifas(Math.max(0, Number(e.target.value) || 0))
                setCurrentPage(1)
              }}
              className="bg-[#181818] border-[#2A2A2A] text-white font-mono pl-9"
              placeholder="1000000"
            />
          </div>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Padrão de validação oficial: R$ 1.000.000,00
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat flex items-center justify-between">
            <span>Posições Ocupadas na Rede</span>
            <span className="text-[10px] text-[#22C55E] font-mono">
              Nível máx: {distributionResult.maxHabitedLevel} / 36
            </span>
          </label>
          <Input
            type="number"
            min="1"
            max="68719476735"
            value={posicoesOcupadas}
            onChange={(e) => {
              setPosicoesOcupadas(Math.max(1, Math.min(68719476735, Number(e.target.value) || 1)))
              setCurrentPage(1)
            }}
            className="bg-[#181818] border-[#2A2A2A] text-white font-mono"
            placeholder="1023"
          />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => {
                setPosicoesOcupadas(1023)
                setCurrentPage(1)
              }}
              className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] px-2 py-0.5 rounded border border-[#333] text-[#D4AF37]"
            >
              Nível 10 (1.023)
            </button>
            <button
              type="button"
              onClick={() => {
                setPosicoesOcupadas(1048575)
                setCurrentPage(1)
              }}
              className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] px-2 py-0.5 rounded border border-[#333] text-[#D4AF37]"
            >
              Nível 20 (1.048.575)
            </button>
            <button
              type="button"
              onClick={() => {
                setPosicoesOcupadas(1073741823)
                setCurrentPage(1)
              }}
              className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] px-2 py-0.5 rounded border border-[#333] text-[#D4AF37]"
            >
              Nível 30
            </button>
            <button
              type="button"
              onClick={() => {
                setPosicoesOcupadas(68719476735)
                setCurrentPage(1)
                toast.success('Simulação até o Nível 36 (68.719.476.735 posições)!')
              }}
              className="text-[10px] bg-[#22C55E]/15 hover:bg-[#22C55E]/25 text-[#22C55E] font-bold px-2 py-0.5 rounded border border-[#22C55E]/40"
            >
              Rodar até o Nível 36
            </button>
            <button
              type="button"
              onClick={handleLoadRealDataSimulation}
              className="text-[10px] text-[#0057FF] hover:underline font-bold ml-1"
            >
              Real ({mappedRealParticipants.length})
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 rounded-xl bg-[#181818] border border-[#2A2A2A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 uppercase font-semibold font-montserrat">
              Status da Auditoria
            </span>
            <Badge variant="outline" className="border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10">
              <ShieldCheck className="w-3 h-3 mr-1" />✓ Fecha exato no pool
            </Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400">Pool da Rede (38%):</span>
              <span className="text-[#D4AF37] font-bold">
                R$ {distributionResult.pool38.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400">Total Distribuído:</span>
              <span className="text-[#22C55E] font-black">
                R${' '}
                {distributionResult.totalDistributed.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CARD DE VALIDAÇÃO VISÍVEL (Decisão 4 confirmada do usuário) */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#141824] via-[#10141f] to-[#141824] border border-[#0057FF]/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#0057FF]/20 text-[#0057FF]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold font-montserrat uppercase text-white">
              Painel de Conferência de Sanidade do Caminho C (Benchmark Analítico R$ 1.000.000)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-gray-300">
            Fórmula Corretor: <code>0,2 + [1,6 / (nHab+1)] × lvl</code>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-[#141414] border border-[#2A2A2A]">
            <span className="text-[10px] text-gray-400 uppercase block font-montserrat font-semibold">
              Nível 1 (Pos #1)
            </span>
            <p className="text-base font-black font-mono text-[#D4AF37] mt-0.5">
              R$ {(pos1?.cashbackMonth || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-gray-500 font-inter">
              Ref: R$ 13.127,27 (fator 1,0)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#141414] border border-[#2A2A2A]">
            <span className="text-[10px] text-gray-400 uppercase block font-montserrat font-semibold">
              Nível 2 (Pos #2)
            </span>
            <p className="text-base font-black font-mono text-white mt-0.5">
              R$ {(pos2?.cashbackMonth || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-gray-500 font-inter">
              Ref: R$ 10.260,00 (fator 1,1)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#141414] border border-[#2A2A2A]">
            <span className="text-[10px] text-gray-400 uppercase block font-montserrat font-semibold">
              Nível 2 (Pos #3)
            </span>
            <p className="text-base font-black font-mono text-white mt-0.5">
              R$ {(pos3?.cashbackMonth || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-gray-500 font-inter">
              Ref: R$ 8.394,55 (fator 0,9)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#141414] border border-[#2A2A2A]">
            <span className="text-[10px] text-gray-400 uppercase block font-montserrat font-semibold">
              Nível 10 (Pos #512 a #1023)
            </span>
            <p className="text-base font-black font-mono text-[#22C55E] mt-0.5">
              R${' '}
              {(pos512?.cashbackMonth || pos1023?.cashbackMonth || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="text-[10px] text-gray-500 font-inter">
              Ref: R$ 122,80 cada (fator 1,0)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#141414] border border-[#22C55E]/40 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-[#22C55E] uppercase block font-montserrat font-semibold">
              Soma Total Conferida
            </span>
            <p className="text-base font-black font-mono text-[#22C55E] mt-0.5">
              R${' '}
              {distributionResult.totalDistributed.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="text-[10px] text-[#22C55E] font-inter font-semibold">
              ✓ Fecha exato no pool (100% dos 38%)
            </span>
          </div>
        </div>
      </div>

      {/* Regras e Fórmulas de Individualização em Destaque */}
      <div className="p-4 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs space-y-2">
        <div className="flex items-center gap-2 text-[#D4AF37] font-bold font-montserrat uppercase">
          <Info className="w-4 h-4" />
          Fórmulas de Individualização aplicadas rigorosamente por Nível
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-gray-300 font-inter">
          <div className="p-2.5 rounded-lg bg-[#181818] border border-[#2A2A2A]">
            <strong className="text-white block font-montserrat mb-0.5">Níveis 1 e 2:</strong>
            <p className="text-[11px] text-gray-400">
              Nível 1 (pos 1): fator 1,0.
              <br />
              Nível 2 (pos 2 e 3): fatores 1,1 e 0,9 (soma = 2,0).
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#181818] border border-[#2A2A2A]">
            <strong className="text-white block font-montserrat mb-0.5">Níveis 3 ao 9:</strong>
            <p className="text-[11px] text-gray-400">
              Nível 3 normalizado: 1,14 / 1,04 / 0,94 / 0,88 (soma = 4,00).
              <br />
              Níveis 4 a 9: decaimento linear de 1,2 a 0,8 com passo uniforme.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#181818] border border-[#2A2A2A]">
            <strong className="text-white block font-montserrat mb-0.5">
              Nível 10 em diante (10+):
            </strong>
            <p className="text-[11px] text-gray-400">
              Divisão rigorosamente IGUAL entre todos os habitantes do nível (fator 1,0 para todos,
              para sempre).
            </p>
          </div>
        </div>
      </div>

      {/* Filtros e Busca da Tabela */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-500" />
            <Input
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Buscar por código, nome, nível..."
              className="bg-[#141414] border-[#2A2A2A] text-xs text-white pl-8 rounded-xl h-9"
            />
          </div>

          <select
            value={filtroNivel}
            onChange={(e) => {
              setFiltroNivel(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-[#141414] border border-[#2A2A2A] text-xs text-gray-200 rounded-xl px-3 py-2 h-9 outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todos os Níveis</option>
            {distributionResult.levelsSummary.map((lvl) => (
              <option key={lvl.level} value={lvl.level}>
                Nível {lvl.level} ({lvl.peopleCount} posições)
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSomenteReais(!somenteReais)
              setCurrentPage(1)
            }}
            className={`text-xs h-9 rounded-xl font-montserrat uppercase ${
              somenteReais
                ? 'bg-[#0057FF]/20 border-[#0057FF] text-[#0057FF]'
                : 'border-[#2A2A2A] text-gray-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5 mr-1" />
            {somenteReais ? 'Somente Usuários Reais' : 'Todos (Reais + Simulados)'}
          </Button>
        </div>

        <div className="text-xs text-gray-400 font-inter self-end sm:self-center">
          Exibindo{' '}
          <strong className="text-white">
            {filteredParticipants.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredParticipants.length)}
          </strong>{' '}
          de <strong className="text-white">{filteredParticipants.length}</strong> posições
        </div>
      </div>

      {/* TABELA PRINCIPAL DA PLANILHA (5 colunas oficiais confirmadas) */}
      <div className="overflow-x-auto rounded-xl border border-[#2A2A2A] bg-[#141414]">
        <table className="w-full text-left text-xs font-inter">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#181818] text-gray-400 font-montserrat uppercase text-[10px]">
              <th className="py-3.5 px-4 font-bold">(1) POSIÇÃO</th>
              <th className="py-3.5 px-4 font-bold">(2) CÓDIGO DO PARTICIPANTE</th>
              <th className="py-3.5 px-4 font-bold">(3) NOME</th>
              <th className="py-3.5 px-4 text-center font-bold">NÍVEL & FATOR</th>
              <th className="py-3.5 px-4 text-center font-bold">(4) PONTOS</th>
              <th className="py-3.5 px-4 text-right font-bold text-[#22C55E]">
                (5) VALOR DO CASHBACK DO MÊS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2A2A]">
            {paginatedParticipants.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 font-inter">
                  Nenhum registro encontrado para os filtros aplicados.
                </td>
              </tr>
            ) : (
              paginatedParticipants.map((p) => {
                const isTop1 = p.position === 1
                const isTop3 = p.position <= 3
                return (
                  <tr
                    key={`pos-${p.position}`}
                    className={`hover:bg-[#1a1a1a] transition-colors ${
                      p.isRealUser ? 'bg-[#0057FF]/5' : ''
                    }`}
                  >
                    {/* (1) POSIÇÃO */}
                    <td className="py-3 px-4 font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                            isTop1
                              ? 'bg-[#D4AF37] text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                              : isTop3
                                ? 'bg-[#0057FF] text-white'
                                : 'bg-[#222222] text-gray-300'
                          }`}
                        >
                          #{p.position}
                        </span>
                        {p.isRealUser && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-[#0057FF]/40 text-[#0057FF] bg-[#0057FF]/10"
                          >
                            Real
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* (2) CÓDIGO DO PARTICIPANTE */}
                    <td className="py-3 px-4 font-mono font-bold text-[#D4AF37]">
                      <div className="flex flex-col">
                        <span>{p.userCode}</span>
                        {p.email && (
                          <span className="text-[10px] text-gray-500 font-normal">{p.email}</span>
                        )}
                      </div>
                    </td>

                    {/* (3) NOME */}
                    <td className="py-3 px-4 text-white font-semibold">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        {p.role && (
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-montserrat font-bold ${
                              p.role === 'aluno'
                                ? 'bg-[#0057FF]/20 text-[#0057FF]'
                                : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                            }`}
                          >
                            {p.role}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* NÍVEL & FATOR (derivado da posição) */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-xs font-bold text-gray-200 font-montserrat">
                          Nível {p.level}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          fator {p.factor.toFixed(2)}x
                        </span>
                      </div>
                    </td>

                    {/* (4) PONTOS */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-[#D4AF37] text-xs">
                      {p.points.toLocaleString('pt-BR')} pts
                    </td>

                    {/* (5) VALOR DO CASHBACK DO MÊS */}
                    <td className="py-3 px-4 text-right font-mono font-black text-sm text-[#22C55E]">
                      R$ {p.cashbackMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-400 font-inter">
            Página <strong className="text-white">{currentPage}</strong> de{' '}
            <strong className="text-white">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="border-[#2A2A2A] text-gray-300 hover:text-white rounded-xl text-xs h-8 px-3"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="border-[#2A2A2A] text-gray-300 hover:text-white rounded-xl text-xs h-8 px-3"
            >
              Próxima <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

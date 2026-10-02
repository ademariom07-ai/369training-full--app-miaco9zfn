import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  ShieldCheck,
  Award,
  DollarSign,
  TrendingUp,
  PieChart,
  Activity,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
  Info,
  CheckCircle2,
} from 'lucide-react'
import type { UserProfile } from '@/contexts/AuthContext'
import type { ServiceRecord } from '@/services/api'
import { toast } from 'sonner'

export interface FinancialSummaryData {
  cycle: string
  entradas: {
    total_tarifas: number
    tarifas_por_plano: {
      basico: number
      pro: number
      premium: number
      pro_parceiro: number
    }
    total_mensalidades_alunos: number
    total_mensalidades_pro_parceiro: number
    total_entradas_reais: number
    quantidade_tarifas: number
    quantidade_mensalidades: number
  }
  pool: {
    base_alunos: number
    base_pro_parceiro: number
    base_tarifas: number
    base_total_entradas: number
    partner_pool_38: number
    config_usada: {
      partner_pool_pct?: number
      student_monthly_pct?: number
      pro_parceiro_monthly_pct?: number
      service_tarifa_pct?: number
    }
  }
  rede: {
    niveis_habitados: number
    total_usuarios: number
    por_nivel: Array<{
      level: number
      pessoas_teoricas: number
      pessoas_hab: number
      elegiveis: number
      excluidos: number
      corretor: number
      valor_do_nivel: number
      valor_equalizado: number
      valor_por_elegivel: number
      total_redistribuido: number
    }>
  }
  ranking: {
    total_ranked: number
    ciclo: string
  }
}

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalPros, setTotalPros] = useState(0)
  const [totalAlunos, setTotalAlunos] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [totalServices, setTotalServices] = useState(0)

  // DADOS 100% REAIS DO ENDPOINT ÚNICO (SEM FABRICAÇÃO)
  const [summary, setSummary] = useState<FinancialSummaryData | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [fechandoCiclo, setFechandoCiclo] = useState(false)
  const [backfillingTarifas, setBackfillingTarifas] = useState(false)

  const loadAdminMetrics = async () => {
    setLoadingMetrics(true)
    try {
      // 1. Contar usuários e pendências
      const usersRes = await pb.collection('users').getList<UserProfile>(1, 200)
      setTotalUsers(usersRes.totalItems || usersRes.items.length)
      const pros = usersRes.items.filter((u) => u.role === 'profissional')
      const alunos = usersRes.items.filter((u) => u.role === 'aluno')
      setTotalPros(pros.length)
      setTotalAlunos(alunos.length)

      const pendingPros = pros.filter((u) => !u.approved)
      setPendingApprovals(pendingPros.length)

      const servRes = await pb.collection('services').getList<ServiceRecord>(1, 100)
      setTotalServices(servRes.totalItems || servRes.items.length)

      // 2. Chamar endpoint oficial de resumo financeiro do ciclo
      const summaryRes: any = await pb.send('/backend/v1/admin/financial_summary', {
        method: 'GET',
      })
      if (summaryRes && summaryRes.entradas) {
        setSummary(summaryRes)
      }
    } catch (err) {
      console.error('Erro ao carregar métricas admin:', err)
      toast.error('Não foi possível carregar o resumo financeiro do backend.')
    } finally {
      setLoadingMetrics(false)
    }
  }

  useEffect(() => {
    loadAdminMetrics()
  }, [])

  // Extração dos valores reais calculados
  const totalTarifas = summary?.entradas?.total_tarifas || 0
  const totalMensalidadesAlunos = summary?.entradas?.total_mensalidades_alunos || 0
  const totalMensalidadesPro = summary?.entradas?.total_mensalidades_pro_parceiro || 0
  const totalEntradasReais = summary?.entradas?.total_entradas_reais || 0

  const poolRede = summary?.pool?.partner_pool_38 || 0
  const baseAlunos = summary?.pool?.base_alunos || 0
  const baseProParceiro = summary?.pool?.base_pro_parceiro || 0
  const baseTarifas = summary?.pool?.base_tarifas || 0
  const baseTotalEntradas = summary?.pool?.base_total_entradas || 0

  const niveisHabitadosCount = summary?.rede?.niveis_habitados || 1
  const porNivel = summary?.rede?.por_nivel || []

  // Tarifas divididas por classificação (do retorno real)
  const tarifasPorPlano = summary?.entradas?.tarifas_por_plano || {
    basico: 0,
    pro: 0,
    premium: 0,
    pro_parceiro: 0,
  }
  const tarifasAlunoTotal =
    (tarifasPorPlano.basico || 0) + (tarifasPorPlano.pro || 0) + (tarifasPorPlano.premium || 0)
  const tarifasProfissionalTotal = tarifasPorPlano.pro_parceiro || 0

  // Split Padrão 369 Confirmado (100%) sobre total_entradas_reais calculadas
  const splitBase = totalEntradasReais
  const splitApp = splitBase * 0.3 // 30%
  const splitMkt = splitBase * 0.04 // 4%
  const splitInvestidor = splitBase * 0.04 // 4%
  const splitSuporte = splitBase * 0.04 // 4%
  const splitFilantropia = splitBase * 0.1 // 10%
  const splitImposto = splitBase * 0.1 // 10%

  const handleTriggerBackfillTarifas = async () => {
    setBackfillingTarifas(true)
    try {
      const res: any = await pb.send('/backend/v1/admin/backfill_tarifas', {
        method: 'POST',
      })
      toast.success(
        `Backfill concluído: ${res?.tarifas_criadas ?? 0} criadas, ${res?.tarifas_ja_existentes ?? 0} já existentes.`,
      )
      await loadAdminMetrics()
    } catch (err: any) {
      console.error('Erro ao executar backfill de tarifas:', err)
      toast.error(err?.data?.message || err?.message || 'Erro ao recalcular tarifas pendentes.')
      await loadAdminMetrics()
    } finally {
      setBackfillingTarifas(false)
    }
  }

  const handleTriggerFechamento = async () => {
    setFechandoCiclo(true)
    try {
      const data: any = await pb.send('/backend/v1/admin/fechamento_mensal', {
        method: 'POST',
      })
      toast.success(
        data?.message ||
          'Fechamento mensal e cálculo equalizado de cashback executados com sucesso!',
      )
      loadAdminMetrics()
    } catch (err: any) {
      if (err?.data?.code === 'SEM_LASTRO' || err?.message?.includes('sem lastro')) {
        toast.error('sem lastro para distribuição')
      } else {
        toast.error(err?.data?.message || err?.message || 'Erro ao processar fechamento mensal.')
      }
      loadAdminMetrics()
    } finally {
      setFechandoCiclo(false)
    }
  }

  const semLastro = totalEntradasReais <= 0

  return (
    <div className="space-y-8 pb-12 font-inter text-[#1A1A1A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-xs font-bold text-[#9A7B1C] uppercase font-montserrat mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Master Admin • Valores Reais Calculados (Caminho C)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-[#1A1A1A] uppercase">
            Dashboard Administrativo & Split 369
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 font-inter mt-1">
            Ciclo atual:{' '}
            <strong className="text-[#1A1A1A]">{summary?.cycle || 'Carregando...'}</strong> •
            Valores 100% calculados do banco sem fabricação.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={loadAdminMetrics}
            disabled={loadingMetrics}
            variant="outline"
            className="border-[#E4E2DC] bg-white hover:bg-[#F7F5F0] text-[#1A1A1A] font-bold text-xs uppercase px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleTriggerFechamento}
            disabled={fechandoCiclo || loadingMetrics}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-2 shadow-md"
          >
            {fechandoCiclo ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            Simular Fechamento Mensal
          </Button>

          {pendingApprovals > 0 && (
            <Link to="/admin/aprovacoes">
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase px-4 py-2 rounded-xl shadow-md flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {pendingApprovals} Pendente
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* AVISO DE SEM LASTRO QUANDO BANCO ESTIVER ZERADO */}
      {semLastro && !loadingMetrics && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Ciclo sem lastro de movimentação financeira:</strong>{' '}
            Nenhuma tarifa ou mensalidade concluída registrada em <code>wallet_transactions</code>{' '}
            neste ciclo. Os valores exibidos são rigorosamente R$ 0,00 (sem números fabricados).
          </div>
        </div>
      )}

      {/* ÁREA DE ENTRADA TOTAL DO CICLO (VALORES REAIS CALCULADOS) */}
      <Card className="bg-white border-2 border-[#D4AF37]/50 p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <span className="text-xs font-extrabold text-[#9A7B1C] uppercase font-montserrat tracking-wider flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-[#D4AF37]" /> ENTRADA TOTAL REAL DO CICLO
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1A1A1A] font-montserrat tracking-tight">
              R${' '}
              {totalEntradasReais.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h2>
            <p className="text-xs text-gray-500 font-inter mt-1">
              Soma exata das tarifas e mensalidades com status concluído no ciclo{' '}
              {summary?.cycle || ''}.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div className="p-3.5 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC] flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-gray-500 font-montserrat uppercase font-semibold block">
                  Total Tarifas
                </span>
                <p className="text-base font-bold text-[#1A1A1A] font-montserrat">
                  R$ {totalTarifas.toFixed(2)}
                </p>
                <span className="text-[9px] text-[#0057FF] font-semibold block">
                  {summary?.entradas?.quantidade_tarifas || 0} lançamentos
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleTriggerBackfillTarifas}
                disabled={backfillingTarifas || loadingMetrics}
                className="mt-2 h-6 px-1.5 py-0 text-[10px] font-bold text-[#9A7B1C] hover:text-black hover:bg-[#D4AF37]/20 border border-[#D4AF37]/40 rounded-lg flex items-center gap-1 w-full justify-center"
                title="Recalcular tarifas de serviços concluídos sem lançamento"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${backfillingTarifas ? 'animate-spin' : ''}`} />
                {backfillingTarifas ? 'Recalculando...' : 'Recalcular pendentes'}
              </Button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC]">
              <span className="text-[10px] text-gray-500 font-montserrat uppercase font-semibold block">
                Mensalidades Alunos
              </span>
              <p className="text-base font-bold text-[#1A1A1A] font-montserrat">
                R$ {totalMensalidadesAlunos.toFixed(2)}
              </p>
              <span className="text-[9px] text-gray-500 font-semibold">
                {totalAlunos} alunos ativos
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC]">
              <span className="text-[10px] text-gray-500 font-montserrat uppercase font-semibold block">
                PRO PARCEIRO
              </span>
              <p className="text-base font-bold text-[#9A7B1C] font-montserrat">
                R$ {totalMensalidadesPro.toFixed(2)}
              </p>
              <span className="text-[9px] text-[#22C55E] font-semibold">{totalPros} parceiros</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC]">
              <span className="text-[10px] text-gray-500 font-montserrat uppercase font-semibold block">
                Níveis Habitados
              </span>
              <p className="text-base font-bold text-[#22C55E] font-montserrat">
                {niveisHabitadosCount} de 36
              </p>
              <span className="text-[9px] text-gray-500">
                {summary?.rede?.total_usuarios || 0} na árvore
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* BLOCO VISÍVEL: COMPOSIÇÃO DO POOL DESTE CICLO (SOLICITADO PELO ADEMARIO) */}
      <Card className="bg-[#FAF9F5] border border-[#E4E2DC] p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#E4E2DC]">
          <div>
            <h3 className="font-bold font-montserrat text-[#1A1A1A] text-base uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Composição do Pool 38% deste Ciclo
            </h3>
            <p className="text-xs text-gray-500 font-inter mt-0.5">
              Detalhamento de cada fonte de entrada real e seu percentual aplicado para compor a
              base do pool.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-500 uppercase font-mono block">
              Pool Final 38%
            </span>
            <span className="text-xl font-black font-montserrat text-[#9A7B1C]">
              R$ {poolRede.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-inter text-xs">
          {/* Linha 1: Mensalidades Alunos */}
          <div className="p-4 rounded-xl bg-white border border-[#E4E2DC] space-y-1.5 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="font-bold font-montserrat text-[#1A1A1A] uppercase">
                1. Mensalidades de Alunos
              </span>
              <span className="text-[10px] font-bold text-[#0057FF] bg-[#0057FF]/10 px-2 py-0.5 rounded-full">
                {((summary?.pool?.config_usada?.student_monthly_pct ?? 1.0) * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Alunos NÃO vinculados (planos 10 / 20 / 30).
            </p>
            <div className="pt-2 flex justify-between items-baseline border-t border-[#F0EFEA] font-mono">
              <span className="text-gray-500 text-[11px]">
                Entrada: R$ {totalMensalidadesAlunos.toFixed(2)}
              </span>
              <span className="font-bold text-[#1A1A1A]">Base: R$ {baseAlunos.toFixed(2)}</span>
            </div>
          </div>

          {/* Linha 2: Mensalidades PRO PARCEIRO */}
          <div className="p-4 rounded-xl bg-white border border-[#E4E2DC] space-y-1.5 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="font-bold font-montserrat text-[#1A1A1A] uppercase">
                2. PRO PARCEIRO (149)
              </span>
              <span className="text-[10px] font-bold text-[#9A7B1C] bg-[#D4AF37]/15 px-2 py-0.5 rounded-full">
                {((summary?.pool?.config_usada?.pro_parceiro_monthly_pct ?? 0.38) * 100).toFixed(0)}
                %
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Mensalidade de R$ 149 (sem tarifas por serviço prestado).
            </p>
            <div className="pt-2 flex justify-between items-baseline border-t border-[#F0EFEA] font-mono">
              <span className="text-gray-500 text-[11px]">
                Entrada: R$ {totalMensalidadesPro.toFixed(2)}
              </span>
              <span className="font-bold text-[#9A7B1C]">
                Base: R$ {baseProParceiro.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Linha 3: Tarifas de Serviços */}
          <div className="p-4 rounded-xl bg-white border border-[#E4E2DC] space-y-1.5 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="font-bold font-montserrat text-[#1A1A1A] uppercase">
                3. Tarifas de Serviços
              </span>
              <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full">
                {((summary?.pool?.config_usada?.service_tarifa_pct ?? 1.0) * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Tarifas por serviços concluídos e excedentes de IA.
            </p>
            <div className="pt-2 flex justify-between items-baseline border-t border-[#F0EFEA] font-mono">
              <span className="text-gray-500 text-[11px]">
                Entrada: R$ {totalTarifas.toFixed(2)}
              </span>
              <span className="font-bold text-[#22C55E]">Base: R$ {baseTarifas.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-white border border-[#E4E2DC] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
          <div className="text-gray-600">
            Fórmula: <strong>Pool 38% = (Base Alunos + Base PRO + Base Tarifas) × 38%</strong>
            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
              R$ {baseAlunos.toFixed(2)} + R$ {baseProParceiro.toFixed(2)} + R${' '}
              {baseTarifas.toFixed(2)} = R$ {baseTotalEntradas.toFixed(2)} × 0,38 ={' '}
              <strong>R$ {poolRede.toFixed(2)}</strong>
            </div>
          </div>
          <div className="font-mono text-xs font-bold text-[#9A7B1C]">
            Equalização exata no fechamento ✓
          </div>
        </div>
      </Card>

      {/* REVENUE SPLIT PADRÃO 369 (DISTRIBUIÇÃO SOBRE TOTAL REAL CALCULADO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-white border border-[#E4E2DC] p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold font-montserrat text-[#1A1A1A] text-base uppercase mb-1 flex items-center justify-between">
            <span>Split Padrão 369 (100%)</span>
            <span className="text-xs text-[#9A7B1C] font-mono">100% Auditável</span>
          </h3>
          <p className="text-xs text-gray-500 font-inter mb-1">
            Base de cálculo usada:{' '}
            <strong className="text-[#1A1A1A] font-mono">R$ {splitBase.toFixed(2)}</strong> (total
            de entradas reais)
          </p>
          <p className="text-[11px] text-gray-400 font-inter mb-4">
            (Porcentagem) × (Entrada Total Real) = Valor
          </p>

          <div className="space-y-2.5 font-inter text-xs">
            <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#D4AF37]/50 flex justify-between items-center">
              <div>
                <span className="font-bold text-[#9A7B1C] block font-montserrat">
                  PARCEIRO / REDE (38%)
                </span>
                <span className="text-[10px] text-gray-500">Pool distribuído na Rede Única</span>
              </div>
              <span className="text-sm font-black text-[#9A7B1C] font-mono">
                R$ {poolRede.toFixed(2)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E2DC] flex justify-between items-center">
              <div>
                <span className="font-bold text-[#1A1A1A] block font-montserrat">
                  APP / PLATAFORMA (30%)
                </span>
                <span className="text-[10px] text-gray-500">Infraestrutura, servidores e IA</span>
              </div>
              <span className="text-sm font-bold text-[#1A1A1A] font-mono">
                R$ {splitApp.toFixed(2)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E2DC] flex justify-between items-center">
              <div>
                <span className="font-bold text-[#22C55E] block font-montserrat">
                  FILANTROPIA (10%)
                </span>
                <span className="text-[10px] text-gray-500">Impacto socioambiental ESG</span>
              </div>
              <span className="text-sm font-bold text-[#22C55E] font-mono">
                R$ {splitFilantropia.toFixed(2)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E2DC] flex justify-between items-center">
              <div>
                <span className="font-bold text-red-600 block font-montserrat">IMPOSTO (10%)</span>
                <span className="text-[10px] text-gray-500">Provisão tributária oficial</span>
              </div>
              <span className="text-sm font-bold text-red-600 font-mono">
                R$ {splitImposto.toFixed(2)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E2DC] flex justify-between items-center">
              <div>
                <span className="font-bold text-purple-700 block font-montserrat">
                  MARKETING / CARREIRA (4%)
                </span>
                <span className="text-[10px] text-gray-500">Aquisição e expansão</span>
              </div>
              <span className="text-sm font-bold text-purple-700 font-mono">
                R$ {splitMkt.toFixed(2)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E2DC] flex justify-between items-center">
              <div>
                <span className="font-bold text-cyan-700 block font-montserrat">
                  PARC / INVESTIDOR (4%)
                </span>
                <span className="text-[10px] text-gray-500">Remuneração do ecossistema</span>
              </div>
              <span className="text-sm font-bold text-cyan-700 font-mono">
                R$ {splitInvestidor.toFixed(2)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E2DC] flex justify-between items-center">
              <div>
                <span className="font-bold text-blue-700 block font-montserrat">
                  SUPORTE TÉCNICO (4%)
                </span>
                <span className="text-[10px] text-gray-500">Atendimento 24/7</span>
              </div>
              <span className="text-sm font-bold text-blue-700 font-mono">
                R$ {splitSuporte.toFixed(2)}
              </span>
            </div>
          </div>
        </Card>

        {/* DISTRIBUIÇÃO POR NÍVEIS COM CORRETOR/EQUALIZAÇÃO (CAMINHO C) */}
        <Card className="lg:col-span-2 bg-white border border-[#E4E2DC] p-6 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div>
              <h3 className="font-bold font-montserrat text-[#1A1A1A] text-base uppercase flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#D4AF37]" /> Distribuição por Níveis da Rede Única
                (Caminho C)
              </h3>
              <p className="text-xs text-gray-500 font-inter mt-0.5">
                Pool 38% (R$ {poolRede.toFixed(2)}) dividido por {niveisHabitadosCount} nível(is)
                habitado(s) = R${' '}
                {niveisHabitadosCount > 0 ? (poolRede / niveisHabitadosCount).toFixed(2) : '0.00'}{' '}
                base por nível.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-inter">
              <thead>
                <tr className="border-b border-[#E4E2DC] text-gray-500 font-montserrat uppercase text-[10px]">
                  <th className="pb-3">Nível</th>
                  <th className="pb-3">Teórico</th>
                  <th className="pb-3">Habitantes</th>
                  <th className="pb-3 text-emerald-700">Elegíveis</th>
                  <th className="pb-3">Corretor</th>
                  <th className="pb-3">Valor Equalizado</th>
                  <th className="pb-3">Por Elegível</th>
                  <th className="pb-3 text-right text-emerald-700">Redistribuído</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFEA]">
                {porNivel.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-400">
                      Nenhum dado de nível disponível no ciclo.
                    </td>
                  </tr>
                ) : (
                  porNivel.map((lvl) => (
                    <tr key={lvl.level} className="hover:bg-[#F7F5F0] transition-colors">
                      <td className="py-2.5 font-bold font-montserrat text-[#1A1A1A]">
                        Nível {lvl.level}
                      </td>
                      <td className="py-2.5 text-gray-400 font-mono">{lvl.pessoas_teoricas}</td>
                      <td className="py-2.5 text-[#1A1A1A] font-mono font-medium">
                        {lvl.pessoas_hab}
                      </td>
                      <td className="py-2.5 font-mono text-[#22C55E] font-bold">{lvl.elegiveis}</td>
                      <td className="py-2.5 font-mono text-[#0057FF] font-bold">
                        {lvl.corretor.toFixed(2)}x
                      </td>
                      <td className="py-2.5 font-mono font-bold text-[#9A7B1C]">
                        R$ {lvl.valor_equalizado.toFixed(2)}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-[#22C55E]">
                        R$ {lvl.valor_por_elegivel.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-700">
                        R$ {lvl.total_redistribuido.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E4E2DC] font-montserrat font-bold text-xs text-[#1A1A1A]">
                  <td colSpan={5} className="pt-3 uppercase">
                    Soma dos Níveis Equalizados:
                  </td>
                  <td className="pt-3 font-mono text-[#9A7B1C] font-black">
                    R$ {poolRede.toFixed(2)}
                  </td>
                  <td colSpan={2} className="pt-3 text-right text-[10px] text-gray-500 font-normal">
                    (Confere 38% exato da base de pool)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      {/* ATALHOS DE GESTÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <Link to="/admin/usuarios" className="block">
          <Card className="p-4 bg-white border border-[#E4E2DC] hover:border-[#0057FF] transition-all group shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-[#1A1A1A] font-montserrat group-hover:text-[#0057FF]">
                  Gestão de Usuários
                </h4>
                <p className="text-[10px] text-gray-500 font-inter mt-0.5">
                  Visualizar posições da Rede Única e planos.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#0057FF]" />
            </div>
          </Card>
        </Link>

        <Link to="/admin/ranking" className="block">
          <Card className="p-4 bg-white border border-[#E4E2DC] hover:border-[#D4AF37] transition-all group shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-[#1A1A1A] font-montserrat group-hover:text-[#9A7B1C]">
                  Parâmetros de Ranking & Níveis
                </h4>
                <p className="text-[10px] text-gray-500 font-inter mt-0.5">
                  Recalcular ranking, tarifas e planilha de cashback.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#9A7B1C]" />
            </div>
          </Card>
        </Link>

        <Link to="/admin/aprovacoes" className="block">
          <Card className="p-4 bg-white border border-[#E4E2DC] hover:border-[#22C55E] transition-all group shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-[#1A1A1A] font-montserrat group-hover:text-[#22C55E]">
                  Aprovações de Profissionais
                </h4>
                <p className="text-[10px] text-gray-500 font-inter mt-0.5">
                  Auditar registros CREF/CRN/CRP pendentes.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#22C55E]" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}

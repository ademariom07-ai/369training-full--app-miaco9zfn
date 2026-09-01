import React, { useState, useEffect } from 'react'
import { useAuth, PlanTier } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { WalletTransactionRecord, ServiceRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  Copy,
  Clock,
  CheckCircle2,
  Trophy,
  Award,
  Sparkles,
  TrendingUp,
  Percent,
  Layers,
  Calendar,
  AlertCircle,
  DollarSign,
  Users,
  Activity,
  History,
  ShieldCheck,
  ChevronRight,
  Loader2,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { ALL_PLANS } from '@/components/PlanChangeSection'

export interface StandardWalletProps {
  role: 'aluno' | 'profissional'
}

export function StandardWalletPage({ role }: StandardWalletProps) {
  const { user, refreshUser } = useAuth()

  // 8 BLOCOS PADRONIZADOS:
  // 1. Pontuação Atual (soma dos pontos de todos os meses anteriores fechados)
  const [pontuacaoAtual, setPontuacaoAtual] = useState<number>(0)
  // 2. Pontuação Mensal (soma dos pontos do mês corrente)
  const [pontuacaoMensal, setPontuacaoMensal] = useState<number>(0)
  // 3. Posição no Ranking (pontuação total = atual + mensal)
  const [posicaoRanking, setPosicaoRanking] = useState<number>(1)
  const [pontuacaoTotal, setPontuacaoTotal] = useState<number>(0)
  // 4. Cashback do Mês (previsão conforme ranking e rede, disponível no fechamento)
  const [cashbackPrevisaoMes, setCashbackPrevisaoMes] = useState<number>(0)
  // 5. Resgatar Cashback (saldo de cashback disponível para resgate ESG)
  const [cashbackDisponivel, setCashbackDisponivel] = useState<number>(0)
  // 6. Saque e Depósito (saldo líquido disponível e movimentação PIX)
  const [saldoDisponivel, setSaldoDisponivel] = useState<number>(0)
  // 7. Indicação (validadas e pendentes)
  const [indicacoesValidadas, setIndicacoesValidadas] = useState<number>(0)
  const [indicacoesPendentes, setIndicacoesPendentes] = useState<number>(0)
  // 8. Serviços/Aulas (histórico consumido pelo aluno ou vendido pelo profissional)
  const [servicosCountMes, setServicosCountMes] = useState<number>(0)
  const [servicosHistorico, setServicosHistorico] = useState<ServiceRecord[]>([])

  // Transações gerais
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([])
  const [snapshotsHistory, setSnapshotsHistory] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Modais de PIX Depósito e Saque
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('100.00')
  const [comprovanteBase64, setComprovanteBase64] = useState('')
  const [comprovanteFileName, setComprovanteFileName] = useState('')
  const [submittingDeposit, setSubmittingDeposit] = useState(false)

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('50.00')
  const [pixKeyType, setPixKeyType] = useState('CPF')
  const [pixKeyValue, setPixKeyValue] = useState('')
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false)

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  const pixKeyFicticia = '369training@pagamento.com'
  const titularFicticio = '369TRAINING LTDA'

  const userPlan = (user?.plan || 'gratis').toLowerCase()
  const isGratis = userPlan === 'gratis'

  // Multiplicador vigente
  const planMultiplier =
    userPlan === 'premium' ? 3.0 : userPlan === 'pro' ? 2.0 : userPlan === 'basico' ? 1.0 : 0.0

  const loadAllWalletData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const now = new Date()
      const currentCycle = now.toISOString().slice(0, 7)
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .replace('T', ' ')

      // 1. Transações de Carteira (saldo + cashback)
      const txRes = await pb
        .collection('wallet_transactions')
        .getList<WalletTransactionRecord>(1, 100, {
          filter: `user = "${user.id}"`,
          sort: '-created',
        })
      setTransactions(txRes.items)

      let calcSaldo = 0
      let calcCashDisponivel = 0
      txRes.items.forEach((t) => {
        const amt = Number(t.amount) || 0
        const status = String(t.status || '')
        const txType = String(t.type || '')
        if (status === 'concluido' || status === 'aprovado') {
          if (txType === 'deposito' || txType === 'cashback' || txType === 'bonus_indicacao') {
            calcSaldo += amt
          } else if (
            txType === 'saque' ||
            txType === 'tarifa' ||
            txType === 'pagamento' ||
            txType === 'servico'
          ) {
            calcSaldo += amt // amount já pode vir negativo
          }
          if (txType === 'cashback' || txType === 'bonus_indicacao') {
            calcCashDisponivel += Math.max(0, amt)
          }
        }
      })
      setSaldoDisponivel(calcSaldo > 0 ? calcSaldo : 0)
      setCashbackDisponivel(calcCashDisponivel)

      // 2. Snapshots Mensais Fechados Anteriores (Bloco 1: Pontuação Atual)
      let pastPointsSum = 0
      try {
        const snapRes = await pb.collection('monthly_rank_snapshots').getList(1, 100, {
          filter: `user = "${user.id}" && cycle != "${currentCycle}"`,
          sort: '-cycle',
        })
        setSnapshotsHistory(snapRes.items)
        snapRes.items.forEach((s: any) => {
          pastPointsSum += Number(s.points) || 0
        })
      } catch (_) {
        pastPointsSum = 0
      }
      setPontuacaoAtual(pastPointsSum)

      // 3. Serviços do Mês Corrente (Bloco 8)
      const servFilter =
        role === 'profissional'
          ? `professional = "${user.id}" && status = "concluido"`
          : `student = "${user.id}" && status = "concluido"`

      let servsThisMonthCount = 0
      try {
        const sRes = await pb.collection('services').getList<ServiceRecord>(1, 100, {
          filter: servFilter,
          sort: '-created',
        })
        setServicosHistorico(sRes.items)
        sRes.items.forEach((s) => {
          if (s.created >= currentMonthStart) {
            servsThisMonthCount++
          }
        })
      } catch (_) {
        servsThisMonthCount = 0
      }
      setServicosCountMes(servsThisMonthCount)

      // 4. Indicações (Bloco 7: Validadas e Pendentes)
      let valCount = 0
      let pendCount = 0
      let cycleRefCount = 0
      try {
        const refRes = await pb.collection('referrals').getList(1, 100, {
          filter: `referrer = "${user.id}"`,
          sort: '-created',
        })
        refRes.items.forEach((r: any) => {
          if (r.status === 'validated') {
            valCount++
          } else {
            pendCount++
          }
          if (r.created >= currentMonthStart) {
            cycleRefCount++
          }
        })
      } catch (_) {
        valCount = 0
        pendCount = 0
      }
      setIndicacoesValidadas(valCount)
      setIndicacoesPendentes(pendCount)

      // 5. Pontuação do Mês Vigente (Bloco 2)
      // FÓRMULA CAMINHO C: (PLANO) x (SERVIÇOS) x (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
      // Plano Grátis = 0x → NÃO pontua!
      const avaliacao = Math.round(Number(user.rating_avg || 5))
      const createdDate = user.created ? new Date(user.created) : new Date()
      const diffMonths = Math.max(
        1,
        Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
      )
      const antiguidade = Math.min(diffMonths, 10)

      let calcMesPoints = 0
      if (planMultiplier > 0) {
        const indFator = Math.max(cycleRefCount, 1)
        calcMesPoints =
          Math.round(planMultiplier * servsThisMonthCount * indFator) + avaliacao + antiguidade
      } else {
        calcMesPoints = 0 // Grátis = 0 pts
      }
      setPontuacaoMensal(calcMesPoints)

      // 6. Pontuação Total & Posição no Ranking (Bloco 3)
      const totPts = pastPointsSum + calcMesPoints
      setPontuacaoTotal(totPts)

      if (isGratis) {
        setPosicaoRanking(0) // Não aparece no ranking
      } else {
        try {
          const rankEntry = await pb
            .collection('rank_entries')
            .getFirstListItem(`user = "${user.id}"`)
          setPosicaoRanking(rankEntry.ranking_position || 1)
        } catch (_) {
          const simulatedPos = Math.max(1, Math.min(100, 50 - Math.floor(totPts / 20)))
          setPosicaoRanking(simulatedPos)
        }
      }

      // 7. Cashback do Mês (Bloco 4: Previsão do Fechamento)
      if (isGratis) {
        setCashbackPrevisaoMes(0)
      } else {
        // Estimativa baseada no pool 38% e na posição / nível
        const estimativaPoolShare = servsThisMonthCount * (planMultiplier || 1) * 2.5 + valCount * 5
        setCashbackPrevisaoMes(Number(estimativaPoolShare.toFixed(2)))
      }
    } catch (err) {
      console.error('Erro ao carregar carteira padronizada:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllWalletData()
  }, [user, role])

  // Submissão de Depósito PIX
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const amt = parseFloat(depositAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Informe um valor de depósito válido.')
      return
    }

    setSubmittingDeposit(true)
    try {
      await pb.collection('wallet_transactions').create({
        user: user.id,
        type: 'deposito',
        amount: amt,
        status: 'pendente',
        pix_code: pixKeyFicticia,
        description: `Depósito PIX ${comprovanteFileName ? `(Comprovante: ${comprovanteFileName})` : ''}`,
      })

      toast.success(
        'Depósito enviado para validação administrativa! Em breve seu saldo será creditado.',
      )
      setIsDepositModalOpen(false)
      loadAllWalletData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar depósito.')
    } finally {
      setSubmittingDeposit(false)
    }
  }

  // Submissão de Saque PIX
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const amt = parseFloat(withdrawAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Informe um valor de saque válido.')
      return
    }
    if (amt > saldoDisponivel) {
      toast.error(`Saldo insuficiente. Saldo disponível: R$ ${saldoDisponivel.toFixed(2)}`)
      return
    }
    if (!pixKeyValue.trim()) {
      toast.error('Informe sua chave PIX para transferência.')
      return
    }

    setSubmittingWithdraw(true)
    try {
      await pb.collection('wallet_transactions').create({
        user: user.id,
        type: 'saque',
        amount: -amt,
        status: 'pendente',
        pix_code: `${pixKeyType}: ${pixKeyValue}`,
        description: `Solicitação de Saque PIX (${pixKeyType}: ${pixKeyValue})`,
      })

      toast.success('Solicitação de saque via PIX enviada com sucesso!')
      setIsWithdrawModalOpen(false)
      loadAllWalletData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar saque.')
    } finally {
      setSubmittingWithdraw(false)
    }
  }

  // Evolução rápida de plano (permitida a qualquer momento a partir do Grátis)
  const handleUpgradePlan = async (targetPlan: 'basico' | 'pro' | 'premium') => {
    if (!user) return
    setUpgrading(true)
    try {
      await pb.collection('users').update(user.id, {
        plan: targetPlan,
        plan_upgraded_at: new Date().toISOString(),
      })
      await refreshUser()
      toast.success(
        `Parabéns! Você evoluiu para o Plano ${targetPlan.toUpperCase()}. Sua pontuação e cashback agora estão ativos!`,
      )
      setIsUpgradeModalOpen(false)
      loadAllWalletData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao evoluir plano.')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Padronizado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <Wallet className="w-3.5 h-3.5" />
            Ecossistema Financeiro & Ranking 369
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            {role === 'aluno'
              ? 'Carteira, Ranking & Cashback (Aluno)'
              : 'Carteira, Ranking & Cashback (Profissional)'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-inter mt-1">
            Padronização 369TRAINING:{' '}
            <strong className="text-white">
              (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO + ANTIGUIDADE
            </strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {isGratis && (
            <Button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="bg-gradient-to-r from-[#D4AF37] to-[#F4D77A] text-black font-extrabold text-xs uppercase px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.3)] animate-pulse"
            >
              <Sparkles className="w-4 h-4 mr-1" /> Ativar Ranking (Evoluir Plano)
            </Button>
          )}
          <Button
            onClick={() => setIsWithdrawModalOpen(true)}
            variant="outline"
            className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 font-bold text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4" /> Saque PIX
          </Button>
          <Button
            onClick={() => setIsDepositModalOpen(true)}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md"
          >
            <QrCode className="w-4 h-4" /> Depósito PIX
          </Button>
        </div>
      </div>

      {/* BANNER AVISO PLANO GRÁTIS */}
      {isGratis && (
        <Card className="bg-amber-950/30 border border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-200 uppercase font-montserrat">
                Você está no Plano Grátis (Multiplicador 0.0x)
              </h4>
              <p className="text-[11px] text-gray-300 font-inter">
                O aluno do plano grátis tem acesso aos recursos básicos, porém{' '}
                <strong>não pontua no ranking</strong> e{' '}
                <strong>não recebe cashback de rede</strong>. Evolua para o plano Básico, Pro ou
                Premium a qualquer momento para começar a pontuar imediatamente!
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase px-4 py-2 shrink-0 rounded-xl"
          >
            Evoluir Agora
          </Button>
        </Card>
      )}

      {/* OS 8 BLOCOS PADRONIZADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* BLOCO 1: Pontuação Atual (Meses Anteriores Fechados) */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              1. Pontuação Atual
            </span>
            <History className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-montserrat tracking-tight">
            {pontuacaoAtual.toLocaleString('pt-BR')}{' '}
            <span className="text-xs text-[#D4AF37] font-bold">PTS</span>
          </p>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            Soma dos meses anteriores fechados ({snapshotsHistory.length} fechamentos)
          </span>
        </Card>

        {/* BLOCO 2: Pontuação Mensal (Mês Vigente) */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              2. Pontuação Mensal
            </span>
            <Calendar className="w-4 h-4 text-[#0057FF]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#0057FF] font-montserrat tracking-tight">
            {isGratis ? 0 : pontuacaoMensal.toLocaleString('pt-BR')}{' '}
            <span className="text-xs text-gray-400 font-bold">PTS</span>
          </p>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            {isGratis ? 'Plano Grátis (0x - Sem pontos)' : `Ciclo atual • Mult. ${planMultiplier}x`}
          </span>
        </Card>

        {/* BLOCO 3: Posição no Ranking (Atual + Mensal) */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              3. Posição no Ranking
            </span>
            <Trophy className="w-4 h-4 text-[#22C55E]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#22C55E] font-montserrat tracking-tight">
            {isGratis ? '—' : `#${posicaoRanking}`}
          </p>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            {isGratis
              ? 'Não listado (Plano Grátis)'
              : `Pontuação Total: ${pontuacaoTotal.toLocaleString('pt-BR')} pts`}
          </span>
        </Card>

        {/* BLOCO 4: Cashback do Mês (Disponível no Fechamento) */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              4. Cashback do Mês
            </span>
            <Percent className="w-4 h-4 text-[#FF7A00]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#FF7A00] font-montserrat tracking-tight">
            R$ {cashbackPrevisaoMes.toFixed(2)}
          </p>
          <span className="text-[10px] text-amber-400 font-inter mt-1 block flex items-center gap-1">
            <Clock className="w-3 h-3" /> Calculado no último dia do mês
          </span>
        </Card>

        {/* BLOCO 5: Resgatar Cashback (Disponível ESG) */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              5. Resgatar Cashback
            </span>
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#D4AF37] font-montserrat tracking-tight">
            R$ {cashbackDisponivel.toFixed(2)}
          </p>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            Liberado conforme regras gerais & ESG
          </span>
        </Card>

        {/* BLOCO 6: Saque e Depósito (Saldo em Conta) */}
        <Card className="bg-gradient-to-br from-[#181818] to-[#121212] border-2 border-[#D4AF37]/50 p-5 rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.15)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-[#D4AF37] font-montserrat uppercase font-extrabold">
              6. Saque e Depósito
            </span>
            <Wallet className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-montserrat tracking-tight">
            R$ {saldoDisponivel.toFixed(2)}
          </p>
          <span className="text-[10px] text-[#22C55E] font-inter mt-1 block">
            Saldo líquido disponível para PIX
          </span>
        </Card>

        {/* BLOCO 7: Indicações (Validadas & Pendentes) */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              7. Indicações
            </span>
            <Users className="w-4 h-4 text-[#0057FF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-montserrat">
              {indicacoesValidadas}
            </span>
            <span className="text-xs text-[#22C55E] font-bold">Validadas</span>
            <span className="text-xs text-gray-500 font-normal">/ {indicacoesPendentes} pend.</span>
          </div>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            Código:{' '}
            <strong className="text-[#D4AF37] font-mono">{user?.referral_code || '369REF'}</strong>
          </span>
        </Card>

        {/* BLOCO 8: Serviços / Aulas (Histórico) */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              8. Serviços & Aulas
            </span>
            <Activity className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-montserrat">
              {servicosCountMes}
            </span>
            <span className="text-xs text-[#22C55E] font-bold">este mês</span>
            <span className="text-xs text-gray-500 font-normal">
              ({servicosHistorico.length} total)
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            {role === 'aluno' ? 'Aulas e treinos consumidos' : 'Atendimentos validados'}
          </span>
        </Card>
      </div>

      {/* EXPLICATIVO DO CAMINHO C & MULTIPLICADORES */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <h3 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          Regra de Pontuação Caminho C: (PLANO) × (SERVIÇOS) × (INDICAÇÕES) + AVALIAÇÃO +
          ANTIGUIDADE
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-inter text-gray-300">
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1">
            <strong className="text-gray-400 font-montserrat block">Plano Grátis (0x)</strong>
            <p className="text-gray-500">
              Multiplicador 0x. O aluno não pontua e não concorre no ranking. Evolução liberada a
              qualquer momento.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1">
            <strong className="text-[#22C55E] font-montserrat block">Plano Básico (1.0x)</strong>
            <p className="text-gray-400">
              Multiplicador base 1.0x. Pontua 1 ponto por serviço × indicação + avaliação e
              antiguidade.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1">
            <strong className="text-[#0057FF] font-montserrat block">Plano Pro (2.0x)</strong>
            <p className="text-gray-400">
              Multiplicador 2.0x. Pontuação acelerada em 2 vezes em todos os serviços do mês.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1">
            <strong className="text-[#D4AF37] font-montserrat block">Plano Premium (3.0x)</strong>
            <p className="text-gray-400">
              Multiplicador 3.0x. Aceleração máxima no ranking (3x mais rápido) e IA ilimitada.
            </p>
          </div>
        </div>
      </Card>

      {/* HISTÓRICO DE SNAPSHOTS MENSAIS FECHADOS */}
      {snapshotsHistory.length > 0 && (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-[#D4AF37]" /> Histórico de Fechamentos Mensais
            (Snapshots)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-inter">
              <thead>
                <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                  <th className="pb-3">Ciclo</th>
                  <th className="pb-3">Plano</th>
                  <th className="pb-3">Serviços</th>
                  <th className="pb-3">Indicações</th>
                  <th className="pb-3">Posição Final</th>
                  <th className="pb-3 text-right">Pontos Fechados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {snapshotsHistory.map((s: any) => (
                  <tr key={s.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-3 font-mono font-bold text-white">{s.cycle}</td>
                    <td className="py-3 font-montserrat uppercase text-gray-300">
                      {s.plan || 'BÁSICO'}
                    </td>
                    <td className="py-3 text-gray-300">{s.services_count || 0}</td>
                    <td className="py-3 text-gray-300">{s.referrals_count || 0}</td>
                    <td className="py-3 text-[#22C55E] font-bold">#{s.ranking_position || '—'}</td>
                    <td className="py-3 text-right font-mono font-bold text-[#D4AF37]">
                      +{Number(s.points || 0).toLocaleString('pt-BR')} PTS
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* EXTRATO DE MOVIMENTAÇÕES FINANCEIRAS */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold font-montserrat text-white text-base uppercase">
            Extrato Financeiro & Transações
          </h3>
          <span className="text-xs text-gray-400 font-mono">{transactions.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-inter">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                <th className="pb-3">Tipo</th>
                <th className="pb-3">Descrição / Referência</th>
                <th className="pb-3">Data</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    Nenhuma movimentação financeira registrada.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isPositive = Number(t.amount) > 0
                  return (
                    <tr key={t.id} className="hover:bg-[#141414] transition-colors">
                      <td className="py-3 font-semibold capitalize font-montserrat text-white flex items-center gap-1.5">
                        {isPositive ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-[#22C55E]" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                        )}
                        {t.type}
                      </td>
                      <td className="py-3 text-gray-300">{t.description || t.type}</td>
                      <td className="py-3 text-gray-400 font-mono text-[10px]">
                        {new Date(t.created).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            String(t.status) === 'concluido' || String(t.status) === 'aprovado'
                              ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30'
                              : 'bg-amber-900/30 text-amber-300 border border-amber-600/30'
                          }`}
                        >
                          {String(t.status)}
                        </span>
                      </td>
                      <td
                        className={`py-3 text-right font-mono font-bold ${
                          isPositive ? 'text-[#22C55E]' : 'text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : ''} R$ {Math.abs(Number(t.amount)).toFixed(2)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DEPÓSITO PIX */}
      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#D4AF37]" /> Adicionar Saldo via PIX
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Pague via chave PIX e envie seu comprovante para liberação imediata.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDepositSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Valor do Depósito (R$) *
              </label>
              <Input
                type="number"
                min="10"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-[#181818] border-[#2A2A2A] text-white font-mono text-base rounded-xl"
                required
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Chave PIX (E-mail):</span>
                <span className="text-white font-mono font-bold">{pixKeyFicticia}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Favorecido:</span>
                <span className="text-gray-300 font-montserrat">{titularFicticio}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(pixKeyFicticia)
                  toast.success('Chave PIX copiada!')
                }}
                className="w-full border-[#2A2A2A] text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs font-bold mt-1"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Chave PIX
              </Button>
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDepositModalOpen(false)}
                className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingDeposit}
                className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase rounded-xl flex items-center gap-2"
              >
                {submittingDeposit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirmar Depósito'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL SAQUE PIX */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-[#D4AF37]" /> Solicitar Saque via PIX
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Transfira seu saldo disponível diretamente para sua conta bancária.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWithdrawSubmit} className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] flex justify-between items-center text-xs">
              <span className="text-gray-400">Saldo Disponível:</span>
              <span className="text-[#D4AF37] font-bold font-mono text-sm">
                R$ {saldoDisponivel.toFixed(2)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Valor do Saque (R$) *
              </label>
              <Input
                type="number"
                min="10"
                max={saldoDisponivel}
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="bg-[#181818] border-[#2A2A2A] text-white font-mono text-base rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Tipo
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="w-full h-10 px-2 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value="CPF">CPF</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="TELEFONE">Celular</option>
                  <option value="ALEATORIA">Aleatória</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Sua Chave PIX *
                </label>
                <Input
                  value={pixKeyValue}
                  onChange={(e) => setPixKeyValue(e.target.value)}
                  placeholder="Informe a chave exata"
                  className="bg-[#181818] border-[#2A2A2A] text-white text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingWithdraw || saldoDisponivel <= 0}
                className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase rounded-xl flex items-center gap-2"
              >
                {submittingWithdraw ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirmar Saque'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EVOLUÇÃO DE PLANO */}
      <Dialog open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Evolução de Plano 369
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Evolua a partir do plano Grátis a qualquer momento e comece a pontuar imediatamente no
              ranking!
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-2">
            {[
              {
                id: 'basico' as const,
                name: 'BÁSICO (1.0x)',
                desc: 'Multiplicador 1.0x • R$ 1,00/serviço • Entrada no Ranking',
                color: 'border-gray-600 hover:border-[#22C55E]',
                badge: '1x Pontuação',
              },
              {
                id: 'pro' as const,
                name: 'PRO (2.0x)',
                desc: 'Multiplicador 2.0x • R$ 2,00/serviço • Acelere 2x no Ranking',
                color: 'border-[#0057FF]/50 hover:border-[#0057FF]',
                badge: '2x Mais Rápido',
              },
              {
                id: 'premium' as const,
                name: 'PREMIUM (3.0x)',
                desc: 'Multiplicador 3.0x • R$ 3,00/serviço • IA Ilimitada e Máxima Visibilidade',
                color: 'border-[#D4AF37]/60 hover:border-[#D4AF37]',
                badge: '3x Aceleração Máxima',
              },
            ].map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-xl bg-[#181818] border ${p.color} flex items-center justify-between transition-all`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm font-montserrat text-white">
                      {p.name}
                    </span>
                    <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-0 text-[10px] font-bold">
                      {p.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 font-inter mt-1">{p.desc}</p>
                </div>
                <Button
                  onClick={() => handleUpgradePlan(p.id)}
                  disabled={upgrading}
                  className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase shrink-0"
                >
                  {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Escolher'}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUpgradeModalOpen(false)}
              className="border-[#2A2A2A] text-gray-400 text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

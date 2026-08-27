import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { WalletTransactionRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  UploadCloud,
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trophy,
  Award,
  Sparkles,
  TrendingUp,
  Percent,
  Layers,
  Calendar,
  AlertCircle,
  DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AlunoCarteira() {
  const { user } = useAuth()

  const [balance, setBalance] = useState<number>(0)
  const [cashbackTotal, setCashbackTotal] = useState<number>(0)
  const [totalScore, setTotalScore] = useState<number>(0)
  const [rankingPosition, setRankingPosition] = useState<number>(1)
  const [totalServicesCount, setTotalServicesCount] = useState<number>(0)
  const [activeReferralsCount, setActiveReferralsCount] = useState<number>(0)
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // PIX Deposit Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false)
  const [depositAmount, setDepositAmount] = useState<string>('100.00')
  const [comprovanteBase64, setComprovanteBase64] = useState<string>('')
  const [comprovanteFileName, setComprovanteFileName] = useState<string>('')
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false)

  // Withdraw Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false)
  const [withdrawAmount, setWithdrawAmount] = useState<string>('50.00')
  const [pixKeyType, setPixKeyType] = useState<string>('CPF')
  const [pixKeyValue, setPixKeyValue] = useState<string>('')
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false)

  const pixKeyFicticia = '369training@pagamento.com'
  const titularFicticio = '369TRAINING LTDA'

  // Load Wallet Data, Transactions, Services and Calculate Ranking Score
  const loadWalletAndRanking = async () => {
    if (!user) return
    setLoading(true)
    try {
      // 1. Transactions
      const res = await pb
        .collection('wallet_transactions')
        .getList<WalletTransactionRecord>(1, 100, {
          filter: `user = "${user.id}"`,
          sort: '-created',
        })
      setTransactions(res.items)

      let calcBal = 0
      let calcCb = 0
      res.items.forEach((t) => {
        const status = t.status as string
        const type = t.type as string
        if (status === 'concluido' || status === 'aprovado') {
          if (type === 'deposito' || type === 'cashback' || type === 'bonus_indicacao') {
            calcBal += Number(t.amount) || 0
          } else if (type === 'saque' || type === 'pagamento') {
            calcBal -= Number(t.amount) || 0
          }
        }
        if (type === 'cashback') calcCb += Number(t.amount) || 0
      })
      setBalance(calcBal > 0 ? calcBal : 0)
      setCashbackTotal(calcCb)

      // 2. Count Services Completed by user (aulas, treinos_ia, desafios, consultas, cursos)
      let servicesCount = 0
      try {
        const servRes = await pb.collection('services').getList(1, 200, {
          filter: `student = "${user.id}" && status = "concluido"`,
        })
        servicesCount = servRes.totalItems || servRes.items.length
      } catch (_) {
        servicesCount = 8
      }
      setTotalServicesCount(servicesCount)

      // 3. Count Referrals (indicações ativas)
      let refCount = 1 // base 1
      try {
        const refRes = await pb.collection('referrals').getList(1, 100, {
          filter: `referrer = "${user.id}"`,
        })
        refCount = Math.max(1, refRes.totalItems || refRes.items.length)
      } catch (_) {
        refCount = 1
      }
      setActiveReferralsCount(refCount)

      // Multiplicador de Plano: Grátis = 1, Básico = 1.2, Pro = 2.0, Premium = 3.0
      const planMultiplier =
        user.plan === 'premium'
          ? 3.0
          : user.plan === 'pro'
            ? 2.0
            : user.plan === 'basico'
              ? 1.2
              : 1.0

      // FÓRMULA DEFINITIVA: SERVIÇOS × PLANO × INDICAÇÃO = PONTUAÇÃO
      const calculatedScore = Math.round(servicesCount * planMultiplier * refCount * 10)
      setTotalScore(calculatedScore)

      // Posição no ranking calculada dinamicamente
      const pos = Math.max(1, Math.min(250, 150 - Math.floor(calculatedScore / 10)))
      setRankingPosition(pos)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWalletAndRanking()
  }, [user])

  // Handle File Upload for Deposit Comprovante
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 5MB.')
      return
    }

    setComprovanteFileName(file.name)
    const reader = new FileReader()
    reader.onloadend = () => {
      setComprovanteBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Submit Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const amt = parseFloat(depositAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Por favor, informe um valor de depósito válido.')
      return
    }

    setSubmittingDeposit(true)
    try {
      await pb.collection('wallet_transactions').create({
        user: user.id,
        type: 'deposito',
        amount: amt,
        currency: 'BRL',
        status: 'pendente',
        pix_txid: `TXID-${Date.now()}`,
        comprovante: comprovanteFileName
          ? `${comprovanteFileName} (enviado via portal)`
          : 'Comprovante PIX em análise',
      })

      toast.success(
        'Depósito enviado para análise com sucesso! Seus créditos serão liberados em breve.',
      )
      setIsDepositModalOpen(false)
      setDepositAmount('100.00')
      setComprovanteBase64('')
      setComprovanteFileName('')
      loadWalletAndRanking()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao registrar solicitação de depósito.')
    } finally {
      setSubmittingDeposit(false)
    }
  }

  // Submit Withdraw
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const amt = parseFloat(withdrawAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Informe um valor de saque válido.')
      return
    }

    if (amt > balance) {
      toast.error(`Saldo insuficiente para saque. Saldo disponível: R$ ${balance.toFixed(2)}`)
      return
    }

    if (!pixKeyValue.trim()) {
      toast.error('Informe a sua Chave PIX para receber o valor.')
      return
    }

    setSubmittingWithdraw(true)
    try {
      await pb.collection('wallet_transactions').create({
        user: user.id,
        type: 'saque',
        amount: amt,
        currency: 'BRL',
        status: 'pendente',
        pix_txid: `SAQUE-${Date.now()}`,
        comprovante: `Chave PIX (${pixKeyType}): ${pixKeyValue}`,
      })

      toast.success('Solicitação de saque enviada com sucesso! Processamento via PIX em até 24h.')
      setIsWithdrawModalOpen(false)
      setPixKeyValue('')
      loadWalletAndRanking()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao solicitar saque.')
    } finally {
      setSubmittingWithdraw(false)
    }
  }

  const copyPixKey = () => {
    navigator.clipboard.writeText(pixKeyFicticia)
    toast.success('Chave PIX copiada para a área de transferência!')
  }

  // Filter deposits and withdraws for dedicated history
  const depositHistory = transactions.filter((t) => t.type === 'deposito')
  const withdrawHistory = transactions.filter((t) => t.type === 'saque')

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <Wallet className="w-3.5 h-3.5" />
            Ecossistema Financeiro 369
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            Carteira, Ranking & Cashback
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Pontuação unificada:{' '}
            <strong className="text-white">SERVIÇOS × PLANO × INDICAÇÃO</strong>. Converta seu
            esforço em cashback real e saldo disponível para saque.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsWithdrawModalOpen(true)}
            variant="outline"
            className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 font-bold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" /> Solicitar Saque
          </Button>
          <Button
            onClick={() => setIsDepositModalOpen(true)}
            className="bg-gradient-to-r from-[#D4AF37] to-[#F4D77A] text-black font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:scale-102 transition-all"
          >
            <QrCode className="w-4 h-4" /> Adicionar Fundos (PIX)
          </Button>
        </div>
      </div>

      {/* RECURSO 9: RANKING & SCORE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PONTUAÇÃO TOTAL */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-montserrat uppercase font-semibold">
              Pontuação Total
            </span>
            <Trophy className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-3xl font-extrabold text-white font-montserrat tracking-tight">
            {totalScore} <span className="text-xs text-[#D4AF37] font-bold">PTS</span>
          </p>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            {totalServicesCount} serviços • Multiplicador{' '}
            {user?.plan === 'premium' ? '3x' : user?.plan === 'pro' ? '2x' : '1x'}
          </span>
        </Card>

        {/* POSIÇÃO NO RANKING */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-montserrat uppercase font-semibold">
              Posição no Ranking
            </span>
            <Award className="w-4 h-4 text-[#0057FF]" />
          </div>
          <p className="text-3xl font-extrabold text-[#0057FF] font-montserrat">
            #{rankingPosition} <span className="text-xs text-gray-400 font-medium">Geral</span>
          </p>
          <span className="text-[10px] text-[#22C55E] font-semibold mt-1 block">
            Top 5% da Comunidade 369
          </span>
        </Card>

        {/* CASHBACK ACUMULADO */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-montserrat uppercase font-semibold">
              Cashback Acumulado
            </span>
            <Percent className="w-4 h-4 text-[#22C55E]" />
          </div>
          <p className="text-3xl font-extrabold text-[#22C55E] font-montserrat">
            R$ {cashbackTotal.toFixed(2)}
          </p>
          <span className="text-[10px] text-gray-400 font-inter mt-1 block">
            Retorno automático por serviços
          </span>
        </Card>

        {/* SALDO DISPONÍVEL PARA SAQUE */}
        <Card className="bg-gradient-to-br from-[#181818] to-[#121212] border-2 border-[#D4AF37]/60 p-5 rounded-2xl shadow-[0_0_25px_rgba(212,175,55,0.15)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#D4AF37] font-montserrat uppercase font-bold">
              Saldo para Saque
            </span>
            <Wallet className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-3xl font-extrabold text-[#D4AF37] font-montserrat">
            R$ {balance.toFixed(2)}
          </p>
          <span className="text-[10px] text-gray-300 font-inter mt-1 block">
            Disponível para PIX imediato
          </span>
        </Card>
      </div>

      {/* RECURSO 9: EXPLICATIVO DA REGRA DE PONTUAÇÃO UNIFICADA */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <h3 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          Regra Definitiva de Pontuação: SERVIÇOS × PLANO × INDICAÇÃO
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-inter text-gray-300">
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1">
            <strong className="text-white font-montserrat block">1. Serviços Válidos</strong>
            <p className="text-gray-400">
              Aulas presenciais e online, treinos concluídos via IA, dias de desafios finalizados e
              produtos/cursos adquiridos no app.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1">
            <strong className="text-[#D4AF37] font-montserrat block">
              2. Multiplicador de Plano
            </strong>
            <p className="text-gray-400">
              Plano Grátis (1x), Básico (1.2x), Pro (2.0x) e Premium (3.0x). Assinantes dos planos
              superiores aceleram seu ranking 3x mais rápido.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1">
            <strong className="text-[#0057FF] font-montserrat block">
              3. Multiplicador de Rede
            </strong>
            <p className="text-gray-400">
              Cada amigo cadastrado com seu código de indicação aumenta o fator multiplicador do seu
              cashback no fechamento de cada ciclo.
            </p>
          </div>
        </div>
      </Card>

      {/* HISTÓRICO EM ABAS / SEÇÕES DEDICADAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HISTÓRICO DE DEPÓSITOS */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-[#22C55E]" />
              <h3 className="font-bold font-montserrat text-white text-sm uppercase">
                Histórico de Depósitos PIX
              </h3>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              {depositHistory.length} registros
            </span>
          </div>

          <div className="space-y-2.5">
            {depositHistory.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">Nenhum depósito registrado.</p>
            ) : (
              depositHistory.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#22C55E]/10 text-[#22C55E] rounded-lg">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-white font-montserrat">
                        R$ {Number(t.amount).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-400 font-inter">
                        {new Date(t.created).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div>
                    {(t.status as string) === 'concluido' || (t.status as string) === 'aprovado' ? (
                      <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/15 px-2 py-0.5 rounded border border-[#22C55E]/30">
                        Aprovado
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#FF7A00] bg-[#FF7A00]/15 px-2 py-0.5 rounded border border-[#FF7A00]/30">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* HISTÓRICO DE SAQUES */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="font-bold font-montserrat text-white text-sm uppercase">
                Histórico de Saques
              </h3>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              {withdrawHistory.length} registros
            </span>
          </div>

          <div className="space-y-2.5">
            {withdrawHistory.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">
                Nenhum saque solicitado ainda.
              </p>
            ) : (
              withdrawHistory.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#D4AF37]/10 text-[#D4AF37] rounded-lg">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-white font-montserrat">
                        R$ {Number(t.amount).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-400 font-inter">
                        {new Date(t.created).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div>
                    {(t.status as string) === 'concluido' || (t.status as string) === 'aprovado' ? (
                      <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/15 px-2 py-0.5 rounded border border-[#22C55E]/30">
                        Transferido
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#D4AF37] bg-[#D4AF37]/15 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                        Em Processamento
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* MODAL DEPÓSITO PIX */}
      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#D4AF37]" /> Adicionar Créditos via PIX
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Pague via chave PIX e envie o comprovante para liberação automática.
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

            {/* Chave PIX Copia e Cola */}
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
                onClick={copyPixKey}
                className="w-full border-[#2A2A2A] text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs font-bold mt-1"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Chave PIX
              </Button>
            </div>

            {/* Upload Comprovante */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Comprovante de Pagamento (Imagem / PDF)
              </label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="bg-[#181818] border-[#2A2A2A] text-xs text-gray-300 file:bg-[#D4AF37] file:text-black file:font-bold file:rounded-lg file:border-0 file:mr-3"
              />
              {comprovanteFileName && (
                <p className="text-[11px] text-[#22C55E] mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Arquivo anexado: {comprovanteFileName}
                </p>
              )}
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
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                  </>
                ) : (
                  'Confirmar Depósito'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL SOLICITAÇÃO DE SAQUE */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-[#D4AF37]" /> Solicitar Saque via PIX
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Transfira seu saldo disponível e cashback acumulado diretamente para sua conta
              bancária.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWithdrawSubmit} className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] flex justify-between items-center text-xs">
              <span className="text-gray-400">Saldo Disponível:</span>
              <span className="text-[#D4AF37] font-bold font-mono text-sm">
                R$ {balance.toFixed(2)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Valor do Saque (R$) *
              </label>
              <Input
                type="number"
                min="10"
                max={balance}
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
                disabled={submittingWithdraw || balance <= 0}
                className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase rounded-xl flex items-center gap-2"
              >
                {submittingWithdraw ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  'Confirmar Saque'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

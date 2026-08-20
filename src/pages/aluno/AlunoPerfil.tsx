import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { WalletTransactionRecord, AchievementRecord } from '@/services/api'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Wallet,
  Copy,
  CheckCircle2,
  TrendingUp,
  UploadCloud,
  Sun,
  Apple,
  Dumbbell,
  Droplets,
  Heart,
  Trophy,
  ShieldCheck,
  QrCode,
  Loader2,
  DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AlunoPerfil() {
  const { user, refreshUser } = useAuth()

  // Wallet State
  const [balance, setBalance] = useState<number>(300.0)
  const [cashbackBalance, setCashbackBalance] = useState<number>(45.8)
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([])

  // PIX Deposit State
  const [depositAmount, setDepositAmount] = useState<string>('150')
  const [pixCodeGenerated, setPixCodeGenerated] = useState<string | null>(null)
  const [comprovanteText, setComprovanteText] = useState<string>('')
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false)

  // Referral
  const referralCode = user?.referral_code || 'LUCAS369'
  const referralLink = `${window.location.origin}/cadastro?ref=${referralCode}`

  // Load Wallet Transactions
  useEffect(() => {
    if (!user) return
    pb.collection('wallet_transactions')
      .getList<WalletTransactionRecord>(1, 20, {
        filter: `user = "${user.id}"`,
        sort: '-created',
      })
      .then((res) => {
        setTransactions(res.items)
        let calculated = 0
        let cb = 0
        res.items.forEach((tx) => {
          if (tx.status === 'concluido') {
            calculated += tx.amount
            if (tx.type === 'cashback') cb += tx.amount
          }
        })
        if (calculated > 0) setBalance(calculated)
        if (cb > 0) setCashbackBalance(cb)
      })
      .catch(() => {})
  }, [user])

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text)
    toast.success(msg)
  }

  const handleGeneratePix = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(depositAmount)
    if (!val || val <= 0) {
      toast.error('Informe um valor válido para depósito.')
      return
    }

    const fakePix = `00020126580014br.gov.bcb.pix0136369training-pix-key-${Date.now()}520400005303986540${val.toFixed(2)}5802BR5925369TRAINING SERVICOS6009SAO PAULO62070503***6304E8A9`
    setPixCodeGenerated(fakePix)
    toast.success('Código PIX Copia e Cola gerado com sucesso!')
  }

  const handleSendComprovante = async () => {
    if (!user) return
    setSubmittingDeposit(true)
    try {
      const val = parseFloat(depositAmount) || 100
      await pb.collection('wallet_transactions').create({
        user: user.id,
        type: 'deposito',
        amount: val,
        status: 'pendente',
        pix_code: pixCodeGenerated,
        comprovante: comprovanteText || 'Comprovante PIX anexado pelo aluno',
        description: `Recarga de Carteira via PIX - R$ ${val.toFixed(2)}`,
      })

      toast.success('Comprovante enviado para validação administrativa!')
      setPixCodeGenerated(null)
      setComprovanteText('')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao enviar comprovante.')
    } finally {
      setSubmittingDeposit(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Profile Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#181818] border border-[#2A2A2A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xl">
        <div className="flex items-center gap-5">
          <CrestLogo
            size={80}
            avatarUrl={
              user?.avatar
                ? pb.files.getURL(user, user.avatar)
                : 'https://img.usecurling.com/ppl/medium?gender=male&seed=1'
            }
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#D4AF37] uppercase font-montserrat">
                Aluno Nível 4 • Ranking 369
              </span>
            </div>
            <h1 className="text-2xl font-extrabold font-montserrat text-white mt-0.5">
              {user?.name || 'Lucas Ferreira'}
            </h1>
            <p className="text-xs text-gray-400 font-inter mt-1">
              {user?.email} • {user?.city || 'São Paulo'}, {user?.state || 'SP'}
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex gap-3">
          <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center">
            <span className="text-[10px] text-gray-400 font-montserrat uppercase">
              Treinos Feitos
            </span>
            <p className="text-lg font-bold text-[#D4AF37] font-montserrat">28</p>
          </div>
          <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center">
            <span className="text-[10px] text-gray-400 font-montserrat uppercase">Indicações</span>
            <p className="text-lg font-bold text-[#0057FF] font-montserrat">3</p>
          </div>
        </div>
      </div>

      {/* CARTEIRA DIGITAL & CASHBACK BLOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balances Card */}
        <Card className="lg:col-span-1 bg-gradient-to-br from-[#181818] to-[#141414] border border-[#D4AF37]/40 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold text-[#D4AF37] uppercase font-montserrat flex items-center gap-1.5">
                <Wallet className="w-4 h-4" /> Carteira Digital 369
              </span>
              <span className="text-[10px] font-mono bg-[#22C55E]/10 text-[#22C55E] px-2 py-0.5 rounded border border-[#22C55E]/30">
                Ativa
              </span>
            </div>

            <span className="text-xs text-gray-400 font-montserrat">Saldo Disponível</span>
            <h2 className="text-3xl font-black font-montserrat text-white mt-0.5">
              R$ {balance.toFixed(2)}
            </h2>

            <div className="mt-4 pt-3 border-t border-[#2A2A2A]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Cashback Acumulado:</span>
                <span className="font-bold text-[#D4AF37] font-mono">
                  R$ {cashbackBalance.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-inter mt-1">
                Cashback com validade de 12 meses para serviços e produtos na rede.
              </p>
            </div>
          </div>

          {/* Referral Link & Code with Copy Button */}
          <div className="mt-6 p-3 rounded-xl bg-[#101010] border border-[#2A2A2A]">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-bold text-gray-300 font-montserrat">
                Seu Código de Indicação:
              </span>
              <span className="font-mono text-[#D4AF37] font-bold">{referralCode}</span>
            </div>
            <Button
              size="sm"
              onClick={() =>
                copyToClipboard(referralLink, 'Link de indicação copiado com sucesso!')
              }
              className="w-full mt-2 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar Link de Indicação
            </Button>
          </div>
        </Card>

        {/* PIX Recarga Flow */}
        <Card className="lg:col-span-2 bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="w-5 h-5 text-[#22C55E]" />
            <h3 className="font-bold font-montserrat text-white text-base uppercase">
              Recarregar Carteira via PIX Instantâneo
            </h3>
          </div>
          <p className="text-xs text-gray-400 font-inter mb-4">
            Insira o valor desejado, copie a chave PIX e envie o comprovante para liberação de
            créditos imediata.
          </p>

          {!pixCodeGenerated ? (
            <form onSubmit={handleGeneratePix} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Valor da Recarga (R$)
                </label>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="100.00"
                  className="bg-[#141414] border-[#2A2A2A] rounded-xl text-white font-mono text-base"
                  required
                />
              </div>

              <div className="flex gap-2">
                {[50, 100, 200, 500].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDepositAmount(v.toString())}
                    className="px-3 py-1.5 rounded-lg bg-[#141414] border border-[#2A2A2A] text-xs font-bold text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37]"
                  >
                    + R$ {v}
                  </button>
                ))}
              </div>

              <Button
                type="submit"
                className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase px-6"
              >
                Gerar Código PIX
              </Button>
            </form>
          ) : (
            <div className="space-y-4 p-4 rounded-xl bg-[#141414] border border-[#22C55E]/40 animate-fade-in">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-300 font-montserrat font-bold">PIX Copia e Cola:</span>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(pixCodeGenerated, 'Código PIX copiado!')}
                  className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs h-7"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Código
                </Button>
              </div>

              <div className="p-3 bg-[#0B0B0C] border border-[#2A2A2A] rounded-xl text-[11px] font-mono text-gray-400 break-all select-all">
                {pixCodeGenerated}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Comprovante / ID da Transação
                </label>
                <Input
                  value={comprovanteText}
                  onChange={(e) => setComprovanteText(e.target.value)}
                  placeholder="Cole o código do comprovante do seu banco..."
                  className="bg-[#101010] border-[#2A2A2A] rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSendComprovante}
                  disabled={submittingDeposit}
                  className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase"
                >
                  {submittingDeposit ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Confirmar Envio do Comprovante'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPixCodeGenerated(null)}
                  className="border-[#2A2A2A] text-gray-400 hover:text-white text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* DICAS DE SAÚDE (Sol, Alimentação, Exercícios, Água, Meditação) */}
      <div>
        <h3 className="text-lg font-bold font-montserrat uppercase text-white mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-[#EF4444]" />5 Pilares Diários de Saúde 369
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
            <Sun className="w-8 h-8 text-[#D4AF37] mx-auto mb-2" />
            <h4 className="text-xs font-bold font-montserrat text-white uppercase">
              1. Sol & Vitamina D
            </h4>
            <p className="text-[11px] text-gray-400 font-inter mt-1">
              15 min de sol matinal para sincronizar ciclo circadiano.
            </p>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
            <Apple className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
            <h4 className="text-xs font-bold font-montserrat text-white uppercase">
              2. Alimentação Limpa
            </h4>
            <p className="text-[11px] text-gray-400 font-inter mt-1">
              Comida de verdade, alta proteína e micronutrientes.
            </p>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
            <Dumbbell className="w-8 h-8 text-[#0057FF] mx-auto mb-2" />
            <h4 className="text-xs font-bold font-montserrat text-white uppercase">
              3. Exercício Intenso
            </h4>
            <p className="text-[11px] text-gray-400 font-inter mt-1">
              Estímulo muscular diário para longevidade biomecânica.
            </p>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
            <Droplets className="w-8 h-8 text-[#0057FF] mx-auto mb-2" />
            <h4 className="text-xs font-bold font-montserrat text-white uppercase">
              4. Hidratação
            </h4>
            <p className="text-[11px] text-gray-400 font-inter mt-1">
              Mínimo de 35ml de água por quilo de peso corporal.
            </p>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
            <Heart className="w-8 h-8 text-[#9D52FF] mx-auto mb-2" />
            <h4 className="text-xs font-bold font-montserrat text-white uppercase">5. Meditação</h4>
            <p className="text-[11px] text-gray-400 font-inter mt-1">
              10 min de respiração consciente e foco mental 369.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Building2,
  Tag,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WalletTransactionRecord } from '@/services/api'

export default function ProfissionalCarteira() {
  const { user } = useAuth()

  const [balance, setBalance] = useState(1250.0)
  const [cashbackTotal, setCashbackTotal] = useState(180.5)
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([])

  // Saque Modal / Form
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [pixKey, setPixKey] = useState(user?.phone || '')
  const [withdrawing, setWithdrawing] = useState(false)

  // Load wallet txs
  useEffect(() => {
    if (!user) return
    pb.collection('wallet_transactions')
      .getList<WalletTransactionRecord>(1, 30, {
        filter: `user = "${user.id}"`,
        sort: '-created',
      })
      .then((res) => {
        setTransactions(res.items)
        let calc = 0
        let cb = 0
        res.items.forEach((t) => {
          if (t.status === 'concluido') {
            calc += t.amount
            if (t.type === 'cashback') cb += t.amount
          }
        })
        if (calc > 0) setBalance(calc)
        if (cb > 0) setCashbackTotal(cb)
      })
      .catch(() => {})
  }, [user])

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(withdrawAmount)
    if (!val || val <= 0 || val > balance) {
      toast.error('Informe um valor de saque válido menor ou igual ao seu saldo.')
      return
    }

    setWithdrawing(true)
    try {
      await pb.collection('wallet_transactions').create({
        user: user?.id,
        type: 'saque',
        amount: -val,
        status: 'pendente',
        pix_code: pixKey,
        description: `Solicitação de Saque PIX para chave: ${pixKey}`,
      })

      toast.success('Solicitação de saque enviada para processamento administrativo!')
      setWithdrawAmount('')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao solicitar saque.')
    } finally {
      setWithdrawing(false)
    }
  }

  const getTarifaBadge = (plan: string) => {
    if (plan === 'premium') return 'R$ 1,00 / serviço'
    if (plan === 'pro') return 'R$ 2,00 / serviço'
    return 'R$ 3,00 / serviço'
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
          <Wallet className="w-3.5 h-3.5" />
          Financeiro & Repasses
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Carteira Profissional & Cashback
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Acompanhe seus recebimentos de serviços, cashback distribuído por nível e solicite saques
          via PIX.
        </p>
      </div>

      {/* BALANCES & TARIFAS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Saldo Disponível */}
        <Card className="bg-gradient-to-br from-[#181818] to-[#141414] border border-[#D4AF37]/40 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-xs text-gray-400 font-montserrat uppercase">
              Saldo Disponível
            </span>
            <h2 className="text-3xl font-black font-montserrat text-white mt-1">
              R$ {balance.toFixed(2)}
            </h2>
            <span className="text-[11px] text-[#22C55E] font-semibold mt-1 inline-block">
              ✓ Liberado para saque bancário
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex justify-between items-center text-xs">
            <span className="text-gray-400">Cashback da Rede:</span>
            <span className="font-bold text-[#D4AF37] font-mono">
              R$ {cashbackTotal.toFixed(2)}
            </span>
          </div>
        </Card>

        {/* Tarifa Descontada por Serviço */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-montserrat uppercase">
                Tarifa por Serviço
              </span>
              <Tag className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <h3 className="text-2xl font-bold font-montserrat text-[#D4AF37]">
              {getTarifaBadge(user?.plan || 'premium')}
            </h3>
            <p className="text-xs text-gray-400 font-inter mt-1 leading-relaxed">
              Descontada automaticamente a cada atendimento concluído.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2A2A2A]">
            <span className="text-[10px] text-gray-500 font-inter">
              Plano {user?.plan?.toUpperCase() || 'PREMIUM'} • Tarifa reduzida de parceiro
            </span>
          </div>
        </Card>

        {/* Solicitar Saque */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="text-xs font-bold font-montserrat text-white uppercase mb-3 flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4 text-[#22C55E]" /> Solicitar Saque PIX
          </h3>

          <form onSubmit={handleWithdraw} className="space-y-3">
            <div>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Valor do saque (R$)"
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
                required
              />
            </div>
            <div>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Chave PIX (CPF / E-mail / Telefone)"
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={withdrawing}
              className="w-full bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase"
            >
              {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Saque'}
            </Button>
          </form>
        </Card>
      </div>

      {/* HISTÓRICO DE REPASSES POR NÍVEL & EXTRATO */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4">
          Extrato Detalhado de Transações & Cashback 369
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-inter">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                <th className="pb-3">Tipo</th>
                <th className="pb-3">Descrição / Referência</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    Nenhuma movimentação financeira recente.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-3 font-semibold capitalize font-montserrat text-white flex items-center gap-1.5">
                      {tx.amount > 0 ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#22C55E]" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {tx.type}
                    </td>
                    <td className="py-3 text-gray-300">{tx.description || tx.type}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tx.status === 'concluido'
                            ? 'bg-[#22C55E]/10 text-[#22C55E]'
                            : 'bg-amber-900/30 text-amber-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td
                      className={`py-3 text-right font-mono font-bold ${
                        tx.amount > 0 ? 'text-[#22C55E]' : 'text-red-400'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''} R$ {Math.abs(tx.amount).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

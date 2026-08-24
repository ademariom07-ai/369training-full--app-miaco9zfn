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
  Image as ImageIcon,
  ShieldCheck,
  Building2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AlunoCarteira() {
  const { user } = useAuth()

  const [balance, setBalance] = useState<number>(0)
  const [cashbackTotal, setCashbackTotal] = useState<number>(0)
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // PIX Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false)
  const [depositAmount, setDepositAmount] = useState<string>('100.00')
  const [comprovanteBase64, setComprovanteBase64] = useState<string>('')
  const [comprovanteFileName, setComprovanteFileName] = useState<string>('')
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false)

  const pixKeyFicticia = '369training@pagamento.com'
  const titularFicticio = '369TRAINING LTDA'

  const loadTransactions = async () => {
    if (!user) return
    try {
      const res = await pb
        .collection('wallet_transactions')
        .getList<WalletTransactionRecord>(1, 50, {
          filter: `user = "${user.id}"`,
          sort: '-created',
        })
      setTransactions(res.items)

      let calcBalance = 0
      let calcCb = 0
      res.items.forEach((t) => {
        if (t.status === 'concluido') {
          calcBalance += t.amount
          if (t.type === 'cashback') calcCb += t.amount
        }
      })
      setBalance(calcBalance)
      setCashbackTotal(calcCb)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [user])

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text)
    toast.success(msg)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, envie uma imagem nos formatos PNG ou JPG.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 5MB.')
      return
    }

    setComprovanteFileName(file.name)
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setComprovanteBase64(result)
    }
    reader.readAsDataURL(file)
  }

  const handleSendDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const val = parseFloat(depositAmount)
    if (!val || val <= 0) {
      toast.error('Informe um valor de recarga válido.')
      return
    }

    if (!comprovanteBase64) {
      toast.error('Por favor, anexe a foto ou print do comprovante PIX.')
      return
    }

    setSubmittingDeposit(true)
    try {
      await pb.collection('wallet_transactions').create({
        user: user.id,
        type: 'deposito',
        amount: val,
        status: 'pendente',
        comprovante: comprovanteBase64,
        pix_code: pixKeyFicticia,
        reference_type: 'pix_manual',
        description: `Depósito PIX - R$ ${val.toFixed(2)} (${comprovanteFileName || 'Comprovante'})`,
      })

      toast.success('Comprovante PIX enviado! Aguarde a aprovação do administrador.')
      setIsDepositModalOpen(false)
      setComprovanteBase64('')
      setComprovanteFileName('')
      setDepositAmount('100.00')
      loadTransactions()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao enviar comprovante.')
    } finally {
      setSubmittingDeposit(false)
    }
  }

  return (
    <div className="space-y-8 pb-12 font-inter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <Wallet className="w-3.5 h-3.5" />
            Carteira Digital do Aluno
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Minha Carteira & Saldo PIX
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie seus créditos, adicione fundos via PIX e consulte seu cashback acumulado.
          </p>
        </div>

        <Button
          onClick={() => setIsDepositModalOpen(true)}
          className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-5 py-3 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
        >
          <QrCode className="w-4 h-4" /> Adicionar Crédito via PIX
        </Button>
      </div>

      {/* Cards de Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Saldo Atual */}
        <Card className="bg-gradient-to-br from-[#181818] to-[#141414] border border-[#D4AF37]/40 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400 font-montserrat uppercase">
                Saldo Disponível
              </span>
              <span className="text-[10px] font-mono bg-[#22C55E]/10 text-[#22C55E] px-2 py-0.5 rounded border border-[#22C55E]/30">
                Ativo
              </span>
            </div>
            <h2 className="text-3xl font-black font-montserrat text-white">
              R$ {balance.toFixed(2)}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Utilize para contratar personais, nutricionistas e aulas.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex justify-between items-center text-xs">
            <span className="text-gray-400">Cashback Acumulado:</span>
            <span className="font-bold text-[#D4AF37] font-mono">
              R$ {cashbackTotal.toFixed(2)}
            </span>
          </div>
        </Card>

        {/* Informações PIX */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-montserrat uppercase">
                Chave PIX Oficial
              </span>
              <Building2 className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <p className="text-xs font-mono text-[#D4AF37] font-bold break-all">{pixKeyFicticia}</p>
            <p className="text-xs text-gray-300 font-montserrat mt-1">{titularFicticio}</p>
            <p className="text-[11px] text-gray-500 mt-2">
              Envios de comprovante são validados e liberados pela administração em poucos minutos.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(pixKeyFicticia, 'Chave PIX copiada!')}
            className="w-full mt-4 border-[#2A2A2A] text-xs text-gray-300 hover:text-white"
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Chave PIX
          </Button>
        </Card>

        {/* Como Funciona */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-xs text-gray-400 font-montserrat uppercase block mb-2">
              Passo a Passo
            </span>
            <ul className="text-xs text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-black font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>Copie a chave PIX e faça a transferência no seu banco.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-black font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>Clique em &ldquo;Adicionar Crédito&rdquo; e anexe o comprovante.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-black font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>Após aprovação, seu saldo é atualizado imediatamente.</span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Extrato de Transações */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4">
          Histórico de Movimentações
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                <th className="pb-3">Tipo</th>
                <th className="pb-3">Descrição</th>
                <th className="pb-3">Data</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    Nenhuma movimentação registrada na sua carteira.
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
                      {tx.type === 'deposito' ? 'Depósito PIX' : tx.type}
                    </td>
                    <td className="py-3 text-gray-300">{tx.description || tx.type}</td>
                    <td className="py-3 text-gray-400 font-mono text-[11px]">
                      {new Date(tx.created).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(tx.created).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tx.status === 'concluido'
                            ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                            : tx.status === 'rejeitado'
                              ? 'bg-red-950/40 text-red-400 border border-red-800'
                              : 'bg-amber-950/40 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {tx.status === 'concluido'
                          ? 'Aprovado'
                          : tx.status === 'rejeitado'
                            ? 'Rejeitado'
                            : 'Pendente de Análise'}
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

      {/* Modal de Upload de Comprovante PIX */}
      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#D4AF37]" /> Adicionar Crédito via PIX
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Siga os passos abaixo para efetuar a transferência e enviar seu comprovante para
              liberação.
            </DialogDescription>
          </DialogHeader>

          {/* Dados PIX */}
          <div className="p-4 rounded-xl bg-[#0E0E0E] border border-[#2A2A2A] space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Chave PIX (E-mail):</span>
              <button
                type="button"
                onClick={() => copyToClipboard(pixKeyFicticia, 'Chave PIX copiada!')}
                className="text-[#D4AF37] font-bold font-mono hover:underline flex items-center gap-1"
              >
                {pixKeyFicticia} <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Titular:</span>
              <span className="text-white font-semibold">{titularFicticio}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Banco:</span>
              <span className="text-white font-semibold">Skip Cloud / 369 Digital</span>
            </div>
          </div>

          <form onSubmit={handleSendDeposit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Valor Transferido (R$) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Ex: 150.00"
                className="bg-[#0E0E0E] border-[#2A2A2A] rounded-xl text-white font-mono text-base"
                required
              />
            </div>

            {/* Upload Area */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Anexo do Comprovante (PNG / JPG) *
              </label>
              <div className="border-2 border-dashed border-[#2A2A2A] hover:border-[#D4AF37] rounded-xl p-4 text-center cursor-pointer bg-[#0E0E0E] relative transition-all">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {comprovanteBase64 ? (
                  <div className="space-y-2">
                    <img
                      src={comprovanteBase64}
                      alt="Prévia do Comprovante"
                      className="max-h-36 mx-auto rounded-lg object-contain border border-[#2A2A2A]"
                    />
                    <p className="text-xs text-[#22C55E] font-semibold truncate">
                      ✓ {comprovanteFileName || 'Imagem carregada com sucesso'}
                    </p>
                    <p className="text-[10px] text-gray-500">Clique para substituir o arquivo</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-3">
                    <UploadCloud className="w-8 h-8 text-[#D4AF37] mx-auto" />
                    <p className="text-xs font-bold text-gray-300 font-montserrat uppercase">
                      Clique ou arraste a imagem do comprovante
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Formatos aceitos: PNG, JPG (Máx. 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDepositModalOpen(false)}
                className="flex-1 border-[#2A2A2A] text-gray-400 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingDeposit || !comprovanteBase64}
                className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase"
              >
                {submittingDeposit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Enviar Comprovante'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

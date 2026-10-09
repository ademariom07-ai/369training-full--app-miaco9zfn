import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Flag, AlertTriangle, Loader2 } from 'lucide-react'

interface ReportMessageModalProps {
  open: boolean
  messageId: string | null
  messageContent?: string
  senderName?: string
  onClose: () => void
  onConfirmReport: (messageId: string, reason: string) => Promise<void>
}

export function ReportMessageModal({
  open,
  messageId,
  messageContent,
  senderName,
  onClose,
  onConfirmReport,
}: ReportMessageModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const quickReasons = [
    'Conteúdo ofensivo ou desrespeitoso',
    'Spam ou divulgação indevida',
    'Conduta antiética / assédio',
    'Descumprimento dos termos de serviço',
    'Tentativa de pagamento fora da plataforma',
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageId || !reason.trim()) return

    setLoading(true)
    try {
      await onConfirmReport(messageId, reason.trim())
      setReason('')
      onClose()
    } catch {
      // toast é gerenciado na tela chamadora
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && !val && onClose()}>
      <DialogContent className="bg-[#181818] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-2">
            <Flag className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase">
            Denunciar Mensagem
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400 font-inter">
            A mensagem denunciada será encaminhada com registro de auditoria para revisão da
            administração do 369WELLNESS.
          </DialogDescription>
        </DialogHeader>

        {messageContent && (
          <div className="p-3 rounded-xl bg-[#121212] border border-[#2A2A2A] text-xs space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase font-montserrat">
              Mensagem de {senderName || 'Usuário'}:
            </span>
            <p className="text-gray-300 italic line-clamp-3 font-inter">
              &ldquo;{messageContent}&rdquo;
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
              Selecione um motivo rápido:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition-all ${
                    reason === r
                      ? 'bg-red-500/20 border-red-500 text-red-300 font-semibold'
                      : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
              Descreva o motivo da denúncia:
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique o ocorrido detalhadamente..."
              className="bg-[#141414] border-[#2A2A2A] text-white text-xs rounded-xl min-h-[85px]"
              maxLength={500}
              required
            />
            <span className="text-[10px] text-gray-500 font-mono mt-0.5 block text-right">
              {reason.length}/500 caracteres
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-inter">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Denúncias falsas deliberadas violam os Termos de Uso da plataforma.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onClose}
              className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs font-bold uppercase rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !reason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase rounded-xl px-4 flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Flag className="w-3.5 h-3.5" />
              )}
              Enviar Denúncia
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

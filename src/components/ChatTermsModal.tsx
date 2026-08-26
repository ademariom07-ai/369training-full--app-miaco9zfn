import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShieldCheck, FileCheck, Scale, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import { sha256 } from '@/lib/chatExport'

interface ChatTermsModalProps {
  open: boolean
  userId: string
  onAccepted: () => void
}

export function ChatTermsModal({ open, userId, onAccepted }: ChatTermsModalProps) {
  const [accepting, setAccepting] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const handleAccept = async () => {
    if (!agreed) {
      toast.error('Você deve concordar com os termos para acessar o chat.')
      return
    }

    setAccepting(true)
    try {
      // Mock/hash IP representation
      const ipRaw = `${navigator.userAgent}_${window.location.host}_${userId}`
      const ipHash = await sha256(ipRaw)

      await pb.collection('chat_terms_accepted').create({
        user_id: userId,
        accepted_at: new Date().toISOString(),
        ip_hash: ipHash,
      })

      toast.success('Termos e regras do Chat aceitos com sucesso!')
      onAccepted()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao registrar aceite dos termos.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="bg-[#141414] border border-[#D4AF37]/40 text-white max-w-xl rounded-2xl p-6 sm:p-8"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat w-fit">
            <Scale className="w-3.5 h-3.5" />
            Termos de Uso & Validade Legal
          </div>
          <DialogTitle className="text-xl font-bold font-montserrat text-white">
            Regras de Convivência e Validade Jurídica do Chat 369
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400 font-inter leading-relaxed">
            Para garantir a segurança, integridade e conformidade jurídica das orientações e
            atendimentos, leia atentamente as diretrizes abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-3 font-inter text-xs text-gray-300 max-h-60 overflow-y-auto pr-2 border-y border-[#2A2A2A]">
          <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-montserrat uppercase text-[11px] mb-0.5">
                1. Respeito Mútuo e Ética Profissional
              </strong>
              <span>
                Todas as interações devem ser conduzidas com urbanidade, respeito e cordialidade.
                Não serão tolerados desrespeito ou assédio moral.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-montserrat uppercase text-[11px] mb-0.5">
                2. Proibição de Assédio e Discriminação
              </strong>
              <span>
                É estritamente proibido qualquer tipo de assédio sexual ou moral, discriminação por
                gênero, raça, credo ou orientação sexual, bem como o compartilhamento de conteúdo
                ilegal.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/40 flex items-start gap-2.5">
            <FileCheck className="w-4 h-4 text-[#0057FF] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#0057FF] block font-montserrat uppercase text-[11px] mb-0.5">
                3. Validade Jurídica e Probatória das Mensagens
              </strong>
              <span className="text-gray-200">
                As mensagens trocadas neste chat constituem{' '}
                <strong>documento válido para fins legais</strong>, conforme o{' '}
                <strong>Art. 225 do Código de Processo Civil</strong> e a{' '}
                <strong>Medida Provisória 2.200-2/2001</strong>. Cada histórico é criptograficamente
                assinado com hash SHA-256.
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] cursor-pointer hover:border-[#D4AF37]/50 transition-colors">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded text-[#D4AF37] focus:ring-[#D4AF37] bg-black border-[#2A2A2A]"
            />
            <span className="text-xs text-white font-medium font-inter">
              Li, compreendi e concordo integralmente com as Regras de Convivência e os Termos de
              Validade Legal do Chat.
            </span>
          </label>

          <Button
            onClick={handleAccept}
            disabled={!agreed || accepting}
            className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase py-5 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center justify-center gap-2"
          >
            {accepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Aceitar Regras e Abrir Chat
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

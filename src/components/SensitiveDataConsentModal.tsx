import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { pb } from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { ShieldAlert, HeartPulse, CheckCircle2, Lock, Loader2 } from 'lucide-react'

interface SensitiveDataConsentModalProps {
  open: boolean
  areaName: string
  onConsented: () => void
  onDismiss: () => void
}

export function SensitiveDataConsentModal({
  open,
  areaName,
  onConsented,
  onDismiss,
}: SensitiveDataConsentModalProps) {
  const { user } = useAuth()
  const [acceptedCheckbox, setAcceptedCheckbox] = useState(false)
  const [loading, setLoading] = useState(false)
  const [documentDoc, setDocumentDoc] = useState<{ id: string; version: number } | null>(null)

  useEffect(() => {
    if (open) {
      loadDocInfo()
      setAcceptedCheckbox(false)
    }
  }, [open])

  const loadDocInfo = async () => {
    try {
      const doc = await pb
        .collection('legal_documents')
        .getFirstListItem('slug = "consentimento-dados-sensiveis-saude"')
      setDocumentDoc({
        id: doc.id,
        version: Number(doc.version) || 1,
      })
    } catch {
      setDocumentDoc({
        id: 'consentimento-dados-sensiveis-saude',
        version: 1,
      })
    }
  }

  const handleConfirmConsent = async () => {
    if (!user) return
    if (!acceptedCheckbox) {
      toast.error('Marque a caixa de seleção para confirmar seu consentimento expresso.')
      return
    }

    setLoading(true)
    try {
      const docId = documentDoc?.id || 'consentimento-dados-sensiveis-saude'
      const docVer = documentDoc?.version || 1
      const nowIso = new Date().toISOString()

      // Gravar na coleção legal_acceptances com consent_type destacado
      await pb.collection('legal_acceptances').create({
        user: user.id,
        document: docId,
        document_slug: 'consentimento-dados-sensiveis-saude',
        version: docVer,
        accepted_at: nowIso,
        consent_type: 'dados_sensiveis_saude_art11',
        ip: 'client-verified',
        user_agent: navigator.userAgent || 'browser',
      })

      // Gravar em audits
      try {
        await pb.collection('audits').create({
          actor: user.id,
          target_type: 'legal_acceptances',
          target_id: docId,
          action: 'SENSITIVE_DATA_CONSENT_GRANTED',
          details: {
            area: areaName,
            version: docVer,
            consented_at: nowIso,
          },
        })
      } catch {
        /* intentionally ignored */
      }

      toast.success(
        'Consentimento específico de dados sensíveis registrado com sucesso! Acesso liberado.',
      )
      onConsented()
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast.error(e.message || 'Erro ao registrar consentimento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="bg-[#121212] border-2 border-[#D4AF37]/40 text-white max-w-xl rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider font-montserrat bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-full border border-[#D4AF37]/30">
              <ShieldAlert className="w-3.5 h-3.5" /> LGPD Artigo 11, Inciso I
            </span>
          </div>
          <DialogTitle className="text-xl font-black font-montserrat text-white uppercase flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-[#22C55E]" /> Consentimento Específico de Dados
            Sensíveis de Saúde
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-300 font-inter pt-1">
            Para acessar o módulo de <strong className="text-[#D4AF37]">{areaName}</strong>, a Lei
            Geral de Proteção de Dados exige seu consentimento expresso, informado e destacado.
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 space-y-3.5 max-h-[50vh] overflow-y-auto pr-1 text-xs text-gray-300 font-inter leading-relaxed">
          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-2">
            <h4 className="font-bold text-white font-montserrat uppercase text-xs flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#0057FF]" /> 1. Quais dados sensíveis são tratados?
            </h4>
            <p className="text-gray-400">
              Biometria corporal (peso, altura, medidas), histórico de lesões, restrições
              articulares, sintomas de dor/mobilidade, hábitos nutricionais, anamnese física e
              evolução esportiva.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-2">
            <h4 className="font-bold text-white font-montserrat uppercase text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" /> 2. Finalidade Exclusiva
            </h4>
            <p className="text-gray-400">
              Montagem de treinos físicos por inteligência artificial, dietas personalizadas,
              prevenção de lesões e suporte às consultas com profissionais credenciados (CREF, CRN,
              CREFITO, CRP). Seus dados <strong>jamais serão vendidos para terceiros</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-2">
            <h4 className="font-bold text-white font-montserrat uppercase text-xs">
              3. Direito de Revogação
            </h4>
            <p className="text-gray-400">
              Você pode revogar este consentimento a qualquer momento na página{' '}
              <strong className="text-white">/lgpd-consentimentos</strong>. Ao revogar, o acesso às
              áreas clínicas será temporariamente pausado até que um novo consentimento seja
              fornecido.
            </p>
          </div>

          <div className="pt-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
            <Checkbox
              id="sensitive-consent-check"
              checked={acceptedCheckbox}
              onCheckedChange={(c) => setAcceptedCheckbox(!!c)}
              className="mt-0.5 data-[state=checked]:bg-[#22C55E] data-[state=checked]:border-[#22C55E]"
            />
            <label
              htmlFor="sensitive-consent-check"
              className="text-xs text-white font-semibold cursor-pointer leading-snug"
            >
              Eu concordo de forma expressa, informada e destacada com o tratamento dos meus dados
              sensíveis de saúde e biométricos para fins de treinamento, nutrição e fisioterapia no
              369TRAINING.
            </label>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            disabled={loading}
            className="border-[#2A2A2A] text-gray-400 text-xs font-montserrat uppercase"
          >
            Voltar ao Início
          </Button>
          <Button
            type="button"
            onClick={handleConfirmConsent}
            disabled={loading || !acceptedCheckbox}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Autorizar e Acessar {areaName}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

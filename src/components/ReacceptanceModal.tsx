import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { LegalDocumentRecord, LegalAcceptanceRecord } from '@/services/api'
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
import { ShieldAlert, FileText, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function ReacceptanceModal() {
  const { user } = useAuth()
  const [pendingDocs, setPendingDocs] = useState<LegalDocumentRecord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [acceptedCheck, setAcceptedCheck] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!user) return

    async function checkPendingAcceptances() {
      try {
        // 1. Obter todos os documentos publicados relevantes para o papel do usuário
        const targetAudience = user.role === 'profissional' ? 'profissional' : 'aluno'
        const filter = `status = 'publicado' && (audience = 'todos' || audience = '${targetAudience}')`
        const publishedDocs = await pb
          .collection('legal_documents')
          .getFullList<LegalDocumentRecord>({ filter })

        if (publishedDocs.length === 0) return

        // 2. Buscar os aceites registrados para este usuário
        const userAcceptances = await pb
          .collection('legal_acceptances')
          .getFullList<LegalAcceptanceRecord>({
            filter: `user = '${user.id}'`,
          })

        // Mapear aceites por documentId ou slug para a versão aceita
        const acceptedMap = new Map<string, number>()
        userAcceptances.forEach((acc) => {
          const key = acc.document || acc.document_slug
          const currentMax = acceptedMap.get(key) || 0
          if (acc.version > currentMax) {
            acceptedMap.set(key, acc.version)
          }
          if (acc.document_slug) {
            const currentSlugMax = acceptedMap.get(acc.document_slug) || 0
            if (acc.version > currentSlugMax) {
              acceptedMap.set(acc.document_slug, acc.version)
            }
          }
        })

        // 3. Documentos que o usuário ainda não aceitou nesta versão
        const unaccepted: LegalDocumentRecord[] = []
        for (const doc of publishedDocs) {
          const acceptedVer = acceptedMap.get(doc.id) ?? acceptedMap.get(doc.slug) ?? 0
          if (acceptedVer < doc.version) {
            unaccepted.push(doc)
          }
        }

        if (unaccepted.length > 0) {
          setPendingDocs(unaccepted)
          setCurrentIndex(0)
          setIsOpen(true)
        }
      } catch (err) {
        console.warn('Erro ao verificar documentos legais pendentes:', err)
      }
    }

    checkPendingAcceptances()
  }, [user])

  if (!isOpen || pendingDocs.length === 0) return null

  const currentDoc = pendingDocs[currentIndex]

  const handleAcceptCurrent = async () => {
    if (!acceptedCheck || !user || !currentDoc) {
      toast.error('Você precisa marcar a caixa de confirmação de leitura e aceite.')
      return
    }

    setSubmitting(true)
    try {
      const nowIso = new Date().toISOString()
      const nowIsoPb = nowIso.replace('T', ' ').slice(0, 19)

      // Gravar na coleção legal_acceptances
      await pb.collection('legal_acceptances').create({
        user: user.id,
        document: currentDoc.id,
        document_slug: currentDoc.slug,
        version: currentDoc.version,
        accepted_at: nowIsoPb,
        ip: 'client-verified',
        user_agent: navigator.userAgent || 'web-browser',
        consent_type: currentDoc.slug,
      })

      toast.success(`Você aceitou os termos de "${currentDoc.title}" (v${currentDoc.version}.0).`)

      if (currentIndex + 1 < pendingDocs.length) {
        setCurrentIndex((prev) => prev + 1)
        setAcceptedCheck(false)
      } else {
        setIsOpen(false)
        setPendingDocs([])
      }
    } catch (err: any) {
      console.error('Erro ao gravar aceite legal:', err)
      toast.error('Erro ao registrar aceite. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl bg-[#141414] border border-[#D4AF37]/40 text-white shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-[#D4AF37] uppercase font-montserrat">
              Atualização Jurídica Obrigatória ({currentIndex + 1} de {pendingDocs.length})
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold font-montserrat uppercase text-white">
            {currentDoc.title} — Versão {currentDoc.version}.0
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            Houve uma nova versão deste documento legal. Para continuar utilizando o ecossistema
            369TRAINING, leia atentamente e confirme seu aceite.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[45vh] overflow-y-auto pr-2 my-2 space-y-3 bg-[#181818] p-4 rounded-xl border border-[#2A2A2A] text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
          {currentDoc.body}
        </div>

        <div className="p-3 bg-[#1c1c1c] border border-[#2A2A2A] rounded-xl flex items-start gap-3 mt-2">
          <Checkbox
            id="modal-accept-checkbox"
            checked={acceptedCheck}
            onCheckedChange={(checked) => setAcceptedCheck(Boolean(checked))}
            className="mt-0.5 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black border-[#444]"
          />
          <label
            htmlFor="modal-accept-checkbox"
            className="text-xs text-gray-200 cursor-pointer leading-snug"
          >
            Declaro expressamente que li, compreendi e concordo integralmente com os termos da
            versão <strong className="text-[#D4AF37]">{currentDoc.version}.0</strong> de{' '}
            <strong className="text-white">{currentDoc.title}</strong>.
          </label>
        </div>

        <DialogFooter className="pt-3 border-t border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">
            Registro com carimbo de data, versão e IP nos termos do Marco Civil da Internet.
          </span>
          <Button
            onClick={handleAcceptCurrent}
            disabled={!acceptedCheck || submitting}
            className="w-full sm:w-auto bg-[#D4AF37] text-black hover:bg-[#e0be4a] font-montserrat font-bold text-xs uppercase"
          >
            {currentIndex + 1 < pendingDocs.length ? (
              <>
                Aceitar e Próximo <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </>
            ) : (
              <>
                Confirmar Aceite e Prosseguir <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
export default ReacceptanceModal

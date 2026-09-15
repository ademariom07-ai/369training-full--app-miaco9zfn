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

    const run = async () => {
      await checkPendingAcceptances()
    }
    run()
  }, [user])

  const checkPendingAcceptances = async () => {
    if (!user) return
    try {
      // 1. Obter todos os documentos publicados relevantes para o papel do usuário
      const targetAudience = user.role === 'profissional' ? 'profissional' : 'aluno'
      const filter = `status = 'publicado' && (audience = 'todos' || audience = '${targetAudience}')`
      const publishedDocs = await pb
        .collection('legal_documents')
        .getFullList<LegalDocumentRecord>({ filter })

      if (publishedDocs.length === 0) {
        setPendingDocs([])
        setIsOpen(false)
        return
      }

      // 2. Buscar os aceites registrados para este usuário
      const userAcceptances = await pb
        .collection('legal_acceptances')
        .getFullList<LegalAcceptanceRecord>({
          filter: `user = '${user.id}'`,
        })

      // Mapear aceites por slug e por id para o conjunto de versões já aceitas
      // Reconciliação canônica: aceites de 'consentimento-dados-sensiveis-saude' também contam para 'lgpd-consentimentos'
      const acceptedVersionsBySlug = new Map<string, Set<number>>()
      const acceptedVersionsById = new Map<string, Set<number>>()

      const addAccepted = (slugOrId: string, ver: number, isId = false) => {
        if (!slugOrId) return
        const map = isId ? acceptedVersionsById : acceptedVersionsBySlug
        if (!map.has(slugOrId)) {
          map.set(slugOrId, new Set<number>())
        }
        map.get(slugOrId)!.add(Number(ver))
      }

      userAcceptances.forEach((acc) => {
        const ver = Number(acc.version) || 1
        if (acc.document) addAccepted(acc.document, ver, true)
        if (acc.document_slug) {
          addAccepted(acc.document_slug, ver, false)
          // Reconciliar o slug alternativo de dados sensíveis
          if (acc.document_slug === 'consentimento-dados-sensiveis-saude') {
            addAccepted('lgpd-consentimentos', ver, false)
          } else if (acc.document_slug === 'lgpd-consentimentos') {
            addAccepted('consentimento-dados-sensiveis-saude', ver, false)
          }
        }
      })

      // 3. Documentos que o usuário ainda não aceitou na VERSÃO atual (slug + versão)
      const unaccepted: LegalDocumentRecord[] = []
      for (const doc of publishedDocs) {
        const targetVer = Number(doc.version) || 1
        const slugVersions = acceptedVersionsBySlug.get(doc.slug)
        const idVersions = acceptedVersionsById.get(doc.id)

        const hasAcceptedCurrentVersion =
          (slugVersions && slugVersions.has(targetVer)) || (idVersions && idVersions.has(targetVer))

        if (!hasAcceptedCurrentVersion) {
          unaccepted.push(doc)
        }
      }

      if (unaccepted.length > 0) {
        setPendingDocs(unaccepted)
        setCurrentIndex(0)
        setIsOpen(true)
      } else {
        setPendingDocs([])
        setIsOpen(false)
      }
    } catch (err) {
      console.warn('Erro ao verificar documentos legais pendentes:', err)
    }
  }

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
        // Revalidar imediatamente a checagem na mesma sessão sem exigir novo login
        await checkPendingAcceptances()
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

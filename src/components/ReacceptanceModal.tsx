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
  const [acceptedMap, setAcceptedMap] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const hasAuth = !!user || pb.authStore.isValid
    if (!hasAuth) return

    const run = async () => {
      await checkPendingAcceptances()
    }
    run()
  }, [user])

  const checkPendingAcceptances = async () => {
    const activeUserId =
      user?.id || (pb.authStore.record as any)?.id || (pb.authStore.model as any)?.id
    const activeRole =
      user?.role || (pb.authStore.record as any)?.role || (pb.authStore.model as any)?.role

    if (!activeUserId) return
    try {
      // 1. Obter todos os documentos publicados relevantes para o papel do usuário
      const targetAudience = activeRole === 'profissional' ? 'profissional' : 'aluno'
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
          filter: `user = '${activeUserId}'`,
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
  const currentDocKey = currentDoc
    ? `${currentDoc.id || currentDoc.slug}_${currentDoc.version}`
    : ''
  const isCurrentDocAccepted = Boolean(currentDocKey && acceptedMap[currentDocKey])

  const handleToggleAccept = (checked: boolean) => {
    if (!currentDocKey) return
    setAcceptedMap((prev) => ({
      ...prev,
      [currentDocKey]: checked,
    }))
  }

  const handleAcceptCurrent = async () => {
    // 1. Validação estrita do checkbox de aceite
    if (!isCurrentDocAccepted) {
      toast.error('Você precisa marcar a caixa de confirmação de leitura e aceite.')
      return
    }

    // 2. Validação da existência do documento atual
    if (!currentDoc) {
      toast.error('Documento legal não encontrado. Recarregue a página.')
      return
    }

    // 3. Blindagem de sessão: verificar se pb.authStore.isValid é falso antes de tentar gravar
    if (!pb.authStore.isValid) {
      try {
        if (pb.authStore.token) {
          await pb.collection('users').authRefresh()
        }
      } catch (refreshErr) {
        console.warn('Falha no authRefresh preliminar:', refreshErr)
      }
    }

    if (!pb.authStore.isValid) {
      toast.error('Sua sessão expirou. Faça login novamente para registrar o aceite.')
      setIsOpen(false)
      return
    }

    setSubmitting(true)
    try {
      // Registrar via rota de backend /backend/v1/legal/accept (Tarefa 2)
      await pb.send('/backend/v1/legal/accept', {
        method: 'POST',
        body: {
          document_id: currentDoc.id,
          document_slug: currentDoc.slug,
          version: currentDoc.version,
          consent_type: currentDoc.slug,
        },
      })

      // Atualizar o estado local com o documento/versão aceitos
      setAcceptedMap((prev) => ({
        ...prev,
        [currentDocKey]: true,
        [`${currentDoc.slug}_${currentDoc.version}`]: true,
        [`${currentDoc.id}_${currentDoc.version}`]: true,
      }))

      toast.success(`Você aceitou os termos de "${currentDoc.title}" (v${currentDoc.version}.0).`)

      if (currentIndex + 1 < pendingDocs.length) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        // Fechar imediatamente o modal para evitar loops na sessão
        setPendingDocs([])
        setIsOpen(false)
        // Revalidar em background
        checkPendingAcceptances().catch(() => {})
      }
    } catch (err: any) {
      console.error('Erro ao gravar aceite legal via backend:', err)
      const msg =
        err?.response?.message || err?.message || 'Erro ao registrar aceite. Tente novamente.'
      if (err?.status === 401 || !pb.authStore.isValid) {
        toast.error('Sua sessão expirou. Faça login novamente para registrar o aceite.')
        setIsOpen(false)
      } else {
        toast.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl bg-white border border-[#E4E2DC] text-[#1A1A1A] shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#B8962E]">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-[#B8962E] uppercase font-montserrat">
              Atualização Jurídica Obrigatória ({currentIndex + 1} de {pendingDocs.length})
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold font-montserrat uppercase text-[#1A1A1A]">
            {currentDoc.title} — Versão {currentDoc.version}.0
          </DialogTitle>
          <DialogDescription className="text-xs text-[#4B5563]">
            Houve uma nova versão deste documento legal. Para continuar utilizando o ecossistema
            369TRAINING, leia atentamente e confirme seu aceite.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[45vh] overflow-y-auto pr-2 my-2 space-y-3 bg-[#F7F5F0] p-4 rounded-xl border border-[#E4E2DC] text-xs text-[#374151] leading-relaxed whitespace-pre-wrap font-sans">
          {currentDoc.body}
        </div>

        <div
          className="p-3 bg-white border border-[#E4E2DC] rounded-xl flex items-start gap-3 mt-2 cursor-pointer hover:border-[#D4AF37]/60 transition-colors"
          onClick={() => handleToggleAccept(!isCurrentDocAccepted)}
        >
          <Checkbox
            key={`checkbox-${currentDocKey}`}
            id={`modal-accept-${currentDocKey}`}
            checked={isCurrentDocAccepted}
            onCheckedChange={(checked) => handleToggleAccept(Boolean(checked))}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black border-[#D1D5DB]"
          />
          <label
            htmlFor={`modal-accept-${currentDocKey}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-[#1A1A1A] cursor-pointer leading-snug select-none flex-1"
          >
            Declaro expressamente que li, compreendi e concordo integralmente com os termos da
            versão <strong className="text-[#B8962E]">{currentDoc.version}.0</strong> de{' '}
            <strong className="text-[#1A1A1A]">{currentDoc.title}</strong>.
          </label>
        </div>

        <DialogFooter className="pt-3 border-t border-[#E4E2DC] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] text-[#6B7280]">
            Registro com carimbo de data, versão e IP nos termos do Marco Civil da Internet.
          </span>
          <Button
            onClick={handleAcceptCurrent}
            disabled={!isCurrentDocAccepted || submitting}
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

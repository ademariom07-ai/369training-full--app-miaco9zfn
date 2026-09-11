import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  ExternalLink,
  Loader2,
  Video,
  FileText,
  Eye,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/contexts/AuthContext'
import { CredentialVerificationRecord } from '@/services/api'
import { PresentationVideoPlayer } from '@/components/PresentationVideoPlayer'

export default function AprovacoesProfissionais() {
  const [pendingList, setPendingList] = useState<UserProfile[]>([])
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([])
  const [pendingContents, setPendingContents] = useState<any[]>([])
  const [credentialsMap, setCredentialsMap] = useState<Record<string, CredentialVerificationRecord>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'depositos' | 'profissionais' | 'conteudos'>(
    'profissionais',
  )
  const [processingTxId, setProcessingTxId] = useState<string | null>(null)
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({})
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({})
  const [credNotesMap, setCredNotesMap] = useState<Record<string, string>>({})
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)

  const loadPending = async () => {
    try {
      const [resProf, resDep, resCont, resCreds] = await Promise.all([
        pb.collection('users').getList<UserProfile>(1, 50, {
          filter: 'role = "profissional" && approved = false',
          sort: '-created',
        }),
        pb.collection('wallet_transactions').getList(1, 50, {
          filter: 'status = "pendente" && type = "deposito"',
          sort: '-created',
          expand: 'user',
        }),
        pb
          .collection('contents')
          .getList(1, 50, {
            filter: 'status = "pendente"',
            sort: '-created',
            expand: 'professional_id',
          })
          .catch(() => ({ items: [] })),
        pb
          .collection('credential_verifications')
          .getList<CredentialVerificationRecord>(1, 100, {
            sort: '-created',
          })
          .catch(() => ({ items: [] })),
      ])

      setPendingList(resProf.items)
      setPendingDeposits(resDep.items)
      setPendingContents(resCont.items)

      // Indexar credenciais por profissional
      const map: Record<string, CredentialVerificationRecord> = {}
      resCreds.items.forEach((c) => {
        if (c.professional) {
          map[c.professional] = c
        }
      })
      setCredentialsMap(map)
    } catch (err) {
      console.warn('Erro ao carregar pendências:', err)
    }
  }

  useEffect(() => {
    loadPending().finally(() => setLoading(false))
  }, [])

  const handleApproveDeposit = async (txId: string) => {
    setProcessingTxId(txId)
    try {
      await pb.send('/backend/v1/admin/approve_deposit', {
        method: 'POST',
        body: JSON.stringify({ transaction_id: txId, action: 'approve' }),
      })
      toast.success('Depósito PIX aprovado e saldo creditado ao aluno!')
      loadPending()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aprovar depósito PIX.')
    } finally {
      setProcessingTxId(null)
    }
  }

  const handleRejectDeposit = async (txId: string) => {
    setProcessingTxId(txId)
    try {
      await pb.send('/backend/v1/admin/approve_deposit', {
        method: 'POST',
        body: JSON.stringify({ transaction_id: txId, action: 'reject' }),
      })
      toast.info('Depósito PIX rejeitado com sucesso.')
      loadPending()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao rejeitar depósito PIX.')
    } finally {
      setProcessingTxId(null)
    }
  }

  const handleApprove = async (prof: UserProfile) => {
    const cred = credentialsMap[prof.id]
    const notes = credNotesMap[prof.id] || 'Credencial profissional conferida e aprovada pelo admin.'
    const nowIsoPb = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const expDate = new Date()
    expDate.setFullYear(expDate.getFullYear() + 1)
    const expiresAt = expDate.toISOString().slice(0, 10)

    try {
      // Regra da Tarefa 3: "Aprovar o profissional só é possível com credencial verificado"
      // Atualizar ou criar o registro de verificação para 'verificado'
      if (cred) {
        await pb.collection('credential_verifications').update(cred.id, {
          status: 'verificado',
          reviewed_by: pb.authStore.record?.id,
          reviewed_at: nowIsoPb,
          review_notes: notes,
          expires_at: expiresAt,
        })
      } else {
        await pb.collection('credential_verifications').create({
          professional: prof.id,
          council: 'CREF',
          registration_number: prof.cref || 'NÃO INFORMADO',
          status: 'verificado',
          reviewed_by: pb.authStore.record?.id,
          reviewed_at: nowIsoPb,
          review_notes: notes,
          expires_at: expiresAt,
        })
      }

      // Atualizar o usuário para approved = true
      await pb.collection('users').update(prof.id, {
        approved: true,
        video_enabled: prof.video_url ? true : prof.video_enabled,
      })

      // Append audit
      await pb.collection('audits').create({
        actor: pb.authStore.record?.id,
        target_type: 'users',
        target_id: prof.id,
        action: 'PROFESSIONAL_APPROVED',
        details: { cref: prof.cref, name: prof.name, email: prof.email, notes },
      })

      // Notificação ao profissional
      await pb.collection('notifications').create({
        user: prof.id,
        type: 'account_approved',
        title: 'Credencial Verificada & Perfil Aprovado!',
        body: `Parabéns! Suas credenciais (${prof.cref}) foram validadas com o selo Verificado 369. Seu perfil agora está liberado para atender alunos.`,
        read: false,
        action_url: '/profissional/dashboard',
      })

      toast.success(`Profissional ${prof.name} e credencial aprovados com sucesso!`)
      loadPending()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao aprovar.')
    }
  }

  const handleReject = async (prof: UserProfile) => {
    const cred = credentialsMap[prof.id]
    const notes =
      credNotesMap[prof.id] ||
      rejectReasonMap[prof.id] ||
      'Documento ilegível, divergência cadastral ou registro inativo no conselho.'
    const nowIsoPb = new Date().toISOString().replace('T', ' ').slice(0, 19)

    try {
      if (cred) {
        await pb.collection('credential_verifications').update(cred.id, {
          status: 'reprovado',
          reviewed_by: pb.authStore.record?.id,
          reviewed_at: nowIsoPb,
          review_notes: notes,
        })
      }

      await pb.collection('audits').create({
        actor: pb.authStore.record?.id,
        target_type: 'users',
        target_id: prof.id,
        action: 'PROFESSIONAL_REJECTED',
        details: { cref: prof.cref, name: prof.name, reason: notes },
      })

      // Notificação
      await pb.collection('notifications').create({
        user: prof.id,
        type: 'account_rejected',
        title: 'Credencial Reprovada na Auditoria',
        body: `Seu cadastro profissional foi reprovado. Motivo: ${notes}. Envie um novo documento no seu perfil.`,
        read: false,
        action_url: '/profissional/perfil',
      })

      toast.info(`Cadastro de ${prof.name} reprovado e registrado em auditoria.`)
      loadPending()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao reprovar.')
    }
  }

  const handleApproveContent = async (item: any) => {
    try {
      await pb.collection('contents').update(item.id, {
        status: 'aprovado',
        rejection_reason: '',
      })
      toast.success(`Conteúdo "${item.title}" aprovado e publicado com sucesso!`)
      loadPending()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao aprovar conteúdo.')
    }
  }

  const handleRejectContent = async (item: any) => {
    const reason = rejectReasonMap[item.id] || 'Material fora das diretrizes da plataforma 369.'
    try {
      await pb.collection('contents').update(item.id, {
        status: 'rejeitado',
        rejection_reason: reason,
      })
      toast.info(`Conteúdo "${item.title}" rejeitado.`)
      loadPending()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao rejeitar conteúdo.')
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400 uppercase font-montserrat mb-2">
          <FileCheck2 className="w-3.5 h-3.5" />
          Central de Auditoria & Aprovações
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Aprovações da Plataforma
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Gerencie a liberação de depósitos PIX dos alunos e audite registros profissionais (CREF /
          CRN / CREFITO).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] max-w-xl">
        <button
          type="button"
          onClick={() => setActiveTab('depositos')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all font-montserrat uppercase flex items-center justify-center gap-2 ${
            activeTab === 'depositos'
              ? 'bg-[#D4AF37] text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Depósitos PIX</span>
          {pendingDeposits.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'depositos' ? 'bg-black text-[#D4AF37]' : 'bg-[#D4AF37] text-black'
              }`}
            >
              {pendingDeposits.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profissionais')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all font-montserrat uppercase flex items-center justify-center gap-2 ${
            activeTab === 'profissionais'
              ? 'bg-[#0057FF] text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Profissionais</span>
          {pendingList.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'profissionais'
                  ? 'bg-white text-[#0057FF]'
                  : 'bg-[#0057FF] text-white'
              }`}
            >
              {pendingList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('conteudos')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all font-montserrat uppercase flex items-center justify-center gap-2 ${
            activeTab === 'conteudos'
              ? 'bg-[#22C55E] text-black shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Conteúdos</span>
          {pendingContents.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'conteudos' ? 'bg-black text-[#22C55E]' : 'bg-[#22C55E] text-black'
              }`}
            >
              {pendingContents.length}
            </span>
          )}
        </button>
      </div>

      {/* ABA DEPÓSITOS PIX */}
      {activeTab === 'depositos' && (
        <div className="space-y-4">
          {pendingDeposits.length === 0 ? (
            <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto mb-3" />
              <h3 className="text-lg font-bold font-montserrat text-white">
                Nenhum Depósito PIX Pendente
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1">
                Todas as solicitações de recarga via PIX foram auditadas e processadas.
              </p>
            </Card>
          ) : (
            pendingDeposits.map((tx) => {
              const aluno = tx.expand?.user
              return (
                <Card
                  key={tx.id}
                  className="bg-[#181818] border border-[#D4AF37]/30 p-6 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Miniatura do Comprovante */}
                    {tx.comprovante && tx.comprovante.startsWith('data:image') ? (
                      <div className="relative group shrink-0">
                        <img
                          src={tx.comprovante}
                          alt="Comprovante PIX"
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-[#D4AF37] cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            const win = window.open('')
                            win?.document.write(
                              `<img src="${tx.comprovante}" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />`,
                            )
                          }}
                        />
                        <span className="block text-[10px] text-center text-[#D4AF37] mt-1 hover:underline cursor-pointer">
                          Ver Original
                        </span>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-center text-gray-500 shrink-0">
                        <FileCheck2 className="w-8 h-8 text-[#D4AF37]" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold font-montserrat text-white text-base">
                          {aluno?.name || 'Aluno Não Identificado'}
                        </h3>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/40">
                          Depósito PIX
                        </span>
                      </div>

                      <p className="text-xs text-gray-400">
                        {aluno?.email} • {aluno?.phone || 'Sem telefone'}
                      </p>

                      <div className="flex flex-wrap gap-4 text-xs text-gray-300 font-inter pt-1">
                        <span>
                          Valor:{' '}
                          <strong className="text-lg font-mono text-[#22C55E]">
                            R$ {(tx.amount || 0).toFixed(2)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Data:{' '}
                          <span className="font-mono text-gray-400">
                            {new Date(tx.created).toLocaleDateString('pt-BR')} às{' '}
                            {new Date(tx.created).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </span>
                      </div>

                      {tx.description && (
                        <p className="text-xs text-gray-400 font-mono bg-[#141414] px-2.5 py-1 rounded-lg border border-[#2A2A2A] mt-1 inline-block">
                          {tx.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full lg:w-auto">
                    <Button
                      onClick={() => handleApproveDeposit(tx.id)}
                      disabled={processingTxId === tx.id}
                      className="flex-1 lg:flex-initial bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.25)]"
                    >
                      {processingTxId === tx.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Aprovar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRejectDeposit(tx.id)}
                      disabled={processingTxId === tx.id}
                      className="flex-1 lg:flex-initial border-red-900 text-red-400 hover:bg-red-950/30 text-xs uppercase px-4 py-2.5 rounded-xl"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* ABA PROFISSIONAIS */}
      {activeTab === 'profissionais' &&
        (pendingList.length === 0 ? (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto mb-3" />
            <h3 className="text-lg font-bold font-montserrat text-white">
              Nenhum Profissional Pendente
            </h3>
            <p className="text-xs text-gray-400 font-inter mt-1">
              Todas as solicitações de cadastro profissional foram auditadas e aprovadas.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingList.map((prof) => (
              {
                const cred = credentialsMap[prof.id]
                const docFileUrl = cred?.document_file
                  ? pb.files.getURL(cred, cred.document_file)
                  : cred?.document_url_fallback || ''

                return (
                  <Card
                    key={prof.id}
                    className="bg-[#181818] border border-amber-500/30 p-6 rounded-2xl flex flex-col gap-6"
                  >
                    <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <img
                          src="https://img.usecurling.com/ppl/medium?gender=male&seed=3"
                          alt={prof.name}
                          className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500"
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold font-montserrat text-white text-base">
                              {prof.name}
                            </h3>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/40">
                              Pendente de Análise
                            </span>
                            {cred && (
                              <Badge
                                variant="outline"
                                className="border-[#D4AF37]/40 text-[#D4AF37] text-[10px] uppercase font-montserrat"
                              >
                                Conselho: {cred.council}
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-[#0057FF] font-semibold">
                            Especialidades: {prof.specialties?.join(' • ') || 'Educação Física'}
                          </p>

                          <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-inter pt-1">
                            <span className="font-mono text-white">
                              Número Registrado:{' '}
                              <strong className="text-[#D4AF37]">
                                {cred?.registration_number || prof.cref || 'Em validação'}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>Tipo: {prof.professional_type || 'Pessoa Física'}</span>
                            <span>•</span>
                            <span>
                              {prof.city || 'São Paulo'} - {prof.state || 'SP'}
                            </span>
                          </div>

                          {prof.bio && (
                            <p className="text-xs text-gray-300 font-inter mt-1 max-w-xl italic">
                              &ldquo;{prof.bio}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* DOCUMENTO ANEXADO — PREVIEW DIRETO (TAREFA 3) */}
                      <div className="w-full lg:w-72 bg-[#141414] border border-[#2A2A2A] p-3 rounded-xl shrink-0 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white uppercase font-montserrat flex items-center gap-1.5 text-[11px]">
                            <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                            Documento Anexado
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {cred?.council || 'CONSELHO'}
                          </span>
                        </div>

                        {docFileUrl ? (
                          <div className="space-y-1.5">
                            <div
                              onClick={() => {
                                const win = window.open('')
                                win?.document.write(
                                  `<img src="${docFileUrl}" style="max-width: 90%; height: auto; display: block; margin: 40px auto; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />`,
                                )
                              }}
                              className="relative group cursor-pointer overflow-hidden rounded-lg border border-[#333] max-h-36 bg-black flex items-center justify-center"
                            >
                              <img
                                src={docFileUrl}
                                alt="Cédula profissional"
                                className="w-full h-32 object-cover group-hover:scale-105 transition-transform opacity-90 group-hover:opacity-100"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-bold uppercase font-montserrat flex items-center gap-1 bg-[#D4AF37] text-black px-2.5 py-1 rounded">
                                  <Eye className="w-3.5 h-3.5" /> Ampliar
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-400">
                              <span>Nº: {cred?.registration_number || prof.cref}</span>
                              <a
                                href={docFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                              >
                                Abrir <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-gray-500 border border-dashed border-[#333] rounded-lg">
                            Nenhum arquivo enviado
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vídeo de Apresentação Auditável (se houver) */}
                    {prof.video_url && prof.video_url.trim() && (
                      <div className="p-3 bg-[#141414] border border-[#2A2A2A] rounded-xl max-w-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#D4AF37] flex items-center gap-1.5 uppercase font-montserrat text-[11px]">
                            <Video className="w-3.5 h-3.5" />
                            Vídeo de Apresentação (30s Pitch)
                          </span>
                        </div>
                        <PresentationVideoPlayer url={prof.video_url} profName={prof.name} />
                      </div>
                    )}

                    {/* Nota do Auditor e Ações */}
                    <div className="pt-3 border-t border-[#2A2A2A] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={credNotesMap[prof.id] || ''}
                          onChange={(e) =>
                            setCredNotesMap({ ...credNotesMap, [prof.id]: e.target.value })
                          }
                          placeholder="Nota da auditoria (ex: Cédula conferida no portal do conselho, regular e ativa)..."
                          className="w-full h-9 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-[#D4AF37]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleApprove(prof)}
                          className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.25)]"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Aprovar com Credencial
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(prof)}
                          className="border-red-900 text-red-400 hover:bg-red-950/30 text-xs uppercase px-4 py-2 rounded-xl"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reprovar
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              }
            ))}
          </div>
        ))}

      {/* ABA CONTEÚDOS PENDENTES (RECURSO 6: APROVAÇÃO DE CONTEÚDOS) */}
      {activeTab === 'conteudos' && (
        <div className="space-y-4">
          {pendingContents.length === 0 ? (
            <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto mb-3" />
              <h3 className="text-lg font-bold font-montserrat text-white">
                Nenhum Conteúdo Pendente de Aprovação
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1">
                Todos os PDFs, planilhas, e-books e vídeos submetidos foram auditados.
              </p>
            </Card>
          ) : (
            pendingContents.map((item) => {
              const prof = item.expand?.professional_id
              const hasFile = !!item.file
              const downloadUrl = hasFile ? pb.files.getURL(item, item.file) : item.file_url

              return (
                <Card
                  key={item.id}
                  className="bg-[#181818] border border-amber-500/30 p-6 rounded-2xl flex flex-col gap-4"
                >
                  <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                          {item.type}
                        </span>
                        <h3 className="font-bold font-montserrat text-white text-base">
                          {item.title}
                        </h3>
                        <span className="text-xs font-mono text-gray-400">
                          Preço: {item.price > 0 ? `R$ ${item.price.toFixed(2)}` : 'Gratuito'}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 font-inter">
                        Profissional:{' '}
                        <strong className="text-white">{prof?.name || 'Parceiro 369'}</strong> (
                        {prof?.email})
                      </p>

                      {item.description && (
                        <p className="text-xs text-gray-300 font-inter max-w-2xl bg-[#141414] p-3 rounded-xl border border-[#2A2A2A]">
                          {item.description}
                        </p>
                      )}

                      {/* Visualizador de Arquivo / Link */}
                      <div className="flex items-center gap-3 pt-1">
                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-[#0057FF] hover:underline font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Abrir / Baixar Arquivo Anexado ({item.type.toUpperCase()})
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Botões de Decisão */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto shrink-0">
                      <Button
                        onClick={() => handleApproveContent(item)}
                        className="w-full sm:w-auto bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.25)]"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Aprovar Conteúdo
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() =>
                          setShowRejectInput((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                        className="w-full sm:w-auto border-red-900 text-red-400 hover:bg-red-950/30 text-xs uppercase px-4 py-2.5 rounded-xl"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  </div>

                  {/* Input de Motivo para Rejeição */}
                  {showRejectInput[item.id] && (
                    <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/40 space-y-3">
                      <label className="block text-xs font-bold text-red-400 uppercase font-montserrat">
                        Motivo da Reprovação:
                      </label>
                      <input
                        type="text"
                        value={rejectReasonMap[item.id] || ''}
                        onChange={(e) =>
                          setRejectReasonMap((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Ex: Formatação do PDF incompleta, resolução baixa, ou conteúdo fora das diretrizes..."
                        className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-red-500/40 text-white text-xs"
                      />
                      <Button
                        onClick={() => handleRejectContent(item)}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase rounded-lg px-4 py-2"
                      >
                        Confirmar Rejeição
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

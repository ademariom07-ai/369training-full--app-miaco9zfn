import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/contexts/AuthContext'
import { PresentationVideoPlayer } from '@/components/PresentationVideoPlayer'

export default function AprovacoesProfissionais() {
  const [pendingList, setPendingList] = useState<UserProfile[]>([])
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profissionais' | 'depositos'>('depositos')
  const [processingTxId, setProcessingTxId] = useState<string | null>(null)

  const loadPending = async () => {
    try {
      const [resProf, resDep] = await Promise.all([
        pb.collection('users').getList<UserProfile>(1, 50, {
          filter: 'role = "profissional" && approved = false',
          sort: '-created',
        }),
        pb.collection('wallet_transactions').getList(1, 50, {
          filter: 'status = "pendente" && type = "deposito"',
          sort: '-created',
          expand: 'user',
        }),
      ])
      setPendingList(resProf.items)
      setPendingDeposits(resDep.items)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadPending().finally(() => setLoading(false))
  }, [])

  const handleApproveDeposit = async (txId: string) => {
    setProcessingTxId(txId)
    try {
      await pb.send('/api/custom/admin/approve-deposit', {
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
      await pb.send('/api/custom/admin/approve-deposit', {
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
    try {
      // Ao aprovar o profissional, se ele já tiver vídeo cadastrado, liberamos o vídeo também por conveniência ou mantemos ativo
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
        details: { cref: prof.cref, name: prof.name, email: prof.email },
      })

      // Send notification to professional
      await pb.collection('notifications').create({
        user: prof.id,
        type: 'account_approved',
        title: 'Perfil Aprovado com Sucesso!',
        body: 'Parabéns! Suas credenciais foram validadas. Seu perfil agora está disponível para alunos no 369TRAINING.',
        read: false,
        action_url: '/profissional/dashboard',
      })

      toast.success(`Profissional ${prof.name} aprovado com sucesso!`)
      loadPending()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao aprovar.')
    }
  }

  const handleReject = async (prof: UserProfile) => {
    try {
      await pb.collection('audits').create({
        actor: pb.authStore.record?.id,
        target_type: 'users',
        target_id: prof.id,
        action: 'PROFESSIONAL_REJECTED',
        details: { cref: prof.cref, name: prof.name, reason: 'Documento divergente' },
      })

      toast.info(`Cadastro de ${prof.name} reprovado e registrado em auditoria.`)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao reprovar.')
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
      <div className="flex bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] max-w-md">
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
              <Card
                key={prof.id}
                className="bg-[#181818] border border-amber-500/30 p-6 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-4">
                  <img
                    src="https://img.usecurling.com/ppl/medium?gender=male&seed=3"
                    alt={prof.name}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold font-montserrat text-white text-base">
                        {prof.name}
                      </h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/40">
                        Pendente de Análise
                      </span>
                    </div>

                    <p className="text-xs text-[#0057FF] font-semibold mt-0.5">
                      {prof.specialties?.join(' • ') || 'Educação Física'}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-inter mt-2">
                      <span className="font-mono text-white">
                        Registro:{' '}
                        <strong className="text-[#D4AF37]">{prof.cref || 'Em validação'}</strong>
                      </span>
                      <span>•</span>
                      <span>Tipo: {prof.professional_type || 'Pessoa Física'}</span>
                      <span>•</span>
                      <span>
                        {prof.city} - {prof.state}
                      </span>
                    </div>

                    {prof.bio && (
                      <p className="text-xs text-gray-300 font-inter mt-2 max-w-xl italic">
                        &ldquo;{prof.bio}&rdquo;
                      </p>
                    )}

                    {/* Vídeo de Apresentação Auditável */}
                    {prof.video_url && prof.video_url.trim() ? (
                      <div className="mt-3 p-3 bg-[#141414] border border-[#2A2A2A] rounded-xl max-w-lg space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#D4AF37] flex items-center gap-1.5 uppercase font-montserrat text-[11px]">
                            <Video className="w-3.5 h-3.5" />
                            Vídeo de Apresentação (30s Pitch)
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              prof.video_enabled
                                ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                                : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {prof.video_enabled ? 'Vídeo Ativo' : 'Vídeo Não Liberado'}
                          </span>
                        </div>
                        <PresentationVideoPlayer url={prof.video_url} profName={prof.name} />
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] uppercase font-bold">
                          Sem Vídeo
                        </span>
                        <span>Profissional não cadastrou link de apresentação.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <Button
                    onClick={() => handleApprove(prof)}
                    className="flex-1 lg:flex-initial bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.25)]"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Aprovar Cadastro
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReject(prof)}
                    className="flex-1 lg:flex-initial border-red-900 text-red-400 hover:bg-red-950/30 text-xs uppercase px-4 py-2.5 rounded-xl"
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reprovar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ))}
    </div>
  )
}

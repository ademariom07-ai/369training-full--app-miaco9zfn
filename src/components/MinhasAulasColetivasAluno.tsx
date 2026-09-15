import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Users,
  Camera,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Eye,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { api, type GroupSessionParticipantRecord, type GroupSessionRecord } from '@/services/api'

interface MinhasAulasColetivasAlunoProps {
  currentUserId: string
}

export function MinhasAulasColetivasAluno({ currentUserId }: MinhasAulasColetivasAlunoProps) {
  const [participants, setParticipants] = useState<GroupSessionParticipantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modal para ver Selfie Coletiva
  const [selfieModalOpen, setSelfieModalOpen] = useState(false)
  const [activeSessionSelfie, setActiveSessionSelfie] = useState<GroupSessionRecord | null>(null)

  const loadMyGroupSessions = async () => {
    try {
      setLoading(true)
      // Buscar participações do aluno logado
      const res = await pb
        .collection('group_session_participants')
        .getList<GroupSessionParticipantRecord>(1, 50, {
          filter: `student = "${currentUserId}"`,
          expand: 'session,session.professional',
          sort: '-created',
        })
      setParticipants(res.items)
    } catch (err) {
      console.error('Erro ao carregar aulas coletivas do aluno:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUserId) {
      loadMyGroupSessions()
    }
  }, [currentUserId])

  // Aluno confirma a própria presença ("Estou presente")
  const handleConfirmPresence = async (participantId: string) => {
    setActionLoading(participantId)
    try {
      const res = await api.validateGroupSessionAttendance({
        participant_id: participantId,
        action: 'confirm',
      })

      toast.success(
        res.message || 'Presença confirmada com sucesso! Pontuação validada no Ranking 369.',
      )
      await loadMyGroupSessions()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao confirmar presença na aula coletiva.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return null // silêncio durante o carregamento inicial para não saltar na tela
  }

  if (participants.length === 0) {
    return null // se o aluno não estiver em nenhuma aula coletiva, não polui a home
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black font-montserrat uppercase text-[#1A1A1A] flex items-center gap-2">
              Minhas Aulas Coletivas & Treinos em Grupo
            </h2>
            <p className="text-xs text-gray-500 font-inter">
              Confirme sua presença pelo app para validar sua pontuação e rateio de cashback.
            </p>
          </div>
        </div>

        <Badge className="bg-[#D4AF37]/20 text-[#8B6508] border border-[#D4AF37]/40 text-[10px] font-extrabold uppercase">
          {participants.length} {participants.length === 1 ? 'Aula' : 'Aulas'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {participants.map((participant) => {
          const session = participant.expand?.session as GroupSessionRecord | undefined
          if (!session) return null

          const profUser = (session.expand as any)?.professional
          const profName = profUser?.name || 'Profissional 369'
          const isConfirmed =
            participant.attendance_status === 'confirmado' ||
            participant.attendance_status === 'marcado_presente'
          const isAbsent = participant.attendance_status === 'ausente'
          const isPending = participant.attendance_status === 'pendente'

          const hasSelfie = !!session.group_selfie
          const selfieUrl = hasSelfie ? pb.files.getURL(session, session.group_selfie) : null

          // Checar janela de confirmação (padrão 24h a partir do início da sessão)
          const sessionDateTime = new Date(`${session.date}T${session.start_time}:00`)
          const windowHours = Number(session.validation_window_hours) || 24
          const deadline = new Date(sessionDateTime.getTime() + windowHours * 60 * 60 * 1000)
          const now = new Date()
          const isExpired = now.getTime() > deadline.getTime()
          const isTooEarly = now.getTime() < sessionDateTime.getTime() - 2 * 60 * 60 * 1000 // mais de 2h antes

          return (
            <Card
              key={participant.id}
              className="bg-white border border-[#E5E3DC] hover:border-[#D4AF37] p-5 rounded-2xl transition-all shadow-xs flex flex-col justify-between gap-4"
            >
              <div>
                {/* Header da Aula */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-[#B8962E] font-montserrat tracking-wider block">
                      {session.specialty.replace('_', ' ')} • {profName}
                    </span>
                    <h3 className="text-base font-bold font-montserrat text-[#1A1A1A]">
                      {session.title}
                    </h3>
                  </div>

                  <Badge
                    className={`text-[9px] uppercase font-bold shrink-0 ${
                      isConfirmed
                        ? 'bg-[#22C55E]/15 text-[#166534] border border-[#22C55E]/40'
                        : isAbsent
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isConfirmed
                      ? 'Presença Confirmada'
                      : isAbsent
                        ? 'Ausente'
                        : 'Confirmação Pendente'}
                  </Badge>
                </div>

                {/* Info Row */}
                <div className="p-3 rounded-xl bg-[#FAFAF7] border border-[#E5E3DC] text-xs space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-[#B8962E]" />
                      {session.date}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#0057FF]" />
                      {session.start_time}
                      {session.end_time ? ` - ${session.end_time}` : ''}
                    </span>
                  </div>

                  {session.location && (
                    <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{session.location}</span>
                    </div>
                  )}
                </div>

                {/* SELFIE STATUS & AUDITORIA */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-zinc-50 to-amber-50/30 border border-[#E5E3DC] flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    {hasSelfie && selfieUrl ? (
                      <img
                        src={selfieUrl}
                        alt="Selfie da Turma"
                        className="w-10 h-10 rounded-lg object-cover border border-[#22C55E] cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setActiveSessionSelfie(session)
                          setSelfieModalOpen(true)
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                        <Camera className="w-4 h-4" />
                      </div>
                    )}

                    <div>
                      <span className="font-bold text-[#1A1A1A] block text-xs">
                        {hasSelfie
                          ? 'Selfie Coletiva da Turma'
                          : 'Aguardando Selfie do Profissional'}
                      </span>
                      <span className="text-[10px] text-gray-500 font-inter">
                        {hasSelfie
                          ? 'Foto registrada para comprovação e auditoria'
                          : 'O profissional anexará a foto da turma na aula'}
                      </span>
                    </div>
                  </div>

                  {hasSelfie && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveSessionSelfie(session)
                        setSelfieModalOpen(true)
                      }}
                      className="border-[#D4AF37] text-[#8B6508] hover:bg-[#D4AF37]/10 text-[10px] font-bold uppercase h-7 px-2"
                    >
                      <Eye className="w-3 h-3 mr-1" /> Ver Foto
                    </Button>
                  )}
                </div>
              </div>

              {/* ACTION AREA */}
              <div className="pt-3 border-t border-[#E5E3DC] flex items-center justify-between gap-3">
                <div className="text-[11px] text-gray-500 font-inter">
                  {isConfirmed ? (
                    <span className="text-[#166534] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                      Validado para Ranking & Cashback
                    </span>
                  ) : isExpired ? (
                    <span className="text-red-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Janela expirada (+{windowHours}h)
                    </span>
                  ) : isTooEarly ? (
                    <span className="text-amber-700 font-medium">Libera 2h antes da aula</span>
                  ) : (
                    <span className="text-amber-700 font-medium">
                      Janela aberta para confirmação
                    </span>
                  )}
                </div>

                {isPending && !isExpired && !isTooEarly && (
                  <Button
                    size="sm"
                    onClick={() => handleConfirmPresence(participant.id)}
                    disabled={actionLoading === participant.id}
                    className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-xs uppercase px-4 h-9 rounded-xl shadow-[0_0_12px_rgba(34,197,94,0.3)] flex items-center gap-1.5"
                  >
                    {actionLoading === participant.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Estou Presente
                      </>
                    )}
                  </Button>
                )}

                {isConfirmed && (
                  <div className="inline-flex items-center gap-1 text-[#166534] text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> Presença OK
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* MODAL PARA VER A SELFIE COLETIVA */}
      <Dialog open={selfieModalOpen} onOpenChange={setSelfieModalOpen}>
        <DialogContent className="bg-white border border-[#E5E3DC] text-[#1A1A1A] max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-[#1A1A1A] uppercase flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#B8962E]" />
              Foto Coletiva da Turma
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 font-inter">
              Registro fotográfico da aula anexado pelo profissional para validação da turma.
            </DialogDescription>
          </DialogHeader>

          {activeSessionSelfie && activeSessionSelfie.group_selfie && (
            <div className="space-y-3 pt-2">
              <img
                src={pb.files.getURL(activeSessionSelfie, activeSessionSelfie.group_selfie)}
                alt="Selfie Coletiva da Turma"
                className="w-full h-72 rounded-xl object-cover border border-[#D4AF37] shadow-md"
              />
              <div className="p-3 bg-[#FAFAF7] rounded-xl text-xs space-y-1">
                <p className="font-bold text-[#1A1A1A]">{activeSessionSelfie.title}</p>
                <p className="text-gray-500">
                  Data: {activeSessionSelfie.date} às {activeSessionSelfie.start_time}
                </p>
                {activeSessionSelfie.selfie_uploaded_at && (
                  <p className="text-[10px] text-gray-400 font-mono">
                    Registrada em: {activeSessionSelfie.selfie_uploaded_at}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

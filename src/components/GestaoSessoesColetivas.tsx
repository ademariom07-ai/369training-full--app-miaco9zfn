import React, { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  XCircle,
  Plus,
  Loader2,
  AlertCircle,
  Zap,
  Image as ImageIcon,
  Check,
  UserCheck,
  UserX,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import {
  api,
  type GroupSessionRecord,
  type GroupSessionParticipantRecord,
  type GroupSessionSpecialty,
} from '@/services/api'
import type { UserProfile } from '@/contexts/AuthContext'

interface GestaoSessoesColetivasProps {
  currentUserId: string
  students: UserProfile[]
}

const SPECIALTY_OPTIONS: { id: GroupSessionSpecialty; label: string; icon: string }[] = [
  { id: 'educacao_fisica', label: 'Educação Física / Treinamento', icon: '🏋️' },
  { id: 'nutricao', label: 'Nutrição / Workshop em Grupo', icon: '🥗' },
  { id: 'fisioterapia', label: 'Fisioterapia / Turma Preventiva', icon: '🩺' },
  { id: 'artes_marciais', label: 'Artes Marciais / Turma de Dojo', icon: '🥋' },
  { id: 'psicologia', label: 'Psicologia / Roda & Mental Training', icon: '🧠' },
]

export function GestaoSessoesColetivas({ currentUserId, students }: GestaoSessoesColetivasProps) {
  const [sessions, setSessions] = useState<GroupSessionRecord[]>([])
  const [participantsBySession, setParticipantsBySession] = useState<
    Record<string, GroupSessionParticipantRecord[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modal Criar Aula Coletiva
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [savingSession, setSavingSession] = useState(false)

  // Form states
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionSpecialty, setSessionSpecialty] = useState<GroupSessionSpecialty>('educacao_fisica')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sessionStartTime, setSessionStartTime] = useState('08:00')
  const [sessionEndTime, setSessionEndTime] = useState('09:00')
  const [sessionLocation, setSessionLocation] = useState('Sala Principal / Tatame')
  const [sessionMaxCapacity, setSessionMaxCapacity] = useState('15')
  const [sessionPrice, setSessionPrice] = useState('50.00')
  const [sessionWindowHours, setSessionWindowHours] = useState('24')
  const [sessionNotes, setSessionNotes] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [guestListInput, setGuestListInput] = useState('') // convidados extras: Nome (opcional)

  // Modal Selfie Coletiva Upload / Preview
  const [selfieModalOpen, setSelfieModalOpen] = useState(false)
  const [activeSessionForSelfie, setActiveSessionForSelfie] = useState<GroupSessionRecord | null>(
    null,
  )
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal Detalhes & Presenças da Sessão
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [activeSessionForDetails, setActiveSessionForDetails] = useState<GroupSessionRecord | null>(
    null,
  )

  // Carregar sessões e participantes
  const loadSessions = async () => {
    try {
      setLoading(true)
      const res = await pb.collection('group_sessions').getList<GroupSessionRecord>(1, 100, {
        filter: `professional = "${currentUserId}"`,
        sort: '-date,-start_time',
      })
      setSessions(res.items)

      // Carregar participantes de todas as sessões
      if (res.items.length > 0) {
        const sessionIds = res.items.map((s) => s.id)
        const filterStr = sessionIds.map((id) => `session = "${id}"`).join(' || ')
        const pRes = await pb
          .collection('group_session_participants')
          .getList<GroupSessionParticipantRecord>(1, 500, {
            filter: filterStr,
            expand: 'student',
            sort: 'created',
          })

        const mapped: Record<string, GroupSessionParticipantRecord[]> = {}
        for (const item of pRes.items) {
          if (!mapped[item.session]) mapped[item.session] = []
          mapped[item.session].push(item)
        }
        setParticipantsBySession(mapped)
      } else {
        setParticipantsBySession({})
      }
    } catch (err) {
      console.error('Erro ao carregar sessões coletivas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUserId) {
      loadSessions()
    }
  }, [currentUserId])

  // Submeter Criação de Sessão com Alunos
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionTitle.trim()) {
      toast.error('Informe um título para a aula/treinamento coletivo')
      return
    }

    setSavingSession(true)
    try {
      // 1. Criar group_session
      const createdSession = await pb.collection('group_sessions').create<GroupSessionRecord>({
        professional: currentUserId,
        title: sessionTitle.trim(),
        specialty: sessionSpecialty,
        date: sessionDate,
        start_time: sessionStartTime,
        end_time: sessionEndTime || null,
        location: sessionLocation.trim() || null,
        max_capacity: parseInt(sessionMaxCapacity, 10) || null,
        status: 'agendada',
        validation_window_hours: parseInt(sessionWindowHours, 10) || 24,
        price_per_participant: parseFloat(sessionPrice) || 0,
        notes: sessionNotes.trim() || null,
      })

      // 2. Criar participantes selecionados cadastrados na plataforma
      const participantPromises = selectedStudentIds.map((studentId) =>
        pb.collection('group_session_participants').create({
          session: createdSession.id,
          student: studentId,
          attendance_status: 'pendente',
          is_registered_user: true,
          fee_charged: false,
          points_awarded: false,
        }),
      )

      // 3. Processar convidados extras (visitantes sem conta)
      const guestLines = guestListInput
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

      for (const guest of guestLines) {
        participantPromises.push(
          pb.collection('group_session_participants').create({
            session: createdSession.id,
            guest_name: guest,
            attendance_status: 'pendente',
            is_registered_user: false,
            fee_charged: false,
            points_awarded: false,
            notes: 'Visitante convidado (sem conta)',
          }),
        )
      }

      await Promise.all(participantPromises)

      toast.success(
        `Aula coletiva "${createdSession.title}" criada com ${
          selectedStudentIds.length + guestLines.length
        } participante(s)!`,
      )
      setCreateModalOpen(false)
      // Reset form
      setSessionTitle('')
      setSelectedStudentIds([])
      setGuestListInput('')
      await loadSessions()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao criar sessão de grupo.')
    } finally {
      setSavingSession(false)
    }
  }

  // Upload da Selfie Coletiva
  const handleUploadSelfie = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSessionForSelfie || !selfieFile) {
      toast.error('Selecione uma imagem de selfie coletiva da turma')
      return
    }

    setUploadingSelfie(true)
    try {
      const formData = new FormData()
      formData.append('group_selfie', selfieFile)
      formData.append('selfie_uploaded_at', new Date().toISOString().replace('T', ' ').slice(0, 19))
      // Se a sessão estava agendada, podemos atualizar para 'em_andamento' ou manter
      if (activeSessionForSelfie.status === 'agendada') {
        formData.append('status', 'em_andamento')
      }

      await pb.collection('group_sessions').update(activeSessionForSelfie.id, formData)

      toast.success(
        'Foto/selfie coletiva da turma anexada com sucesso! Alunos já podem validar presença no app.',
      )
      setSelfieModalOpen(false)
      setSelfieFile(null)
      setSelfiePreview(null)
      await loadSessions()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao enviar selfie coletiva.')
    } finally {
      setUploadingSelfie(false)
    }
  }

  // Validação Manual de Presença pelo Profissional
  const handleValidateParticipant = async (
    participantId: string,
    action: 'confirm' | 'mark_absent',
  ) => {
    setActionLoading(`part-${participantId}-${action}`)
    try {
      const res = await api.validateGroupSessionAttendance({
        participant_id: participantId,
        action,
      })

      if (action === 'confirm') {
        toast.success(
          res.is_registered_user
            ? 'Presença validada! Tarifa de serviço debitada e pontuação recalculada no Ranking.'
            : 'Presença confirmada para convidado (sem conta, sem tarifa/pontos).',
        )
      } else {
        toast.info('Participante marcado como ausente.')
      }

      await loadSessions()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao processar presença.')
    } finally {
      setActionLoading(null)
    }
  }

  // Concluir Sessão Coletiva
  const handleCompleteSession = async (sessionId: string) => {
    setActionLoading(`session-comp-${sessionId}`)
    try {
      await pb.collection('group_sessions').update(sessionId, {
        status: 'concluida',
      })
      toast.success('Aula coletiva concluída com sucesso!')
      await loadSessions()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao concluir aula.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER BAR COLETIVO */}
      <div className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 uppercase font-montserrat flex items-center gap-1">
              <Users className="w-3 h-3" /> Multi-Aluno & Turmas Coletivas
            </span>
            <span className="text-xs text-gray-400 font-inter">
              (Ed. Física, Nutrição, Fisioterapia, Artes Marciais, Psicologia)
            </span>
          </div>
          <h2 className="text-xl font-black font-montserrat text-white uppercase tracking-tight">
            Aulas Coletivas & Validação de Presença
          </h2>
          <p className="text-xs text-gray-400 font-inter max-w-2xl mt-1">
            Cadastre múltiplos alunos na mesma aula, anexe a{' '}
            <strong className="text-white">selfie coletiva</strong> da turma e valide presenças.
            Alunos com conta ativa geram tarifa do plano e pontuam no Ranking.
          </p>
        </div>

        <Button
          onClick={() => {
            // Pré-selecionar os 3 primeiros alunos se houver
            if (students.length >= 3 && selectedStudentIds.length === 0) {
              setSelectedStudentIds(students.slice(0, 3).map((s) => s.id))
            }
            setCreateModalOpen(true)
          }}
          className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Nova Aula Coletiva (Multi-Aluno)
        </Button>
      </div>

      {/* SESSIONS LIST */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 bg-[#181818] rounded-2xl border border-[#2A2A2A]">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <p className="text-xs text-gray-400 font-inter">Carregando aulas coletivas...</p>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white font-montserrat uppercase">
            Nenhuma Aula Coletiva Agendada
          </h3>
          <p className="text-xs text-gray-400 font-inter mt-1 max-w-md mx-auto">
            Crie sua primeira turma multi-aluno (treinamento funcional, grupo de corrida, turma de
            artes marciais, roda de psicologia ou oficina nutricional).
          </p>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 bg-[#D4AF37] text-black hover:bg-[#E6C65C] text-xs font-bold uppercase rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Criar Aula Coletiva Agora
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {sessions.map((session) => {
            const participants = participantsBySession[session.id] || []
            const confirmedCount = participants.filter(
              (p) =>
                p.attendance_status === 'confirmado' || p.attendance_status === 'marcado_presente',
            ).length
            const pendingCount = participants.filter(
              (p) => p.attendance_status === 'pendente',
            ).length
            const absentCount = participants.filter((p) => p.attendance_status === 'ausente').length
            const hasSelfie = !!session.group_selfie

            // Specialty label & icon
            const specMeta = SPECIALTY_OPTIONS.find((s) => s.id === session.specialty) || {
              label: session.specialty,
              icon: '📋',
            }

            // Url da selfie no PB
            const selfieUrl = session.group_selfie
              ? pb.files.getURL(session, session.group_selfie)
              : null

            return (
              <Card
                key={session.id}
                className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/50 rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 shadow-lg"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{specMeta.icon}</span>
                        <span className="text-[10px] font-bold text-[#D4AF37] uppercase font-montserrat">
                          {specMeta.label}
                        </span>
                        <Badge
                          className={`text-[9px] uppercase font-extrabold px-2 py-0.5 ${
                            session.status === 'concluida'
                              ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                              : session.status === 'em_andamento'
                                ? 'bg-[#0057FF]/20 text-[#0057FF] border border-[#0057FF]/40'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          }`}
                        >
                          {session.status}
                        </Badge>
                      </div>

                      <h3 className="text-lg font-black font-montserrat text-white leading-tight">
                        {session.title}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-gray-400 block font-inter">Por Aluno</span>
                      <span className="text-base font-black font-montserrat text-[#D4AF37]">
                        R$ {(session.price_per_participant || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Info Badges Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs mb-4">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="font-mono text-[11px]">{session.date}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-[#0057FF]" />
                      <span className="font-mono text-[11px]">
                        {session.start_time}
                        {session.end_time ? ` - ${session.end_time}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-300 col-span-2 sm:col-span-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate text-[11px]">
                        {session.location || 'Local a definir'}
                      </span>
                    </div>
                  </div>

                  {/* PRESENÇA & SELFIE STATUS BOX */}
                  <div className="p-3.5 rounded-xl bg-[#161616] border border-[#2A2A2A] space-y-3">
                    {/* Presenças Summary */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#D4AF37]" />
                        <span className="text-xs font-bold font-montserrat uppercase text-white">
                          Presenças: {confirmedCount}/{participants.length} Validados
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-bold font-mono">
                        <span className="text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded border border-[#22C55E]/30">
                          {confirmedCount} presentes
                        </span>
                        <span className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                          {pendingCount} pendentes
                        </span>
                        {absentCount > 0 && (
                          <span className="text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/30">
                            {absentCount} ausentes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selfie Coletiva Preview / Upload Prompt */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2A]">
                      <div className="flex items-center gap-3">
                        {hasSelfie && selfieUrl ? (
                          <img
                            src={selfieUrl}
                            alt="Selfie Coletiva"
                            className="w-12 h-12 rounded-xl object-cover border border-[#22C55E] cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setActiveSessionForSelfie(session)
                              setSelfieModalOpen(true)
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-dashed border-zinc-700 flex items-center justify-center text-gray-500">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}

                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1">
                            {hasSelfie ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                                Selfie Coletiva Anexada
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                Selfie Coletiva Pendente
                              </>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400 font-inter">
                            {hasSelfie
                              ? 'Foto oficial da turma validando o treino coletivo.'
                              : 'Tire ou anexe uma foto da turma reunida para auditoria.'}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveSessionForSelfie(session)
                          setSelfieFile(null)
                          setSelfiePreview(null)
                          setSelfieModalOpen(true)
                        }}
                        className={`text-xs font-bold font-montserrat uppercase rounded-xl h-8 px-3 ${
                          hasSelfie
                            ? 'bg-[#181818] border border-[#2A2A2A] text-gray-200 hover:border-[#D4AF37]'
                            : 'bg-[#D4AF37] text-black hover:bg-[#E6C65C]'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 mr-1" />
                        {hasSelfie ? 'Ver / Trocar' : 'Tirar Selfie'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="pt-3 border-t border-[#2A2A2A] flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveSessionForDetails(session)
                      setDetailsModalOpen(true)
                    }}
                    className="border-[#2A2A2A] text-white hover:border-[#D4AF37] text-xs font-bold rounded-xl"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]" />
                    Gerenciar Presenças ({participants.length})
                  </Button>

                  <div className="flex items-center gap-2">
                    {session.status !== 'concluida' && (
                      <Button
                        size="sm"
                        onClick={() => handleCompleteSession(session.id)}
                        disabled={actionLoading === `session-comp-${session.id}`}
                        className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-xs uppercase px-4 rounded-xl shadow-[0_0_12px_rgba(34,197,94,0.3)] flex items-center gap-1.5"
                      >
                        {actionLoading === `session-comp-${session.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 fill-black" /> Concluir Aula
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL 1: CRIAR AULA COLETIVA MULTI-ALUNO */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-[#D4AF37]" />
              Nova Aula / Treinamento Coletivo
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Cadastre múltiplos alunos para uma mesma aula ou turma. Suporta todas as
              especialidades (Educação Física, Nutrição, Fisioterapia, Artes Marciais e Psicologia).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSession} className="space-y-4 pt-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Título da Aula / Treinamento Coletivo *
              </label>
              <Input
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Ex: Treino Funcional HIIT em Grupo, Turma de Jiu-Jitsu Faixa Branca..."
                className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white text-xs h-10"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Especialidade / Modalidade *
                </label>
                <select
                  value={sessionSpecialty}
                  onChange={(e) => setSessionSpecialty(e.target.value as GroupSessionSpecialty)}
                  className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                  required
                >
                  {SPECIALTY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Local / Endereço / Sala
                </label>
                <Input
                  value={sessionLocation}
                  onChange={(e) => setSessionLocation(e.target.value)}
                  placeholder="Ex: Sala 3, Tatame B, Parque Ibirapuera..."
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white text-xs h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Data da Aula *
                </label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white text-xs h-10 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Início *
                </label>
                <Input
                  type="time"
                  value={sessionStartTime}
                  onChange={(e) => setSessionStartTime(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white text-xs h-10 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Término
                </label>
                <Input
                  type="time"
                  value={sessionEndTime}
                  onChange={(e) => setSessionEndTime(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white text-xs h-10 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Valor por Aluno (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sessionPrice}
                  onChange={(e) => setSessionPrice(e.target.value)}
                  placeholder="50.00"
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs h-10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Capacidade Máxima
                </label>
                <Input
                  type="number"
                  min="1"
                  value={sessionMaxCapacity}
                  onChange={(e) => setSessionMaxCapacity(e.target.value)}
                  placeholder="15"
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs h-10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Janela de Validação (Horas)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={sessionWindowHours}
                  onChange={(e) => setSessionWindowHours(e.target.value)}
                  placeholder="24"
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs h-10"
                />
              </div>
            </div>

            {/* SELEÇÃO MULTI-ALUNO DA CARTEIRA */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-200 uppercase font-montserrat flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#D4AF37]" />
                  Selecionar Alunos da Plataforma ({selectedStudentIds.length} selecionados)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIds(students.map((s) => s.id))}
                    className="text-[10px] text-[#D4AF37] hover:underline font-bold uppercase"
                  >
                    Marcar Todos
                  </button>
                  <span className="text-gray-600">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIds([])}
                    className="text-[10px] text-gray-400 hover:underline font-bold uppercase"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto p-2 bg-[#181818] border border-[#2A2A2A] rounded-xl space-y-1">
                {students.length === 0 ? (
                  <p className="text-xs text-gray-500 p-3 text-center">
                    Nenhum aluno cadastrado na plataforma ainda.
                  </p>
                ) : (
                  students.map((student) => {
                    const isSelected = selectedStudentIds.includes(student.id)
                    return (
                      <div
                        key={student.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id))
                          } else {
                            setSelectedStudentIds((prev) => [...prev, student.id])
                          }
                        }}
                        className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-white'
                            : 'hover:bg-white/5 border border-transparent text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isSelected
                                ? 'bg-[#D4AF37] border-[#D4AF37] text-black'
                                : 'border-gray-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="font-semibold">{student.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ({student.email})
                          </span>
                        </div>
                        <Badge className="text-[9px] uppercase font-mono bg-zinc-800 text-zinc-300">
                          {student.plan || 'gratis'}
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Apenas alunos cadastrados na plataforma pontuam no Ranking e geram a tarifa do seu
                plano (R$ 1/2/3).
              </p>
            </div>

            {/* CONVIDADOS EXTRAS (VISITANTES) */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Convidados / Visitantes Sem Conta (Opcional - 1 por linha)
              </label>
              <textarea
                value={guestListInput}
                onChange={(e) => setGuestListInput(e.target.value)}
                placeholder="Ex: Carlos Convidado&#10;Mariana Silva (Aula Experimental)"
                rows={2}
                className="w-full p-2.5 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-mono focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
              />
              <p className="text-[10px] text-amber-400 mt-0.5">
                Visitantes sem conta não geram cobrança de tarifa nem pontuação no Ranking.
              </p>
            </div>

            <Button
              type="submit"
              disabled={savingSession}
              className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase h-11 rounded-xl mt-4"
            >
              {savingSession ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Criar Aula Coletiva (${selectedStudentIds.length} Alunos Selecionados)`
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: UPLOAD DE SELFIE COLETIVA */}
      <Dialog open={selfieModalOpen} onOpenChange={setSelfieModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#D4AF37]" />
              Selfie Coletiva da Turma
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Anexe uma foto coletiva de todos os presentes para validação e auditoria da aula.
            </DialogDescription>
          </DialogHeader>

          {activeSessionForSelfie && (
            <div className="space-y-4 pt-3">
              <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs">
                <p className="font-bold text-white">{activeSessionForSelfie.title}</p>
                <p className="text-gray-400">
                  {activeSessionForSelfie.date} às {activeSessionForSelfie.start_time} •{' '}
                  {activeSessionForSelfie.location || 'Local informado'}
                </p>
              </div>

              {/* Se já existe selfie no PB e nenhuma nova foto selecionada */}
              {activeSessionForSelfie.group_selfie && !selfiePreview && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-300 uppercase font-montserrat">
                    Foto Atual da Turma:
                  </p>
                  <img
                    src={pb.files.getURL(
                      activeSessionForSelfie,
                      activeSessionForSelfie.group_selfie,
                    )}
                    alt="Selfie Coletiva Atual"
                    className="w-full h-56 rounded-xl object-cover border border-[#22C55E]"
                  />
                  {activeSessionForSelfie.selfie_uploaded_at && (
                    <p className="text-[10px] text-gray-400 text-right font-mono">
                      Enviada em: {activeSessionForSelfie.selfie_uploaded_at}
                    </p>
                  )}
                </div>
              )}

              {/* Preview de nova foto */}
              {selfiePreview && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#D4AF37] uppercase font-montserrat">
                    Nova Foto Selecionada:
                  </p>
                  <img
                    src={selfiePreview}
                    alt="Preview Selfie"
                    className="w-full h-56 rounded-xl object-cover border border-[#D4AF37]"
                  />
                </div>
              )}

              {/* Input de arquivo */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment" // abre câmera no celular se disponível
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setSelfieFile(file)
                    setSelfiePreview(URL.createObjectURL(file))
                  }
                }}
                className="hidden"
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-[#2A2A2A] text-white hover:border-[#D4AF37] text-xs font-bold rounded-xl h-10"
                >
                  <Camera className="w-4 h-4 mr-1.5 text-[#D4AF37]" />
                  {selfieFile ? 'Escolher Outra Foto' : 'Tirar / Selecionar Foto'}
                </Button>
              </div>

              {selfieFile && (
                <Button
                  onClick={handleUploadSelfie}
                  disabled={uploadingSelfie}
                  className="w-full bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-xs uppercase h-11 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                >
                  {uploadingSelfie ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Salvar Foto da Turma na Plataforma'
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: GERENCIAR PARTICIPANTES E PRESENÇAS */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#D4AF37]" />
              Lista de Presenças — {activeSessionForDetails?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Presenças validadas automaticamente quando o aluno confirma no app dele ou confirmadas
              manualmente por você aqui.
            </DialogDescription>
          </DialogHeader>

          {activeSessionForDetails && (
            <div className="space-y-4 pt-3">
              {/* Resumo da Sessão */}
              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-gray-400 font-mono text-[11px] block">
                    {activeSessionForDetails.date} às {activeSessionForDetails.start_time}
                  </span>
                  <span className="font-bold text-white uppercase">
                    Janela de Validação: {activeSessionForDetails.validation_window_hours || 24}h
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 uppercase text-[10px] font-bold">
                    Tarifa por Aluno: R${' '}
                    {(activeSessionForDetails.price_per_participant || 0).toFixed(2)}
                  </Badge>
                </div>
              </div>

              {/* Lista de Participantes */}
              <div className="space-y-2">
                {(participantsBySession[activeSessionForDetails.id] || []).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    Nenhum participante vinculado a esta sessão.
                  </p>
                ) : (
                  (participantsBySession[activeSessionForDetails.id] || []).map((participant) => {
                    const isRegistered = !!participant.student
                    const studentData = participant.expand?.student
                    const studentName =
                      studentData?.name || participant.guest_name || 'Participante'
                    const studentEmail = studentData?.email || participant.guest_email || ''
                    const isPresent =
                      participant.attendance_status === 'confirmado' ||
                      participant.attendance_status === 'marcado_presente'
                    const isAbsent = participant.attendance_status === 'ausente'
                    const isPending = participant.attendance_status === 'pendente'

                    return (
                      <div
                        key={participant.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          isPresent
                            ? 'bg-[#22C55E]/10 border-[#22C55E]/40'
                            : isAbsent
                              ? 'bg-red-950/20 border-red-900/40 text-gray-400'
                              : 'bg-[#181818] border-[#2A2A2A]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold font-montserrat text-white text-sm">
                              {studentName}
                            </h4>
                            {isRegistered ? (
                              <Badge className="text-[9px] uppercase font-bold bg-[#0057FF]/20 text-[#0057FF] border border-[#0057FF]/40">
                                Conta Cadastrada
                              </Badge>
                            ) : (
                              <Badge className="text-[9px] uppercase font-bold bg-zinc-800 text-zinc-400">
                                Visitante
                              </Badge>
                            )}

                            <Badge
                              className={`text-[9px] uppercase font-extrabold px-1.5 ${
                                isPresent
                                  ? 'bg-[#22C55E] text-black'
                                  : isAbsent
                                    ? 'bg-red-500 text-white'
                                    : 'bg-amber-500 text-black'
                              }`}
                            >
                              {participant.attendance_status}
                            </Badge>
                          </div>

                          <div className="text-[11px] text-gray-400 font-mono mt-0.5 space-x-2">
                            {studentEmail && <span>{studentEmail}</span>}
                            {participant.confirmed_at && (
                              <span className="text-[#22C55E]">
                                • Confirmado em {participant.confirmed_at.slice(11, 16)} (
                                {participant.confirmation_method === 'self_app'
                                  ? 'Aluno via App'
                                  : 'Manual'}
                                )
                              </span>
                            )}
                            {participant.fee_charged && (
                              <span className="text-[#D4AF37] font-bold">
                                • Tarifa Debitada & Pontuado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação por Participante */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isPresent && (
                            <Button
                              size="sm"
                              onClick={() => handleValidateParticipant(participant.id, 'confirm')}
                              disabled={actionLoading === `part-${participant.id}-confirm`}
                              className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase rounded-xl h-8 px-3 flex items-center gap-1"
                            >
                              {actionLoading === `part-${participant.id}-confirm` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Validar Presença
                                </>
                              )}
                            </Button>
                          )}

                          {!isAbsent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleValidateParticipant(participant.id, 'mark_absent')
                              }
                              disabled={actionLoading === `part-${participant.id}-mark_absent`}
                              className="text-gray-400 hover:text-red-400 text-xs rounded-xl h-8 px-2"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Marcar Ausente
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

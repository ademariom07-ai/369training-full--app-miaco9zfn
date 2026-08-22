import React, { useState, useEffect } from 'react'
import { useAuth, type UserProfile } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Ban,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Zap,
  DollarSign,
  User,
  Activity,
  Layers,
  Sparkles,
  Loader2,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WeeklyScheduleRecord, AppointmentRecord } from '@/services/api'

// Days of week helper
const DAYS_OF_WEEK = [
  { id: 1, name: 'Segunda-feira', short: 'Seg' },
  { id: 2, name: 'Terça-feira', short: 'Ter' },
  { id: 3, name: 'Quarta-feira', short: 'Qua' },
  { id: 4, name: 'Quinta-feira', short: 'Qui' },
  { id: 5, name: 'Sexta-feira', short: 'Sex' },
  { id: 6, name: 'Sábado', short: 'Sáb' },
  { id: 0, name: 'Domingo', short: 'Dom' },
]

function getWeekDays(offsetWeeks = 1) {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 is Sunday, 1 is Monday
  // Days to target week's Monday
  const distanceToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) + offsetWeeks * 7
  const targetMonday = new Date(now)
  targetMonday.setDate(now.getDate() + distanceToMonday)

  return DAYS_OF_WEEK.map((dayItem, index) => {
    const d = new Date(targetMonday)
    d.setDate(targetMonday.getDate() + index)
    const dateStr = d.toISOString().slice(0, 10)
    return {
      ...dayItem,
      date: dateStr,
      displayDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      rawDate: d,
    }
  })
}

export default function AgendaServicos() {
  const { user } = useAuth()

  // Week offset: 0 = Esta Semana, 1 = Próxima Semana, 2 = Em 2 Semanas
  const [weekOffset, setWeekOffset] = useState<number>(1)
  const currentWeekDays = getWeekDays(weekOffset)

  // Data states
  const [schedules, setSchedules] = useState<WeeklyScheduleRecord[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [students, setStudents] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Slot Modal state (Adicionar faixa de horário)
  const [slotModalOpen, setSlotModalOpen] = useState(false)
  const [selectedDayForSlot, setSelectedDayForSlot] = useState<{
    date: string
    name: string
  } | null>(null)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('12:00')
  const [savingSlot, setSavingSlot] = useState(false)

  // Quick Appointment Modal state (Agendar direto pelo profissional)
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [selectedScheduleForApp, setSelectedScheduleForApp] = useState<WeeklyScheduleRecord | null>(
    null,
  )
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [appServiceType, setAppServiceType] = useState<
    'treino' | 'nutrição' | 'fisioterapia' | 'artes_marciais'
  >('treino')
  const [appValue, setAppValue] = useState('150.00')
  const [savingApp, setSavingApp] = useState(false)

  // Active view tab
  const [activeTab, setActiveTab] = useState<'grid' | 'appointments' | 'settings'>('grid')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Load Data
  const loadData = async () => {
    if (!user) return
    try {
      setLoading(true)
      const weekDates = currentWeekDays.map((d) => d.date)
      const minDate = weekDates[0]
      const maxDate = weekDates[weekDates.length - 1]

      // 1. Load schedules for current selected week
      const schedRes = await pb
        .collection('weekly_schedules')
        .getList<WeeklyScheduleRecord>(1, 100, {
          filter: `profissional = "${user.id}" && data >= "${minDate}" && data <= "${maxDate}"`,
          sort: 'data,hora_inicio',
        })
      setSchedules(schedRes.items)

      // 2. Load appointments for current professional
      const appRes = await pb.collection('appointments').getList<AppointmentRecord>(1, 100, {
        filter: `profissional = "${user.id}"`,
        sort: '-created',
        expand: 'aluno,schedule',
      })
      setAppointments(appRes.items)
    } catch (err) {
      console.error('Error loading agenda data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Initial load & students load
  useEffect(() => {
    pb.collection('users')
      .getList<UserProfile>(1, 50, { filter: 'role = "aluno"' })
      .then((res) => {
        setStudents(res.items)
        if (res.items.length > 0) setSelectedStudentId(res.items[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadData()
  }, [user, weekOffset])

  // Toggle Day Available (Bloquear / Desbloquear Dia Inteiro)
  const handleToggleDayBlock = async (
    dateStr: string,
    dayName: string,
    isCurrentlyBlocked: boolean,
  ) => {
    if (!user) return
    const daySchedules = schedules.filter((s) => s.data === dateStr)
    const newAvailableStatus = isCurrentlyBlocked // if currently blocked, we make it available (true)

    setActionLoading(`day-${dateStr}`)
    try {
      if (daySchedules.length === 0) {
        // Create default slots as available or blocked
        await pb.collection('weekly_schedules').create({
          profissional: user.id,
          dia_da_semana: dayName,
          data: dateStr,
          hora_inicio: '08:00',
          hora_fim: '18:00',
          disponivel: newAvailableStatus,
        })
      } else {
        // Update all slots of this day
        await Promise.all(
          daySchedules.map((s) =>
            pb.collection('weekly_schedules').update(s.id, {
              disponivel: newAvailableStatus,
            }),
          ),
        )
      }

      toast.success(
        newAvailableStatus
          ? `Dia ${dayName} desbloqueado para agendamentos!`
          : `Dia ${dayName} bloqueado completamente!`,
      )
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao alterar disponibilidade do dia.')
    } finally {
      setActionLoading(null)
    }
  }

  // Add new time range slot
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedDayForSlot) return

    setSavingSlot(true)
    try {
      await pb.collection('weekly_schedules').create({
        profissional: user.id,
        dia_da_semana: selectedDayForSlot.name,
        data: selectedDayForSlot.date,
        hora_inicio: startTime,
        hora_fim: endTime,
        disponivel: true,
      })

      toast.success(`Faixa ${startTime}–${endTime} adicionada com sucesso!`)
      setSlotModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao adicionar faixa de horário.')
    } finally {
      setSavingSlot(false)
    }
  }

  // Delete a specific time range slot
  const handleDeleteSlot = async (slotId: string) => {
    setActionLoading(`del-${slotId}`)
    try {
      await pb.collection('weekly_schedules').delete(slotId)
      toast.success('Faixa de horário removida.')
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao remover faixa de horário.')
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle specific slot availability
  const handleToggleSlotAvailability = async (slot: WeeklyScheduleRecord) => {
    setActionLoading(`slot-${slot.id}`)
    try {
      await pb.collection('weekly_schedules').update(slot.id, {
        disponivel: !slot.disponivel,
      })
      toast.success(
        !slot.disponivel
          ? `Horário ${slot.hora_inicio}–${slot.hora_fim} ativado!`
          : `Horário ${slot.hora_inicio}–${slot.hora_fim} pausado.`,
      )
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao alternar horário.')
    } finally {
      setActionLoading(null)
    }
  }

  // Complete Appointment (TRIGGERS RANKING ENGINE AND CASHBACK VIA ON_APPOINTMENT_COMPLETED HOOK)
  const handleCompleteAppointment = async (appointmentId: string) => {
    setActionLoading(`comp-${appointmentId}`)
    try {
      await pb.collection('appointments').update(appointmentId, {
        status: 'concluído',
      })

      toast.success('Atendimento concluído com sucesso! Motor de Ranking e Cashback 369 acionado.')
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao concluir atendimento.')
    } finally {
      setActionLoading(null)
    }
  }

  // Cancel Appointment
  const handleCancelAppointment = async (appointmentId: string) => {
    setActionLoading(`canc-${appointmentId}`)
    try {
      await pb.collection('appointments').update(appointmentId, {
        status: 'cancelado',
      })
      toast.info('Agendamento cancelado.')
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao cancelar agendamento.')
    } finally {
      setActionLoading(null)
    }
  }

  // Confirm Appointment
  const handleConfirmAppointment = async (appointmentId: string) => {
    setActionLoading(`conf-${appointmentId}`)
    try {
      await pb.collection('appointments').update(appointmentId, {
        status: 'confirmado',
      })
      toast.success('Agendamento confirmado!')
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao confirmar agendamento.')
    } finally {
      setActionLoading(null)
    }
  }

  // Create manual appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedStudentId) return

    setSavingApp(true)
    try {
      // Check if student is in referral list of partner
      let isPartnerList = false
      try {
        const ref = await pb
          .collection('referrals')
          .getFirstListItem(`referrer = "${user.id}" && referred = "${selectedStudentId}"`)
        if (ref) isPartnerList = true
      } catch {
        /* intentionally ignored */
      }

      const baseVal = parseFloat(appValue) || 150
      const extraFee = isPartnerList ? 0 : baseVal * 0.5

      await pb.collection('appointments').create({
        profissional: user.id,
        aluno: selectedStudentId,
        schedule: selectedScheduleForApp?.id || null,
        servico_tipo: appServiceType,
        status: 'confirmado',
        valor: baseVal,
        taxa_extra: extraFee,
      })

      toast.success(
        `Agendamento criado! ${
          extraFee > 0
            ? `(Taxa extra de R$ ${extraFee.toFixed(2)} aplicada - aluno fora da lista)`
            : '(Aluno vinculado à rede)'
        }`,
      )
      setAppointmentModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao criar agendamento.')
    } finally {
      setSavingApp(false)
    }
  }

  // Filtered Appointments
  const filteredAppointments = appointments.filter((app) => {
    if (statusFilter === 'todos') return true
    return app.status === statusFilter
  })

  // Quick stats
  const totalPending = appointments.filter((a) => a.status === 'pendente').length
  const totalConfirmed = appointments.filter((a) => a.status === 'confirmado').length
  const totalCompleted = appointments.filter((a) => a.status === 'concluído').length

  return (
    <div className="space-y-8 pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <CalendarIcon className="w-3.5 h-3.5" />
            Agenda Semanal & Atendimentos
          </div>
          <h1 className="text-3xl font-black font-montserrat text-white tracking-tight uppercase">
            Agenda do Profissional
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1 max-w-2xl">
            Configure sua disponibilidade semanal, bloqueie dias inteiros ou faixas de horário (ex:{' '}
            <span className="text-[#D4AF37] font-semibold">08:00–12:00</span>,{' '}
            <span className="text-[#D4AF37] font-semibold">14:00–18:00</span>) e gerencie os
            agendamentos de seus alunos com disparo instantâneo de Ranking e Cashback.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setSelectedScheduleForApp(null)
              setAppointmentModalOpen(true)
            }}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Agendamento
          </Button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0057FF]/15 border border-[#0057FF]/30 flex items-center justify-center text-[#0057FF]">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 font-montserrat">
              Semana Selecionada
            </p>
            <p className="text-base font-black text-white font-montserrat">
              {weekOffset === 0
                ? 'Esta Semana'
                : weekOffset === 1
                  ? 'Próxima Semana'
                  : `Em +${weekOffset} semanas`}
            </p>
          </div>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 font-montserrat">
              Pendentes de Confirmação
            </p>
            <p className="text-xl font-black text-amber-400 font-montserrat">{totalPending}</p>
          </div>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0057FF]/15 border border-[#0057FF]/30 flex items-center justify-center text-[#0057FF]">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 font-montserrat">
              Confirmados / Na Grade
            </p>
            <p className="text-xl font-black text-[#0057FF] font-montserrat">{totalConfirmed}</p>
          </div>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 font-montserrat">
              Concluídos & Pontuados
            </p>
            <p className="text-xl font-black text-[#22C55E] font-montserrat">{totalCompleted}</p>
          </div>
        </Card>
      </div>

      {/* WEEK NAVIGATION & TABS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#181818] border border-[#2A2A2A] p-3 sm:p-4 rounded-2xl">
        {/* Week Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            className="border-[#2A2A2A] text-white hover:border-[#D4AF37] h-9 w-9 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs font-bold text-white font-montserrat flex items-center gap-2">
            <span className="text-[#D4AF37]">
              {currentWeekDays[0].displayDate} a {currentWeekDays[6].displayDate}
            </span>
            <span className="text-gray-400 text-[10px]">
              (
              {weekOffset === 0
                ? 'Semana Atual'
                : weekOffset === 1
                  ? 'Próxima Semana'
                  : `+${weekOffset} sem`}
              )
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="border-[#2A2A2A] text-white hover:border-[#D4AF37] h-9 w-9 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold font-montserrat transition-all uppercase ${
              activeTab === 'grid'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Grade Semanal
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold font-montserrat transition-all uppercase flex items-center justify-center gap-1.5 ${
              activeTab === 'appointments'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Atendimentos Marcados
            {appointments.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-black/20 text-[10px] flex items-center justify-center">
                {appointments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: WEEKLY GRID */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 bg-[#181818] rounded-2xl border border-[#2A2A2A]">
              <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
              <p className="text-xs text-gray-400 font-inter">
                Carregando disponibilidade da semana...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
              {currentWeekDays.map((day) => {
                const daySchedules = schedules.filter((s) => s.data === day.date)
                // Day is blocked if explicitly all slots are disponivel=false or if marked
                const isEntirelyBlocked =
                  daySchedules.length > 0 && daySchedules.every((s) => !s.disponivel)

                const dayAppointments = appointments.filter((a) => {
                  if (a.expand?.schedule?.data === day.date) return true
                  // Check if schedule id is in day's schedules
                  return daySchedules.some((s) => s.id === a.schedule)
                })

                return (
                  <Card
                    key={day.date}
                    className={`bg-[#181818] border transition-all rounded-2xl p-4 flex flex-col justify-between min-h-[380px] ${
                      isEntirelyBlocked
                        ? 'border-red-900/40 bg-[#161313]'
                        : 'border-[#2A2A2A] hover:border-[#D4AF37]/50'
                    }`}
                  >
                    {/* Day Card Header */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-gray-400 font-montserrat">
                            {day.name}
                          </p>
                          <h3 className="text-lg font-black font-montserrat text-white">
                            {day.displayDate}
                          </h3>
                        </div>

                        {/* Block/Unblock Day Toggle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleDayBlock(day.date, day.name, isEntirelyBlocked)
                          }
                          disabled={actionLoading === `day-${day.date}`}
                          title={isEntirelyBlocked ? 'Desbloquear Dia' : 'Bloquear Dia Inteiro'}
                          className={`h-8 w-8 p-0 rounded-lg ${
                            isEntirelyBlocked
                              ? 'text-red-400 bg-red-950/30 hover:bg-red-900/50'
                              : 'text-gray-400 hover:text-[#D4AF37] hover:bg-[#2A2A2A]'
                          }`}
                        >
                          {isEntirelyBlocked ? (
                            <Ban className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Status indicator */}
                      {isEntirelyBlocked ? (
                        <div className="mb-3 p-2 rounded-xl bg-red-950/30 border border-red-900/40 text-center">
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
                            Dia Bloqueado
                          </span>
                          <span className="text-[9px] text-gray-400 block mt-0.5">
                            Sem horários disponíveis
                          </span>
                        </div>
                      ) : (
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#22C55E] uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                            {daySchedules.filter((s) => s.disponivel).length} Faixas Livres
                          </span>
                        </div>
                      )}

                      {/* Time Slots List */}
                      <div className="space-y-2 mb-4">
                        {daySchedules.length === 0 && !isEntirelyBlocked ? (
                          <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center">
                            <p className="text-[11px] text-gray-400 font-inter">
                              Nenhuma faixa cadastrada.
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDayForSlot({ date: day.date, name: day.name })
                                setSlotModalOpen(true)
                              }}
                              className="mt-2 text-[10px] font-bold text-[#D4AF37] hover:underline p-0 h-auto"
                            >
                              + Adicionar Faixa
                            </Button>
                          </div>
                        ) : (
                          daySchedules.map((slot) => {
                            // Find if any appointment is booked in this slot
                            const slotApp = appointments.find((a) => a.schedule === slot.id)

                            return (
                              <div
                                key={slot.id}
                                className={`p-2.5 rounded-xl border text-xs transition-all ${
                                  !slot.disponivel
                                    ? 'bg-[#141414] border-[#2A2A2A] opacity-60'
                                    : slotApp
                                      ? slotApp.status === 'concluído'
                                        ? 'bg-[#22C55E]/10 border-[#22C55E]/40'
                                        : 'bg-[#0057FF]/10 border-[#0057FF]/40'
                                      : 'bg-[#141414] border-[#2A2A2A] hover:border-[#D4AF37]/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1 font-mono font-bold text-white">
                                    <Clock className="w-3 h-3 text-[#D4AF37]" />
                                    <span>
                                      {slot.hora_inicio}–{slot.hora_fim}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleToggleSlotAvailability(slot)}
                                      disabled={actionLoading === `slot-${slot.id}`}
                                      className="text-gray-400 hover:text-white text-[10px] px-1"
                                      title={slot.disponivel ? 'Pausar horário' : 'Ativar horário'}
                                    >
                                      {slot.disponivel ? 'Ativo' : 'Pausado'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSlot(slot.id)}
                                      disabled={actionLoading === `del-${slot.id}`}
                                      className="text-gray-500 hover:text-red-400 p-0.5"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Slot details / appointment */}
                                {slotApp ? (
                                  <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-white text-[11px] truncate">
                                        {slotApp.expand?.aluno?.name || 'Aluno'}
                                      </span>
                                      <Badge
                                        className={`text-[9px] px-1.5 py-0 uppercase ${
                                          slotApp.status === 'concluído'
                                            ? 'bg-[#22C55E] text-black font-bold'
                                            : slotApp.status === 'confirmado'
                                              ? 'bg-[#0057FF] text-white'
                                              : 'bg-amber-500 text-black'
                                        }`}
                                      >
                                        {slotApp.status}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-gray-300 capitalize">
                                      {slotApp.servico_tipo} • R${' '}
                                      {(slotApp.valor + (slotApp.taxa_extra || 0)).toFixed(2)}
                                    </p>

                                    {slotApp.status !== 'concluído' && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleCompleteAppointment(slotApp.id)}
                                        disabled={actionLoading === `comp-${slotApp.id}`}
                                        className="w-full mt-1.5 h-6 bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-[9px] uppercase rounded-lg flex items-center justify-center gap-1"
                                      >
                                        <Zap className="w-3 h-3 fill-black" /> Concluir
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                                    <span className="text-[#22C55E] font-semibold">
                                      Livre para agendar
                                    </span>
                                    <button
                                      onClick={() => {
                                        setSelectedScheduleForApp(slot)
                                        setAppointmentModalOpen(true)
                                      }}
                                      className="text-[#D4AF37] hover:underline font-bold"
                                    >
                                      + Aluno
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Day Bottom Actions */}
                    <div className="pt-2 border-t border-[#2A2A2A]">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isEntirelyBlocked}
                        onClick={() => {
                          setSelectedDayForSlot({ date: day.date, name: day.name })
                          setSlotModalOpen(true)
                        }}
                        className="w-full border-[#2A2A2A] text-white hover:border-[#D4AF37] text-xs font-bold font-montserrat uppercase h-8 rounded-xl flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Adicionar Faixa
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPOINTMENTS LIST */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-bold font-montserrat uppercase text-white">
                Filtrar Status:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['todos', 'confirmado', 'pendente', 'concluído', 'cancelado'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold font-montserrat uppercase transition-all ${
                      statusFilter === st
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-gray-400 font-inter">
              {filteredAppointments.length} agendamentos listados
            </span>
          </div>

          {/* Appointments Grid/Cards */}
          {filteredAppointments.length === 0 ? (
            <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl">
              <CalendarIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white font-montserrat uppercase">
                Nenhum agendamento encontrado
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1">
                Não há registros para o filtro selecionado na sua agenda.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAppointments.map((app) => {
                const isExtraFee = (app.taxa_extra || 0) > 0
                const totalValue = app.valor + (app.taxa_extra || 0)

                return (
                  <Card
                    key={app.id}
                    className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/50 p-5 rounded-2xl transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      {/* Card Top */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                              app.status === 'concluído'
                                ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                                : app.status === 'confirmado'
                                  ? 'bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            <User className="w-6 h-6" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold font-montserrat text-white text-base">
                                {app.expand?.aluno?.name || 'Aluno 369'}
                              </h4>
                              <Badge
                                className={`text-[10px] uppercase font-bold ${
                                  app.status === 'concluído'
                                    ? 'bg-[#22C55E] text-black'
                                    : app.status === 'confirmado'
                                      ? 'bg-[#0057FF] text-white'
                                      : 'bg-amber-500 text-black'
                                }`}
                              >
                                {app.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-[#0057FF] font-semibold uppercase mt-0.5 font-montserrat">
                              Serviço: {app.servico_tipo}
                            </p>
                          </div>
                        </div>

                        {/* Price badge */}
                        <div className="text-right">
                          <span className="text-lg font-black font-montserrat text-[#D4AF37] block">
                            R$ {totalValue.toFixed(2)}
                          </span>
                          {isExtraFee && (
                            <span className="text-[10px] font-bold text-amber-400 font-mono block">
                              +50% fora da lista (+R$ {app.taxa_extra?.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Schedule info */}
                      <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs space-y-1">
                        <div className="flex items-center justify-between text-gray-300">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <CalendarIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                            {app.expand?.schedule?.dia_da_semana || 'Agendamento Flexível'}
                          </span>
                          <span className="font-mono text-gray-400">
                            {app.expand?.schedule?.data || 'Data a alinhar'}
                          </span>
                        </div>

                        {app.expand?.schedule?.hora_inicio && (
                          <div className="flex items-center justify-between text-gray-400">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#0057FF]" />
                              Horário Reservado:
                            </span>
                            <span className="font-mono font-bold text-white">
                              {app.expand.schedule.hora_inicio} às {app.expand.schedule.hora_fim}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-3 border-t border-[#2A2A2A] flex flex-wrap items-center justify-end gap-2">
                      {app.status === 'pendente' && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmAppointment(app.id)}
                          disabled={actionLoading === `conf-${app.id}`}
                          className="bg-[#0057FF] text-white hover:bg-[#0047D4] font-bold text-xs uppercase rounded-xl"
                        >
                          Confirmar Horário
                        </Button>
                      )}

                      {app.status !== 'concluído' && app.status !== 'cancelado' && (
                        <Button
                          size="sm"
                          onClick={() => handleCompleteAppointment(app.id)}
                          disabled={actionLoading === `comp-${app.id}`}
                          className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-xs uppercase px-4 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.25)] flex items-center gap-1.5"
                        >
                          {actionLoading === `comp-${app.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 fill-black" /> Concluir Atendimento
                            </>
                          )}
                        </Button>
                      )}

                      {app.status === 'concluído' && (
                        <span className="text-xs font-mono font-bold text-[#22C55E] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Pontuado no Ranking & Cashback Pago
                        </span>
                      )}

                      {app.status !== 'cancelado' && app.status !== 'concluído' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelAppointment(app.id)}
                          disabled={actionLoading === `canc-${app.id}`}
                          className="text-gray-400 hover:text-red-400 text-xs rounded-xl"
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADICIONAR FAIXA DE HORÁRIO */}
      <Dialog open={slotModalOpen} onOpenChange={setSlotModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
              Nova Faixa de Horário
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Defina os limites de atendimento para{' '}
              <strong className="text-white">{selectedDayForSlot?.name}</strong> (
              {selectedDayForSlot?.date}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSlot} className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Hora Início
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs h-10"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Hora Fim
                </label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs h-10"
                  required
                />
              </div>
            </div>

            {/* Quick preset chips */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase font-montserrat mb-2">
                Atalhos Rápidos:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartTime('08:00')
                    setEndTime('12:00')
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2A2A2A] text-xs text-gray-300 hover:text-white hover:border-[#D4AF37]"
                >
                  Manhã (08:00–12:00)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartTime('14:00')
                    setEndTime('18:00')
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2A2A2A] text-xs text-gray-300 hover:text-white hover:border-[#D4AF37]"
                >
                  Tarde (14:00–18:00)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartTime('18:00')
                    setEndTime('22:00')
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2A2A2A] text-xs text-gray-300 hover:text-white hover:border-[#D4AF37]"
                >
                  Noite (18:00–22:00)
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingSlot}
              className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase h-11 rounded-xl mt-4"
            >
              {savingSlot ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Salvar Faixa de Horário'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVO AGENDAMENTO PELO PROFISSIONAL */}
      <Dialog open={appointmentModalOpen} onOpenChange={setAppointmentModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#D4AF37]" />
              Agendar Atendimento para Aluno
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Selecione o aluno e o serviço para inclusão na sua grade semanal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAppointment} className="space-y-4 pt-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Aluno
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                required
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Tipo de Serviço
                </label>
                <select
                  value={appServiceType}
                  onChange={(e) =>
                    setAppServiceType(
                      e.target.value as 'treino' | 'nutrição' | 'fisioterapia' | 'artes_marciais',
                    )
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                >
                  <option value="treino">Treino / Personal</option>
                  <option value="nutrição">Nutrição</option>
                  <option value="fisioterapia">Fisioterapia</option>
                  <option value="artes_marciais">Artes Marciais</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Valor da Consulta (R$)
                </label>
                <Input
                  type="number"
                  value={appValue}
                  onChange={(e) => setAppValue(e.target.value)}
                  placeholder="150.00"
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs h-10"
                  required
                />
              </div>
            </div>

            {selectedScheduleForApp && (
              <div className="p-3 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs">
                <span className="font-bold text-[#0057FF] block font-montserrat uppercase">
                  Faixa Vinculada:
                </span>
                <span className="text-gray-200">
                  {selectedScheduleForApp.dia_da_semana} ({selectedScheduleForApp.data}) •{' '}
                  {selectedScheduleForApp.hora_inicio}–{selectedScheduleForApp.hora_fim}
                </span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs text-gray-400 space-y-1 font-inter">
              <p className="font-semibold text-gray-200">Regra 369 de Tarifação & Taxa Extra:</p>
              <p>
                • Aluno na sua lista de parceiro: tarifa normal (Básico R$1, Pro R$2, Premium R$3).
              </p>
              <p>• Aluno fora da lista: acréscimo automático de +50% do valor da consulta.</p>
            </div>

            <Button
              type="submit"
              disabled={savingApp}
              className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase h-11 rounded-xl mt-4"
            >
              {savingApp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Confirmar e Registrar Agendamento'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

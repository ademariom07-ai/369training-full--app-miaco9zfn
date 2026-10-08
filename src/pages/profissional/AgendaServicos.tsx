import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth, type UserProfile } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
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
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Zap,
  User,
  Activity,
  Loader2,
  Filter,
  Plus,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  Star,
  Award,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  WeeklyScheduleRecord,
  AppointmentRecord,
  ServiceRecord,
  ServiceReviewRecord,
} from '@/services/api'
import { GestaoSessoesColetivas } from '@/components/GestaoSessoesColetivas'
import ReviewModal from '@/components/ReviewModal'

// Grade fixa de 19 faixas horárias de 1 em 1 hora (05:00 às 00:00)
export const FIXED_TIME_SLOTS = [
  { id: '05-06', hora_inicio: '05:00', hora_fim: '06:00', label: '05h - 06h' },
  { id: '06-07', hora_inicio: '06:00', hora_fim: '07:00', label: '06h - 07h' },
  { id: '07-08', hora_inicio: '07:00', hora_fim: '08:00', label: '07h - 08h' },
  { id: '08-09', hora_inicio: '08:00', hora_fim: '09:00', label: '08h - 09h' },
  { id: '09-10', hora_inicio: '09:00', hora_fim: '10:00', label: '09h - 10h' },
  { id: '10-11', hora_inicio: '10:00', hora_fim: '11:00', label: '10h - 11h' },
  { id: '11-12', hora_inicio: '11:00', hora_fim: '12:00', label: '11h - 12h' },
  { id: '12-13', hora_inicio: '12:00', hora_fim: '13:00', label: '12h - 13h' },
  { id: '13-14', hora_inicio: '13:00', hora_fim: '14:00', label: '13h - 14h' },
  { id: '14-15', hora_inicio: '14:00', hora_fim: '15:00', label: '14h - 15h' },
  { id: '15-16', hora_inicio: '15:00', hora_fim: '16:00', label: '15h - 16h' },
  { id: '16-17', hora_inicio: '16:00', hora_fim: '17:00', label: '16h - 17h' },
  { id: '17-18', hora_inicio: '17:00', hora_fim: '18:00', label: '17h - 18h' },
  { id: '18-19', hora_inicio: '18:00', hora_fim: '19:00', label: '18h - 19h' },
  { id: '19-20', hora_inicio: '19:00', hora_fim: '20:00', label: '19h - 20h' },
  { id: '20-21', hora_inicio: '20:00', hora_fim: '21:00', label: '20h - 21h' },
  { id: '21-22', hora_inicio: '21:00', hora_fim: '22:00', label: '21h - 22h' },
  { id: '22-23', hora_inicio: '22:00', hora_fim: '23:00', label: '22h - 23h' },
  { id: '23-00', hora_inicio: '23:00', hora_fim: '00:00', label: '23h - 00h' },
]

// Dias da semana helper
const DAYS_OF_WEEK = [
  { id: 1, name: 'Segunda-feira', short: 'Seg' },
  { id: 2, name: 'Terça-feira', short: 'Ter' },
  { id: 3, name: 'Quarta-feira', short: 'Qua' },
  { id: 4, name: 'Quinta-feira', short: 'Qui' },
  { id: 5, name: 'Sexta-feira', short: 'Sex' },
  { id: 6, name: 'Sábado', short: 'Sáb' },
  { id: 0, name: 'Domingo', short: 'Dom' },
]

function getWeekDays(offsetWeeks = 0) {
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
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const currentWeekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])

  // Data states
  const [schedules, setSchedules] = useState<WeeklyScheduleRecord[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [students, setStudents] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Percentual de cobrança para alunos/clientes sem plano (default 10%, editável pelo profissional)
  const [noPlanFeePercentage, setNoPlanFeePercentage] = useState<number>(() => {
    const saved = localStorage.getItem('professional_no_plan_fee_pct')
    return saved ? parseFloat(saved) || 10 : 10
  })

  // Quick Appointment Modal state (Agendar direto pelo profissional)
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [selectedSlotForApp, setSelectedSlotForApp] = useState<{
    date: string
    dayName: string
    hora_inicio: string
    hora_fim: string
    scheduleId?: string
  } | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [appServiceType, setAppServiceType] = useState<
    'treino' | 'nutrição' | 'fisioterapia' | 'artes_marciais'
  >('treino')
  const [appValue, setAppValue] = useState('150.00')
  const [savingApp, setSavingApp] = useState(false)
  // Active view tab
  const [activeTab, setActiveTab] = useState<'grid' | 'appointments' | 'coletivo'>('grid')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Mapas de serviços e reviews para vincular aos agendamentos concluídos
  const [servicesMap, setServicesMap] = useState<Record<string, ServiceRecord>>({})
  const [myReviewsMap, setMyReviewsMap] = useState<Record<string, ServiceReviewRecord>>({})
  const [allReviewsByServiceMap, setAllReviewsByServiceMap] = useState<
    Record<string, ServiceReviewRecord[]>
  >({})

  // Modal de avaliação
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedReviewTarget, setSelectedReviewTarget] = useState<{
    serviceId: string
    revieweeId: string
    revieweeName: string
    serviceTitle: string
    existingReview?: ServiceReviewRecord | null
  } | null>(null)

  // Load Data
  const loadData = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const weekDates = currentWeekDays.map((d) => d.date)
      const minDate = weekDates[0]
      const maxDate = weekDates[weekDates.length - 1]

      // 1. Load schedules for current selected week
      const schedRes = await pb
        .collection('weekly_schedules')
        .getList<WeeklyScheduleRecord>(1, 300, {
          filter: `profissional = "${user.id}" && data >= "${minDate}" && data <= "${maxDate}"`,
          sort: 'data,hora_inicio',
        })
      setSchedules(schedRes.items)

      // 2. Load appointments for current professional
      const appRes = await pb.collection('appointments').getList<AppointmentRecord>(1, 150, {
        filter: `profissional = "${user.id}"`,
        sort: '-created',
        expand: 'aluno,schedule,service_record',
      })
      setAppointments(appRes.items)

      // 3. Carregar serviços concluídos do profissional para mapeamento
      const svcRes = await pb.collection('services').getList<ServiceRecord>(1, 200, {
        filter: `professional = "${user.id}"`,
        sort: '-created',
      })
      const sMap: Record<string, ServiceRecord> = {}
      for (const s of svcRes.items) {
        sMap[s.id] = s
      }
      setServicesMap(sMap)

      // 4. Carregar todas as reviews visíveis ao profissional (como reviewer ou reviewee)
      const revRes = await pb.collection('service_reviews').getList<ServiceReviewRecord>(1, 500, {
        filter: `reviewer = "${user.id}" || reviewee = "${user.id}"`,
        sort: '-created',
        expand: 'reviewer,reviewee',
      })
      const rMap: Record<string, ServiceReviewRecord> = {}
      const allMap: Record<string, ServiceReviewRecord[]> = {}
      for (const r of revRes.items) {
        if (r.reviewer === user.id) {
          rMap[r.service] = r
        }
        if (!allMap[r.service]) {
          allMap[r.service] = []
        }
        allMap[r.service].push(r)
      }
      setMyReviewsMap(rMap)
      setAllReviewsByServiceMap(allMap)
    } catch (err) {
      console.error('Error loading agenda data:', err)
    } finally {
      setLoading(false)
    }
  }, [user, currentWeekDays])

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
  }, [loadData])

  // Helper: check if a day is released (liberado)
  const isDayLiberado = (dateStr: string) => {
    const daySchedules = schedules.filter((s) => s.data === dateStr)
    if (daySchedules.length === 0) return false
    return daySchedules.some((s) => s.dia_liberado === true)
  }

  // 1-Clique: Liberar / Pausar Liberação do Dia Inteiro
  // Utiliza o endpoint batch /backend/v1/schedules/toggle-day para consolidar em 1 chamada única
  // eliminando o loop de 19 requisições que causava HTTP 429 (Too Many Requests)
  const handleToggleLiberarDia = async (dateStr: string, dayName: string) => {
    if (!user) return
    const currentlyLiberado = isDayLiberado(dateStr)
    const nextLiberadoState = !currentlyLiberado

    setActionLoading(`day-${dateStr}`)
    try {
      const res = await pb.send('/backend/v1/schedules/toggle-day', {
        method: 'POST',
        body: {
          date: dateStr,
          day_name: dayName,
          dia_liberado: nextLiberadoState,
          slots: FIXED_TIME_SLOTS.map((s) => ({
            hora_inicio: s.hora_inicio,
            hora_fim: s.hora_fim,
          })),
        },
      })

      if (res && res.success === false) {
        throw new Error(res.message || 'Falha ao alterar liberação do dia.')
      }

      toast.success(
        nextLiberadoState
          ? `Dia ${dayName} (${dateStr}) liberado com sucesso para visão dos alunos!`
          : `Dia ${dayName} (${dateStr}) ocultado da visão dos alunos.`,
      )
      await loadData()
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string }
      if (error?.status === 429) {
        toast.error('Muitas requisições, tente novamente em instantes.')
      } else {
        toast.error(error?.message || 'Erro ao alterar liberação do dia.')
      }
      await loadData().catch(() => {})
    } finally {
      setActionLoading(null)
    }
  }

  // 1-Clique: Alternar Bloqueio / Liberação de um Horário Específico (05h-06h, 06h-07h, etc.)
  const handleToggleSlot = async (
    dateStr: string,
    dayName: string,
    slotDef: (typeof FIXED_TIME_SLOTS)[0],
  ) => {
    if (!user) return
    const slotKey = `${dateStr}_${slotDef.hora_inicio}`
    setActionLoading(slotKey)

    try {
      const existingRecord = schedules.find(
        (s) => s.data === dateStr && s.hora_inicio === slotDef.hora_inicio,
      )

      if (existingRecord) {
        const newDisponivel = !existingRecord.disponivel
        await pb.collection('weekly_schedules').update(existingRecord.id, {
          disponivel: newDisponivel,
        })
        toast.success(
          newDisponivel
            ? `Horário ${slotDef.label} liberado!`
            : `Horário ${slotDef.label} bloqueado.`,
        )
      } else {
        // Se ainda não existia o registro específico no banco, cria como bloqueado (pois o default virtual é liberado)
        // ou cria com o status atual do dia
        const dayLiberadoState = isDayLiberado(dateStr)
        await pb.collection('weekly_schedules').create({
          profissional: user.id,
          dia_da_semana: dayName,
          data: dateStr,
          hora_inicio: slotDef.hora_inicio,
          hora_fim: slotDef.hora_fim,
          disponivel: false, // O primeiro clique bloqueia o slot padrão livre
          dia_liberado: dayLiberadoState,
        })
        toast.success(`Horário ${slotDef.label} bloqueado.`)
      }

      await loadData()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao alternar horário.')
    } finally {
      setActionLoading(null)
    }
  }

  // Localizar ou obter o ServiceRecord vinculado a um appointment
  const resolveServiceForAppointment = async (
    app: AppointmentRecord,
  ): Promise<ServiceRecord | null> => {
    if (!user) return null
    // Se já tem service_record expandido
    if (app.expand?.service_record) return app.expand.service_record
    // Se o appointment tem id de service_record
    if (app.service_record && servicesMap[app.service_record]) {
      return servicesMap[app.service_record]
    }
    // Tentar buscar por nota ou buscar service existente
    try {
      const existing = await pb
        .collection('services')
        .getFirstListItem<ServiceRecord>(
          `professional = "${user.id}" && student = "${app.aluno}" && notes ~ "${app.id}"`,
        )
      return existing
    } catch (_) {
      // Se ainda não existe serviço registrado (ex: agendamento legado concluído antes do hook), cria sob demanda
      try {
        const createdSvc = await pb.collection('services').create<ServiceRecord>({
          professional: user.id,
          student: app.aluno,
          type: app.servico_tipo || 'treino',
          title: `Atendimento: ${(app.servico_tipo || 'treino').toUpperCase()}`,
          value: app.valor || 150,
          status: 'concluido',
          validation_status: 'pendente',
          validated: false,
          notes: `Gerado para agendamento #${app.id}`,
        })
        try {
          await pb.collection('appointments').update(app.id, { service_record: createdSvc.id })
        } catch {
          /* intentionally ignored */
        }
        return createdSvc
      } catch (err) {
        console.error('Erro ao resolver serviço do agendamento:', err)
        return null
      }
    }
  }

  // Abrir modal de avaliação para um agendamento
  const handleOpenReview = async (app: AppointmentRecord) => {
    setActionLoading(`rev-${app.id}`)
    try {
      const svc = await resolveServiceForAppointment(app)
      if (!svc) {
        toast.error('Não foi possível carregar o serviço deste atendimento.')
        return
      }

      const existingReview = myReviewsMap[svc.id] || null
      const studentName = app.expand?.aluno?.name || 'Aluno'

      setSelectedReviewTarget({
        serviceId: svc.id,
        revieweeId: app.aluno,
        revieweeName: studentName,
        serviceTitle: `Aula de ${app.servico_tipo || 'Treino'} • ${app.expand?.schedule?.data || ''}`,
        existingReview,
      })
      setReviewModalOpen(true)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao abrir avaliação.')
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

      toast.success(
        'Atendimento concluído! Tarifa debitada. A aula aguarda avaliação para validar a pontuação.',
      )
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

  // Create manual appointment directly from slot
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedStudentId || !selectedSlotForApp) return

    setSavingApp(true)
    try {
      // Verificar se o aluno tem plano ativo ou se está sem plano
      const selectedStudent = students.find((s) => s.id === selectedStudentId)
      const studentPlan = selectedStudent?.plan
      const isStudentWithoutPlan = !studentPlan || studentPlan === 'gratis'

      const baseVal = parseFloat(appValue) || 150
      // Nova regra: Alunos e clientes sem planos: cobramos X% (default 10%, editável) do valor da consulta no agendamento
      const appliedPercent = isStudentWithoutPlan
        ? Math.max(0, Number(noPlanFeePercentage) || 0)
        : 0
      const extraFee = isStudentWithoutPlan ? (baseVal * appliedPercent) / 100 : 0

      // Garantir que existe o registro de schedule para vincular
      let targetScheduleId = selectedSlotForApp.scheduleId
      if (!targetScheduleId) {
        const existingSched = schedules.find(
          (s) =>
            s.data === selectedSlotForApp.date && s.hora_inicio === selectedSlotForApp.hora_inicio,
        )
        if (existingSched) {
          targetScheduleId = existingSched.id
        } else {
          const newSched = await pb.collection('weekly_schedules').create({
            profissional: user.id,
            dia_da_semana: selectedSlotForApp.dayName,
            data: selectedSlotForApp.date,
            hora_inicio: selectedSlotForApp.hora_inicio,
            hora_fim: selectedSlotForApp.hora_fim,
            disponivel: true,
            dia_liberado: isDayLiberado(selectedSlotForApp.date),
          })
          targetScheduleId = newSched.id
        }
      }

      await pb.collection('appointments').create({
        profissional: user.id,
        aluno: selectedStudentId,
        schedule: targetScheduleId || null,
        servico_tipo: appServiceType,
        status: 'confirmado',
        valor: baseVal,
        taxa_extra: extraFee,
      })

      const totalFinal = baseVal - extraFee
      toast.success(
        `Agendamento criado! ${
          extraFee > 0
            ? `(Descontado ${appliedPercent}% de R$ ${extraFee.toFixed(2)} por aluno sem plano • Total: R$ ${totalFinal.toFixed(2)})`
            : `(Total: R$ ${totalFinal.toFixed(2)} • Aluno com plano ${studentPlan?.toUpperCase() || ''})`
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
            Grade Fixa 05h–00h (19 Horários)
          </div>
          <h1 className="text-3xl font-black font-montserrat text-white tracking-tight uppercase">
            Agenda do Profissional
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1 max-w-2xl">
            Controle de 1 clique: bloqueie/libere horários individuais das{' '}
            <strong className="text-white">05:00 às 00:00</strong> e use o botão{' '}
            <span className="text-[#D4AF37] font-semibold">"Liberar Dia"</span> para disponibilizar
            o dia na busca dos alunos.
          </p>
        </div>

        {/* Action Button & Configuration */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#181818] border border-[#2A2A2A] rounded-xl">
            <span className="text-[11px] font-bold text-gray-300 font-montserrat uppercase">
              Cobrança Sem Plano:
            </span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={noPlanFeePercentage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setNoPlanFeePercentage(val)
                  localStorage.setItem('professional_no_plan_fee_pct', String(val))
                }}
                className="w-16 h-7 text-xs bg-[#141414] border-[#2A2A2A] rounded-lg text-center font-mono font-bold text-[#D4AF37] p-1"
              />
              <span className="text-xs font-bold text-[#D4AF37]">%</span>
            </div>
          </div>

          <Button
            onClick={() => {
              const defaultDay = currentWeekDays[0]
              setSelectedSlotForApp({
                date: defaultDay.date,
                dayName: defaultDay.name,
                hora_inicio: '08:00',
                hora_fim: '09:00',
              })
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
            Grade 19 Horários
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold font-montserrat transition-all uppercase flex items-center justify-center gap-1.5 ${
              activeTab === 'appointments'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Individuais
            {appointments.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-black/20 text-[10px] flex items-center justify-center">
                {appointments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('coletivo')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold font-montserrat transition-all uppercase flex items-center justify-center gap-1.5 ${
              activeTab === 'coletivo'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Aulas Coletivas
          </button>
        </div>
      </div>

      {/* TAB 1: WEEKLY 19-SLOT GRID */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {/* Quick instructions banner */}
          <div className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-gray-300">
              <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>
                <strong className="text-white">Regra de Visibilidade para Alunos:</strong> O aluno
                só enxerga os horários livres se você clicar em{' '}
                <strong className="text-[#22C55E]">"Liberar Dia"</strong>. Clique em cada horário
                para bloquear ou liberar instantaneamente com 1 toque.
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] shrink-0 font-montserrat uppercase font-bold">
              <span className="flex items-center gap-1 text-[#22C55E]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /> Liberado
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Bloqueado
              </span>
              <span className="flex items-center gap-1 text-[#0057FF]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0057FF]" /> Agendado
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 bg-[#181818] rounded-2xl border border-[#2A2A2A]">
              <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
              <p className="text-xs text-gray-400 font-inter">
                Carregando grade horária da semana...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
              {currentWeekDays.map((day) => {
                const dayLiberado = isDayLiberado(day.date)
                const daySchedules = schedules.filter((s) => s.data === day.date)

                // Count active slots
                const activeSlotsCount = FIXED_TIME_SLOTS.filter((slotDef) => {
                  const rec = daySchedules.find((s) => s.hora_inicio === slotDef.hora_inicio)
                  return rec ? rec.disponivel : true
                }).length

                return (
                  <Card
                    key={day.date}
                    className={`bg-[#181818] border transition-all rounded-2xl p-3 sm:p-4 flex flex-col justify-between ${
                      dayLiberado
                        ? 'border-[#D4AF37]/40 shadow-[0_0_15px_rgba(212,175,55,0.08)]'
                        : 'border-[#2A2A2A]'
                    }`}
                  >
                    {/* Day Header */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-gray-400 font-montserrat">
                            {day.name.split('-')[0]}
                          </p>
                          <h3 className="text-base font-black font-montserrat text-white">
                            {day.displayDate}
                          </h3>
                        </div>

                        <Badge
                          className={`text-[9px] uppercase font-bold px-2 py-0.5 ${
                            dayLiberado
                              ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/40'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {dayLiberado ? 'Visível' : 'Oculto'}
                        </Badge>
                      </div>

                      {/* Botão de 1 Clique: Liberar Dia / Ocultar Dia */}
                      <Button
                        size="sm"
                        onClick={() => handleToggleLiberarDia(day.date, day.name)}
                        disabled={actionLoading === `day-${day.date}`}
                        className={`w-full mb-3 text-xs font-bold font-montserrat uppercase rounded-xl h-9 flex items-center justify-center gap-1.5 transition-all ${
                          dayLiberado
                            ? 'bg-[#22C55E] text-black hover:bg-[#1eb354] shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                            : 'bg-[#141414] border border-[#2A2A2A] text-gray-300 hover:border-[#D4AF37] hover:text-white'
                        }`}
                      >
                        {actionLoading === `day-${day.date}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : dayLiberado ? (
                          <>
                            <Eye className="w-3.5 h-3.5" /> Dia Liberado
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-gray-400" /> Liberar Dia
                          </>
                        )}
                      </Button>

                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2 px-1 font-mono">
                        <span>{activeSlotsCount}/19 Horários Livres</span>
                        {!dayLiberado && (
                          <span className="text-amber-400 text-[9px] font-semibold">
                            (Aluno não vê)
                          </span>
                        )}
                      </div>

                      {/* Fixed 19 Slots List */}
                      <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                        {FIXED_TIME_SLOTS.map((slotDef) => {
                          const existingRecord = daySchedules.find(
                            (s) => s.hora_inicio === slotDef.hora_inicio,
                          )
                          // Se existe registro no banco, pega o disponivel. Se não existe registro ainda, por padrão está livre (true)
                          const isAvailable = existingRecord ? existingRecord.disponivel : true

                          // Verifica se há agendamento para este slot
                          const slotApp = appointments.find((a) => {
                            if (existingRecord && a.schedule === existingRecord.id) return true
                            // Match por data e horário
                            if (
                              a.expand?.schedule?.data === day.date &&
                              a.expand?.schedule?.hora_inicio === slotDef.hora_inicio
                            ) {
                              return true
                            }
                            return false
                          })

                          const slotKey = `${day.date}_${slotDef.hora_inicio}`
                          const isSlotLoading = actionLoading === slotKey

                          return (
                            <div
                              key={slotDef.id}
                              className={`p-2 rounded-xl border text-xs transition-all ${
                                !isAvailable
                                  ? 'bg-red-950/20 border-red-900/40 text-gray-400'
                                  : slotApp
                                    ? slotApp.status === 'concluído'
                                      ? 'bg-[#22C55E]/10 border-[#22C55E]/40 text-white'
                                      : 'bg-[#0057FF]/15 border-[#0057FF]/40 text-white'
                                    : 'bg-[#141414] border-[#2A2A2A] hover:border-[#D4AF37]/60 text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono font-bold text-[11px] flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-[#D4AF37]" />
                                  {slotDef.label}
                                </span>

                                {/* Toggle 1-Clique para Bloquear / Liberar */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSlot(day.date, day.name, slotDef)}
                                  disabled={isSlotLoading}
                                  title={
                                    isAvailable ? 'Clique para Bloquear' : 'Clique para Liberar'
                                  }
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 uppercase transition-all ${
                                    isAvailable
                                      ? 'bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E] hover:text-black border border-[#22C55E]/30'
                                      : 'bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/50'
                                  }`}
                                >
                                  {isSlotLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : isAvailable ? (
                                    <>
                                      <Unlock className="w-2.5 h-2.5" /> Livre
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-2.5 h-2.5" /> Bloq
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Se tiver agendamento */}
                              {slotApp ? (
                                <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white truncate max-w-[90px]">
                                      {slotApp.expand?.aluno?.name || 'Aluno'}
                                    </span>
                                    <span
                                      className={`text-[8px] font-extrabold uppercase px-1 rounded ${
                                        slotApp.status === 'concluído'
                                          ? 'bg-[#22C55E] text-black'
                                          : slotApp.status === 'confirmado'
                                            ? 'bg-[#0057FF] text-white'
                                            : 'bg-amber-500 text-black'
                                      }`}
                                    >
                                      {slotApp.status}
                                    </span>
                                  </div>
                                  <p className="text-gray-400 capitalize text-[9px]">
                                    {slotApp.servico_tipo} • R${' '}
                                    {(slotApp.valor + (slotApp.taxa_extra || 0)).toFixed(2)}
                                  </p>

                                  {slotApp.status !== 'concluído' ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCompleteAppointment(slotApp.id)}
                                      disabled={actionLoading === `comp-${slotApp.id}`}
                                      className="w-full mt-1 h-5 bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-[8px] uppercase rounded-md flex items-center justify-center gap-1"
                                    >
                                      <Zap className="w-2.5 h-2.5 fill-black" /> Concluir
                                    </Button>
                                  ) : (
                                    (() => {
                                      const svc = slotApp.service_record
                                        ? servicesMap[slotApp.service_record]
                                        : null
                                      const hasReviewed = svc
                                        ? Boolean(myReviewsMap[svc.id])
                                        : false
                                      const isFullyValidated =
                                        svc?.validation_status === 'totalmente_validada' ||
                                        Boolean(svc?.validated)
                                      const svcReviews = svc
                                        ? allReviewsByServiceMap[svc.id] || []
                                        : []
                                      const counterReview = svcReviews.find(
                                        (r) => r.reviewer !== user?.id,
                                      )

                                      return (
                                        <div className="mt-1 pt-1 border-t border-white/5 space-y-1">
                                          <div className="flex items-center justify-between text-[8px]">
                                            <span className="font-semibold text-gray-400">
                                              Validação:
                                            </span>
                                            {isFullyValidated ? (
                                              <span className="text-[#22C55E] font-bold flex items-center gap-0.5">
                                                <CheckCircle2 className="w-2 h-2" /> Totalmente
                                                Validada
                                              </span>
                                            ) : hasReviewed ? (
                                              <span className="text-amber-400 font-medium">
                                                Aguardando aluno
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">Pendente</span>
                                            )}
                                          </div>

                                          {/* Revelação mútua: apenas quando totalmente_validada */}
                                          {isFullyValidated && counterReview && (
                                            <div className="p-1 rounded bg-[#F7F5F0] border border-[#E4E2DC] text-[8px] text-[#1A1A1A] space-y-0.5">
                                              <div className="flex items-center justify-between">
                                                <span className="font-bold text-[#B8962E] flex items-center gap-0.5">
                                                  ★ {counterReview.rating}/5
                                                </span>
                                                <span className="text-[7px] text-[#666666] font-semibold uppercase">
                                                  Avaliação do Aluno
                                                </span>
                                              </div>
                                              {counterReview.message && (
                                                <p className="italic text-[#333333] text-[7.5px] line-clamp-2 leading-tight">
                                                  &ldquo;{counterReview.message}&rdquo;
                                                </p>
                                              )}
                                            </div>
                                          )}

                                          <Button
                                            size="sm"
                                            onClick={() => handleOpenReview(slotApp)}
                                            disabled={actionLoading === `rev-${slotApp.id}`}
                                            className={`w-full h-5 text-[8px] uppercase font-bold rounded-md flex items-center justify-center gap-1 ${
                                              hasReviewed
                                                ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/30'
                                                : 'bg-[#D4AF37] text-black hover:bg-[#c49f2e]'
                                            }`}
                                          >
                                            <Star
                                              className={`w-2 h-2 ${hasReviewed ? 'fill-[#D4AF37]' : 'fill-black'}`}
                                            />
                                            {hasReviewed ? 'Avaliado ✓' : 'Avaliar Aluno'}
                                          </Button>
                                        </div>
                                      )
                                    })()
                                  )}
                                </div>
                              ) : isAvailable ? (
                                <div className="mt-1 flex items-center justify-end text-[9px]">
                                  <button
                                    onClick={() => {
                                      setSelectedSlotForApp({
                                        date: day.date,
                                        dayName: day.name,
                                        hora_inicio: slotDef.hora_inicio,
                                        hora_fim: slotDef.hora_fim,
                                        scheduleId: existingRecord?.id,
                                      })
                                      setAppointmentModalOpen(true)
                                    }}
                                    className="text-[#D4AF37] hover:underline font-bold"
                                  >
                                    + Agendar Aluno
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GESTÃO DE SESSÕES COLETIVAS MULTI-ALUNO & SELFIE */}
      {activeTab === 'coletivo' && user && (
        <GestaoSessoesColetivas currentUserId={user.id} students={students} />
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
                              +{((app.taxa_extra! / (app.valor || 1)) * 100).toFixed(0)}% sem plano
                              (incluso +R$ {app.taxa_extra?.toFixed(2)})
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

                      {app.status === 'concluído' &&
                        (() => {
                          const svc = app.service_record ? servicesMap[app.service_record] : null
                          const hasReviewed = svc ? Boolean(myReviewsMap[svc.id]) : false
                          const isFullyValidated =
                            svc?.validation_status === 'totalmente_validada' ||
                            Boolean(svc?.validated)
                          const svcReviews = svc ? allReviewsByServiceMap[svc.id] || [] : []
                          const counterReview = svcReviews.find((r) => r.reviewer !== user?.id)

                          return (
                            <div className="w-full space-y-3">
                              {/* Revelação mútua de avaliações: APENAS quando totalmente_validada */}
                              {isFullyValidated ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-mono font-bold text-[#22C55E] flex items-center gap-1.5 bg-[#22C55E]/10 border border-[#22C55E]/30 px-2.5 py-1 rounded-lg">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Totalmente Validada •
                                      Pontuada no Ranking
                                    </span>
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenReview(app)}
                                      disabled={actionLoading === `rev-${app.id}`}
                                      className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/30 text-xs uppercase font-bold rounded-xl h-8 px-3.5 flex items-center gap-1.5"
                                    >
                                      <Star className="w-3.5 h-3.5 fill-[#D4AF37]" /> Avaliado ✓
                                    </Button>
                                  </div>

                                  {/* Caixa da avaliação mútua revelada da contraparte (aluno) */}
                                  {counterReview ? (
                                    <div className="p-3 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC] text-[#1A1A1A] space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                          {[1, 2, 3, 4, 5].map((s) => (
                                            <Star
                                              key={s}
                                              className={`w-3.5 h-3.5 ${
                                                s <= counterReview.rating
                                                  ? 'fill-[#D4AF37] text-[#D4AF37]'
                                                  : 'fill-transparent text-[#CCCCCC]'
                                              }`}
                                            />
                                          ))}
                                          <span className="text-xs font-bold text-[#B8962E] font-mono ml-1">
                                            ({counterReview.rating}/5)
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0057FF] font-montserrat">
                                          Avaliação do Aluno
                                        </span>
                                      </div>
                                      {counterReview.message ? (
                                        <p className="text-xs text-[#333333] font-inter italic leading-relaxed">
                                          &ldquo;{counterReview.message}&rdquo;
                                        </p>
                                      ) : (
                                        <p className="text-[11px] text-[#666666] font-inter italic">
                                          Nota atribuída sem mensagem escrita.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="p-2.5 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC] text-xs text-[#666666]">
                                      Avaliações mútuas confirmadas pelo sistema.
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  {hasReviewed ? (
                                    <span className="text-xs font-mono font-medium text-amber-400 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                                      <Clock className="w-3.5 h-3.5" /> Você avaliou — aguardando a
                                      avaliação da outra parte
                                    </span>
                                  ) : (
                                    <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                                      <Clock className="w-3.5 h-3.5" /> Concluído — Avalie para
                                      validar no ranking
                                    </span>
                                  )}

                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenReview(app)}
                                    disabled={actionLoading === `rev-${app.id}`}
                                    className={`text-xs uppercase font-bold rounded-xl h-8 px-3.5 flex items-center gap-1.5 ${
                                      hasReviewed
                                        ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/30'
                                        : 'bg-[#D4AF37] text-black hover:bg-[#c49f2e] shadow-sm'
                                    }`}
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${hasReviewed ? 'fill-[#D4AF37]' : 'fill-black'}`}
                                    />
                                    {hasReviewed ? 'Avaliado ✓' : 'Avaliar Aluno'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })()}

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

      {/* MODAL: AVALIAÇÃO MÚTUA PÓS-AULA */}
      {selectedReviewTarget && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false)
            setSelectedReviewTarget(null)
          }}
          serviceId={selectedReviewTarget.serviceId}
          revieweeId={selectedReviewTarget.revieweeId}
          revieweeName={selectedReviewTarget.revieweeName}
          serviceTitle={selectedReviewTarget.serviceTitle}
          existingReview={selectedReviewTarget.existingReview}
          onSuccess={(savedReview) => {
            setMyReviewsMap((prev) => ({
              ...prev,
              [savedReview.service]: savedReview,
            }))
            loadData()
          }}
        />
      )}

      {/* MODAL: NOVO AGENDAMENTO PELO PROFISSIONAL */}
      <Dialog open={appointmentModalOpen} onOpenChange={setAppointmentModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#D4AF37]" />
              Agendar Atendimento para Aluno
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Selecione o aluno e o serviço para inclusão na sua grade.
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

            {selectedSlotForApp && (
              <div className="p-3 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs">
                <span className="font-bold text-[#0057FF] block font-montserrat uppercase">
                  Horário Vinculado:
                </span>
                <span className="text-gray-200 font-mono">
                  {selectedSlotForApp.dayName} ({selectedSlotForApp.date}) •{' '}
                  {selectedSlotForApp.hora_inicio} às {selectedSlotForApp.hora_fim}
                </span>
              </div>
            )}

            {/* Campo editável de percentual para alunos/clientes sem plano */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300 uppercase font-montserrat">
                  Percentual para Alunos Sem Plano (%)
                </label>
                <span className="text-[11px] text-[#D4AF37] font-mono font-bold">
                  {noPlanFeePercentage}% sobre a consulta
                </span>
              </div>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={noPlanFeePercentage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setNoPlanFeePercentage(val)
                  localStorage.setItem('professional_no_plan_fee_pct', String(val))
                }}
                placeholder="10"
                className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs h-10"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Defina a porcentagem aplicada no agendamento de alunos e clientes sem planos.
              </p>
            </div>

            {/* Simulação do Valor Final no Fechamento */}
            {(() => {
              const selectedStudent = students.find((s) => s.id === selectedStudentId)
              const isWithoutPlan = !selectedStudent?.plan || selectedStudent?.plan === 'gratis'
              const base = parseFloat(appValue) || 0
              const pct = isWithoutPlan ? Number(noPlanFeePercentage) || 0 : 0
              const extra = isWithoutPlan ? (base * pct) / 100 : 0
              const finalTotal = base - extra

              return (
                <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs space-y-1 font-inter">
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Status do Aluno:</span>
                    <span className="font-bold text-white">
                      {isWithoutPlan ? (
                        <span className="text-amber-400">Sem Plano Cadastrado</span>
                      ) : (
                        <span className="text-[#22C55E]">
                          Plano {selectedStudent?.plan?.toUpperCase()}
                        </span>
                      )}
                    </span>
                  </div>
                  {isWithoutPlan && (
                    <div className="flex justify-between items-center text-gray-400">
                      <span>Desconto no Fechamento ({pct}%):</span>
                      <span className="font-mono text-amber-400">- R$ {extra.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-white/10 font-bold">
                    <span className="text-white">Valor Final no Fechamento:</span>
                    <span className="font-mono text-base text-[#D4AF37]">
                      R$ {finalTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })()}

            <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs text-gray-400 space-y-1 font-inter">
              <p className="font-semibold text-gray-200">Regra de Cobrança:</p>
              <p>
                • Alunos e clientes sem planos: cobramos {noPlanFeePercentage}% do valor da consulta
                no agendamento.
              </p>
              <p>
                • No fechamento, o valor dos {noPlanFeePercentage}% será descontado do valor final.
              </p>
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

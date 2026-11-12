import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarClock, ChevronRight, Users, UserPlus } from 'lucide-react'
import type { AppointmentRecord } from '@/services/api'

const SERVICO_LABELS: Record<string, string> = {
  treino: 'Sessão de Treino',
  nutrição: 'Consulta de Nutrição',
  fisioterapia: 'Sessão de Fisioterapia',
  artes_marciais: 'Aula de Artes Marciais',
}

interface ProximaSessaoCardProps {
  studentId: string
}

function formatDateTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ProximaSessaoCard({ studentId }: ProximaSessaoCardProps) {
  const { user } = useAuth()
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return
    let cancelled = false

    pb.collection('appointments')
      .getFullList<AppointmentRecord>({
        filter: `aluno = "${studentId}" && status != "cancelado" && status != "concluído"`,
        sort: '-created',
        expand: 'profissional,schedule,service_record',
      })
      .then((res) => {
        if (cancelled) return
        const today = new Date().toISOString().split('T')[0]
        const upcoming = res
          .filter((appt) => {
            const d = appt.expand?.schedule?.data
            if (d) return d >= today
            return appt.status === 'pendente' || appt.status === 'confirmado'
          })
          .sort((a, b) => {
            const da = a.expand?.schedule?.data || '9999-12-31'
            const db = b.expand?.schedule?.data || '9999-12-31'
            return da.localeCompare(db)
          })
        setAppointment(upcoming[0] || null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [studentId])

  if (loading) {
    return (
      <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#2A2A2A]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-[#2A2A2A]" />
            <div className="h-4 w-2/3 rounded bg-[#2A2A2A]" />
            <div className="h-3 w-1/3 rounded bg-[#2A2A2A]" />
          </div>
          <div className="h-9 w-28 rounded-xl bg-[#2A2A2A] hidden sm:block" />
        </div>
      </Card>
    )
  }

  if (!appointment) {
    // Estado vazio acolhedor: sem sessão marcada
    return (
      <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 flex items-center justify-center text-[#0057FF] shrink-0">
              <CalendarClock className="w-5.5 h-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-[#0057FF] uppercase tracking-widest font-montserrat">
                Agenda
              </span>
              <h3 className="text-sm font-bold font-montserrat text-white mt-0.5">
                Nenhuma sessão marcada por enquanto
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-0.5 leading-relaxed">
                Que tal agendar um horário com um profissional ou entrar em uma aula coletiva?
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto shrink-0">
            <Link to="/aluno/profissionais" className="flex-1 sm:flex-none">
              <Button className="w-full bg-[#0057FF] hover:bg-[#0046d1] text-white text-xs font-bold font-montserrat uppercase rounded-xl min-h-[40px] px-4 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                <UserPlus className="w-4 h-4" /> Agendar
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => scrollToSection('encontrar-profissional')}
              className="flex-1 sm:flex-none w-full border-[#2A2A2A] text-gray-200 hover:bg-white/5 font-bold rounded-xl min-h-[40px] px-4 flex items-center justify-center gap-1.5"
            >
              <Users className="w-4 h-4" /> Aulas
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const schedule = appointment.expand?.schedule
  const profName = appointment.expand?.profissional?.name || 'Profissional 369'
  const serviceName = SERVICO_LABELS[appointment.servico_tipo] || 'Atendimento'
  const date = schedule?.data
    ? new Date(schedule.data + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      })
    : 'Data a combinar'
  const time = schedule?.hora_inicio || 'Horário agendado'

  return (
    <Card className="bg-gradient-to-br from-[#181818] via-[#141414] to-[#181818] border-2 border-[#0057FF]/50 rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,87,255,0.15)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/40 flex items-center justify-center text-[#0057FF] shrink-0">
            <CalendarClock className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#0057FF] uppercase tracking-widest font-montserrat">
              Próxima atividade confirmada
            </span>
            <h3 className="text-base sm:text-lg font-extrabold font-montserrat text-white mt-0.5 truncate">
              {serviceName}
            </h3>
            <p className="text-xs text-gray-400 font-inter mt-0.5">
              {date} às <span className="text-[#D4AF37] font-bold">{time}</span> · com {profName}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => scrollToSection('aulas-coletivas')}
          className="shrink-0 w-full sm:w-auto bg-[#0057FF] hover:bg-[#0046d1] text-white text-xs font-bold font-montserrat uppercase rounded-xl min-h-[40px] px-5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
        >
          Ver Agenda <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}

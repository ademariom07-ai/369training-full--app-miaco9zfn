import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Clock,
  User,
  AlertCircle,
  QrCode,
  ChevronRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import type { AppointmentRecord } from '@/services/api'
import { UserAvatar } from '@/components/UserAvatar'
import { MeusAgendamentosModal } from './MeusAgendamentosModal'

interface ProximaSessaoCardProps {
  studentId: string
}

export function ProximaSessaoCard({ studentId }: ProximaSessaoCardProps) {
  const [loading, setLoading] = useState(true)
  const [proximoAgendamento, setProximoAgendamento] = useState<AppointmentRecord | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchNextAppointment = async () => {
    if (!studentId) return
    try {
      // Buscar agendamentos futuros do aluno
      const today = new Date().toISOString().split('T')[0]
      const res = await pb.collection('appointments').getList<AppointmentRecord>(1, 10, {
        filter: `aluno = "${studentId}" && status != "cancelado"`,
        sort: 'created',
        expand: 'profissional,schedule',
      })

      // Ordenar e achar o próximo válido
      const validItems = res.items.filter((item) => {
        const scheduleDate = item.expand?.schedule?.data
        const st = String(item.status)
        if (scheduleDate) {
          return scheduleDate >= today && st !== 'cancelado' && st !== 'concluído'
        }
        return st === 'pendente' || st === 'confirmado' || st === 'agendado'
      })

      if (validItems.length > 0) {
        setProximoAgendamento(validItems[0])
      } else {
        setProximoAgendamento(null)
      }
    } catch (err) {
      console.warn('Erro ao carregar próxima sessão do aluno:', err)
      setProximoAgendamento(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNextAppointment()

    // Subscrição em tempo real para mudanças em appointments
    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    pb.collection('appointments')
      .subscribe('*', (e) => {
        const record = e.record as unknown as AppointmentRecord
        if (record && record.aluno === studentId) {
          fetchNextAppointment()
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch((err) => {
        console.warn('[Realtime ProximaSessao] Ignorando erro silenciosamente:', err)
      })

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      } else {
        pb.collection('appointments')
          .unsubscribe('*')
          .catch(() => {})
      }
    }
  }, [studentId])

  // Se estiver carregando ou não houver agendamento futuro, não polui a tela do aluno
  if (loading || !proximoAgendamento) {
    return (
      <MeusAgendamentosModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        studentId={studentId}
        onUpdated={fetchNextAppointment}
      />
    )
  }

  const schedule = proximoAgendamento.expand?.schedule
  const prof = proximoAgendamento.expand?.profissional
  const profName = prof?.name || 'Profissional 369'
  const dataFormatada = schedule?.data
    ? new Date(schedule.data + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'A combinar'
  const horario = schedule?.hora_inicio
    ? `${schedule.hora_inicio}${schedule.hora_fim ? ` - ${schedule.hora_fim}` : ''}`
    : 'Horário agendado'

  const hasPendingAdvance =
    Boolean(proximoAgendamento.requires_advance) &&
    (proximoAgendamento.advance_amount || 0) > 0 &&
    proximoAgendamento.status !== 'cancelado'

  return (
    <>
      <Card className="bg-gradient-to-r from-white via-[#FCFBF7] to-white border-2 border-[#D4AF37]/50 p-5 rounded-2xl shadow-md transition-all hover:shadow-lg relative overflow-hidden">
        {/* Glow dourado de destaque */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative shrink-0">
              <UserAvatar
                user={prof}
                thumb="64x64"
                className="w-14 h-14 rounded-2xl border-2 border-[#D4AF37] shadow-sm text-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#B8962E] font-montserrat flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Próxima Sessão
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    proximoAgendamento.status === 'confirmado'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : String(proximoAgendamento.status) === 'concluído'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {proximoAgendamento.status === 'confirmado'
                    ? 'Confirmada'
                    : String(proximoAgendamento.status) === 'concluído'
                      ? 'Concluída'
                      : 'Agendada'}
                </span>
              </div>

              <h3 className="font-extrabold font-montserrat text-[#1A1A1A] text-base sm:text-lg">
                {proximoAgendamento.servico_tipo || 'Consulta / Sessão'} com {profName}
              </h3>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 font-inter">
                <span className="flex items-center gap-1 font-semibold text-gray-800">
                  <Calendar className="w-3.5 h-3.5 text-[#B8962E]" />
                  {dataFormatada}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-gray-800">
                  <Clock className="w-3.5 h-3.5 text-[#B8962E]" />
                  {horario}
                </span>
                {schedule?.dia_da_semana && (
                  <>
                    <span>•</span>
                    <span className="capitalize text-gray-500">{schedule.dia_da_semana}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Ações: Ver detalhes / Pagar sinal se pendente */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
            {hasPendingAdvance && (
              <Button
                type="button"
                onClick={() => setModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs uppercase px-3.5 py-2 rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                Sinal Pendente (R$ {(proximoAgendamento.advance_amount || 0).toFixed(2)})
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="border-[#D4AF37] text-[#B8962E] hover:bg-[#D4AF37]/10 font-bold text-xs uppercase px-3.5 py-2 rounded-xl flex items-center justify-center gap-1"
            >
              Meus Agendamentos
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Alerta discreto de sinal pendente se aplicável */}
        {hasPendingAdvance && (
          <div className="mt-3 pt-3 border-t border-[#D4AF37]/20 flex items-center justify-between gap-2 text-xs font-inter text-amber-800 bg-amber-50/60 p-2 rounded-lg">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Sinal de 30% aguarda confirmação de comprovante PIX para assegurar sua vaga.
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-[#B8962E] font-bold underline hover:text-[#9A7D24] text-[11px] shrink-0 uppercase"
            >
              Ver PIX
            </button>
          </div>
        )}
      </Card>

      <MeusAgendamentosModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        studentId={studentId}
        onUpdated={fetchNextAppointment}
      />
    </>
  )
}

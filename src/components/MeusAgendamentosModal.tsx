import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Calendar,
  Clock,
  User,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Upload,
  RefreshCw,
  ExternalLink,
  XCircle,
  Sparkles,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import type { AppointmentRecord } from '@/services/api'
import { UserAvatar } from '@/components/UserAvatar'
import { toast } from 'sonner'

interface MeusAgendamentosModalProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  onUpdated?: () => void
}

export function MeusAgendamentosModal({
  isOpen,
  onClose,
  studentId,
  onUpdated,
}: MeusAgendamentosModalProps) {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'proximos' | 'historico'>('proximos')

  // Estado para fluxo PIX de sinal de uma consulta selecionada
  const [payingAppointment, setPayingAppointment] = useState<AppointmentRecord | null>(null)
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null)
  const [comprovanteFileName, setComprovanteFileName] = useState('')
  const [submittingDeposit, setSubmittingDeposit] = useState(false)

  // Configuração padrão da chave PIX da plataforma para sinal
  const platformPixKey = 'financeiro@369training.com'
  const platformPixHolder = '369WELLNESS LTDA'

  const fetchAppointments = async () => {
    if (!studentId) return
    setLoading(true)
    try {
      const res = await pb.collection('appointments').getList<AppointmentRecord>(1, 50, {
        filter: `aluno = "${studentId}"`,
        sort: '-created',
        expand: 'profissional,schedule',
      })
      setAppointments(res.items)
    } catch (err) {
      console.warn('Erro ao listar agendamentos do aluno:', err)
      toast.error('Não foi possível carregar seus agendamentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchAppointments()
    }
  }, [isOpen, studentId])

  // Submissão do comprovante de sinal PIX
  const handleUploadSinalComprovante = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingAppointment) return
    const amount = payingAppointment.advance_amount || 0
    if (amount <= 0) {
      toast.error('Valor de sinal inválido.')
      return
    }

    setSubmittingDeposit(true)
    try {
      const formData = new FormData()
      formData.append('amount', String(amount))
      formData.append('pix_code', platformPixKey)
      formData.append(
        'description',
        `Sinal PIX 30% - Agendamento #${payingAppointment.id} com ${
          payingAppointment.expand?.profissional?.name || 'Profissional'
        }${comprovanteFileName ? ` - Anexo: ${comprovanteFileName}` : ''}`,
      )
      if (comprovanteFile) {
        formData.append('comprovante_file', comprovanteFile)
      }

      const res = await pb.send('/backend/v1/wallet/deposit', {
        method: 'POST',
        body: formData,
      })

      if (res && res.success === false) {
        throw new Error(res.message || 'Falha ao registrar comprovante de sinal.')
      }

      toast.success(
        res?.message ||
          'Comprovante de sinal enviado com sucesso! A equipe e o profissional foram notificados.',
      )
      setPayingAppointment(null)
      setComprovanteFile(null)
      setComprovanteFileName('')
      fetchAppointments()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar comprovante do sinal.')
    } finally {
      setSubmittingDeposit(false)
    }
  }

  const copyPixKey = () => {
    navigator.clipboard.writeText(platformPixKey)
    toast.success('Chave PIX copiada!')
  }

  const today = new Date().toISOString().split('T')[0]

  const proximos = appointments.filter((item) => {
    const d = item.expand?.schedule?.data
    const st = String(item.status)
    if (d) return d >= today && st !== 'cancelado' && st !== 'concluído'
    return st === 'pendente' || st === 'confirmado' || st === 'agendado'
  })

  const historico = appointments.filter((item) => {
    const d = item.expand?.schedule?.data
    const st = String(item.status)
    if (d && d < today) return true
    return st === 'concluído' || st === 'concluido' || st === 'cancelado'
  })

  const displayedList = selectedTab === 'proximos' ? proximos : historico

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmado':
        return (
          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Confirmado
          </span>
        )
      case 'concluído':
      case 'concluido':
        return (
          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </span>
        )
      case 'cancelado':
        return (
          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        )
      case 'em_andamento':
        return (
          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Em Andamento
          </span>
        )
      default:
        return (
          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Agendado
          </span>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border border-[#E5E3DC] text-[#1A1A1A] p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-[#E5E3DC]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#B8962E]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-extrabold font-montserrat text-[#1A1A1A] uppercase">
                  Meus Agendamentos
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 font-inter">
                  Consultas, sessões e atendimentos com profissionais 369
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fetchAppointments}
              className="text-gray-500 hover:text-black"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Modal interno para envio de sinal PIX */}
        {payingAppointment ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-900 font-montserrat uppercase flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-amber-700" />
                  Sinal PIX de 30% (Primeira Consulta)
                </span>
                <span className="text-xs font-mono font-extrabold text-amber-900">
                  R$ {(payingAppointment.advance_amount || 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-amber-800 font-inter">
                Profissional:{' '}
                <strong>{payingAppointment.expand?.profissional?.name || 'Profissional'}</strong> •
                Serviço: <strong>{payingAppointment.servico_tipo || 'Consulta'}</strong>
              </p>
            </div>

            {/* Chave PIX da plataforma */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase font-montserrat">
                Chave PIX da Plataforma (E-mail):
              </span>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-2.5">
                <span className="font-mono font-bold text-xs text-[#1A1A1A]">{platformPixKey}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={copyPixKey}
                  className="h-7 text-xs border-[#D4AF37] text-[#B8962E] hover:bg-[#D4AF37]/10"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </div>
              <p className="text-[10px] text-gray-500 font-inter">
                Favorecido: <strong>{platformPixHolder}</strong>
              </p>
            </div>

            {/* Formulário de anexo do comprovante */}
            <form onSubmit={handleUploadSinalComprovante} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 font-montserrat block mb-1">
                  Anexar Comprovante PIX:
                </label>
                <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-[#D4AF37]/60 rounded-2xl cursor-pointer bg-white hover:bg-[#D4AF37]/5 transition-colors">
                  <Upload className="w-6 h-6 text-[#B8962E] mb-1" />
                  <span className="text-xs font-bold text-gray-700">
                    {comprovanteFileName ||
                      'Clique para escolher a imagem do comprovante (PDF ou foto)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setComprovanteFile(file)
                        setComprovanteFileName(file.name)
                      }
                    }}
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPayingAppointment(null)}
                  className="text-xs text-gray-600"
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingDeposit}
                  className="bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold text-xs uppercase px-4 py-2 rounded-xl shadow-xs"
                >
                  {submittingDeposit ? 'Enviando...' : 'Confirmar Envio do Sinal'}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Abas: Próximos vs Histórico */}
            <div className="flex items-center gap-2 border-b border-[#E5E3DC] pb-2">
              <button
                type="button"
                onClick={() => setSelectedTab('proximos')}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-1.5 ${
                  selectedTab === 'proximos'
                    ? 'bg-[#f7f6f3] text-[#B8962E] border border-[#D4AF37]/50 shadow-xs'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                <span>Próximas Sessões</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 text-gray-800 font-mono">
                  {proximos.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('historico')}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-1.5 ${
                  selectedTab === 'historico'
                    ? 'bg-[#f7f6f3] text-[#B8962E] border border-[#D4AF37]/50 shadow-xs'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                <span>Histórico Completo</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 text-gray-800 font-mono">
                  {historico.length}
                </span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 text-[#B8962E] animate-spin" />
                <span className="text-xs text-gray-500 font-inter">Carregando agendamentos...</span>
              </div>
            ) : displayedList.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-bold font-montserrat text-gray-700">
                  {selectedTab === 'proximos'
                    ? 'Nenhum agendamento futuro no momento.'
                    : 'Nenhum agendamento anterior registrado.'}
                </p>
                <p className="text-xs text-gray-400 font-inter mt-1">
                  {selectedTab === 'proximos'
                    ? 'Quando você ou seu profissional marcarem uma nova sessão, ela aparecerá aqui em tempo real.'
                    : 'Suas consultas concluídas ou canceladas serão guardadas aqui.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedList.map((appt) => {
                  const schedule = appt.expand?.schedule
                  const prof = appt.expand?.profissional
                  const profName = prof?.name || 'Profissional 369'
                  const dataFormatada = schedule?.data
                    ? new Date(schedule.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Data a combinar'
                  const horario = schedule?.hora_inicio
                    ? `${schedule.hora_inicio}${schedule.hora_fim ? ` - ${schedule.hora_fim}` : ''}`
                    : 'Horário agendado'

                  const hasPendingAdvance =
                    Boolean(appt.requires_advance) &&
                    (appt.advance_amount || 0) > 0 &&
                    appt.status !== 'cancelado'

                  return (
                    <Card
                      key={appt.id}
                      className="bg-[#FCFBF7] border border-[#E5E3DC] p-4 rounded-2xl space-y-3 hover:border-[#D4AF37]/50 transition-all shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            user={prof}
                            thumb="64x64"
                            className="w-12 h-12 rounded-xl border border-[#D4AF37] shadow-xs text-xs"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold font-montserrat text-[#1A1A1A] text-sm">
                                {profName}
                              </h4>
                              {getStatusBadge(appt.status)}
                            </div>
                            <p className="text-xs text-gray-600 font-inter mt-0.5">
                              {appt.servico_tipo || 'Atendimento / Consulta'}
                            </p>
                          </div>
                        </div>

                        {/* Valor e Sinal */}
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-extrabold font-mono text-[#1A1A1A]">
                            R$ {(appt.valor || 0).toFixed(2)}
                          </span>
                          {appt.requires_advance && (
                            <p className="text-[10px] text-amber-700 font-inter">
                              Sinal (30%): R$ {(appt.advance_amount || 0).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E3DC] text-xs text-gray-600 font-inter">
                        <div className="flex items-center gap-3">
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
                              <span className="capitalize text-gray-500">
                                {schedule.dia_da_semana}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Ação de pagamento de sinal se pendente */}
                        {hasPendingAdvance && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setPayingAppointment(appt)}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1"
                          >
                            <QrCode className="w-3 h-3" /> Pagar Sinal PIX
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
      </DialogContent>
    </Dialog>
  )
}

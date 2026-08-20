import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  User,
  Zap,
  Plus,
  Loader2,
  DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ServiceRecord } from '@/services/api'
import type { UserProfile } from '@/contexts/AuthContext'

export default function AgendaServicos() {
  const { user } = useAuth()

  const [services, setServices] = useState<ServiceRecord[]>([])
  const [students, setStudents] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  // New Service Modal/Form state
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [serviceType, setServiceType] = useState('Consultoria Presencial')
  const [serviceValue, setServiceValue] = useState('250.00')
  const [serviceNotes, setServiceNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // Load existing services
  const loadServices = async () => {
    if (!user) return
    try {
      const res = await pb.collection('services').getList<ServiceRecord>(1, 30, {
        filter: `professional = "${user.id}"`,
        sort: '-created',
        expand: 'student',
      })
      setServices(res.items)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    pb.collection('users')
      .getList<UserProfile>(1, 50, { filter: 'role = "aluno"' })
      .then((res) => {
        setStudents(res.items)
        if (res.items.length > 0) setSelectedStudentId(res.items[0].id)
      })
      .catch(() => {})

    loadServices().finally(() => setLoading(false))
  }, [user])

  // Complete Service (TRIGGERS RANKING / CASHBACK ENGINE VIA POCKETBASE HOOK)
  const handleCompleteService = async (serviceId: string) => {
    try {
      await pb.collection('services').update(serviceId, {
        status: 'concluido',
        completed_at: new Date().toISOString().slice(0, 10),
      })

      toast.success(
        'Atendimento concluído! O motor de ranking e cashback 369 foi acionado com sucesso.',
      )
      loadServices()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao concluir atendimento.')
    }
  }

  // Create New Service Request/Appointment
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId || !user) return

    setCreating(true)
    try {
      await pb.collection('services').create({
        professional: user.id,
        student: selectedStudentId,
        type: serviceType,
        title: serviceType,
        value: parseFloat(serviceValue) || 250,
        status: 'pendente',
        notes: serviceNotes,
      })

      toast.success('Atendimento agendado com sucesso!')
      setServiceNotes('')
      loadServices()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao agendar atendimento.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
          <CalendarIcon className="w-3.5 h-3.5" />
          Agenda & Atendimentos
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Gestão de Serviços & Atendimentos
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Ao clicar em &ldquo;Concluir atendimento&rdquo;, o motor de pontuação no ranking e
          cashback hierárquico (36 níveis) é disparado automaticamente.
        </p>
      </div>

      {/* QUICK NEW APPOINTMENT FORM */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl shadow-xl">
        <h3 className="text-base font-bold font-montserrat text-white uppercase mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#D4AF37]" /> Agendar Novo Atendimento
        </h3>

        <form onSubmit={handleCreateService} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
              Aluno
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
              Tipo de Serviço
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="Consultoria Presencial">Consultoria Presencial</option>
              <option value="Avaliação Física Biomecânica">Avaliação Física Biomecânica</option>
              <option value="Sessão de Fisioterapia">Sessão de Fisioterapia</option>
              <option value="Aula Particular de Artes Marciais">
                Aula Particular de Artes Marciais
              </option>
              <option value="Acompanhamento Nutricional">Acompanhamento Nutricional</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
              Valor do Atendimento (R$)
            </label>
            <Input
              type="number"
              value={serviceValue}
              onChange={(e) => setServiceValue(e.target.value)}
              placeholder="250.00"
              className="bg-[#141414] border-[#2A2A2A] rounded-xl text-white font-mono text-xs"
              required
            />
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={creating}
              className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase h-10 rounded-xl"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Agendamento'}
            </Button>
          </div>
        </form>
      </Card>

      {/* SERVICES LIST TABLE */}
      <div>
        <h3 className="text-lg font-bold font-montserrat uppercase text-white mb-4 flex items-center justify-between">
          <span>Histórico de Atendimentos</span>
          <span className="text-xs text-gray-400 font-inter">{services.length} registros</span>
        </h3>

        <div className="space-y-3">
          {services.map((svc) => (
            <Card
              key={svc.id}
              className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold font-montserrat ${
                    svc.status === 'concluido'
                      ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                      : 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                  }`}
                >
                  <DollarSign className="w-6 h-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold font-montserrat text-white text-sm">
                      {svc.type || svc.title}
                    </h4>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        svc.status === 'concluido'
                          ? 'bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]'
                          : 'bg-amber-900/30 border-amber-500 text-amber-300'
                      }`}
                    >
                      {svc.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-inter mt-0.5">
                    Aluno:{' '}
                    <strong className="text-gray-200">
                      {svc.expand?.student?.name || 'Lucas Ferreira'}
                    </strong>{' '}
                    • Valor: R$ {svc.value?.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Action */}
              {svc.status === 'pendente' ? (
                <Button
                  onClick={() => handleCompleteService(svc.id)}
                  className="w-full sm:w-auto bg-[#22C55E] text-black hover:bg-[#1eb354] font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.25)] flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4 fill-black" /> Concluir Atendimento
                </Button>
              ) : (
                <span className="text-xs font-mono text-[#22C55E] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Pontuado no Ranking
                </span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Bot,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  Moon,
  Heart,
  ChevronRight,
  Send,
  Loader2,
  Clock,
  Dumbbell,
  FileCheck,
  Info,
  Calendar,
  Lock,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'

interface AgentStatusData {
  plan: string
  is_linked: boolean
  month: string
  limits: {
    workouts_per_month: number
    messages_per_month: number
    smartwatch_sleep_adjustment: boolean
    menstrual_cycle_module: boolean
  }
  usage: {
    workouts_generated: number
    chat_messages: number
    workouts_remaining: number | string
    free_remaining?: number | string
    quota_limit?: number
    used_this_month?: number
    is_unlimited?: boolean
    messages_remaining: number
  }
  overage_costs: {
    workout_cost: number
    message_cost: number
  }
  wallet_balance: number
  parq: {
    completed: boolean
    passed_clean: boolean
    details?: any
  }
  lgpd_health_consent: boolean
  recent_sleep?: {
    date: string
    sleep_hours: number
    sleep_score: number
    readiness_score: number
    resting_hr: number
  } | null
  fixed_disclaimer: string
}

export function Agente369Section() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [agentStatus, setAgentStatus] = useState<AgentStatusData | null>(null)

  // PAR-Q+ Modal state
  const [parqOpen, setParqOpen] = useState(false)
  const [submittingParq, setSubmittingParq] = useState(false)
  const [parqAnswers, setParqAnswers] = useState({
    has_heart_condition: false,
    has_chest_pain_activity: false,
    has_chest_pain_rest: false,
    has_dizziness_loss_consciousness: false,
    has_bone_joint_problem: false,
    has_prescription_blood_pressure_heart: false,
    has_other_reason_preventing_activity: false,
    medical_clearance_notes: '',
  })

  // Workout generator state
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false)
  const [generatingWorkout, setGeneratingWorkout] = useState(false)
  const [targetAgeGroup, setTargetAgeGroup] = useState<'40-59' | '60+'>('40-59')
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('')
  const [workoutSymptoms, setWorkoutSymptoms] = useState('')
  const [cycleSymptom, setCycleSymptom] = useState('')
  const [generatedWorkout, setGeneratedWorkout] = useState<any>(null)
  const [redFlagAlert, setRedFlagAlert] = useState<string | null>(null)

  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'agent'; content: string; isRedFlag?: boolean }>
  >([])

  // Menstrual Cycle state
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [cycleForm, setCycleForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    flow: 'leve' as 'nenhum' | 'leve' | 'moderado' | 'intenso',
    energy_level: 6,
    symptoms: [] as string[],
    perceived_recovery: 7,
    notes: '',
  })
  const [savingCycle, setSavingCycle] = useState(false)

  // Carregar status do agente
  const loadStatus = async () => {
    try {
      setLoading(true)
      const res = await pb.send('/backend/v1/aluno/agent_status', {
        method: 'POST',
      })
      setAgentStatus(res)
    } catch (err: any) {
      console.error('Erro ao carregar status do Agente 369:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      loadStatus()
    }
  }, [user?.id])

  // Salvar PAR-Q+
  const handleSaveParq = async () => {
    try {
      setSubmittingParq(true)
      const res = await pb.send('/backend/v1/aluno/save_parq', {
        method: 'POST',
        body: parqAnswers,
      })
      toast({
        title: res.passed_clean
          ? 'PAR-Q+ Concluído com Sucesso'
          : 'PAR-Q+ Registrado com Alerta Clínico',
        description: res.message,
        variant: res.passed_clean ? 'default' : 'destructive',
      })
      setParqOpen(false)
      loadStatus()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar questionário',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingParq(false)
    }
  }

  // Gerar treino
  const handleGenerateWorkout = async () => {
    setRedFlagAlert(null)
    try {
      setGeneratingWorkout(true)
      const res = await pb.send('/backend/v1/aluno/generate_workout', {
        method: 'POST',
        body: {
          age_group: targetAgeGroup,
          template_code: selectedTemplateCode || undefined,
          symptoms: workoutSymptoms,
          cycle_symptom: cycleSymptom || undefined,
        },
      })

      setGeneratedWorkout(res.workout)
      toast({
        title: 'Treino Gerado com Sucesso!',
        description:
          res.usage.charged_amount > 0
            ? `Franquia esgotada: debitado R$ ${res.usage.charged_amount.toFixed(2)} da sua carteira.`
            : 'Treino determinístico homologado pela equipe credenciada.',
      })
      loadStatus()
    } catch (err: any) {
      const respData = err.data || {}
      if (respData.error === 'RED_FLAG_DETECTED') {
        setRedFlagAlert(respData.message)
      } else if (respData.error === 'PAR_Q_REQUIRED') {
        toast({
          title: 'PAR-Q+ Obrigatório',
          description: respData.message,
          variant: 'destructive',
        })
        setWorkoutModalOpen(false)
        setParqOpen(true)
      } else if (respData.error === 'WALLET_BALANCE_INSUFFICIENT' || err.status === 402) {
        toast({
          title: 'Cota de Treinos Excedida',
          description:
            respData.message ||
            'Você atingiu o limite de gerações do seu plano neste mês. Recarregue a carteira (R$ 0,25 por treino adicional) ou faça upgrade do plano.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Não foi possível gerar treino',
          description: err.message || 'Verifique seus dados.',
          variant: 'destructive',
        })
      }
    } finally {
      setGeneratingWorkout(false)
    }
  }

  // Enviar mensagem no chat
  const handleSendMessage = async () => {
    if (!chatInput.trim() || sendingMsg) return
    const text = chatInput.trim()
    setChatInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    try {
      setSendingMsg(true)
      const res = await pb.send('/backend/v1/aluno/agent_chat', {
        method: 'POST',
        body: { message: text },
      })

      if (res.is_red_flag) {
        setMessages((prev) => [...prev, { role: 'agent', content: res.reply, isRedFlag: true }])
      } else {
        setMessages((prev) => [...prev, { role: 'agent', content: res.reply }])
      }

      if (res.usage?.charged_amount > 0) {
        toast({
          title: 'Excedente de Franquia de Chat',
          description: `Debitado R$ ${res.usage.charged_amount.toFixed(2)} da sua carteira.`,
        })
      }
      loadStatus()
    } catch (err: any) {
      const respData = err.data || {}
      if (respData.error === 'WALLET_BALANCE_INSUFFICIENT' || err.status === 402) {
        toast({
          title: 'Cota de Chat Excedida',
          description:
            respData.message ||
            'Saldo insuficiente na carteira para mensagens excedentes. Recarregue a carteira ou faça upgrade do plano.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Erro ao comunicar com Agente',
          description: err.message || 'Tente novamente em instantes.',
          variant: 'destructive',
        })
      }
    } finally {
      setSendingMsg(false)
    }
  }

  // Salvar registro de ciclo menstrual
  const handleSaveCycle = async () => {
    try {
      setSavingCycle(true)
      await pb.send('/backend/v1/aluno/cycle_log', {
        method: 'POST',
        body: cycleForm,
      })
      toast({
        title: 'Registro do Ciclo Salvo!',
        description: 'Dados individuais protegidos sob o Art. 11 da LGPD.',
      })
      setCycleModalOpen(false)
    } catch (err: any) {
      const respData = err.data || {}
      toast({
        title: 'Erro ao registrar ciclo',
        description: respData.message || err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingCycle(false)
    }
  }

  if (loading && !agentStatus) {
    return (
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl animate-pulse">
        <div className="h-6 w-48 bg-[#2A2A2A] rounded mb-4" />
        <div className="h-16 w-full bg-[#2A2A2A] rounded" />
      </Card>
    )
  }

  const isGratis = agentStatus?.plan === 'gratis' && !agentStatus?.is_linked
  const isBasico = agentStatus?.plan === 'basico'
  const isPro = agentStatus?.plan === 'pro'
  const isPremium = agentStatus?.plan === 'premium'
  const isProOrPremium =
    isPro || isPremium || (agentStatus?.limits?.workouts_per_month ?? 0) >= 9000

  return (
    <div className="space-y-4">
      {/* CARD PRINCIPAL DO AGENTE 369 */}
      <Card className="bg-gradient-to-br from-[#0057FF] via-[#0046CC] to-[#003399] border-2 border-[#D4AF37]/40 hover:border-[#D4AF37]/80 transition-all rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#D4AF37] text-black font-extrabold uppercase text-[10px] tracking-wider px-3 py-1 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                Agente 369 Nativo
              </Badge>
              {agentStatus?.is_linked && (
                <Badge
                  variant="outline"
                  className="border-white/40 text-white bg-white/15 text-[10px]"
                >
                  Vinculado a Profissional (Franquia Mentor)
                </Badge>
              )}
              <Badge
                variant="outline"
                className="border-white/30 text-white/90 bg-black/20 text-[10px] uppercase"
              >
                Plano: {agentStatus?.plan?.toUpperCase()}
              </Badge>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white tracking-tight flex items-center gap-3">
              Copiloto Inteligente de Saúde & Treino
            </h2>
            <p className="text-sm text-white/90 font-inter leading-relaxed">
              Motor determinístico credenciado por profissionais (CREF 40+ e 60+), ajuste por sono
              (smartwatch) e progressão científica contínua.
            </p>
          </div>

          {/* STATUS DAS FRANQUIAS */}
          <div className="bg-black/35 backdrop-blur-md border border-white/20 p-4 rounded-2xl min-w-[260px] flex flex-col justify-center space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/85 font-medium flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 text-[#D4AF37]" /> Cota de Treinos (Mês):
              </span>
              <span className="text-white font-bold">
                {isProOrPremium
                  ? 'Ilimitado no plano Pro'
                  : `${agentStatus?.usage.workouts_generated ?? 0} de ${agentStatus?.limits.workouts_per_month ?? 5} usadas`}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/85 font-medium flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-[#00E5FF]" /> Mensagens Chat:
              </span>
              <span className="text-white font-bold">
                {agentStatus?.usage.chat_messages} / {agentStatus?.limits.messages_per_month}
              </span>
            </div>

            <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-white/80">
              <span className="text-white/90 font-medium">Excedente Carteira:</span>
              <span className="text-[#00E5FF] font-semibold">
                R$ {agentStatus?.overage_costs.workout_cost.toFixed(2)}/treino • R${' '}
                {agentStatus?.overage_costs.message_cost.toFixed(2)}/msg
              </span>
            </div>
          </div>
        </div>

        {/* ALERTA PAR-Q+ CASO NÃO PREENCHIDO */}
        {!agentStatus?.parq.completed && (
          <div className="mt-6 bg-black/40 border border-[#D4AF37]/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37] shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider font-montserrat">
                  Questionário de Prontidão PAR-Q+ Obrigatório
                </p>
                <p className="text-xs text-white/85 font-inter">
                  Antes de gerar treinos inteligentes, responda ao questionário médico regulamentar
                  CREF.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setParqOpen(true)}
              className="bg-[#D4AF37] hover:bg-[#B8972E] text-black font-bold text-xs shrink-0"
            >
              Responder PAR-Q+ Agora
            </Button>
          </div>
        )}

        {/* BOTÕES DE AÇÃO DO AGENTE */}
        <div className="mt-6 pt-6 border-t border-white/20 flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <Button
              onClick={() => {
                if (!agentStatus?.parq.completed) {
                  setParqOpen(true)
                } else {
                  setWorkoutModalOpen(true)
                }
              }}
              className="bg-[#D4AF37] hover:bg-[#B8972E] text-black font-extrabold text-xs px-5 py-5 rounded-xl shadow-md flex items-center gap-2"
            >
              <Dumbbell className="w-4 h-4" />
              Gerar Treino Determinístico (40+ / 60+)
            </Button>
            {/* Status discreto da cota abaixo do botão */}
            <span className="text-[11px] text-white/80 font-medium px-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              {isProOrPremium
                ? 'Ilimitado no plano Pro'
                : `${agentStatus?.usage.workouts_generated ?? 0} de ${agentStatus?.limits.workouts_per_month ?? 5} gerações grátis usadas este mês`}
            </span>
          </div>

          <Button
            onClick={() => setChatOpen(true)}
            variant="outline"
            className="border-white/30 hover:border-white text-white hover:text-white bg-black/40 hover:bg-black/60 text-xs px-4 py-5 rounded-xl flex items-center gap-2"
          >
            <Bot className="w-4 h-4 text-[#00E5FF]" />
            Conversar com o Agente ({agentStatus?.usage.messages_remaining} msgs restantes)
          </Button>

          {agentStatus?.limits.menstrual_cycle_module && (
            <Button
              onClick={() => setCycleModalOpen(true)}
              variant="outline"
              className="border-[#FF3366]/60 text-white hover:bg-[#FF3366]/20 bg-black/40 text-xs px-4 py-5 rounded-xl flex items-center gap-2"
            >
              <Heart className="w-4 h-4 text-[#FF3366]" />
              Módulo Ciclo Menstrual (Ajuste Sintomas)
            </Button>
          )}

          {agentStatus?.parq.completed && (
            <button
              type="button"
              onClick={() => setParqOpen(true)}
              className="text-[11px] text-white/80 hover:text-white underline ml-auto"
            >
              Ver Respostas PAR-Q+
            </button>
          )}
        </div>

        {/* DISCLAIMER FIXO CREF */}
        <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-[11px] text-white/85 font-inter">
          <ShieldCheck className="w-3.5 h-3.5 text-white/80 shrink-0" />
          <span>{agentStatus?.fixed_disclaimer}</span>
        </div>
      </Card>

      {/* MODAL 1: PAR-Q+ ONBOARDING */}
      <Dialog open={parqOpen} onOpenChange={setParqOpen}>
        <DialogContent className="max-w-2xl bg-[#181818] border border-[#2D2D2D] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat flex items-center gap-2 text-white">
              <FileCheck className="w-5 h-5 text-[#D4AF37]" />
              Questionário de Prontidão para Atividade Física (PAR-Q+)
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Conformidade CREF: Este questionário identifica restrições de saúde para garantir sua
              segurança cardiovascular e articular antes de iniciar os treinos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-2">
            {[
              {
                id: 'has_heart_condition',
                text: '1. Algum médico já disse que você possui algum problema cardíaco ou pressão alta?',
              },
              {
                id: 'has_chest_pain_activity',
                text: '2. Você sente dores no peito quando pratica atividades físicas?',
              },
              {
                id: 'has_chest_pain_rest',
                text: '3. No último mês, você sentiu dor no peito quando não estava praticando atividade física (em repouso)?',
              },
              {
                id: 'has_dizziness_loss_consciousness',
                text: '4. Você já perdeu a consciência ou caiu por causa de tontura nos últimos 12 meses?',
              },
              {
                id: 'has_bone_joint_problem',
                text: '5. Você tem algum problema ósseo ou articular (como coluna, joelho ou quadril) que poderia piorar com exercícios?',
              },
              {
                id: 'has_prescription_blood_pressure_heart',
                text: '6. Seu médico prescreveu medicamentos para pressão arterial ou problemas cardíacos?',
              },
              {
                id: 'has_other_reason_preventing_activity',
                text: '7. Você tem conhecimento de qualquer outra razão médica pela qual não deva praticar atividades físicas?',
              },
            ].map((q) => {
              const val = (parqAnswers as any)[q.id]
              return (
                <div
                  key={q.id}
                  className="p-3 bg-[#1F1F1F] border border-[#2B2B2B] rounded-xl flex items-center justify-between gap-4"
                >
                  <span className="text-xs text-gray-200 font-inter leading-relaxed">{q.text}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setParqAnswers((prev) => ({ ...prev, [q.id]: false }))}
                      className={`text-xs h-7 px-3 rounded-lg font-bold ${
                        !val ? 'bg-emerald-600 text-white' : 'bg-[#2A2A2A] text-gray-400'
                      }`}
                    >
                      NÃO
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setParqAnswers((prev) => ({ ...prev, [q.id]: true }))}
                      className={`text-xs h-7 px-3 rounded-lg font-bold ${
                        val ? 'bg-red-600 text-white' : 'bg-[#2A2A2A] text-gray-400'
                      }`}
                    >
                      SIM
                    </Button>
                  </div>
                </div>
              )
            })}

            <div className="pt-2">
              <label className="text-xs text-gray-400 font-inter block mb-1">
                Observações de saúde ou histórico relevante (opcional):
              </label>
              <Textarea
                value={parqAnswers.medical_clearance_notes}
                onChange={(e) =>
                  setParqAnswers((prev) => ({ ...prev, medical_clearance_notes: e.target.value }))
                }
                placeholder="Ex: cirurgia de menisco em 2024, liberação médica anexada..."
                className="bg-[#121212] border-[#2A2A2A] text-xs text-white"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-[#2A2A2A] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setParqOpen(false)}
              className="border-[#333] text-gray-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveParq}
              disabled={submittingParq}
              className="bg-[#D4AF37] hover:bg-[#B8972E] text-black font-bold text-xs"
            >
              {submittingParq ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar PAR-Q+ e Liberar Agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: GERAÇÃO DE TREINO DETERMINÍSTICO */}
      <Dialog open={workoutModalOpen} onOpenChange={setWorkoutModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-[#f7f6f3] border-2 border-[#E5E3DC] text-[#1A1A1A] p-6 sm:p-8">
          <DialogHeader className="pb-3 border-b border-[#E5E3DC]">
            <DialogTitle className="text-xl sm:text-2xl font-extrabold font-montserrat flex items-center gap-2.5 text-[#0D1B2A]">
              <div className="w-9 h-9 rounded-xl bg-[#0057FF]/10 flex items-center justify-center text-[#0057FF] shrink-0">
                <Dumbbell className="w-5 h-5 text-[#0057FF]" />
              </div>
              Gerar Treino Determinístico Supervisionado
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-gray-600 font-inter mt-1 leading-relaxed">
              Motor baseado em templates aprovados por mestres em educação física (CREF). A
              inteligência parametrizará carga, volume e segurança biomecânica de acordo com o seu
              perfil.
            </DialogDescription>
          </DialogHeader>

          {/* RED FLAG ALERT CASO OCORRA */}
          {redFlagAlert && (
            <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 my-2 text-red-950">
              <div className="flex items-center gap-2 font-bold text-base text-red-700 mb-1">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                Geração Interrompida por Segurança Médica
              </div>
              <p className="text-sm leading-relaxed">{redFlagAlert}</p>
            </div>
          )}

          <div className="space-y-5 py-2">
            <div>
              <label className="text-sm font-bold text-[#0D1B2A] uppercase tracking-wide block mb-2">
                Faixa Etária Alvo (Protocolo Homologado):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetAgeGroup('40-59')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    targetAgeGroup === '40-59'
                      ? 'border-[#0057FF] bg-blue-50/80 shadow-xs'
                      : 'border-[#E5E3DC] bg-white opacity-80 hover:opacity-100 hover:border-gray-400'
                  }`}
                >
                  <div className="font-extrabold text-base text-[#0D1B2A]">40 a 59 Anos</div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1 leading-snug">
                    Hipertrofia Funcional & Preservação Óssea/Articular
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetAgeGroup('60+')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    targetAgeGroup === '60+'
                      ? 'border-[#0057FF] bg-blue-50/80 shadow-xs'
                      : 'border-[#E5E3DC] bg-white opacity-80 hover:opacity-100 hover:border-gray-400'
                  }`}
                >
                  <div className="font-extrabold text-base text-[#0D1B2A]">
                    60+ Anos (Sênior Ativo)
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1 leading-snug">
                    Multicomponente (Força + Equilíbrio + Marcha ≥3x/sem)
                  </div>
                </button>
              </div>
            </div>

            {/* Smartwatch Sono Info */}
            {agentStatus?.limits.smartwatch_sleep_adjustment && agentStatus?.recent_sleep && (
              <div className="bg-white border-2 border-blue-200 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Moon className="w-5 h-5 text-[#0057FF]" />
                  </div>
                  <span className="text-[#2B2B2B] font-medium">
                    Último sono registrado:{' '}
                    <strong className="text-[#0D1B2A]">
                      {agentStatus.recent_sleep.sleep_hours}h
                    </strong>{' '}
                    (Score: {agentStatus.recent_sleep.sleep_score}/100)
                  </span>
                </div>
                <Badge className="bg-blue-100 text-[#0057FF] text-xs font-bold border-0 px-3 py-1 self-start sm:self-auto">
                  {agentStatus.recent_sleep.sleep_hours < 6
                    ? 'Regenerativo (<6h)'
                    : agentStatus.recent_sleep.sleep_hours < 7
                      ? 'Compensatório (-25%)'
                      : 'Normal (≥7h)'}
                </Badge>
              </div>
            )}

            {/* Check Ciclo Menstrual caso Premium */}
            {agentStatus?.limits.menstrual_cycle_module && (
              <div>
                <label className="text-sm font-bold text-[#0D1B2A] block mb-1.5">
                  Sintoma Menstrual no Dia (Ajuste Individual — Evidência Clínica):
                </label>
                <Input
                  value={cycleSymptom}
                  onChange={(e) => setCycleSymptom(e.target.value)}
                  placeholder="Ex: cólica leve, fadiga muscular, sem sintomas..."
                  className="bg-white border-2 border-[#E5E3DC] text-sm sm:text-base text-[#1A1A1A] h-11 px-3.5 rounded-xl placeholder:text-gray-400"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-bold text-[#0D1B2A] block mb-1.5">
                Sintomas ou observações para o treino de hoje:
              </label>
              <Textarea
                value={workoutSymptoms}
                onChange={(e) => setWorkoutSymptoms(e.target.value)}
                placeholder="Ex: lombar levemente fadigada do dia anterior, foco em membros superiores, preferência por sentar e levantar..."
                className="bg-white border-2 border-[#E5E3DC] text-sm sm:text-base text-[#1A1A1A] p-3 rounded-xl placeholder:text-gray-400"
                rows={2}
              />
              <p className="text-xs sm:text-sm text-gray-500 mt-1.5 font-medium">
                * Qualquer relato de dor no peito, falta de ar ou tontura interromperá a geração
                automaticamente por segurança médica.
              </p>
            </div>

            {/* EXIBIÇÃO DO TREINO GERADO — DESIGN CLARO, ALTO CONTRASTE E TIPOGRAFIA ACESSÍVEL 60+ */}
            {generatedWorkout && (
              <div className="bg-[#f7f6f3] border-2 border-[#0057FF]/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg text-[#1A1A1A]">
                {/* Cabeçalho do Treino Gerado */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E3DC]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-[#0057FF] text-white font-bold text-xs sm:text-sm px-3 py-1 shadow-xs">
                        {generatedWorkout.target_age_group === '60+'
                          ? 'Sênior 60+'
                          : 'Adulto 40-59'}
                      </Badge>
                      <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Protocolo Homologado CREF
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold font-montserrat text-[#0D1B2A] tracking-tight leading-snug">
                      {generatedWorkout.title}
                    </h3>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-[#B8962E] bg-[#D4AF37]/15 border border-[#D4AF37]/40 px-3 py-1.5 rounded-xl font-mono">
                      {generatedWorkout.template_code || 'TPL-369'}
                    </span>
                  </div>
                </div>

                {/* Painel Informativo Técnico e Ajustes do Treino */}
                <div className="bg-white rounded-xl p-4 border border-[#E5E3DC] space-y-2.5 text-sm sm:text-base leading-relaxed text-[#2B2B2B]">
                  <div className="flex items-start gap-2.5">
                    <span className="font-bold text-[#0D1B2A] min-w-[140px] shrink-0 text-sm sm:text-base">
                      Aprovação Técnica:
                    </span>
                    <span className="text-[#333333] font-medium text-sm sm:text-base">
                      {generatedWorkout.approved_by_cref}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 pt-2 border-t border-[#F0EFEB]">
                    <span className="font-bold text-[#0D1B2A] min-w-[140px] shrink-0 text-sm sm:text-base">
                      Diretrizes Clínicas:
                    </span>
                    <span className="text-[#333333] text-sm sm:text-base leading-relaxed">
                      {generatedWorkout.guidelines}
                    </span>
                  </div>

                  {/* Ajuste por Sono do Smartwatch */}
                  {generatedWorkout.sleep_adjustment && (
                    <div className="mt-2 p-3 bg-blue-50/90 border border-blue-200 rounded-lg flex items-start gap-2.5 text-blue-900 text-sm sm:text-base font-medium">
                      <Moon className="w-5 h-5 text-[#0057FF] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#0057FF]">Ajuste por Sono (Smartwatch):</strong>{' '}
                        {generatedWorkout.sleep_adjustment.action}
                      </div>
                    </div>
                  )}

                  {/* Ajuste por Sintomas do Ciclo Menstrual */}
                  {generatedWorkout.menstrual_adjustment && (
                    <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-950 text-sm sm:text-base font-medium">
                      <Heart className="w-5 h-5 text-[#FF3366] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#FF3366]">Ajuste por Sintoma:</strong>{' '}
                        {generatedWorkout.menstrual_adjustment.action}
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de Blocos e Exercícios com Alta Legibilidade */}
                <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 font-medium px-1">
                    <span>Sequência de Exercícios do Protocolo:</span>
                    <span className="font-semibold text-[#0057FF]">
                      {generatedWorkout.exercises?.reduce(
                        (acc: number, b: any) => acc + (b.exercises?.length || 0),
                        0,
                      ) || 0}{' '}
                      exercícios no total
                    </span>
                  </div>

                  {generatedWorkout.exercises?.map((blk: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-[#E5E3DC] shadow-sm hover:border-[#0057FF]/40 transition-colors"
                    >
                      {/* Título do Bloco */}
                      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#E5E3DC]">
                        <div className="w-3 h-3 rounded-full bg-[#0057FF]" />
                        <h4 className="text-base sm:text-lg font-bold font-montserrat text-[#0D1B2A] tracking-tight">
                          {blk.block}
                        </h4>
                      </div>

                      {/* Itens de Exercício */}
                      <div className="space-y-3">
                        {blk.exercises?.map((ex: any, eIdx: number) => (
                          <div
                            key={eIdx}
                            className="p-3.5 sm:p-4 rounded-xl bg-[#FAFAF8] border border-[#EBE8E1] hover:bg-[#F3F2EE] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2.5"
                          >
                            {/* Nome do exercício com marcador e tamanho acessível */}
                            <div className="flex items-start gap-3">
                              <span className="text-[#0057FF] font-black text-lg leading-none mt-0.5">
                                •
                              </span>
                              <div>
                                <span className="text-base sm:text-lg font-bold text-[#1A1A1A] leading-snug">
                                  {ex.name}
                                </span>
                              </div>
                            </div>

                            {/* Prescrição: Séries x Repetições, Carga e Descanso */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 self-start md:self-auto pl-6 md:pl-0">
                              {/* Séries x Reps */}
                              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-[#D4AF37] text-[#8C6D14] font-bold text-sm sm:text-base font-mono shadow-2xs">
                                {ex.sets} séries × {ex.reps}
                              </span>

                              {/* Carga */}
                              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#0057FF] font-semibold text-sm sm:text-base">
                                Carga: {ex.load}
                              </span>

                              {/* Descanso */}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-sm sm:text-base">
                                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                                {ex.rest} de repouso
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nota de Segurança e Acessibilidade no Rodapé do Treino */}
                <div className="p-3 bg-white rounded-xl border border-[#E5E3DC] flex items-center gap-2.5 text-xs sm:text-sm text-gray-700 font-medium">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 text-[#0057FF] shrink-0" />
                  <span>
                    Dica: Faça pausas de hidratação entre os blocos e respeite a sua cadência
                    natural de respiração.
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[#E5E3DC] pt-5 gap-3 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWorkoutModalOpen(false)
                setGeneratedWorkout(null)
                setRedFlagAlert(null)
              }}
              className="border-2 border-[#E5E3DC] bg-white hover:bg-gray-100 text-[#1A1A1A] font-bold text-sm sm:text-base h-11 sm:h-12 px-5 rounded-xl w-full sm:w-auto"
            >
              Fechar
            </Button>
            <Button
              onClick={handleGenerateWorkout}
              disabled={generatingWorkout}
              className="bg-[#0057FF] hover:bg-[#0046CC] text-white font-extrabold text-sm sm:text-base h-11 sm:h-12 px-6 rounded-xl shadow-md w-full sm:w-auto flex items-center justify-center gap-2"
            >
              {generatingWorkout ? <Loader2 className="w-5 h-5 animate-spin mr-1" /> : null}
              Parametrizar Treino Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: CHAT COM O AGENTE 369 */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-2xl bg-[#181818] border border-[#2D2D2D] text-white flex flex-col h-[75vh]">
          <DialogHeader className="border-b border-[#2A2A2A] pb-3">
            <DialogTitle className="text-lg font-bold font-montserrat flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#00E5FF]" />
                Agente 369 — Copiloto Interativo
              </span>
              <Badge variant="outline" className="border-[#00E5FF]/40 text-[#00E5FF] text-[10px]">
                {agentStatus?.usage.messages_remaining} msgs restantes
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* ÁREA DE MENSAGENS */}
          <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                <Bot className="w-12 h-12 text-[#D4AF37]/40 mb-2" />
                <p className="text-xs font-semibold text-gray-300">
                  Olá! Eu sou seu copiloto inteligente 369.
                </p>
                <p className="text-[11px] text-gray-500 max-w-sm mt-1">
                  Pergunte sobre como ajustar seu treino, estratégias de mobilidade, recuperação com
                  smartwatch ou diretrizes de segurança.
                </p>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#D4AF37] text-black font-medium ml-4'
                        : m.isRedFlag
                          ? 'bg-red-950/80 border border-red-500 text-red-200 mr-4'
                          : 'bg-[#222] border border-[#333] text-gray-200 mr-4'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sendingMsg && (
              <div className="flex justify-start">
                <div className="bg-[#222] border border-[#333] rounded-2xl p-3 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
                  Processando com Skip Native AI Agent...
                </div>
              </div>
            )}
          </div>

          {/* INPUT DO CHAT */}
          <div className="border-t border-[#2A2A2A] pt-3 flex items-center gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage()
              }}
              placeholder="Digite sua dúvida de treino ou recuperação..."
              className="bg-[#121212] border-[#2A2A2A] text-xs text-white flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={sendingMsg || !chatInput.trim()}
              className="bg-[#00E5FF] hover:bg-[#00BFD8] text-black font-bold text-xs px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: REGISTRO CICLO MENSTRUAL (LGPD ART. 11) */}
      <Dialog open={cycleModalOpen} onOpenChange={setCycleModalOpen}>
        <DialogContent className="max-w-md bg-[#181818] border border-[#2D2D2D] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat flex items-center gap-2 text-white">
              <Heart className="w-5 h-5 text-[#FF3366]" />
              Módulo Ciclo Menstrual (Premium)
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Dados sensíveis de saúde protegidos sob o Art. 11 da LGPD. O motor ajusta o treino
              pelos seus sintomas individuais diários, sem dogmas hormonais genéricos.
            </DialogDescription>
          </DialogHeader>

          {!agentStatus?.lgpd_health_consent ? (
            <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Lock className="w-4 h-4" /> Consentimento Art. 11 Requerido
              </div>
              <p>
                O consentimento para tratamento de dados sensíveis de saúde não está ativo ou foi
                revogado no painel LGPD.
              </p>
              <Link
                to="/lgpd-consentimentos"
                className="inline-block text-[#D4AF37] font-semibold underline mt-1"
              >
                Ativar Consentimento no Painel LGPD
              </Link>
            </div>
          ) : (
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">Data do Registro:</label>
                <Input
                  type="date"
                  value={cycleForm.date}
                  onChange={(e) => setCycleForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="bg-[#121212] border-[#2A2A2A] text-xs text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Intensidade do Fluxo:</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['nenhum', 'leve', 'moderado', 'intenso'] as const).map((f) => (
                    <Button
                      key={f}
                      type="button"
                      size="sm"
                      onClick={() => setCycleForm((prev) => ({ ...prev, flow: f }))}
                      className={`text-xs capitalize ${
                        cycleForm.flow === f ? 'bg-[#FF3366] text-white' : 'bg-[#222] text-gray-400'
                      }`}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">
                  Nível de Energia e Disposição (1 a 10):{' '}
                  <strong>{cycleForm.energy_level}/10</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={cycleForm.energy_level}
                  onChange={(e) =>
                    setCycleForm((prev) => ({ ...prev, energy_level: Number(e.target.value) }))
                  }
                  className="w-full accent-[#FF3366]"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">
                  Percepção de Recuperação (1 a 10):{' '}
                  <strong>{cycleForm.perceived_recovery}/10</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={cycleForm.perceived_recovery}
                  onChange={(e) =>
                    setCycleForm((prev) => ({
                      ...prev,
                      perceived_recovery: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#FF3366]"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Sintomas do Dia:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Cólica Leve',
                    'Cólica Forte',
                    'Fadiga Muscular',
                    'Dor de Cabeça',
                    'Sensibilidade Articular',
                    'Inchaço',
                    'Disposição Alta',
                  ].map((s) => {
                    const sel = cycleForm.symptoms.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setCycleForm((prev) => ({
                            ...prev,
                            symptoms: sel
                              ? prev.symptoms.filter((x) => x !== s)
                              : [...prev.symptoms, s],
                          }))
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                          sel
                            ? 'border-[#FF3366] bg-[#FF3366]/20 text-white font-bold'
                            : 'border-[#333] bg-[#1a1a1a] text-gray-400'
                        }`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-[#2A2A2A] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCycleModalOpen(false)}
              className="border-[#333] text-gray-300 text-xs"
            >
              Fechar
            </Button>
            {agentStatus?.lgpd_health_consent && (
              <Button
                onClick={handleSaveCycle}
                disabled={savingCycle}
                className="bg-[#FF3366] hover:bg-[#E02657] text-white font-bold text-xs"
              >
                {savingCycle ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar Registro LGPD Art. 11
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

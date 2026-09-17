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
      } else if (respData.error === 'WALLET_BALANCE_INSUFFICIENT') {
        toast({
          title: 'Saldo Insuficiente na Carteira',
          description: respData.message,
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
      if (respData.error === 'WALLET_BALANCE_INSUFFICIENT') {
        toast({
          title: 'Saldo Insuficiente na Carteira',
          description: respData.message,
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
                <Dumbbell className="w-3.5 h-3.5 text-[#D4AF37]" /> Treinos no Mês:
              </span>
              <span className="text-white font-bold">
                {agentStatus?.usage.workouts_generated} /{' '}
                {agentStatus?.limits.workouts_per_month >= 9000
                  ? 'Ilimitado'
                  : agentStatus?.limits.workouts_per_month}
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
        {!agentStatus?.parq.completed && !isGratis && (
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
          {isGratis ? (
            <div className="w-full bg-black/40 border border-white/20 p-4 rounded-xl flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs text-white/90 font-inter">
                O Agente 369 está disponível a partir do <strong>Plano Básico (R$ 10/mês)</strong>{' '}
                ou vinculação a profissional parceiro.
              </span>
              <Link to="/aluno/carteira">
                <Button className="bg-[#D4AF37] hover:bg-[#B8972E] text-black font-bold text-xs">
                  Fazer Upgrade do Plano
                </Button>
              </Link>
            </div>
          ) : (
            <>
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
            </>
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
        <DialogContent className="max-w-2xl bg-[#181818] border border-[#2D2D2D] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat flex items-center gap-2 text-white">
              <Dumbbell className="w-5 h-5 text-[#D4AF37]" />
              Gerar Treino Determinístico Supervisionado
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Motor baseado em templates aprovados por mestres em educação física. A IA
              parametrizará apenas carga, volume e segurança biomecânica.
            </DialogDescription>
          </DialogHeader>

          {/* RED FLAG ALERT CASO OCORRA */}
          {redFlagAlert && (
            <div className="bg-red-950/80 border-2 border-red-500 rounded-2xl p-4 my-2 text-red-200">
              <div className="flex items-center gap-2 font-bold text-sm text-red-400 mb-1">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                Geração Interrompida por Segurança Médica
              </div>
              <p className="text-xs leading-relaxed">{redFlagAlert}</p>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase block mb-1">
                Faixa Etária Alvo (Protocolo Homologado):
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetAgeGroup('40-59')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    targetAgeGroup === '40-59'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : 'border-[#2D2D2D] bg-[#141414] opacity-70'
                  }`}
                >
                  <div className="font-bold text-xs text-white">40 a 59 Anos</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Hipertrofia Funcional & Preservação Óssea/Articular
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetAgeGroup('60+')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    targetAgeGroup === '60+'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : 'border-[#2D2D2D] bg-[#141414] opacity-70'
                  }`}
                >
                  <div className="font-bold text-xs text-white">60+ Anos (Sênior Ativo)</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Multicomponente (Força + Equilíbrio + Marcha ≥3x/sem)
                  </div>
                </button>
              </div>
            </div>

            {/* Smartwatch Sono Info */}
            {agentStatus?.limits.smartwatch_sleep_adjustment && agentStatus?.recent_sleep && (
              <div className="bg-[#151D24] border border-[#00E5FF]/30 p-3 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-[#00E5FF]" />
                  <span className="text-gray-300">
                    Último sono registrado: <strong>{agentStatus.recent_sleep.sleep_hours}h</strong>{' '}
                    (Score: {agentStatus.recent_sleep.sleep_score}/100)
                  </span>
                </div>
                <Badge className="bg-[#00E5FF]/20 text-[#00E5FF] text-[10px] border-0">
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
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Sintoma Menstrual no Dia (Ajuste Individual — Evidência Clínica):
                </label>
                <Input
                  value={cycleSymptom}
                  onChange={(e) => setCycleSymptom(e.target.value)}
                  placeholder="Ex: cólica leve, fadiga muscular, sem sintomas..."
                  className="bg-[#121212] border-[#2A2A2A] text-xs text-white"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Sintomas ou observações para o treino de hoje:
              </label>
              <Textarea
                value={workoutSymptoms}
                onChange={(e) => setWorkoutSymptoms(e.target.value)}
                placeholder="Ex: lombar levemente fadigada do dia anterior, foco em membros superiores..."
                className="bg-[#121212] border-[#2A2A2A] text-xs text-white"
                rows={2}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                * Qualquer relato de dor no peito, falta de ar ou tontura interromperá a geração
                automaticamente.
              </p>
            </div>

            {/* EXIBIÇÃO DO TREINO GERADO */}
            {generatedWorkout && (
              <div className="bg-[#141414] border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-xs uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> {generatedWorkout.title}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-300 text-[10px]"
                  >
                    {generatedWorkout.target_age_group}
                  </Badge>
                </div>

                <div className="text-[11px] text-gray-300 font-inter border-y border-[#262626] py-2">
                  <p>
                    <strong>Aprovação Técnica:</strong> {generatedWorkout.approved_by_cref}
                  </p>
                  <p>
                    <strong>Diretrizes:</strong> {generatedWorkout.guidelines}
                  </p>
                  {generatedWorkout.sleep_adjustment && (
                    <p className="text-[#00E5FF] mt-1 font-semibold">
                      ⚙️ {generatedWorkout.sleep_adjustment.action}
                    </p>
                  )}
                  {generatedWorkout.menstrual_adjustment && (
                    <p className="text-[#FF3366] mt-1 font-semibold">
                      🌸 {generatedWorkout.menstrual_adjustment.action}
                    </p>
                  )}
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {generatedWorkout.exercises?.map((blk: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-[#1C1C1C] p-2.5 rounded-lg border border-[#2B2B2B]"
                    >
                      <div className="text-[11px] font-bold text-[#D4AF37] mb-1">{blk.block}</div>
                      <div className="space-y-1">
                        {blk.exercises?.map((ex: any, eIdx: number) => (
                          <div
                            key={eIdx}
                            className="flex justify-between text-[10px] text-gray-300"
                          >
                            <span>• {ex.name}</span>
                            <span className="text-gray-400 font-mono">
                              {ex.sets}x{ex.reps} | {ex.load} | rest {ex.rest}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[#2A2A2A] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWorkoutModalOpen(false)
                setGeneratedWorkout(null)
                setRedFlagAlert(null)
              }}
              className="border-[#333] text-gray-300 text-xs"
            >
              Fechar
            </Button>
            <Button
              onClick={handleGenerateWorkout}
              disabled={generatingWorkout}
              className="bg-[#D4AF37] hover:bg-[#B8972E] text-black font-bold text-xs"
            >
              {generatingWorkout ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
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

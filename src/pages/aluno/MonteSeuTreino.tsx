import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { api, type WorkoutRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Dumbbell,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  Layers,
  Lock,
  Flame,
  Award,
  Video,
  ChevronRight,
  TrendingUp,
  Coins,
  Wallet,
  Zap,
  ShoppingBag,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchExerciseReference, ExerciseReferenceInfo } from '@/lib/exerciseDb'

export default function MonteSeuTreino() {
  const { user } = useAuth()
  const userPlan = (user?.plan || 'gratis').toLowerCase()
  const isGratis = userPlan === 'gratis'
  const isPremium = userPlan === 'premium'
  const isProOrPremium = userPlan === 'pro' || userPlan === 'premium'

  // Anamnese Form State
  const [objective, setObjective] = useState(user?.objective || 'Hipertrofia')
  const [experience, setExperience] = useState('Intermediário')
  const [daysAvailable, setDaysAvailable] = useState(4)
  const [restrictions, setRestrictions] = useState('Nenhuma lesão atual')
  const [notes, setNotes] = useState('')

  // AI Credits State
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [creditsData, setCreditsData] = useState<{
    credits: number
    is_unlimited: boolean
    has_images: boolean
    cost_per_workout: number
    wallet_balance: number
    reset_month: string
  }>({
    credits: 0,
    is_unlimited: isPremium,
    has_images: !isGratis,
    cost_per_workout: 20,
    wallet_balance: 0,
    reset_month: '',
  })
  const [buyCreditsModalOpen, setBuyCreditsModalOpen] = useState(false)
  const [buyingCredits, setBuyingCredits] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<'pacote_100' | 'pacote_200'>('pacote_100')

  // AI Generation State
  const [generating, setGenerating] = useState(false)
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutRecord | null>(null)
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutRecord[]>([])

  // Exercise real reference images cache state
  const [exerciseRefs, setExerciseRefs] = useState<Record<string, ExerciseReferenceInfo | null>>({})
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  // RECURSO 3: Modal de Feedback de Carga com IA
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null)
  const [weightUsed, setWeightUsed] = useState<string>('20')
  const [difficulty, setDifficulty] = useState<number>(5)
  const [evaluatingLoad, setEvaluatingLoad] = useState(false)
  const [aiLoadResult, setAiLoadResult] = useState<{
    recommendation: string
    suggestedLoad: string
    suggestedReps: string
    rationale: string
    action: 'increase' | 'maintain' | 'decrease'
  } | null>(null)

  // RECURSO 5: Modal de Finalização do Treino do Dia
  const [finishModalOpen, setFinishModalOpen] = useState(false)
  const [finishingWorkout, setFinishingWorkout] = useState(false)

  // Consultar Saldo de Créditos do Usuário
  const loadCredits = async () => {
    if (!user) return
    setCreditsLoading(true)
    try {
      const res = await pb.send('/backend/v1/aluno/ai-credits', {
        method: 'GET',
      })
      if (res && res.success) {
        setCreditsData({
          credits: res.credits ?? 0,
          is_unlimited: Boolean(res.is_unlimited),
          has_images: Boolean(res.has_images),
          cost_per_workout: res.cost_per_workout || 20,
          wallet_balance: res.wallet_balance || 0,
          reset_month: res.reset_month || '',
        })
      }
    } catch (err) {
      console.warn('Erro ao carregar créditos de treino IA:', err)
    } finally {
      setCreditsLoading(false)
    }
  }

  // Load existing workouts for student
  const loadWorkouts = async () => {
    if (!user) return
    try {
      // Listar todos os treinos que o aluno já gerou por IA ou recebeu
      const res = await pb.collection('workouts').getList<WorkoutRecord>(1, 20, {
        filter: `student = "${user.id}" && ai_generated = true`,
        sort: '-created',
      })
      setWorkoutHistory(res.items)
      if (res.items.length > 0 && !currentWorkout) {
        setCurrentWorkout(res.items[0])
      }
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadCredits()
    loadWorkouts()
  }, [user])

  // Load Exercise real references when currentWorkout changes (apenas se plano suporta imagens)
  useEffect(() => {
    if (!currentWorkout?.exercises) return

    // Plano Grátis NÃO carrega imagem (treino apenas descritivo)
    if (!creditsData.has_images) {
      setExerciseRefs({})
      return
    }

    const loadReferences = async () => {
      const refs: Record<string, ExerciseReferenceInfo | null> = {}
      for (const ex of currentWorkout.exercises || []) {
        if (!ex?.name || typeof ex.name !== 'string') continue
        const ref = await fetchExerciseReference(ex.name)
        refs[ex.name] = ref
      }
      setExerciseRefs(refs)
    }

    loadReferences()
  }, [currentWorkout, creditsData.has_images])

  // Comprar Mais Créditos usando Saldo da Carteira
  const handleBuyCredits = async () => {
    setBuyingCredits(true)
    try {
      const res = await pb.send('/backend/v1/aluno/buy-ai-credits', {
        method: 'POST',
        body: { package_type: selectedPackage },
      })
      if (res.success) {
        toast.success(res.message || 'Créditos adquiridos com sucesso!')
        setBuyCreditsModalOpen(false)
        await loadCredits()
      } else {
        toast.error(res.message || 'Falha na compra de créditos.')
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Erro ao comprar créditos.'
      toast.error(msg)
    } finally {
      setBuyingCredits(false)
    }
  }

  // Handle AI Workout Generation com Dedução de Créditos
  const handleGenerateAI = async () => {
    // 1. Validar e Consumir Crédito no Backend
    setGenerating(true)
    try {
      const consumeRes = await pb.send('/backend/v1/aluno/consume-ai-credit', {
        method: 'POST',
      })

      if (!consumeRes.success) {
        if (consumeRes.needs_credits) {
          toast.error(consumeRes.message)
          setBuyCreditsModalOpen(true)
          return
        }
        throw new Error(consumeRes.message || 'Não foi possível validar créditos.')
      }

      // 2. Chamar o serviço de IA
      const generated = await api.generateWorkout({
        objective,
        experience,
        daysAvailable,
        restrictions,
        notes,
      })

      // Persistir no PocketBase
      const newRec = await pb.collection('workouts').create<WorkoutRecord>({
        student: user?.id,
        title: generated.title || `Treino IA - ${objective}`,
        objective: generated.objective || objective,
        exercises: generated.exercises || [],
        day: 'Personalizado',
        status: 'ativo',
        ai_generated: true,
      })

      setCurrentWorkout(newRec)
      setWorkoutHistory((prev) => [newRec, ...prev])
      await loadCredits()

      toast.success(consumeRes.message || 'Treino gerado com sucesso pelo algoritmo 369!')
    } catch (err: any) {
      const errorMsg =
        err?.data?.message || err?.message || 'Falha ao gerar treino com IA. Tente novamente.'
      toast.error(errorMsg)
      if (err?.data?.needs_credits) {
        setBuyCreditsModalOpen(true)
      }
    } finally {
      setGenerating(false)
    }
  }

  // Iniciar Modo Execução Guiada do Treino
  const handleStartWorkoutExecution = (id?: string) => {
    const targetId = id || currentWorkout?.id
    if (targetId) {
      window.location.href = `/aluno/treino/execucao/${targetId}`
    } else {
      window.location.href = '/aluno/executar-treino'
    }
  }

  // Open Load Feedback Modal on Clicking "Concluir"
  const handleOpenExerciseFeedback = (index: number) => {
    if (!currentWorkout || !currentWorkout.exercises) return
    const ex = currentWorkout.exercises[index]

    if (ex.completed) {
      toggleExerciseStatus(index, false)
      return
    }

    const matchLoad = ex.load?.match(/\d+/)
    const initialWeight = matchLoad ? matchLoad[0] : '20'

    setSelectedExerciseIndex(index)
    setWeightUsed(initialWeight)
    setDifficulty(5)
    setAiLoadResult(null)
    setFeedbackModalOpen(true)
  }

  // Request Load Feedback from AI Hook
  const handleCalculateAiFeedback = async () => {
    if (selectedExerciseIndex === null || !currentWorkout?.exercises) return
    const ex = currentWorkout.exercises[selectedExerciseIndex]

    setEvaluatingLoad(true)
    try {
      const res = await api.loadFeedback({
        exerciseName: ex.name,
        weightUsed: Number(weightUsed) || 0,
        difficulty,
        objective: currentWorkout.objective || objective,
        reps: ex.reps,
        sets: ex.sets,
      })
      setAiLoadResult(res)
      toast.success('Análise de progressão de carga concluída!')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao calcular feedback de carga.')
    } finally {
      setEvaluatingLoad(false)
    }
  }

  // Toggle Exercise status in PocketBase
  const toggleExerciseStatus = async (index: number, completed: boolean, feedbackNote?: string) => {
    if (!currentWorkout || !currentWorkout.exercises) return

    const updatedExercises = [...currentWorkout.exercises]
    const item = { ...updatedExercises[index], completed }
    if (feedbackNote) {
      item.load = `${weightUsed} kg (${feedbackNote})`
    }
    updatedExercises[index] = item

    try {
      const updated = await pb.collection('workouts').update<WorkoutRecord>(currentWorkout.id, {
        exercises: updatedExercises,
      })
      setCurrentWorkout(updated)
      toast.success(completed ? 'Exercício concluído com sucesso! 💪' : 'Exercício reaberto.')
    } catch (_) {
      toast.error('Erro ao atualizar exercício.')
    }
  }

  // Save feedback and mark exercise as completed
  const handleConfirmExerciseFeedback = async () => {
    if (selectedExerciseIndex === null) return
    const note = aiLoadResult
      ? aiLoadResult.suggestedLoad
      : `${weightUsed}kg - RPE ${difficulty}/10`
    await toggleExerciseStatus(selectedExerciseIndex, true, note)
    setFeedbackModalOpen(false)
  }

  // RECURSO 5: Finalizar Treino do Dia e Criar Registro em `services` com type: treino_ia
  const handleFinalizeDailyWorkout = async () => {
    if (!user || !currentWorkout) return
    setFinishingWorkout(true)

    try {
      const hasProfessional = !!currentWorkout.professional

      await pb.collection('services').create({
        student: user.id,
        professional: currentWorkout.professional || null,
        type: 'treino_ia',
        title: `Treino do Dia: ${currentWorkout.title}`,
        value: 0,
        status: 'concluido',
        completed_at: new Date().toISOString(),
        notes: `Treino concluído com 100% dos exercícios finalizados via IA 369. Exercícios: ${currentWorkout.exercises?.length || 0}${hasProfessional ? ' (Com acompanhamento profissional)' : ' (Treino IA autônomo - sem pontuação de ranking)'}`,
      })

      await pb.collection('workouts').update(currentWorkout.id, {
        status: 'concluido',
      })

      if (hasProfessional) {
        toast.success(
          '🏆 Treino Finalizado com Sucesso! 1 serviço com profissional computado para sua pontuação no ranking!',
        )
      } else {
        toast.success(
          '🏆 Treino Finalizado com Sucesso! Registrado no seu histórico (treinos sem acompanhamento profissional não pontuam no ranking).',
        )
      }
      setFinishModalOpen(false)
      loadWorkouts()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao registrar finalização do treino.')
    } finally {
      setFinishingWorkout(false)
    }
  }

  const allExercisesCompleted =
    currentWorkout?.exercises &&
    currentWorkout.exercises.length > 0 &&
    currentWorkout.exercises.every((ex) => ex.completed)

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          Inteligência Artificial 369
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Monte Seu Treino com IA & Biomecânica
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Prescrições inteligentes por IA adaptadas ao seu objetivo, histórico completo de treinos
          gerados e saldo mensal de créditos.
        </p>
      </div>

      {/* PAINEL DE SALDO DE CRÉDITOS & PLANO DO ALUNO */}
      <Card className="bg-gradient-to-r from-[#181818] via-[#151a24] to-[#181818] border border-[#2A2A2A] p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold font-montserrat uppercase bg-[#0057FF]/20 text-[#0057FF] border border-[#0057FF]/40 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-[#D4AF37]" /> Sistema de Créditos IA
              </span>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-extrabold font-montserrat uppercase border ${
                  userPlan === 'premium'
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50'
                    : userPlan === 'pro'
                      ? 'bg-[#0057FF]/20 text-[#0057FF] border-[#0057FF]/50'
                      : userPlan === 'basico'
                        ? 'bg-blue-900/30 text-blue-300 border-blue-500/40'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                Plano {userPlan.toUpperCase()}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black font-montserrat text-white">
                {creditsLoading ? (
                  '...'
                ) : creditsData.is_unlimited ? (
                  <span className="text-[#D4AF37] flex items-center gap-1.5">
                    <Zap className="w-7 h-7" /> Ilimitado
                  </span>
                ) : (
                  `${creditsData.credits} Créditos`
                )}
              </span>
              {!creditsData.is_unlimited && (
                <span className="text-xs text-gray-400 font-inter">
                  (~{Math.floor(creditsData.credits / 20)} gerações restantes • 20 créditos/treino)
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 font-inter">
              {isGratis && (
                <span className="text-amber-300">
                  ℹ️ Plano Grátis: gera treinos IA em formato descritivo (sem fotos/vídeos). Evolua
                  para Básico, Pro ou Premium para fotos e treinos completos.
                </span>
              )}
              {userPlan === 'basico' &&
                'Plano Básico (R$ 10/mês): 100 créditos mensais com imagens reais inclusas.'}
              {userPlan === 'pro' &&
                'Plano Pro (R$ 20/mês): 200 créditos mensais com imagens reais inclusas.'}
              {userPlan === 'premium' &&
                'Plano Premium (R$ 30/mês): Gerações ilimitadas de treinos com imagens reais.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-left text-xs font-inter w-full sm:w-auto">
              <span className="text-gray-400 block text-[10px] uppercase font-montserrat">
                Saldo na Carteira
              </span>
              <strong className="text-white font-mono text-sm">
                R$ {creditsData.wallet_balance.toFixed(2)}
              </strong>
            </div>

            <Button
              onClick={() => setBuyCreditsModalOpen(true)}
              className="w-full sm:w-auto bg-[#D4AF37] hover:bg-[#c5a030] text-black font-bold font-montserrat uppercase text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-md"
            >
              <Coins className="w-4 h-4" /> Comprar Mais Créditos
            </Button>
            <Link to="/aluno/carteira">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-[#2A2A2A] hover:bg-[#202020] text-gray-300 text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5" /> Adicionar Saldo
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* AMBER DISCLAIMER (Mandatory per spec) */}
      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3.5 text-amber-200 text-xs font-inter leading-relaxed">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-300 font-montserrat uppercase tracking-wide block mb-0.5">
            Aviso de Segurança & Responsabilidade
          </strong>
          Orientação de IA não garante resultados e não substitui avaliação profissional presencial
          ou acompanhamento de um educador físico credenciado.
        </div>
      </div>

      {/* ANAMNESE FORM & GENERATOR */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#D4AF37]" />
            Questionário de Anamnese & Metas
          </h2>

          <div className="text-xs text-gray-400 font-inter">
            Custo desta geração:{' '}
            <strong className="text-[#D4AF37] font-mono">
              {isGratis ? 'Grátis (Descritivo)' : isPremium ? '0 (Ilimitado)' : '20 Créditos'}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Objetivo */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
              Objetivo Principal
            </label>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="Aumentar força">Ganho de Força</option>
              <option value="Hipertrofia">Hipertrofia</option>
              <option value="Perda de peso">Emagrecimento / Perda de Peso</option>
              <option value="Condicionamento físico">Condicionamento Físico</option>
              <option value="Resistência aeróbica">Resistência Aeróbica</option>
              <option value="Artes marciais">Artes Marciais / Performance</option>
            </select>
          </div>

          {/* Experiência */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
              Nível de Experiência
            </label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="Iniciante (0-6 meses)">Iniciante (0-6 meses)</option>
              <option value="Intermediário (6m-2 anos)">Intermediário (6m-2 anos)</option>
              <option value="Avançado (2+ anos)">Avançado (2+ anos)</option>
              <option value="Atleta de Alto Rendimento">Atleta de Alto Rendimento</option>
            </select>
          </div>

          {/* Dias Disponíveis */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
              Frequência Semanal
            </label>
            <select
              value={daysAvailable}
              onChange={(e) => setDaysAvailable(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value={2}>2 dias por semana</option>
              <option value={3}>3 dias por semana</option>
              <option value={4}>4 dias por semana</option>
              <option value={5}>5 dias por semana</option>
              <option value={6}>6 dias por semana</option>
            </select>
          </div>

          {/* Restrições */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
              Restrições / Lesões
            </label>
            <Input
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              placeholder="Ex: dor lombar, ombro sensível"
              className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[#2A2A2A]">
          <div className="text-xs text-gray-400">
            {isGratis ? (
              <span className="text-zinc-400">
                Treino descritivo sem fotos. Deseja imagens reais dos exercícios?{' '}
                <Link to="/aluno/perfil" className="text-[#D4AF37] underline font-semibold">
                  Evoluir Plano
                </Link>
              </span>
            ) : (
              <span>Imagens de execução e biomecânica inclusas para o seu plano.</span>
            )}
          </div>

          <Button
            onClick={handleGenerateAI}
            disabled={generating}
            className="w-full sm:w-auto px-8 py-6 bg-gradient-to-r from-[#D4AF37] to-[#F4D77A] text-black font-extrabold text-sm uppercase rounded-xl shadow-[0_0_25px_rgba(212,175,55,0.3)] hover:scale-102 transition-all flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Calculando Séries & Cargas com IA...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Gerar Treino com IA
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* BANNER DE TREINO 100% CONCLUÍDO */}
      {allExercisesCompleted && currentWorkout?.status !== 'concluido' && (
        <Card className="bg-gradient-to-r from-[#22C55E]/20 via-[#181818] to-[#D4AF37]/20 border-2 border-[#22C55E] p-6 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.2)] animate-pulse">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#22C55E] rounded-xl text-black">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold font-montserrat text-white uppercase">
                  Todos os Exercícios Concluídos! 🔥
                </h3>
                <p className="text-xs text-gray-300 font-inter">
                  {currentWorkout.professional
                    ? 'Finalize seu treino para computar +1 serviço oficial com seu profissional e subir no Ranking!'
                    : 'Finalize seu treino para registrar a conclusão no seu histórico de evolução pessoal.'}
                </p>
              </div>
            </div>

            <Button
              onClick={() => setFinishModalOpen(true)}
              className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-sm uppercase px-8 py-6 rounded-xl shadow-lg shrink-0"
            >
              Finalizar Treino do Dia 🏆
            </Button>
          </div>
        </Card>
      )}

      {/* CURRENT WORKOUT DISPLAY */}
      {currentWorkout && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-[#0057FF]/15 via-[#181818] to-[#D4AF37]/15 border border-[#2A2A2A]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#D4AF37] uppercase font-montserrat">
                  Plano Ativo
                </span>
                {currentWorkout.ai_generated && (
                  <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[10px] font-bold text-[#D4AF37] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    IA 369
                  </span>
                )}
                {!creditsData.has_images && (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-300">
                    Modo Descritivo (Plano Grátis)
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold font-montserrat text-white">
                {currentWorkout.title}
              </h3>
            </div>

            <Button
              onClick={() => handleStartWorkoutExecution(currentWorkout.id)}
              className="bg-[#0057FF] hover:bg-[#1e69ff] text-white font-extrabold text-xs uppercase px-6 py-5 rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-5 h-5 text-[#D4AF37]" />
              Iniciar Modo Execução
            </Button>
          </div>

          {/* Exercise List */}
          <div className="grid grid-cols-1 gap-4">
            {currentWorkout.exercises?.map((exercise, idx) => {
              const refInfo = exercise?.name ? exerciseRefs[exercise.name] : null
              const isImageFailed = exercise?.name ? !!failedImages[exercise.name] : false
              const hasValidRealImage =
                creditsData.has_images && refInfo?.imageUrl && !isImageFailed
              const hasVideoLink = !!exercise?.video

              return (
                <Card
                  key={exercise?.id || idx}
                  className={`p-5 rounded-xl border transition-all ${
                    exercise?.completed
                      ? 'bg-[#121212]/70 border-[#22C55E]/40 opacity-85'
                      : 'bg-[#181818] border-[#2A2A2A] hover:border-[#D4AF37]/60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                      {/* Referência Real do Exercício (se o plano incluir imagem) */}
                      {creditsData.has_images ? (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-center shrink-0 relative overflow-hidden group shadow-inner">
                          {hasValidRealImage ? (
                            <div className="relative w-full h-full">
                              <img
                                src={refInfo.imageUrl}
                                alt={`Execução correta: ${exercise?.name || 'Exercício'}`}
                                className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                                onError={() => {
                                  if (exercise?.name) {
                                    setFailedImages((prev) => ({ ...prev, [exercise.name]: true }))
                                  }
                                }}
                              />
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] font-bold text-[#D4AF37] border border-[#D4AF37]/40 uppercase tracking-tighter">
                                Ref Real
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-center text-gray-500 w-full h-full bg-gradient-to-b from-[#181818] to-[#121212]">
                              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mb-1">
                                <Dumbbell className="w-5 h-5 text-[#D4AF37]" />
                              </div>
                              <span className="text-[9px] uppercase font-bold text-gray-300 line-clamp-1 px-1">
                                {exercise?.name?.split(' ')[0] || 'Exercício'}
                              </span>
                              <span className="text-[8px] text-gray-500 uppercase tracking-wider font-mono">
                                369 BIOMECÂNICA
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-[#141414] border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
                          <Dumbbell className="w-6 h-6 text-[#D4AF37]" />
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-400 font-montserrat">
                            #{idx + 1}
                          </span>
                          <h4
                            className={`font-bold font-montserrat text-base ${
                              exercise?.completed ? 'line-through text-gray-400' : 'text-white'
                            }`}
                          >
                            {exercise?.name || 'Exercício'}
                          </h4>
                          {exercise?.muscle_group && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#141414] border border-[#2A2A2A] text-gray-400 uppercase">
                              {exercise.muscle_group}
                            </span>
                          )}
                        </div>

                        {/* Series, Reps, Carga, Descanso Chips */}
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-gray-300 font-mono">
                            <strong>Séries:</strong> {exercise?.sets}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-gray-300 font-mono">
                            <strong>Reps:</strong> {exercise?.reps}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-[#D4AF37] font-mono">
                            <strong>Carga:</strong> {exercise?.load}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-gray-400 font-mono">
                            <strong>Descanso:</strong> {exercise?.rest}
                          </span>
                        </div>

                        {exercise?.tips && (
                          <p className="text-xs text-gray-400 font-inter italic">
                            💡 {exercise.tips}
                          </p>
                        )}

                        {creditsData.has_images && hasVideoLink && (
                          <div className="pt-1">
                            <a
                              href={exercise.video}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[#0057FF] hover:underline font-montserrat font-bold"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Ver Vídeo Demonstrativo
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="flex flex-row md:flex-col items-center gap-2 w-full md:w-auto">
                      <Button
                        onClick={() => handleOpenExerciseFeedback(idx)}
                        variant={exercise?.completed ? 'outline' : 'default'}
                        className={`w-full md:w-auto font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow-md ${
                          exercise?.completed
                            ? 'border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/10'
                            : 'bg-[#D4AF37] text-black hover:bg-[#E6C65C]'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        {exercise?.completed ? 'Concluído ✓' : 'Concluir com IA'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* LISTAGEM DOS TREINOS QUE O ALUNO JÁ GEROU POR IA */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            Treinos Gerados por IA ({workoutHistory.length})
          </h3>
          <span className="text-xs text-gray-400 font-inter">
            Seus treinos autônomos salvos na plataforma
          </span>
        </div>

        {workoutHistory.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 bg-[#141414] rounded-xl border border-[#2A2A2A]">
            Você ainda não gerou treinos por IA. Preencha a anamnese acima e clique em &quot;Gerar
            Treino com IA&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workoutHistory.map((w) => (
              <div
                key={w.id}
                onClick={() => setCurrentWorkout(w)}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  currentWorkout?.id === w.id
                    ? 'bg-[#D4AF37]/10 border-[#D4AF37]'
                    : 'bg-[#141414] border-[#2A2A2A] hover:border-gray-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                      IA 369
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(w.created).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white font-montserrat mt-2">{w.title}</h4>
                  <p className="text-xs text-gray-400 font-inter line-clamp-1">
                    Objetivo: {w.objective || 'Hipertrofia'} • {w.exercises?.length || 0} exercícios
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#222]">
                  <span className="text-[11px] text-[#D4AF37] font-semibold">
                    {currentWorkout?.id === w.id ? 'Treino selecionado' : 'Clique para carregar'}
                  </span>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartWorkoutExecution(w.id)
                    }}
                    className="h-7 text-[11px] font-bold bg-[#0057FF] hover:bg-[#1a66ff] text-white px-3 rounded-lg"
                  >
                    Executar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MODAL DE COMPRA DE CRÉDITOS IA COM SALDO DA CARTEIRA */}
      <Dialog open={buyCreditsModalOpen} onOpenChange={setBuyCreditsModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#D4AF37]" /> Comprar Créditos de Treino IA
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Utilize o saldo da sua carteira para adquirir novos créditos de treino com IA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] flex items-center justify-between text-xs">
              <span className="text-gray-400">Saldo Atual da Carteira:</span>
              <strong className="text-white font-mono text-sm">
                R$ {creditsData.wallet_balance.toFixed(2)}
              </strong>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase font-montserrat text-gray-300">
                Selecione o Pacote de Créditos:
              </label>

              {/* Pacote 100 créditos */}
              <div
                onClick={() => setSelectedPackage('pacote_100')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedPackage === 'pacote_100'
                    ? 'bg-[#D4AF37]/15 border-[#D4AF37]'
                    : 'bg-[#181818] border-[#2A2A2A] hover:border-gray-700'
                }`}
              >
                <div>
                  <h4 className="text-sm font-bold text-white font-montserrat">
                    100 Créditos IA (~5 Treinos)
                  </h4>
                  <p className="text-xs text-gray-400 font-inter">
                    Ideal para complementar seu mês de treinos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#D4AF37] font-mono">R$ 10,00</span>
                </div>
              </div>

              {/* Pacote 200 créditos */}
              <div
                onClick={() => setSelectedPackage('pacote_200')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedPackage === 'pacote_200'
                    ? 'bg-[#D4AF37]/15 border-[#D4AF37]'
                    : 'bg-[#181818] border-[#2A2A2A] hover:border-gray-700'
                }`}
              >
                <div>
                  <h4 className="text-sm font-bold text-white font-montserrat">
                    200 Créditos IA (~10 Treinos)
                  </h4>
                  <p className="text-xs text-gray-400 font-inter">
                    Máxima flexibilidade para múltiplos mesociclos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#D4AF37] font-mono">R$ 20,00</span>
                </div>
              </div>
            </div>

            {/* Aviso de saldo insuficiente se necessário */}
            {creditsData.wallet_balance < (selectedPackage === 'pacote_200' ? 20 : 10) && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs font-inter space-y-2">
                <p>
                  Seu saldo na carteira (R$ {creditsData.wallet_balance.toFixed(2)}) é inferior ao
                  valor do pacote. Faça uma recarga via PIX com comprovante.
                </p>
                <Link to="/aluno/carteira" onClick={() => setBuyCreditsModalOpen(false)}>
                  <Button className="w-full bg-[#D4AF37] hover:bg-[#c5a030] text-black font-bold uppercase text-xs rounded-lg h-8">
                    Recarregar Carteira via PIX
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBuyCreditsModalOpen(false)}
              className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBuyCredits}
              disabled={
                buyingCredits ||
                creditsData.wallet_balance < (selectedPackage === 'pacote_200' ? 20 : 10)
              }
              className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl flex items-center gap-2"
            >
              {buyingCredits ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                </>
              ) : (
                'Confirmar Compra com Saldo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE FEEDBACK DE CARGA COM IA */}
      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Feedback de Carga & Biomecânica
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              {selectedExerciseIndex !== null &&
                currentWorkout?.exercises?.[selectedExerciseIndex]?.name}
            </DialogDescription>
          </DialogHeader>

          {isProOrPremium ? (
            <div className="space-y-5 my-2">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
                  Carga Real Utilizada (kg) *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={weightUsed}
                    onChange={(e) => setWeightUsed(e.target.value)}
                    placeholder="Ex: 24"
                    className="bg-[#181818] border-[#2A2A2A] text-white font-mono text-base rounded-xl"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                    kg
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-gray-300 uppercase font-montserrat">
                    Grau de Dificuldade (RPE / Esforço)
                  </label>
                  <span className="font-bold text-[#D4AF37] font-mono text-sm">
                    {difficulty}/10
                  </span>
                </div>
                <Slider
                  value={[difficulty]}
                  onValueChange={(vals) => setDifficulty(vals[0])}
                  max={10}
                  min={0}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-inter">
                  <span>0: Muito Fácil</span>
                  <span>5: Moderado</span>
                  <span>10: Impossível / Falha</span>
                </div>
              </div>

              <Button
                onClick={handleCalculateAiFeedback}
                disabled={evaluatingLoad}
                className="w-full bg-[#181818] hover:bg-[#202020] border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2"
              >
                {evaluatingLoad ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analisando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Calcular Sugestão de Carga
                  </>
                )}
              </Button>

              {aiLoadResult && (
                <div className="p-4 rounded-xl bg-[#181818] border border-[#D4AF37] space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase font-montserrat">
                    <TrendingUp className="w-4 h-4" /> Recomendação para a Próxima Sessão
                  </div>
                  <p className="text-sm font-extrabold text-white font-montserrat">
                    {aiLoadResult.recommendation}
                  </p>
                  <p className="text-xs text-gray-300 font-inter leading-relaxed">
                    {aiLoadResult.rationale}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A] text-center space-y-2 my-2">
              <Lock className="w-8 h-8 text-[#D4AF37] mx-auto" />
              <h4 className="text-sm font-bold font-montserrat text-white uppercase">
                Recurso Exclusivo Pro e Premium
              </h4>
              <p className="text-xs text-gray-400 font-inter">
                O feedback de carga com IA analisa sua percepção de esforço e calcula a progressão
                científica de peso.
              </p>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFeedbackModalOpen(false)}
              className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmExerciseFeedback}
              className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl"
            >
              Salvar & Concluir Exercício
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE FINALIZAÇÃO */}
      <Dialog open={finishModalOpen} onOpenChange={setFinishModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <Award className="w-5 h-5 text-[#22C55E]" /> Confirmar Finalização do Treino
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Você completou todos os exercícios prescritos para hoje.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-xl bg-[#181818] border border-[#22C55E]/40 space-y-3 my-2 text-xs text-gray-300 font-inter">
            <p>
              Ao confirmar a conclusão do treino, será registrado automaticamente um serviço do tipo{' '}
              <strong className="text-white font-mono">treino_ia</strong> na sua conta.
            </p>
            {currentWorkout?.professional ? (
              <div className="p-2.5 rounded-lg bg-[#141414] border border-[#22C55E]/40 text-[11px] text-[#22C55E] font-bold font-mono">
                ✓ +1 Serviço com acompanhamento profissional para o cálculo da Pontuação e Ranking!
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-[#141414] border border-amber-500/30 text-[11px] text-amber-300 font-medium font-inter">
                ℹ️ Treino sem acompanhamento profissional: registrado no seu histórico, porém não
                gera pontuação no Ranking oficial.
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFinishModalOpen(false)}
              disabled={finishingWorkout}
              className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
            >
              Voltar
            </Button>
            <Button
              onClick={handleFinalizeDailyWorkout}
              disabled={finishingWorkout}
              className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase rounded-xl flex items-center gap-2"
            >
              {finishingWorkout ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Registrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirmar & Concluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

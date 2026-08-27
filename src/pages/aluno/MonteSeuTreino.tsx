import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { api, type WorkoutRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchExerciseGif } from '@/lib/exerciseDb'

export default function MonteSeuTreino() {
  const { user } = useAuth()
  const isProOrPremium = user?.plan === 'pro' || user?.plan === 'premium'

  // Anamnese Form State
  const [objective, setObjective] = useState(user?.objective || 'Hipertrofia')
  const [experience, setExperience] = useState('Intermediário')
  const [daysAvailable, setDaysAvailable] = useState(4)
  const [restrictions, setRestrictions] = useState('Nenhuma lesão atual')
  const [notes, setNotes] = useState('')

  // AI Generation State
  const [generating, setGenerating] = useState(false)
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutRecord | null>(null)
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutRecord[]>([])

  // Exercise GIFs cache state
  const [exerciseGifs, setExerciseGifs] = useState<Record<string, string>>({})

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

  // Load existing workouts for student
  const loadWorkouts = async () => {
    if (!user) return
    try {
      const res = await pb.collection('workouts').getList<WorkoutRecord>(1, 10, {
        filter: `student = "${user.id}"`,
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
    loadWorkouts()
  }, [user])

  // Load Exercise GIFs when currentWorkout changes (Pro/Premium)
  useEffect(() => {
    if (!currentWorkout?.exercises) return

    const loadGifs = async () => {
      const gifs: Record<string, string> = {}
      for (const ex of currentWorkout.exercises || []) {
        const url = await fetchExerciseGif(ex.name)
        if (url) {
          gifs[ex.name] = url
        }
      }
      setExerciseGifs(gifs)
    }

    loadGifs()
  }, [currentWorkout])

  // Handle AI Workout Generation
  const handleGenerateAI = async () => {
    setGenerating(true)
    try {
      const generated = await api.generateWorkout({
        objective,
        experience,
        daysAvailable,
        restrictions,
        notes,
      })

      // Persist to PocketBase workouts collection
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
      toast.success('Treino gerado com sucesso pelo algoritmo 369!')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Falha ao gerar treino com IA. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }

  // Open Load Feedback Modal on Clicking "Concluir"
  const handleOpenExerciseFeedback = (index: number) => {
    if (!currentWorkout || !currentWorkout.exercises) return
    const ex = currentWorkout.exercises[index]

    if (ex.completed) {
      // If already completed, toggle to uncompleted directly
      toggleExerciseStatus(index, false)
      return
    }

    // Extract initial load numeric if available
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
      // Criar registro na coleção services
      await pb.collection('services').create({
        student: user.id,
        professional: currentWorkout.professional || null,
        type: 'treino_ia',
        title: `Treino do Dia: ${currentWorkout.title}`,
        value: 0,
        status: 'concluido',
        completed_at: new Date().toISOString(),
        notes: `Treino concluído com 100% dos exercícios finalizados via IA 369. Exercícios: ${currentWorkout.exercises?.length || 0}`,
      })

      // Atualizar status do treino
      await pb.collection('workouts').update(currentWorkout.id, {
        status: 'concluido',
      })

      toast.success(
        '🏆 Treino Finalizado com Sucesso! 1 serviço computado para sua pontuação no ranking!',
      )
      setFinishModalOpen(false)
      loadWorkouts()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao registrar finalização do treino.')
    } finally {
      setFinishingWorkout(false)
    }
  }

  // Check if all exercises are completed
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
          Demonstrações com GIFs animados ExerciseDB, feedback de progressão de carga inteligente e
          validação de pontuação diária.
        </p>
      </div>

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
        <h2 className="text-lg font-bold font-montserrat text-white uppercase mb-6 flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#D4AF37]" />
          Questionário de Anamnese & Metas
        </h2>

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
      </Card>

      {/* RECURSO 5: BANNER DE TREINO 100% CONCLUÍDO */}
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
                  Finalize seu treino para computar +1 serviço oficial e subir no Ranking Geral de
                  Cashback!
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
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-[#D4AF37] uppercase font-montserrat">
                Plano Ativo
              </span>
              <h3 className="text-2xl font-bold font-montserrat text-white">
                {currentWorkout.title}
              </h3>
            </div>
            {currentWorkout.ai_generated && (
              <span className="px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Gerado por IA
              </span>
            )}
          </div>

          {/* Exercise List */}
          <div className="grid grid-cols-1 gap-4">
            {currentWorkout.exercises?.map((exercise, idx) => {
              const gifUrl = exerciseGifs[exercise.name]
              const hasVideoLink = !!exercise.video

              return (
                <Card
                  key={exercise.id || idx}
                  className={`p-5 rounded-xl border transition-all ${
                    exercise.completed
                      ? 'bg-[#121212]/70 border-[#22C55E]/40 opacity-85'
                      : 'bg-[#181818] border-[#2A2A2A] hover:border-[#D4AF37]/60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                      {/* RECURSO 2: ExerciseDB GIF or Video Embed Gate */}
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-center shrink-0 relative overflow-hidden group">
                        {isProOrPremium ? (
                          gifUrl ? (
                            <img
                              src={gifUrl}
                              alt={exercise.name}
                              className="w-full h-full object-cover rounded-xl"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-center text-gray-500">
                              <Dumbbell className="w-6 h-6 text-[#D4AF37]" />
                              <span className="text-[9px] uppercase font-bold mt-1 text-gray-400">
                                ExerciseDB
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center text-gray-500">
                            <Lock className="w-6 h-6 text-[#D4AF37]" />
                            <span className="text-[9px] uppercase font-bold mt-1 text-[#D4AF37]">
                              Pro/Premium
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-400 font-montserrat">
                            #{idx + 1}
                          </span>
                          <h4
                            className={`font-bold font-montserrat text-base ${
                              exercise.completed ? 'line-through text-gray-400' : 'text-white'
                            }`}
                          >
                            {exercise.name}
                          </h4>
                          {exercise.muscle_group && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#141414] border border-[#2A2A2A] text-gray-400 uppercase">
                              {exercise.muscle_group}
                            </span>
                          )}
                        </div>

                        {/* Series, Reps, Carga, Descanso Chips */}
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-gray-300 font-mono">
                            <strong>Séries:</strong> {exercise.sets}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-gray-300 font-mono">
                            <strong>Reps:</strong> {exercise.reps}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-[#D4AF37] font-mono">
                            <strong>Carga:</strong> {exercise.load}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#141414] border border-[#2A2A2A] text-gray-400 font-mono">
                            <strong>Descanso:</strong> {exercise.rest}
                          </span>
                        </div>

                        {exercise.tips && (
                          <p className="text-xs text-gray-400 font-inter italic">
                            💡 {exercise.tips}
                          </p>
                        )}

                        {/* RECURSO 2: Fallback Video Player Embed se disponível */}
                        {isProOrPremium && hasVideoLink && (
                          <div className="pt-1">
                            <a
                              href={exercise.video}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[#0057FF] hover:underline font-montserrat font-bold"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Ver Vídeo Demonstrativo no YouTube
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="flex flex-row md:flex-col items-center gap-2 w-full md:w-auto">
                      <Button
                        onClick={() => handleOpenExerciseFeedback(idx)}
                        variant={exercise.completed ? 'outline' : 'default'}
                        className={`w-full md:w-auto font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow-md ${
                          exercise.completed
                            ? 'border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/10'
                            : 'bg-[#D4AF37] text-black hover:bg-[#E6C65C]'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        {exercise.completed ? 'Concluído ✓' : 'Concluir com IA'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* PLAN HISTORY */}
      {workoutHistory.length > 1 && (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-sm uppercase mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            Histórico de Planos Gerados
          </h3>
          <div className="space-y-2">
            {workoutHistory.map((w) => (
              <div
                key={w.id}
                onClick={() => setCurrentWorkout(w)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  currentWorkout?.id === w.id
                    ? 'bg-[#D4AF37]/10 border-[#D4AF37]'
                    : 'bg-[#141414] border-[#2A2A2A] hover:border-gray-700'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-white font-montserrat">{w.title}</p>
                  <p className="text-[10px] text-gray-400 font-inter">
                    {w.exercises?.length || 0} exercícios • Criado em{' '}
                    {new Date(w.created).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="text-xs text-[#D4AF37]">
                  Carregar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* RECURSO 3: MODAL DE FEEDBACK DE CARGA COM IA */}
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
              {/* Campo de Carga Real */}
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

              {/* Slider de Grau de Dificuldade (0 a 10) */}
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

              {/* Botão de Calcular Progressão IA */}
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

              {/* Resultado da IA */}
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

      {/* RECURSO 5: MODAL DE CONFIRMAÇÃO DUPLA DE FINALIZAÇÃO */}
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
            <div className="p-2.5 rounded-lg bg-[#141414] border border-[#2A2A2A] text-[11px] text-[#22C55E] font-bold font-mono">
              ✓ +1 Serviço para o cálculo da Pontuação e Ranking Geral (SERVIÇOS × PLANO ×
              INDICAÇÃO)
            </div>
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
                  <CheckCircle2 className="w-4 h-4" /> Confirmar & Pontuar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

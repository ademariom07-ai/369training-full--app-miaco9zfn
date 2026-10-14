import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Dumbbell,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  Calendar,
  Sparkles,
  Info,
  Timer,
  FastForward,
  Loader2,
  ArrowLeft,
  Flame,
  Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchExerciseReference, ExerciseReferenceInfo } from '@/lib/exerciseDb'
import {
  STANDARD_WEEK_CYCLES,
  calculateAutomaticProgression,
  parseExerciseTimeInSeconds,
  playChimeBeep,
  recordWorkoutSetLog,
  getWorkoutLogs,
  WorkoutLogRecord,
} from '@/services/workoutExecution'
import type { WorkoutRecord } from '@/services/api'

interface WorkoutWithWeek extends WorkoutRecord {
  week_number?: number
  week_focus?: string
  cycle_name?: string
  expand?: {
    professional?: {
      id: string
      name: string
      email: string
      avatar?: string
    }
  }
}

export default function ExecucaoTreino() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Estado do treino
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<WorkoutWithWeek | null>(null)
  const [currentExIndex, setCurrentExIndex] = useState(0)
  const [currentSetIndex, setCurrentSetIndex] = useState(1) // 1-based (série 1, série 2...)
  const [activeWeek, setActiveWeek] = useState<number>(1)

  // Registro em PocketBase das séries já gravadas
  const [completedLogs, setCompletedLogs] = useState<WorkoutLogRecord[]>([])

  // Cache de imagens reais (free-exercise-db com match pt-BR e heurística)
  const [exerciseRefs, setExerciseRefs] = useState<Record<string, ExerciseReferenceInfo | null>>({})
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  // Inputs da série atual (Mobile & 60+: botões grandes e fontes legíveis)
  const [currentWeight, setCurrentWeight] = useState<string>('20')
  const [currentReps, setCurrentReps] = useState<string>('10')
  const [currentRpe, setCurrentRpe] = useState<number>(5)
  const [savingSet, setSavingSet] = useState(false)

  // Cronômetro de Série (para exercícios cronometrados: "30s", "10 min", prancha, cardio...)
  const [setTimerSeconds, setSetTimerSeconds] = useState<number | null>(null)
  const [setTimerRunning, setSetTimerRunning] = useState(false)
  const [setTimerTarget, setSetTimerTarget] = useState<number | null>(null)

  // Cronômetro de Descanso entre séries (Contagem Regressiva Grande)
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null)
  const [restTargetTotal, setRestTargetTotal] = useState<number>(60)
  const [isResting, setIsResting] = useState(false)

  // Sugestão de progressão automática recente (calculada ao finalizar série/exercício)
  const [lastProgression, setLastProgression] = useState<{
    exerciseName: string
    recommendation: string
    suggestedLoad: string
    rationale: string
    action: 'increase' | 'maintain' | 'decrease'
  } | null>(null)

  // Modal de Treino Concluído
  const [finishModalOpen, setFinishModalOpen] = useState(false)
  const [finishingWorkout, setFinishingWorkout] = useState(false)

  // Sons ativados
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Carregar dados do treino
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!user) return
      setLoading(true)

      try {
        let rec: WorkoutWithWeek | null = null

        if (workoutId) {
          rec = await pb.collection('workouts').getOne<WorkoutWithWeek>(workoutId, {
            expand: 'professional',
          })
        } else {
          // Busca o treino ativo mais recente do aluno
          const res = await pb.collection('workouts').getList<WorkoutWithWeek>(1, 1, {
            filter: `student = "${user.id}" && status = "ativo"`,
            sort: '-created',
            expand: 'professional',
          })
          if (res.items.length > 0) {
            rec = res.items[0]
          } else {
            // Se não tem ativo, pega o último de qualquer status
            const fallback = await pb.collection('workouts').getList<WorkoutWithWeek>(1, 1, {
              filter: `student = "${user.id}"`,
              sort: '-created',
              expand: 'professional',
            })
            if (fallback.items.length > 0) {
              rec = fallback.items[0]
            }
          }
        }

        if (!isMounted) return

        if (!rec) {
          toast.error('Nenhum treino disponível para execução no momento.')
          navigate('/aluno/treino')
          return
        }

        setWorkout(rec)
        setActiveWeek(rec.week_number || 1)

        // Buscar logs já salvos no banco deste treino
        const logs = await getWorkoutLogs(rec.id)
        if (isMounted) {
          setCompletedLogs(logs)
        }

        // Buscar imagens reais dos exercícios
        if (rec.exercises && rec.exercises.length > 0) {
          const refs: Record<string, ExerciseReferenceInfo | null> = {}
          for (const ex of rec.exercises) {
            if (ex?.name) {
              const ref = await fetchExerciseReference(ex.name)
              refs[ex.name] = ref
            }
          }
          if (isMounted) {
            setExerciseRefs(refs)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar treino para execução:', err)
        toast.error('Não foi possível carregar a rotina de treino.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [workoutId, user, navigate])

  // Exercício atual
  const currentExercise = useMemo(() => {
    if (!workout?.exercises || workout.exercises.length === 0) return null
    return workout.exercises[currentExIndex] || workout.exercises[0]
  }, [workout, currentExIndex])

  // Total de séries do exercício atual
  const totalSetsForCurrent = useMemo(() => {
    if (!currentExercise?.sets) return 3
    const num = parseInt(currentExercise.sets, 10)
    return isNaN(num) || num < 1 ? 3 : num
  }, [currentExercise])

  // Inicializar inputs quando muda o exercício atual
  useEffect(() => {
    if (!currentExercise) return

    // Carga inicial sugerida
    const matchLoad = currentExercise.load?.match(/\d+/)
    if (matchLoad) {
      setCurrentWeight(matchLoad[0])
    } else {
      setCurrentWeight('20')
    }

    // Reps alvo
    const matchReps = currentExercise.reps?.match(/\d+/)
    if (matchReps) {
      setCurrentReps(matchReps[0])
    } else {
      setCurrentReps('10')
    }

    // Descanso padrão
    const restSec = parseExerciseTimeInSeconds(currentExercise.rest) || 60
    setRestTargetTotal(restSec)

    // Se o próprio exercício tem tempo ("30s", "10 min")
    const timedSec =
      parseExerciseTimeInSeconds(currentExercise.reps) ||
      parseExerciseTimeInSeconds(currentExercise.load)
    if (timedSec) {
      setSetTimerTarget(timedSec)
      setSetTimerSeconds(timedSec)
    } else {
      setSetTimerTarget(null)
      setSetTimerSeconds(null)
    }
    setSetTimerRunning(false)

    // Ajustar série atual com base nos logs gravados
    if (workout) {
      const exLogs = completedLogs.filter(
        (l) => l.exercise_id === (currentExercise.id || `ex_${currentExIndex}`),
      )
      if (exLogs.length > 0 && exLogs.length < totalSetsForCurrent) {
        setCurrentSetIndex(exLogs.length + 1)
      } else if (exLogs.length >= totalSetsForCurrent) {
        setCurrentSetIndex(totalSetsForCurrent)
      } else {
        setCurrentSetIndex(1)
      }
    }
  }, [currentExercise, currentExIndex, workout, completedLogs, totalSetsForCurrent])

  // Efeito do Cronômetro de Série
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (setTimerRunning && setTimerSeconds !== null && setTimerSeconds > 0) {
      interval = setInterval(() => {
        setSetTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            if (soundEnabled) playChimeBeep()
            setSetTimerRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [setTimerRunning, setTimerSeconds, soundEnabled])

  // Efeito do Cronômetro de Descanso
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isResting && restSecondsLeft !== null && restSecondsLeft > 0) {
      interval = setInterval(() => {
        setRestSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            if (soundEnabled) playChimeBeep()
            setIsResting(false)
            toast.success('Descanso finalizado! Hora da próxima série. 💪')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isResting, restSecondsLeft, soundEnabled])

  // Iniciar descanso
  const startRestTimer = (seconds?: number) => {
    const sec = seconds || restTargetTotal || 60
    setRestTargetTotal(sec)
    setRestSecondsLeft(sec)
    setIsResting(true)
  }

  // Pular descanso
  const skipRestTimer = () => {
    setIsResting(false)
    setRestSecondsLeft(0)
  }

  // Progresso geral do treino
  const totalExercises = workout?.exercises?.length || 1
  const completedExercisesCount = useMemo(() => {
    if (!workout?.exercises) return 0
    return workout.exercises.filter((ex, idx) => {
      const exId = ex.id || `ex_${idx}`
      const logs = completedLogs.filter((l) => l.exercise_id === exId)
      const neededSets = parseInt(ex.sets, 10) || 3
      return logs.length >= neededSets || ex.completed
    }).length
  }, [workout, completedLogs])

  const progressPercentage = Math.round((completedExercisesCount / totalExercises) * 100)

  // Informações da Semana Selecionada
  const currentWeekConfig = useMemo(() => {
    return STANDARD_WEEK_CYCLES.find((w) => w.weekNumber === activeWeek) || STANDARD_WEEK_CYCLES[0]
  }, [activeWeek])

  // Ação: Registrar Série Concluída
  const handleCompleteSet = async () => {
    if (!workout || !user || !currentExercise) return
    setSavingSet(true)

    const exId = currentExercise.id || `ex_${currentExIndex}`
    const weightNum = parseFloat(currentWeight) || 0
    const repsNum = parseInt(currentReps, 10) || 10

    // Cálculo da progressão automática (mesma regra da IA 369)
    const progression = calculateAutomaticProgression({
      exerciseName: currentExercise.name,
      repsTarget: currentExercise.reps,
      repsDone: repsNum,
      weightUsed: weightNum,
      difficultyRpe: currentRpe,
      weekNumber: activeWeek,
    })

    setLastProgression({
      exerciseName: currentExercise.name,
      recommendation: progression.recommendation,
      suggestedLoad: progression.suggestedLoad,
      rationale: progression.rationale,
      action: progression.action,
    })

    try {
      // 1. Salva log no banco de dados
      const newLog = await recordWorkoutSetLog({
        workoutId: workout.id,
        studentId: user.id,
        professionalId: workout.professional,
        exerciseId: exId,
        exerciseName: currentExercise.name,
        setIndex: currentSetIndex,
        repsDone: repsNum,
        weightUsed: weightNum,
        rpeDifficulty: currentRpe,
        durationSeconds: setTimerTarget ? setTimerTarget - (setTimerSeconds || 0) : 0,
        weekNumber: activeWeek,
        suggestedProgression: progression.recommendation,
      })

      const updatedLogs = [...completedLogs, newLog]
      setCompletedLogs(updatedLogs)

      // Som amigável
      if (soundEnabled) playChimeBeep()

      // Verifica se todas as séries deste exercício foram concluídas
      const setsDoneForThis = updatedLogs.filter((l) => l.exercise_id === exId).length

      if (setsDoneForThis >= totalSetsForCurrent) {
        // Marca exercício como completo na lista do treino em PocketBase
        if (workout.exercises) {
          const updatedExercises = [...workout.exercises]
          updatedExercises[currentExIndex] = {
            ...updatedExercises[currentExIndex],
            completed: true,
            load: `${weightNum} kg (${progression.suggestedLoad})`,
          }
          await pb.collection('workouts').update(workout.id, {
            exercises: updatedExercises,
          })
          setWorkout({ ...workout, exercises: updatedExercises })
        }

        toast.success(
          `Exercício #${currentExIndex + 1} concluído com sucesso! 🏆 Sugestão IA: ${progression.suggestedLoad}`,
        )

        // Se ainda há exercícios pendentes, avança após breve pausa ou inicia descanso
        if (currentExIndex < totalExercises - 1) {
          startRestTimer()
          setCurrentExIndex((prev) => prev + 1)
          setCurrentSetIndex(1)
        } else {
          // Treino inteiro finalizado!
          setFinishModalOpen(true)
        }
      } else {
        // Próxima série do mesmo exercício
        setCurrentSetIndex((prev) => prev + 1)
        toast.success(`Série ${currentSetIndex} concluída! Descanse agora.`)
        startRestTimer()
      }
    } catch (err) {
      console.error('Erro ao salvar série:', err)
      toast.error('Erro ao registrar série no banco de dados.')
    } finally {
      setSavingSet(false)
    }
  }

  // Finalizar Treino Oficial do Dia (gera serviço e ranking)
  const handleFinalizeWorkout = async () => {
    if (!workout || !user) return
    setFinishingWorkout(true)

    try {
      const hasProfessional = !!workout.professional

      // Criar registro na coleção services
      await pb.collection('services').create({
        student: user.id,
        professional: workout.professional || null,
        type: 'treino_executado',
        title: `Execução Concluída: ${workout.title} (Semana ${activeWeek})`,
        value: 0,
        status: 'concluido',
        completed_at: new Date().toISOString(),
        notes: `Treino da Semana ${activeWeek} (${currentWeekConfig.focus}) finalizado pelo aluno. Total de exercícios: ${totalExercises}.`,
      })

      // Atualiza status do treino
      await pb.collection('workouts').update(workout.id, {
        status: 'concluido',
        week_number: activeWeek,
      })

      if (hasProfessional) {
        toast.success(
          '🏆 Treino Finalizado! +1 serviço oficial com seu Personal computado para o Ranking!',
        )
      } else {
        toast.success('🏆 Treino Concluído e salvo com sucesso no seu histórico pessoal!')
      }

      setFinishModalOpen(false)
      navigate('/aluno/historico')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao registrar finalização do treino.')
    } finally {
      setFinishingWorkout(false)
    }
  }

  // Imagem real do exercício atual
  const currentRefInfo = currentExercise?.name ? exerciseRefs[currentExercise.name] : null
  const isImageFailed = currentExercise?.name ? !!failedImages[currentExercise.name] : false
  const hasValidRealImage = currentRefInfo?.imageUrl && !isImageFailed

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
        <p className="text-sm text-gray-400 font-montserrat uppercase">
          Carregando sua sessão de treino...
        </p>
      </div>
    )
  }

  if (!workout || !currentExercise) {
    return (
      <div className="text-center py-16 space-y-4">
        <Dumbbell className="w-12 h-12 text-[#D4AF37] mx-auto opacity-60" />
        <h2 className="text-xl font-bold font-montserrat text-white">Nenhum Treino Encontrado</h2>
        <p className="text-xs text-gray-400">
          Você não possui nenhum treino ativo no momento. Gere um novo com IA ou consulte seu
          profissional.
        </p>
        <Button
          onClick={() => navigate('/aluno/treino')}
          className="bg-[#D4AF37] text-black font-bold uppercase text-xs"
        >
          Ir para Monte Seu Treino
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 max-w-3xl mx-auto">
      {/* BARRA FIXA SUPERIOR COM CRONÔMETRO DE DESCANSO (SE ATIVO) OU STATUS */}
      {isResting && restSecondsLeft !== null && (
        <div className="sticky top-[61px] z-30 bg-[#0057FF] text-white p-4 rounded-2xl shadow-2xl border-2 border-white/20 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 text-white shrink-0 animate-pulse">
                <Timer className="w-7 h-7 text-[#D4AF37]" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-200 font-montserrat block">
                  Descanso Entre Séries
                </span>
                <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
                  {Math.floor(restSecondsLeft / 60)}:
                  {(restSecondsLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="lg"
                onClick={skipRestTimer}
                className="bg-white text-[#0057FF] hover:bg-gray-100 font-black text-sm uppercase px-5 py-3 rounded-xl shadow-lg flex items-center gap-1.5"
              >
                <FastForward className="w-5 h-5 text-[#0057FF]" /> Pular
              </Button>
            </div>
          </div>
          <div className="mt-2.5 w-full bg-blue-900/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#D4AF37] h-full transition-all duration-1000 ease-linear"
              style={{
                width: `${Math.max(0, Math.min(100, ((restTargetTotal - restSecondsLeft) / restTargetTotal) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* HEADER DE EXECUÇÃO */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/aluno/treino')}
          className="text-gray-400 hover:text-white px-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        <div className="text-center flex-1">
          <span className="text-[10px] font-bold text-[#D4AF37] uppercase font-montserrat tracking-wider">
            Execução do Treino do Dia
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold font-montserrat text-white uppercase truncate">
            {workout.title}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-label="Ativar ou desativar som do cronômetro"
          className={`p-2 rounded-xl border text-xs ${
            soundEnabled
              ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30'
              : 'bg-[#181818] text-gray-500 border-[#2A2A2A]'
          }`}
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      {/* SELETOR DE SEMANAS (TREINO DA SEMANA / PERIODIZAÇÃO) */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-bold font-montserrat text-white uppercase">
              Treino da Semana (Periodização)
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#D4AF37] uppercase bg-[#D4AF37]/10 px-2 py-0.5 rounded-md border border-[#D4AF37]/30">
            {currentWeekConfig.focus}
          </span>
        </div>

        {/* 4 Semanas Tab Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {STANDARD_WEEK_CYCLES.map((w) => {
            const isSelected = activeWeek === w.weekNumber
            return (
              <button
                key={w.weekNumber}
                type="button"
                onClick={() => setActiveWeek(w.weekNumber)}
                className={`py-2.5 px-1 rounded-xl text-center transition-all ${
                  isSelected
                    ? 'bg-[#0057FF] text-white font-black shadow-lg border border-white/20'
                    : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
                }`}
              >
                <span className="text-xs sm:text-sm font-extrabold font-montserrat block">
                  Semana {w.weekNumber}
                </span>
                <span className="text-[9px] uppercase font-semibold text-gray-300 block truncate mt-0.5">
                  {w.weekNumber === 1
                    ? 'Base'
                    : w.weekNumber === 2
                      ? '+Carga'
                      : w.weekNumber === 3
                        ? 'Pico'
                        : 'Deload'}
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-gray-400 font-inter mt-3 bg-[#141414] p-2.5 rounded-xl border border-[#2A2A2A] leading-relaxed">
          💡 <strong className="text-white">{currentWeekConfig.name}:</strong>{' '}
          {currentWeekConfig.description} ({currentWeekConfig.repRangeAdjustment})
        </p>
      </Card>

      {/* BARRA DE PROGRESSO DO TREINO */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-montserrat">
          <span className="text-gray-400">
            Exercício {currentExIndex + 1} de {totalExercises}
          </span>
          <span className="font-extrabold text-[#D4AF37]">{progressPercentage}% concluído</span>
        </div>
        <Progress value={progressPercentage} className="h-3 bg-[#181818]" />
      </div>

      {/* CARD PRINCIPAL DO EXERCÍCIO ATUAL (60+ AMIGÁVEL: FONTES GRANDES, FOTO REAL E CONTROLES DIRETOS) */}
      <Card className="bg-[#181818] border-2 border-[#2A2A2A] p-5 sm:p-7 rounded-3xl shadow-xl space-y-6">
        {/* Topo do Exercício com FOTO REAL */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Foto Real de Referência com fallback seguro biomecânico */}
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-[#141414] border-2 border-[#2A2A2A] overflow-hidden shrink-0 relative shadow-inner">
            {hasValidRealImage ? (
              <div className="relative w-full h-full">
                <img
                  src={currentRefInfo.imageUrl}
                  alt={`Execução correta do exercício ${currentExercise.name}`}
                  className="w-full h-full object-cover rounded-2xl"
                  loading="eager"
                  onError={() => {
                    if (currentExercise?.name) {
                      setFailedImages((prev) => ({ ...prev, [currentExercise.name]: true }))
                    }
                  }}
                />
                <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-xs text-[10px] font-black text-[#D4AF37] border border-[#D4AF37]/50 uppercase">
                  Ref Real
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-3 text-center text-gray-500 w-full h-full bg-gradient-to-b from-[#1a1a1a] to-[#121212]">
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-2">
                  <Dumbbell className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <span className="text-[10px] uppercase font-bold text-gray-300 line-clamp-1">
                  {currentExercise.name.split(' ')[0]}
                </span>
                <span className="text-[8px] text-gray-500 uppercase tracking-widest font-mono mt-0.5">
                  369 BIOMECÂNICA
                </span>
              </div>
            )}
          </div>

          {/* Nome, Séries, Dica Biomecânica */}
          <div className="flex-1 space-y-2.5 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/40 text-xs font-bold text-[#0057FF] uppercase font-montserrat">
              Exercício #{currentExIndex + 1}
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold font-montserrat text-white leading-tight">
              {currentExercise.name}
            </h2>

            {/* Metas prescritas em chips grandes */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs font-bold text-white font-mono">
                {currentExercise.sets} Séries
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs font-bold text-white font-mono">
                {currentExercise.reps} Repetições
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#D4AF37]/40 text-xs font-bold text-[#D4AF37] font-mono">
                Carga: {currentExercise.load || 'Livre'}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs font-bold text-gray-400 font-mono">
                Descanso: {currentExercise.rest || '60s'}
              </span>
            </div>

            {currentExercise.tips && (
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs text-gray-300 font-inter leading-relaxed text-left">
                💡 <strong className="text-[#D4AF37]">Dica biomecânica:</strong>{' '}
                {currentExercise.tips}
              </div>
            )}
          </div>
        </div>

        {/* INDICADOR DE SÉRIE ATUAL (PÚBLICO 60+: DESTAQUE VISUAL CLARO) */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#FF7A00]" />
            <span className="text-sm font-extrabold uppercase font-montserrat text-white">
              Série Atual:{' '}
              <span className="text-[#D4AF37]">
                {currentSetIndex} de {totalSetsForCurrent}
              </span>
            </span>
          </div>

          <div className="flex gap-1.5">
            {Array.from({ length: totalSetsForCurrent }).map((_, i) => {
              const setNum = i + 1
              const isDone = setNum < currentSetIndex
              const isCurrent = setNum === currentSetIndex
              return (
                <div
                  key={setNum}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono transition-all ${
                    isDone
                      ? 'bg-[#22C55E] text-black'
                      : isCurrent
                        ? 'bg-[#D4AF37] text-black ring-2 ring-[#D4AF37]/50'
                        : 'bg-[#222] text-gray-500'
                  }`}
                >
                  {isDone ? '✓' : setNum}
                </div>
              )
            })}
          </div>
        </div>

        {/* CRONÔMETRO DE SÉRIE (SE O EXERCÍCIO FOR BASEADO EM TEMPO, ex: "30s", "10 min") */}
        {setTimerTarget !== null && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0057FF]/20 to-[#181818] border border-[#0057FF] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Timer className="w-7 h-7 text-[#0057FF]" />
              <div>
                <span className="text-[11px] font-extrabold text-blue-200 uppercase font-montserrat">
                  Cronômetro do Exercício
                </span>
                <p className="text-3xl font-extrabold font-mono text-white">
                  {Math.floor((setTimerSeconds || 0) / 60)}:
                  {((setTimerSeconds || 0) % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                onClick={() => setSetTimerRunning(!setTimerRunning)}
                className={`flex-1 sm:flex-initial font-bold text-xs uppercase px-5 py-3 rounded-xl flex items-center gap-2 ${
                  setTimerRunning
                    ? 'bg-amber-500 text-black hover:bg-amber-600'
                    : 'bg-[#0057FF] text-white hover:bg-blue-600'
                }`}
              >
                {setTimerRunning ? (
                  <>
                    <Pause className="w-4 h-4" /> Pausar
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Iniciar Tempo
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSetTimerRunning(false)
                  setSetTimerSeconds(setTimerTarget)
                }}
                className="border-[#2A2A2A] text-gray-400 hover:text-white rounded-xl"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* INPUTS DE REGISTRO DA SÉRIE (CARGA x REPETIÇÕES FEITAS - BOTÕES GRANDES 60+) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Carga Utilizada */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-[#2A2A2A] space-y-2">
            <label className="block text-xs font-extrabold text-gray-300 uppercase font-montserrat">
              Carga Real desta Série (kg)
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const val = Math.max(0, parseFloat(currentWeight) - 2.5)
                  setCurrentWeight(String(val))
                }}
                className="w-12 h-12 rounded-xl text-lg font-bold border-[#2A2A2A] text-white hover:bg-[#222]"
              >
                -
              </Button>
              <div className="relative flex-1">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="h-12 bg-[#181818] border-[#2A2A2A] text-center text-xl font-bold font-mono text-white rounded-xl"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">
                  kg
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const val = parseFloat(currentWeight) + 2.5
                  setCurrentWeight(String(val))
                }}
                className="w-12 h-12 rounded-xl text-lg font-bold border-[#2A2A2A] text-white hover:bg-[#222]"
              >
                +
              </Button>
            </div>
          </div>

          {/* Repetições Feitas */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-[#2A2A2A] space-y-2">
            <label className="block text-xs font-extrabold text-gray-300 uppercase font-montserrat">
              Repetições Realizadas
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const val = Math.max(0, parseInt(currentReps, 10) - 1)
                  setCurrentReps(String(val))
                }}
                className="w-12 h-12 rounded-xl text-lg font-bold border-[#2A2A2A] text-white hover:bg-[#222]"
              >
                -
              </Button>
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="0"
                  value={currentReps}
                  onChange={(e) => setCurrentReps(e.target.value)}
                  className="h-12 bg-[#181818] border-[#2A2A2A] text-center text-xl font-bold font-mono text-white rounded-xl"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">
                  reps
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const val = parseInt(currentReps, 10) + 1
                  setCurrentReps(String(val))
                }}
                className="w-12 h-12 rounded-xl text-lg font-bold border-[#2A2A2A] text-white hover:bg-[#222]"
              >
                +
              </Button>
            </div>
          </div>
        </div>

        {/* Nível de Esforço da Série (RPE / Dificuldade de 0 a 10) */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#2A2A2A] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-extrabold text-gray-300 uppercase font-montserrat">
              Percepção de Esforço (RPE):
            </span>
            <span
              className={`font-mono font-bold text-sm ${
                currentRpe <= 4
                  ? 'text-[#22C55E]'
                  : currentRpe <= 7
                    ? 'text-[#D4AF37]'
                    : 'text-amber-500'
              }`}
            >
              {currentRpe} / 10 (
              {currentRpe <= 4
                ? 'Leve/Fácil'
                : currentRpe <= 7
                  ? 'Moderado/Ideal'
                  : 'Intenso/Falha'}
              )
            </span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCurrentRpe(num)}
                className={`h-9 rounded-lg font-bold font-mono text-xs transition-all ${
                  currentRpe === num
                    ? 'bg-[#D4AF37] text-black font-extrabold ring-2 ring-white/50'
                    : 'bg-[#181818] text-gray-400 hover:text-white border border-[#2A2A2A]'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* BOTÃO GRANDE DE AÇÃO PRINCIPAL: SÉRIE COMPLETA (60+ UX) */}
        <Button
          type="button"
          onClick={handleCompleteSet}
          disabled={savingSet}
          className="w-full bg-gradient-to-r from-[#0057FF] to-[#1e69ff] hover:from-[#0047d4] hover:to-[#0057FF] text-white font-extrabold text-base uppercase py-7 rounded-2xl shadow-[0_4px_25px_rgba(0,87,255,0.4)] flex items-center justify-center gap-3 transition-transform hover:scale-[1.01]"
        >
          {savingSet ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" /> Registrando Série...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-6 h-6 text-[#D4AF37]" /> Concluir Série {currentSetIndex}{' '}
              de {totalSetsForCurrent}
            </>
          )}
        </Button>
      </Card>

      {/* SUGESTÃO DE PROGRESSÃO AUTOMÁTICA RECENTE (MESMA REGRA DA IA DO ALUNO) */}
      {lastProgression && (
        <Card className="bg-[#141414] border-2 border-[#D4AF37] p-5 rounded-2xl shadow-xl space-y-2 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase font-montserrat">
            <Sparkles className="w-4 h-4" />
            Sugestão Automática de Progressão IA (369WELLNESS)
          </div>
          <h3 className="text-base font-extrabold text-white font-montserrat">
            {lastProgression.recommendation}
          </h3>
          <p className="text-xs text-gray-300 font-inter leading-relaxed">
            {lastProgression.rationale}
          </p>
          <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-[#D4AF37]">
            <span>Carga recomendada próxima sessão:</span>
            <strong className="px-2 py-0.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-white">
              {lastProgression.suggestedLoad}
            </strong>
          </div>
        </Card>
      )}

      {/* NAVEGAÇÃO ENTRE EXERCÍCIOS DA ROTINA */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={currentExIndex === 0}
          onClick={() => {
            setCurrentExIndex((prev) => Math.max(0, prev - 1))
            setCurrentSetIndex(1)
          }}
          className="border-[#2A2A2A] text-white hover:bg-[#181818] text-xs font-bold uppercase rounded-xl flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Exercício Anterior
        </Button>

        <span className="text-xs text-gray-400 font-montserrat">
          {currentExIndex + 1} / {totalExercises}
        </span>

        <Button
          type="button"
          variant="outline"
          disabled={currentExIndex >= totalExercises - 1}
          onClick={() => {
            setCurrentExIndex((prev) => Math.min(totalExercises - 1, prev + 1))
            setCurrentSetIndex(1)
          }}
          className="border-[#2A2A2A] text-white hover:bg-[#181818] text-xs font-bold uppercase rounded-xl flex items-center gap-1.5"
        >
          Próximo Exercício <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* BANNER SE TODOS OS EXERCÍCIOS ESTÃO CONCLUÍDOS */}
      {completedExercisesCount >= totalExercises && (
        <Card className="bg-gradient-to-r from-[#22C55E]/20 via-[#181818] to-[#D4AF37]/20 border-2 border-[#22C55E] p-6 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.2)] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#22C55E] text-black flex items-center justify-center mx-auto">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold font-montserrat text-white uppercase">
              Parabéns! Todos os Exercícios do Dia Foram Concluídos! 🔥
            </h3>
            <p className="text-xs text-gray-300 font-inter mt-1">
              {workout.professional
                ? 'Finalize a sessão para computar +1 serviço com seu profissional no Ranking oficial.'
                : 'Finalize para registrar sua evolução no histórico da plataforma.'}
            </p>
          </div>
          <Button
            onClick={() => setFinishModalOpen(true)}
            className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-black text-sm uppercase px-8 py-6 rounded-xl shadow-lg w-full sm:w-auto"
          >
            Finalizar Treino & Gravar Resultado 🏆
          </Button>
        </Card>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE FINALIZAÇÃO */}
      <Dialog open={finishModalOpen} onOpenChange={setFinishModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <Award className="w-6 h-6 text-[#22C55E]" /> Confirmar Conclusão do Treino
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Ciclo Semanal: Semana {activeWeek} ({currentWeekConfig.focus})
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-xl bg-[#181818] border border-[#22C55E]/40 space-y-3 my-2 text-xs text-gray-300 font-inter">
            <p>
              Todas as séries, cargas e repetições executadas foram gravadas com sucesso no banco de
              dados.
            </p>
            {workout.professional ? (
              <div className="p-3 rounded-lg bg-[#141414] border border-[#22C55E]/40 text-xs text-[#22C55E] font-bold font-mono">
                ✓ +1 Serviço oficial computado com seu profissional credenciado para o Ranking!
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#141414] border border-amber-500/30 text-xs text-amber-300">
                ℹ️ Treino registrado no seu histórico pessoal.
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
              Continuar Treinando
            </Button>
            <Button
              onClick={handleFinalizeWorkout}
              disabled={finishingWorkout}
              className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase rounded-xl flex items-center gap-2"
            >
              {finishingWorkout ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Concluir & Pontuar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

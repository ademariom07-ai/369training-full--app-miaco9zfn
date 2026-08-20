import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { api, type WorkoutRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from 'lucide-react'
import { toast } from 'sonner'

export default function MonteSeuTreino() {
  const { user } = useAuth()

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

  // Toggle Exercise Completed
  const handleToggleExercise = async (index: number) => {
    if (!currentWorkout || !currentWorkout.exercises) return

    const updatedExercises = [...currentWorkout.exercises]
    const item = updatedExercises[index]
    item.completed = !item.completed

    try {
      const updated = await pb.collection('workouts').update<WorkoutRecord>(currentWorkout.id, {
        exercises: updatedExercises,
      })
      setCurrentWorkout(updated)
      toast.success(item.completed ? 'Exercício concluído! 💪' : 'Exercício reaberto.')
    } catch (_) {
      toast.error('Erro ao atualizar exercício.')
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          Inteligência Artificial 369
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Monte Seu Treino com IA
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Preencha a anamnese rápida e receba uma periodização adaptada ao seu objetivo e nível
          biomecânico.
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
              <option value="Aumentar força">Aumentar força</option>
              <option value="Hipertrofia">Hipertrofia</option>
              <option value="Ganho de massa">Ganho de massa</option>
              <option value="Perda de peso">Perda de peso</option>
              <option value="Resistência aeróbica">Resistência aeróbica</option>
              <option value="Artes marciais">Artes marciais</option>
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
            {currentWorkout.exercises?.map((exercise, idx) => (
              <Card
                key={exercise.id || idx}
                className={`p-5 rounded-xl border transition-all ${
                  exercise.completed
                    ? 'bg-[#121212]/70 border-[#22C55E]/40 opacity-80'
                    : 'bg-[#181818] border-[#2A2A2A] hover:border-[#D4AF37]/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Video Thumbnail Placeholder */}
                    <div className="w-16 h-16 rounded-lg bg-[#141414] border border-[#2A2A2A] flex items-center justify-center text-[#D4AF37] shrink-0 relative overflow-hidden group">
                      <PlayCircle className="w-8 h-8 opacity-80 group-hover:scale-110 transition-transform" />
                    </div>

                    <div>
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
                      </div>

                      {/* Series, Reps, Carga, Descanso Chips */}
                      <div className="flex flex-wrap gap-2 mt-2">
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
                        <p className="text-xs text-gray-400 mt-2 font-inter italic">
                          💡 {exercise.tips}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <Button
                    onClick={() => handleToggleExercise(idx)}
                    variant={exercise.completed ? 'outline' : 'default'}
                    className={`shrink-0 font-bold text-xs uppercase px-4 py-2 rounded-xl transition-all ${
                      exercise.completed
                        ? 'border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/10'
                        : 'bg-[#D4AF37] text-black hover:bg-[#E6C65C]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {exercise.completed ? 'Concluído' : 'Concluir'}
                  </Button>
                </div>
              </Card>
            ))}
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
    </div>
  )
}

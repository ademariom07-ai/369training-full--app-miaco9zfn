import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { api } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dumbbell, Sparkles, Plus, Trash2, Save, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/contexts/AuthContext'

interface ExerciseItem {
  id: string
  name: string
  sets: string
  reps: string
  load: string
  rest: string
  video: string
  tips: string
}

export default function CriacaoTreino() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [students, setStudents] = useState<UserProfile[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [title, setTitle] = useState('Treino A - Hipertrofia & Força')
  const [objective, setObjective] = useState('Hipertrofia')
  const [day, setDay] = useState('Segunda-feira')
  const [exercises, setExercises] = useState<ExerciseItem[]>([
    {
      id: 'ex_1',
      name: 'Supino Reto com Barra',
      sets: '4',
      reps: '8-10',
      load: '30kg cada lado',
      rest: '90s',
      video: '',
      tips: 'Adução escapular e pegada firme.',
    },
    {
      id: 'ex_2',
      name: 'Desenvolvimento Militar Halteres',
      sets: '4',
      reps: '10-12',
      load: '18kg haltere',
      rest: '60s',
      video: '',
      tips: 'Evitar hiperextensão lombar.',
    },
  ])

  const [loadingAI, setLoadingAI] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    pb.collection('users')
      .getList<UserProfile>(1, 50, {
        filter: 'role = "aluno"',
      })
      .then((res) => {
        setStudents(res.items)
        if (res.items.length > 0) {
          setSelectedStudentId(res.items[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const handleAddExercise = () => {
    setExercises([
      ...exercises,
      {
        id: 'ex_' + Date.now(),
        name: '',
        sets: '3',
        reps: '10-12',
        load: 'Moderada',
        rest: '60s',
        video: '',
        tips: '',
      },
    ])
  }

  const handleRemoveExercise = (idx: number) => {
    setExercises(exercises.filter((_, i) => i !== idx))
  }

  const handleUpdateExercise = (idx: number, field: keyof ExerciseItem, val: string) => {
    const updated = [...exercises]
    updated[idx][field] = val
    setExercises(updated)
  }

  // Generate with AI structured prompt
  const handleGenerateAI = async () => {
    setLoadingAI(true)
    try {
      const res = await api.generateWorkout({
        objective,
        experience: 'Avançado',
        daysAvailable: 5,
        restrictions: 'Nenhuma',
      })

      if (res.exercises && res.exercises.length > 0) {
        setTitle(res.title || title)
        setExercises(
          res.exercises.map((e, idx) => ({
            id: e.id || 'ex_' + idx,
            name: e.name,
            sets: e.sets || '4',
            reps: e.reps || '10-12',
            load: e.load || 'Carga progressiva',
            rest: e.rest || '60s',
            video: e.video || '',
            tips: e.tips || '',
          })),
        )
        toast.success('Treino gerado com sucesso pela IA 369!')
      }
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao gerar treino com IA.')
    } finally {
      setLoadingAI(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId) {
      toast.error('Selecione o aluno.')
      return
    }
    if (exercises.length === 0) {
      toast.error('Adicione pelo menos um exercício.')
      return
    }

    setSaving(true)
    try {
      await pb.collection('workouts').create({
        professional: user?.id,
        student: selectedStudentId,
        title,
        objective,
        day,
        status: 'ativo',
        exercises,
        ai_generated: false,
      })

      // Send notification to student
      await pb.collection('notifications').create({
        user: selectedStudentId,
        type: 'new_workout',
        title: `Novo Treino: ${title}`,
        body: `Seu profissional prescreveu um novo treino (${day}). Confira já no app!`,
        read: false,
        action_url: '/aluno/treino',
      })

      toast.success('Treino salvo e aluno notificado com sucesso!')
      navigate('/profissional/dashboard')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao salvar treino.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold font-montserrat text-white uppercase">
              Criar Nova Ficha de Treino
            </h1>
            <p className="text-xs text-gray-400 font-inter">
              Prescreva séries, repetições e cargas com auxílio opcional de Inteligência Artificial.
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerateAI}
          disabled={loadingAI}
          className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase flex items-center gap-2"
        >
          {loadingAI ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Gerar com IA
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Info Card */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
              Selecionar Aluno *
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.objective || 'Aluno'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
              Título do Treino *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
              Dia da Semana
            </label>
            <Input
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="Ex: Segunda-feira"
              className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
            />
          </div>
        </Card>

        {/* Exercises Editor List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold font-montserrat text-white text-sm uppercase flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#D4AF37]" /> Lista de Exercícios Prescritos
            </h3>
            <Button
              type="button"
              size="sm"
              onClick={handleAddExercise}
              className="bg-[#0057FF] hover:bg-[#1e69ff] text-white font-bold text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Exercício
            </Button>
          </div>

          {exercises.map((ex, idx) => (
            <Card
              key={ex.id || idx}
              className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#D4AF37] font-montserrat uppercase">
                  Exercício #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveExercise(idx)}
                  className="text-gray-500 hover:text-red-400 text-xs p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Nome do Exercício
                  </label>
                  <Input
                    value={ex.name}
                    onChange={(e) => handleUpdateExercise(idx, 'name', e.target.value)}
                    placeholder="Ex: Supino Inclinado com Halteres"
                    className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Séries
                  </label>
                  <Input
                    value={ex.sets}
                    onChange={(e) => handleUpdateExercise(idx, 'sets', e.target.value)}
                    placeholder="4"
                    className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Repetições
                  </label>
                  <Input
                    value={ex.reps}
                    onChange={(e) => handleUpdateExercise(idx, 'reps', e.target.value)}
                    placeholder="10-12"
                    className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                    Carga
                  </label>
                  <Input
                    value={ex.load}
                    onChange={(e) => handleUpdateExercise(idx, 'load', e.target.value)}
                    placeholder="25kg"
                    className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Input
                  value={ex.rest}
                  onChange={(e) => handleUpdateExercise(idx, 'rest', e.target.value)}
                  placeholder="Descanso (ex: 60s)"
                  className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-gray-300"
                />
                <Input
                  value={ex.tips}
                  onChange={(e) => handleUpdateExercise(idx, 'tips', e.target.value)}
                  placeholder="Dica biomecânica / postura..."
                  className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-gray-300"
                />
              </div>
            </Card>
          ))}
        </div>

        {/* Save CTA */}
        <Button
          type="submit"
          disabled={saving}
          className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-sm uppercase py-6 rounded-xl shadow-xl flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" /> Salvar Treino & Notificar Aluno
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

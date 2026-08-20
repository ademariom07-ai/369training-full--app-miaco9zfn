import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { api } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Utensils, Sparkles, Plus, Trash2, Save, Loader2, ArrowLeft, Apple } from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/contexts/AuthContext'

interface MealItem {
  name: string
  calories: number
  items: string[]
}

export default function CriacaoDieta() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [students, setStudents] = useState<UserProfile[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [title, setTitle] = useState('Plano Hipertrofia Limpa - 2800 kcal')
  const [calories, setCalories] = useState<number>(2800)
  const [protein, setProtein] = useState<number>(180)
  const [carbs, setCarbs] = useState<number>(340)
  const [fat, setFat] = useState<number>(75)

  const [meals, setMeals] = useState<MealItem[]>([
    {
      name: 'Café da Manhã (07:30)',
      calories: 520,
      items: ['3 ovos mexidos', '2 fatias de pão 100% integral', '1 banana com aveia e mel'],
    },
    {
      name: 'Almoço (12:30)',
      calories: 780,
      items: [
        '180g de filé de frango',
        '200g de arroz integral',
        '100g de feijão preto',
        'Salada à vontade',
      ],
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

  const handleAddMeal = () => {
    setMeals([
      ...meals,
      {
        name: 'Refeição ' + (meals.length + 1),
        calories: 400,
        items: ['Item alimentar 1', 'Item alimentar 2'],
      },
    ])
  }

  const handleRemoveMeal = (idx: number) => {
    setMeals(meals.filter((_, i) => i !== idx))
  }

  const handleUpdateMealName = (idx: number, name: string) => {
    const updated = [...meals]
    updated[idx].name = name
    setMeals(updated)
  }

  const handleUpdateMealItems = (idx: number, rawText: string) => {
    const updated = [...meals]
    updated[idx].items = rawText.split('\n').filter((l) => l.trim().length > 0)
    setMeals(updated)
  }

  // Generate Diet with AI
  const handleGenerateAI = async () => {
    setLoadingAI(true)
    try {
      const res = await api.generateDiet({
        goal: 'Hipertrofia e Definição Muscular',
        calories: calories,
        mealCount: 4,
        dietaryRestrictions: 'Sem restrições',
      })

      if (res.meals && res.meals.length > 0) {
        setTitle(res.title || title)
        setCalories(res.calories || calories)
        if (res.macros) {
          setProtein(res.macros.protein || protein)
          setCarbs(res.macros.carbs || carbs)
          setFat(res.macros.fat || fat)
        }
        setMeals(
          res.meals.map((m) => ({
            name: m.name,
            calories: m.calories || 500,
            items: m.items || [],
          })),
        )
        toast.success('Plano alimentar gerado com sucesso pela IA 369!')
      }
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao gerar dieta com IA.')
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

    setSaving(true)
    try {
      await pb.collection('diets').create({
        professional: user?.id,
        student: selectedStudentId,
        title,
        calories,
        macros: { protein, carbs, fat },
        meals,
      })

      // Send notification
      await pb.collection('notifications').create({
        user: selectedStudentId,
        type: 'new_diet',
        title: `Novo Plano Alimentar: ${title}`,
        body: `Seu nutricionista atualizou sua dieta (${calories} kcal). Confira no app!`,
        read: false,
        action_url: '/aluno/nutricao',
      })

      toast.success('Plano alimentar salvo com sucesso!')
      navigate('/profissional/dashboard')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao salvar dieta.')
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
              Criar Plano Nutricional
            </h1>
            <p className="text-xs text-gray-400 font-inter">
              Estruture refeições, calorias e distribuição de macros com auxílio da IA 369.
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerateAI}
          disabled={loadingAI}
          className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase flex items-center gap-2"
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
        {/* Info & Macros Card */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                Título do Plano Alimentar *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white font-semibold"
                required
              />
            </div>
          </div>

          {/* Macros distribution */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Calorias (kcal)
              </label>
              <Input
                type="number"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-[#D4AF37] font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Proteínas (g)
              </label>
              <Input
                type="number"
                value={protein}
                onChange={(e) => setProtein(Number(e.target.value))}
                className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-[#0057FF] font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Carboidratos (g)
              </label>
              <Input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(Number(e.target.value))}
                className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-[#22C55E] font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                Gorduras (g)
              </label>
              <Input
                type="number"
                value={fat}
                onChange={(e) => setFat(Number(e.target.value))}
                className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-[#FF7A00] font-bold"
              />
            </div>
          </div>
        </Card>

        {/* Meals Editor List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold font-montserrat text-white text-sm uppercase flex items-center gap-2">
              <Apple className="w-4 h-4 text-[#22C55E]" /> Refeições Estruturadas
            </h3>
            <Button
              type="button"
              size="sm"
              onClick={handleAddMeal}
              className="bg-[#22C55E] hover:bg-[#1eb354] text-black font-bold text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Refeição
            </Button>
          </div>

          {meals.map((meal, idx) => (
            <Card
              key={idx}
              className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <Input
                  value={meal.name}
                  onChange={(e) => handleUpdateMealName(idx, e.target.value)}
                  placeholder="Nome da Refeição (ex: Almoço 12:30)"
                  className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-white font-bold w-64"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveMeal(idx)}
                  className="text-gray-500 hover:text-red-400 text-xs p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                  Alimentos (um por linha)
                </label>
                <textarea
                  value={meal.items.join('\n')}
                  onChange={(e) => handleUpdateMealItems(idx, e.target.value)}
                  rows={3}
                  className="w-full p-2.5 bg-[#141414] border border-[#2A2A2A] rounded-lg text-xs text-white focus:ring-2 focus:ring-[#22C55E] focus:outline-none font-mono leading-relaxed"
                />
              </div>
            </Card>
          ))}
        </div>

        {/* Save CTA */}
        <Button
          type="submit"
          disabled={saving}
          className="w-full bg-[#22C55E] text-black hover:bg-[#1eb354] font-extrabold text-sm uppercase py-6 rounded-xl shadow-xl flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar Dieta & Disponibilizar ao Aluno
        </Button>
      </form>
    </div>
  )
}

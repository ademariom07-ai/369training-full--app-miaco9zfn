import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { api, type DietRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Utensils,
  Sparkles,
  RefreshCw,
  Camera,
  ShoppingBag,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  Apple,
  Flame,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function Nutricao() {
  const { user } = useAuth()

  const [diet, setDiet] = useState<DietRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // Smart Swap State
  const [swapInput, setSwapInput] = useState('')
  const [swapResult, setSwapResult] = useState<{
    original: string
    suggestion: string
    benefits: string
    portion: string
  } | null>(null)
  const [swapping, setSwapping] = useState(false)

  // Meal Photo Diary
  const [mealPhotos, setMealPhotos] = useState<
    Array<{ id: string; name: string; time: string; url: string }>
  >([
    {
      id: 'p1',
      name: 'Almoço Balanceado',
      time: 'Hoje às 12:45',
      url: 'https://img.usecurling.com/p/300/200?q=chicken%20salad%20healthy',
    },
    {
      id: 'p2',
      name: 'Café Proteico',
      time: 'Hoje às 07:30',
      url: 'https://img.usecurling.com/p/300/200?q=eggs%20toast%20avocado',
    },
  ])

  // Load Diet
  useEffect(() => {
    if (!user) return
    pb.collection('diets')
      .getList<DietRecord>(1, 1, {
        filter: `student = "${user.id}"`,
        sort: '-created',
      })
      .then((res) => {
        if (res.items.length > 0) {
          setDiet(res.items[0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  // Handle Smart Swap
  const handleSmartSwap = async () => {
    if (!swapInput.trim()) {
      toast.error('Informe o alimento que deseja substituir.')
      return
    }
    setSwapping(true)
    try {
      const res = await api.smartSwap({
        mealItem: swapInput,
        reason: 'Manter macros proteicos e baixo índice glicêmico',
      })
      setSwapResult(res)
      toast.success('Substituição inteligente calculada!')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao sugerir substituição.')
    } finally {
      setSwapping(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-xs font-bold text-[#22C55E] uppercase font-montserrat mb-2">
            <Utensils className="w-3.5 h-3.5" />
            Nutrição de Alta Performance
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Plano Alimentar & Substituições
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Cardápio calculado, fotos de refeições diárias e inteligência artificial para trocas
            nutricionais.
          </p>
        </div>

        <Link to="/aluno/chat">
          <Button className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat com Nutricionista
          </Button>
        </Link>
      </div>

      {/* MACROS & CALORIAS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
          <span className="text-xs text-gray-400 font-montserrat uppercase">Meta Calórica</span>
          <p className="text-2xl font-extrabold text-[#D4AF37] font-montserrat mt-1">
            {diet?.calories || 2800} <span className="text-xs text-gray-400">kcal</span>
          </p>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
          <span className="text-xs text-gray-400 font-montserrat uppercase">Proteínas</span>
          <p className="text-2xl font-extrabold text-[#0057FF] font-montserrat mt-1">
            {diet?.macros?.protein || 180}g
          </p>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
          <span className="text-xs text-gray-400 font-montserrat uppercase">Carboidratos</span>
          <p className="text-2xl font-extrabold text-[#22C55E] font-montserrat mt-1">
            {diet?.macros?.carbs || 340}g
          </p>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-xl text-center">
          <span className="text-xs text-gray-400 font-montserrat uppercase">Gorduras Boas</span>
          <p className="text-2xl font-extrabold text-[#FF7A00] font-montserrat mt-1">
            {diet?.macros?.fat || 75}g
          </p>
        </Card>
      </div>

      {/* PLANO ALIMENTAR DO DIA */}
      <div>
        <h2 className="text-lg font-bold font-montserrat uppercase text-white mb-4 flex items-center gap-2">
          <Apple className="w-5 h-5 text-[#22C55E]" />
          Refeições do Dia
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            diet?.meals || [
              {
                name: 'Café da Manhã (07:30)',
                calories: 520,
                items: ['3 ovos mexidos', '2 fatias de pão integral', '1 banana com aveia e mel'],
              },
              {
                name: 'Almoço (12:30)',
                calories: 780,
                items: [
                  '180g filé de frango',
                  '200g arroz integral',
                  '100g feijão preto',
                  'Salada verde',
                ],
              },
              {
                name: 'Lanche da Tarde (16:30)',
                calories: 380,
                items: ['1 scoop Whey Protein', '30g pasta de amendoim', '1 maçã'],
              },
              {
                name: 'Jantar (20:00)',
                calories: 650,
                items: ['150g patinho moído', '250g batata doce', 'Legumes cozidos'],
              },
            ]
          ).map((meal, idx) => (
            <Card key={idx} className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold font-montserrat text-white text-sm">{meal.name}</h3>
                {meal.calories && (
                  <span className="text-xs font-mono text-[#D4AF37] font-semibold">
                    ~{meal.calories} kcal
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 text-xs text-gray-300 font-inter">
                {meal.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>

      {/* SUBSTITUIÇÃO INTELIGENTE IA */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <h3 className="text-base font-bold font-montserrat text-white uppercase">
            Substituição Inteligente com IA
          </h3>
        </div>
        <p className="text-xs text-gray-400 font-inter mb-4">
          Faltou algum ingrediente ou quer variar o cardápio? Digite o alimento e a IA calcula o
          substituto com os mesmos macronutrientes.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={swapInput}
            onChange={(e) => setSwapInput(e.target.value)}
            placeholder="Ex: 150g de frango grelhado ou 2 fatias de pão integral"
            className="bg-[#141414] border-[#2A2A2A] rounded-xl text-white text-xs"
          />
          <Button
            onClick={handleSmartSwap}
            disabled={swapping}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-6 shrink-0"
          >
            {swapping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calcular Troca'}
          </Button>
        </div>

        {swapResult && (
          <div className="mt-4 p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/40 text-xs space-y-2">
            <div className="flex justify-between font-montserrat">
              <span className="text-gray-400">Sugestão de Troca:</span>
              <span className="text-[#D4AF37] font-bold">{swapResult.suggestion}</span>
            </div>
            <div className="flex justify-between font-montserrat">
              <span className="text-gray-400">Porção Equivalente:</span>
              <span className="text-white font-mono">{swapResult.portion}</span>
            </div>
            <p className="text-gray-300 font-inter pt-1 border-t border-[#2A2A2A]">
              💡 {swapResult.benefits}
            </p>
          </div>
        )}
      </Card>

      {/* DIÁRIO FOTOGRÁFICO DE REFEIÇÕES */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#0057FF]" />
            <h3 className="font-bold font-montserrat text-white text-sm uppercase">
              Diário Fotográfico de Refeições
            </h3>
          </div>
          <Button
            size="sm"
            onClick={() =>
              toast.info('Selecione uma foto da sua refeição para enviar ao nutricionista.')
            }
            className="bg-[#0057FF] hover:bg-[#1e69ff] text-white text-xs font-bold"
          >
            Enviar Foto
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mealPhotos.map((photo) => (
            <div
              key={photo.id}
              className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center gap-3"
            >
              <img
                src={photo.url}
                alt={photo.name}
                className="w-16 h-16 rounded-lg object-cover border border-[#2A2A2A]"
              />
              <div>
                <p className="text-xs font-bold text-white font-montserrat">{photo.name}</p>
                <p className="text-[10px] text-gray-400 font-inter mt-0.5">{photo.time}</p>
                <span className="inline-block mt-1 text-[10px] text-[#22C55E] font-semibold">
                  ✓ Registrado no Diário
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

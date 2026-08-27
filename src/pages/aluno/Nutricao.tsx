import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { api, type DietRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
  Lock,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function Nutricao() {
  const { user } = useAuth()
  const isPremium = user?.plan === 'premium'

  const [diet, setDiet] = useState<DietRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // RECURSO 4: Gerar Dieta com IA State (Anamnese Modal)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [generatingDiet, setGeneratingDiet] = useState(false)
  const [dietGoal, setDietGoal] = useState('Hipertrofia / Ganho de Massa')
  const [caloriesTarget, setCaloriesTarget] = useState<number>(2600)
  const [mealCount, setMealCount] = useState<number>(4)
  const [dietaryRestrictions, setDietaryRestrictions] = useState('Nenhuma restrição alimentar')
  const [dietPreferences, setDietPreferences] = useState(
    'Preferência por alimentos naturais e ricos em proteínas',
  )

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
  const loadDiet = async () => {
    if (!user) return
    try {
      const res = await pb.collection('diets').getList<DietRecord>(1, 1, {
        filter: `student = "${user.id}"`,
        sort: '-created',
      })
      if (res.items.length > 0) {
        setDiet(res.items[0])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDiet()
  }, [user])

  // RECURSO 4: Handle Generate Diet with AI
  const handleGenerateDiet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!isPremium) {
      toast.error('O gerador de dieta com IA é um recurso exclusivo do Plano Premium.')
      return
    }

    setGeneratingDiet(true)
    try {
      const fullRestrictions = `${dietaryRestrictions}. Preferências: ${dietPreferences}`
      const generated = await api.generateDiet({
        goal: dietGoal,
        calories: Number(caloriesTarget) || 2500,
        mealCount: Number(mealCount) || 4,
        dietaryRestrictions: fullRestrictions,
      })

      // Salvar dieta gerada no banco de dados
      const newDietRec = await pb.collection('diets').create<DietRecord>({
        student: user.id,
        title: generated.title || `Plano Nutricional IA - ${dietGoal}`,
        calories: generated.calories || caloriesTarget,
        macros: generated.macros || { protein: 160, carbs: 280, fat: 65 },
        meals: generated.meals || [],
      })

      setDiet(newDietRec)
      toast.success('Plano Nutricional gerado com sucesso pela IA 369!')
      setGenerateModalOpen(false)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao gerar dieta com IA.')
    } finally {
      setGeneratingDiet(false)
    }
  }

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

        <div className="flex items-center gap-3">
          {/* RECURSO 4: Botão Gerar Dieta com IA (Gate Premium) */}
          <Button
            onClick={() => setGenerateModalOpen(true)}
            className="bg-gradient-to-r from-[#D4AF37] to-[#F4D77A] text-black font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:scale-102 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Gerar Dieta com IA
          </Button>

          <Link to="/aluno/chat">
            <Button className="bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat Nutricionista
            </Button>
          </Link>
        </div>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold font-montserrat uppercase text-white flex items-center gap-2">
            <Apple className="w-5 h-5 text-[#22C55E]" />
            {diet?.title || 'Refeições do Dia'}
          </h2>
          {diet && (
            <span className="text-[11px] text-[#D4AF37] font-mono font-bold bg-[#D4AF37]/10 px-2.5 py-1 rounded-lg border border-[#D4AF37]/30">
              ✓ Cardápio Personalizado Ativo
            </span>
          )}
        </div>

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

      {/* RECURSO 4: MODAL DE ANAMNESE E GERAÇÃO DE DIETA COM IA */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Gerar Dieta Personalizada com IA
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Anamnese nutricional de alta precisão baseada em macronutrientes e biotipo.
            </DialogDescription>
          </DialogHeader>

          {isPremium ? (
            <form onSubmit={handleGenerateDiet} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                    Objetivo Principal
                  </label>
                  <select
                    value={dietGoal}
                    onChange={(e) => setDietGoal(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  >
                    <option value="Hipertrofia / Ganho de Massa">
                      Hipertrofia / Ganho de Massa
                    </option>
                    <option value="Emagrecimento / Queima de Gordura">
                      Emagrecimento / Queima de Gordura
                    </option>
                    <option value="Definição Muscular">Definição Muscular</option>
                    <option value="Manutenção & Longevidade">Manutenção & Longevidade</option>
                    <option value="Performance Esportiva">Performance Esportiva</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                    Meta Calórica Diária (kcal)
                  </label>
                  <Input
                    type="number"
                    min="1200"
                    max="5000"
                    step="50"
                    value={caloriesTarget}
                    onChange={(e) => setCaloriesTarget(Number(e.target.value))}
                    className="bg-[#181818] border-[#2A2A2A] text-white font-mono text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Número de Refeições Diárias
                </label>
                <select
                  value={mealCount}
                  onChange={(e) => setMealCount(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value={3}>3 Refeições (Café, Almoço, Jantar)</option>
                  <option value={4}>4 Refeições (Café, Almoço, Lanche, Jantar)</option>
                  <option value={5}>5 Refeições (Café, Lanche 1, Almoço, Lanche 2, Jantar)</option>
                  <option value={6}>6 Refeições (Atletas / Fracionamento)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Restrições Alimentares / Alergias
                </label>
                <Input
                  value={dietaryRestrictions}
                  onChange={(e) => setDietaryRestrictions(e.target.value)}
                  placeholder="Ex: intolerância a lactose, celíaco, sem frutos do mar"
                  className="bg-[#181818] border-[#2A2A2A] text-white text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Preferências Alimentares
                </label>
                <Input
                  value={dietPreferences}
                  onChange={(e) => setDietPreferences(e.target.value)}
                  placeholder="Ex: preferência por ovos, frango, aveia, arroz e saladas"
                  className="bg-[#181818] border-[#2A2A2A] text-white text-xs rounded-xl"
                />
              </div>

              <DialogFooter className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGenerateModalOpen(false)}
                  disabled={generatingDiet}
                  className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={generatingDiet}
                  className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase rounded-xl flex items-center gap-2"
                >
                  {generatingDiet ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Gerando Plano...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Gerar Plano com IA
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="p-6 rounded-xl bg-[#181818] border border-[#2A2A2A] text-center space-y-4 my-2">
              <Lock className="w-10 h-10 text-[#D4AF37] mx-auto" />
              <div>
                <h4 className="text-base font-bold font-montserrat text-white uppercase">
                  Recurso Exclusivo do Plano Premium
                </h4>
                <p className="text-xs text-gray-400 font-inter mt-1 leading-relaxed">
                  A prescrição de planos alimentares automatizados com Inteligência Artificial é
                  reservada para assinantes do nível Premium.
                </p>
              </div>
              <Button
                onClick={() => {
                  setGenerateModalOpen(false)
                  toast.info(
                    'Acesse as configurações do seu perfil para realizar o upgrade de plano.',
                  )
                }}
                className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl"
              >
                Conhecer Planos 369
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

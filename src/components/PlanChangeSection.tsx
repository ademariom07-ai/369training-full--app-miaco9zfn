import React, { useState } from 'react'
import { useAuth, PlanTier } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  CheckCircle2,
  Lock,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Crown,
} from 'lucide-react'
import { toast } from 'sonner'

export interface PlanConfig {
  id: PlanTier
  name: string
  tarifa: string
  tarifaValor: number
  description: string
  benefits: string[]
  recommended?: boolean
  color: string
  borderColor: string
  badgeColor: string
  icon: React.ComponentType<{ className?: string }>
}

export const ALL_PLANS: PlanConfig[] = [
  {
    id: 'gratis',
    name: 'Grátis',
    tarifa: 'Sem tarifa fixa',
    tarifaValor: 0.0,
    description: 'Acesso às rotinas essenciais sem pontuação ou participação no ranking.',
    benefits: [
      'Multiplicador 0x no ranking (sem pontuação)',
      'Sem cashback no fechamento de ciclos',
      'Monte seu treino manual e cronômetro de hidratação',
      'Evolução para planos pagos permitida a qualquer momento',
    ],
    color: 'text-gray-400',
    borderColor: 'border-gray-800 hover:border-gray-600',
    badgeColor: 'bg-gray-800 text-gray-400 border-gray-700',
    icon: ShieldCheck,
  },
  {
    id: 'basico',
    name: 'Básico',
    tarifa: 'R$ 1,00 / serviço',
    tarifaValor: 1.0,
    description: 'Ideal para quem busca pontuar com multiplicador 1.0x na rede.',
    benefits: [
      'Multiplicador 1.0x no ranking mensal 369',
      'Tarifa de R$ 1,00 por atendimento concluído',
      'Até 15 consultas com IA Experts por mês',
      'Prescrição e acompanhamento de treinos e dietas',
      'Participação na distribuição equalizada de cashback',
    ],
    color: 'text-gray-300',
    borderColor: 'border-gray-700 hover:border-gray-500',
    badgeColor: 'bg-gray-800 text-gray-300 border-gray-700',
    icon: ShieldCheck,
  },
  {
    id: 'pro',
    name: 'Pro',
    tarifa: 'R$ 2,00 / serviço',
    tarifaValor: 2.0,
    description: 'Multiplicador 2.0x e recursos avançados de IA para acelerar seus resultados.',
    benefits: [
      'Multiplicador 2.0x no ranking mensal (2x mais rápido)',
      'Tarifa de R$ 2,00 por atendimento concluído',
      'Até 50 consultas com IA Experts por mês',
      'Destaque no ecossistema e ferramentas completas',
      'Participação integral no pool de cashback de 38%',
    ],
    recommended: true,
    color: 'text-[#0057FF]',
    borderColor: 'border-[#0057FF]/40 hover:border-[#0057FF]',
    badgeColor: 'bg-[#0057FF]/15 text-[#0057FF] border-[#0057FF]/40',
    icon: Zap,
  },
  {
    id: 'premium',
    name: 'Premium',
    tarifa: 'R$ 3,00 / serviço',
    tarifaValor: 3.0,
    description: 'O nível máximo de visibilidade: multiplicador 3.0x e IA ilimitada.',
    benefits: [
      'Multiplicador 3.0x no ranking (aceleração máxima 3x)',
      'Tarifa de R$ 3,00 por atendimento concluído',
      'Acesso ILIMITADO a todos os IA Experts 369',
      'Máxima prioridade e suporte VIP de ecossistema',
      'Maior retorno potencial no fechamento mensal de cashback',
    ],
    color: 'text-[#D4AF37]',
    borderColor: 'border-[#D4AF37]/50 hover:border-[#D4AF37]',
    badgeColor: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/50',
    icon: Crown,
  },
]

export const PROFISSIONAL_PLANS: PlanConfig[] = ALL_PLANS.filter((p) => p.id !== 'gratis')

/**
 * Retorna se a data atual (ou informada) está na janela permitida (dias 1 a 3 do mês)
 */
export function isPlanChangeWindowOpen(date: Date = new Date()): boolean {
  const day = date.getDate()
  return day >= 1 && day <= 3
}

export function PlanChangeSection() {
  const { user, refreshUser } = useAuth()
  const [selectedPlanToChange, setSelectedPlanToChange] = useState<PlanConfig | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const isWindowOpen = isPlanChangeWindowOpen()
  const currentDay = new Date().getDate()
  const currentPlan = (user?.plan as PlanTier) || 'basico'

  const isFromGratis = currentPlan === 'gratis'

  const handleOpenConfirm = (plan: PlanConfig) => {
    // Regra: Evolução a partir do GRÁTIS permitida a qualquer momento do mês vigente!
    if (!isFromGratis && !isWindowOpen) {
      toast.error('A troca de plano está disponível apenas do dia 1 ao dia 3 de cada mês.')
      return
    }
    if (plan.id === currentPlan) {
      toast.info('Você já está utilizando este plano.')
      return
    }
    setSelectedPlanToChange(plan)
    setConfirmModalOpen(true)
  }

  const handleConfirmChange = async () => {
    if (!user || !selectedPlanToChange) return
    if (!isFromGratis && !isPlanChangeWindowOpen()) {
      toast.error('A troca de plano está disponível apenas do dia 1 ao dia 3 de cada mês.')
      setConfirmModalOpen(false)
      return
    }

    setIsUpdating(true)
    try {
      // TAREFA 2: Chamar o hook seguro do backend /backend/v1/plans/change
      const res = await pb.send('/backend/v1/plans/change', {
        method: 'POST',
        body: {
          plan: selectedPlanToChange.id,
        },
      })

      if (res && res.success === false) {
        throw new Error(res.message || 'Falha ao alterar plano.')
      }

      await refreshUser()
      toast.success(
        res?.message ||
          `Plano alterado com sucesso para ${selectedPlanToChange.name}! O novo badge já está ativo.`,
      )
      setConfirmModalOpen(false)
      setSelectedPlanToChange(null)
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message || 'Erro ao trocar de plano. Tente novamente.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
      {/* Header & Window Status Alert */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2A2A2A]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#D4AF37] uppercase tracking-wider font-montserrat">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" /> Assinatura & Troca de Plano
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-montserrat text-white uppercase">
            Gerenciamento de Plano Profissional
          </h2>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Escolha o plano que melhor atende à escala dos seus atendimentos e objetivos no
            ecossistema 369.
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {isWindowOpen ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-montserrat font-bold">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Janela de Troca Aberta (Dia {currentDay} de 1 a 3)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-montserrat font-bold">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Janela Bloqueada (Hoje é dia {currentDay})</span>
            </div>
          )}
        </div>
      </div>

      {/* Warning / Informational Banner */}
      {!isWindowOpen ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-300 font-montserrat uppercase">
              Troca Temporariamente Indisponível
            </p>
            <p className="text-gray-300 leading-relaxed font-inter">
              <strong>
                A troca de plano está disponível apenas do dia 1 ao dia 3 de cada mês.
              </strong>{' '}
              Essa regra garante a estabilidade dos ciclos de repasse de cashback e do ranking
              mensal.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-emerald-300 font-montserrat uppercase">
              Janela Mensal de Troca Habilitada!
            </p>
            <p className="text-gray-300 leading-relaxed font-inter">
              Você pode alterar seu plano livremente até o dia 3. O novo plano passará a valer
              imediatamente para suas tarifas, quota de IA e badge.
            </p>
          </div>
        </div>
      )}

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {PROFISSIONAL_PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const Icon = plan.icon

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col justify-between transition-all bg-[#141414] border ${
                isCurrent
                  ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/50 shadow-[0_0_25px_rgba(212,175,55,0.15)]'
                  : plan.borderColor
              }`}
            >
              {/* Badge for Current Plan */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#D4AF37] text-black font-montserrat font-extrabold text-[10px] uppercase shadow-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-black" />
                  Plano Atual
                </div>
              )}

              {/* Recommended Badge */}
              {!isCurrent && plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#0057FF] text-white font-montserrat font-extrabold text-[10px] uppercase shadow-md">
                  Mais Popular
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-xl border ${
                        plan.id === 'premium'
                          ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
                          : plan.id === 'pro'
                            ? 'bg-[#0057FF]/10 border-[#0057FF]/30 text-[#0057FF]'
                            : 'bg-gray-800 border-gray-700 text-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold font-montserrat text-lg text-white">
                        Plano {plan.name}
                      </h3>
                      <span className="text-[10px] text-gray-400 font-inter uppercase tracking-wider">
                        Tarifa por Atendimento
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price Display */}
                <div className="my-4 p-3 rounded-xl bg-[#0F0F0F] border border-[#222222]">
                  <p className="text-2xl font-black font-montserrat text-white">{plan.tarifa}</p>
                  <p className="text-[11px] text-gray-400 font-inter mt-0.5">{plan.description}</p>
                </div>

                {/* Benefits List */}
                <div className="space-y-2.5 my-4">
                  <p className="text-[11px] font-bold uppercase text-gray-400 font-montserrat">
                    O que está incluso:
                  </p>
                  {plan.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          plan.id === 'premium'
                            ? 'text-[#D4AF37]'
                            : plan.id === 'pro'
                              ? 'text-[#0057FF]'
                              : 'text-gray-400'
                        }`}
                      />
                      <span className="leading-tight">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-[#222222]">
                {isCurrent ? (
                  <Button
                    disabled
                    variant="outline"
                    className="w-full bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37] font-bold text-xs uppercase cursor-default"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Seu Plano Ativo
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleOpenConfirm(plan)}
                    disabled={!isWindowOpen}
                    className={`w-full font-bold text-xs uppercase transition-all shadow-md ${
                      !isWindowOpen
                        ? 'bg-[#222222] text-gray-500 border border-gray-800 cursor-not-allowed hover:bg-[#222222]'
                        : plan.id === 'premium'
                          ? 'bg-[#D4AF37] text-black hover:bg-[#E6C65C]'
                          : plan.id === 'pro'
                            ? 'bg-[#0057FF] text-white hover:bg-[#1e69ff]'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {!isWindowOpen ? (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1.5" /> Bloqueado (Dias 1-3)
                      </>
                    ) : (
                      <>
                        Mudar para {plan.name} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Confirmar Troca de Plano
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter pt-2">
              Você está prestes a alterar seu plano de profissional na rede 369.
            </DialogDescription>
          </DialogHeader>

          {selectedPlanToChange && (
            <div className="space-y-4 my-2">
              <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-montserrat uppercase">Plano Atual:</span>
                  <span className="font-bold text-gray-300 uppercase">Plano {currentPlan}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[#262626]">
                  <span className="text-gray-400 font-montserrat uppercase">Novo Plano:</span>
                  <span
                    className={`font-black uppercase text-sm ${
                      selectedPlanToChange.id === 'premium'
                        ? 'text-[#D4AF37]'
                        : selectedPlanToChange.id === 'pro'
                          ? 'text-[#0057FF]'
                          : 'text-white'
                    }`}
                  >
                    Plano {selectedPlanToChange.name}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[#262626]">
                  <span className="text-gray-400 font-montserrat uppercase">
                    Nova Tarifa por Serviço:
                  </span>
                  <span className="font-mono font-bold text-white">
                    {selectedPlanToChange.tarifa}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 font-inter leading-relaxed">
                Ao confirmar, seu badge público, suas tarifas por atendimento e os limites de acesso
                à inteligência artificial serão atualizados imediatamente.
              </p>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              disabled={isUpdating}
              className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmChange}
              disabled={isUpdating}
              className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase flex items-center gap-1.5"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Atualizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Alteração
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

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
  mensalidadeAluno?: string
  anualAluno?: string
  mensalidadeProf?: string
  anualProf?: string
  multiplicador: string
  description: string
  benefits: string[]
  recommended?: boolean
  isProParceiro?: boolean
  color: string
  borderColor: string
  badgeColor: string
  icon: React.ComponentType<{ className?: string }>
}

export const ALL_PLANS: PlanConfig[] = [
  {
    id: 'gratis',
    name: 'Grátis',
    tarifa: 'Sem tarifa',
    tarifaValor: 0.0,
    mensalidadeAluno: 'R$ 0 / mês',
    anualAluno: '—',
    multiplicador: '0x',
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
    tarifa: 'R$ 1,00 / serviço (profissional)',
    tarifaValor: 1.0,
    mensalidadeAluno: 'R$ 10 / mês',
    anualAluno: 'R$ 100 / ano (10×)',
    multiplicador: '1x',
    description: 'Ideal para quem busca pontuar com multiplicador 1.0x na rede.',
    benefits: [
      'Multiplicador 1.0x no ranking mensal 369',
      'Sem mensalidade fixa para profissionais (R$ 1,00 por atendimento concluído)',
      'Aluno: R$ 10/mês (ou R$ 100 anual 10x) — Isento se vinculado a profissional',
      'Tarifa operacional de R$ 1,00 por serviço concluído',
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
    tarifa: 'R$ 2,00 / serviço (profissional)',
    tarifaValor: 2.0,
    mensalidadeAluno: 'R$ 20 / mês',
    anualAluno: 'R$ 200 / ano (10×)',
    multiplicador: '2x',
    description: 'Multiplicador 2.0x e recursos avançados para acelerar seus resultados.',
    benefits: [
      'Multiplicador 2.0x no ranking mensal (2x mais rápido)',
      'Sem mensalidade fixa para profissionais (R$ 2,00 por atendimento concluído)',
      'Aluno: R$ 20/mês (ou R$ 200 anual 10x) — Isento se vinculado a profissional',
      'Tarifa operacional de R$ 2,00 por atendimento concluído',
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
    tarifa: 'R$ 3,00 / serviço (profissional)',
    tarifaValor: 3.0,
    mensalidadeAluno: 'R$ 30 / mês',
    anualAluno: 'R$ 300 / ano (10×)',
    multiplicador: '3x',
    description: 'O nível máximo de visibilidade: multiplicador 3.0x e IA ilimitada.',
    benefits: [
      'Multiplicador 3.0x no ranking (aceleração máxima 3x)',
      'Sem mensalidade fixa para profissionais (R$ 3,00 por atendimento concluído)',
      'Aluno: R$ 30/mês (ou R$ 300 anual 10x) — Isento se vinculado a profissional',
      'Tarifa operacional de R$ 3,00 por atendimento concluído',
      'Acesso ILIMITADO a todos os recursos e IA Experts 369',
    ],
    color: 'text-[#D4AF37]',
    borderColor: 'border-[#D4AF37]/50 hover:border-[#D4AF37]',
    badgeColor: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/50',
    icon: Crown,
  },
  {
    id: 'pro_parceiro',
    name: 'PRO Parceiro',
    tarifa: 'R$ 2,00 / serviço + R$ 149/mês',
    tarifaValor: 2.0,
    mensalidadeProf: 'R$ 149 / mês',
    anualProf: 'R$ 1.490 / ano (10×)',
    multiplicador: '1x (Piso 150)',
    description:
      'Plano fixo do profissional com piso de 150 serviços, alunos ilimitados e Radar 369.',
    benefits: [
      'Alunos ILIMITADOS na carteira do parceiro PRO',
      'Multiplicador 1x oficial para parceiro e alunos vinculados',
      'Pontuação com piso fixo garantido: max(serviços reais, 150)',
      'Selo público "Parceiro PRO" em destaque nas buscas e perfil',
      'Acesso exclusivo ao Radar 369 semanal com evidências científicas',
      'Painel de carteira com IA e alertas preditivos de aderência de alunos',
      'Tarifa por serviço concluído: R$ 2,00 (alimenta diretamente o Pool 38%)',
    ],
    isProParceiro: true,
    color: 'text-[#00C853]',
    borderColor: 'border-[#00C853]/50 hover:border-[#00C853]',
    badgeColor: 'bg-[#00C853]/15 text-[#00C853] border-[#00C853]/50',
    icon: Sparkles,
  },
]

export const ALUNO_PLANS: PlanConfig[] = ALL_PLANS.filter((p) => p.id !== 'pro_parceiro')
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
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const isWindowOpen = isPlanChangeWindowOpen()
  const currentDay = new Date().getDate()
  const currentPlan = (user?.plan as PlanTier) || 'basico'
  const isAluno = user?.role === 'aluno'
  const isLinked = Boolean(user?.linked_professional)

  const isFromGratis = currentPlan === 'gratis'

  const plansList = isAluno ? ALUNO_PLANS : PROFISSIONAL_PLANS

  const handleOpenConfirm = (plan: PlanConfig) => {
    // Alunos podem mudar a qualquer momento; para profissionais entre pagos, janela 1 a 3
    if (!isAluno && !isFromGratis && !isWindowOpen) {
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
    if (!isAluno && !isFromGratis && !isPlanChangeWindowOpen()) {
      toast.error('A troca de plano está disponível apenas do dia 1 ao dia 3 de cada mês.')
      setConfirmModalOpen(false)
      return
    }

    setIsUpdating(true)
    try {
      const res = await pb.send('/backend/v1/plans/change', {
        method: 'POST',
        body: {
          plan: selectedPlanToChange.id,
          billing_period: billingPeriod,
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
              <Sparkles className="w-4 h-4 text-[#D4AF37]" /> Assinatura & Planos 369 v2
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-montserrat text-white uppercase">
            {isAluno ? 'Planos & Mensalidade de Aluno' : 'Gerenciamento de Plano Profissional'}
          </h2>
          <p className="text-xs text-gray-400 font-inter mt-1">
            {isAluno
              ? 'Mensalidade fixa sem tarifa por serviço — ou 10× no plano anual. Alunos vinculados possuem isenção total!'
              : 'Escolha seu nível de aceleração ou a assinatura PRO PARCEIRO com piso fixo de pontuação.'}
          </p>
        </div>

        {/* Toggle Período Mensal / Anual (10x) — visível APENAS para Alunos e para PRO PARCEIRO */}
        <div className="flex items-center gap-3">
          {isAluno ? (
            <div className="flex items-center bg-[#101010] p-1 rounded-xl border border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-[#D4AF37] text-black shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('annual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold flex items-center gap-1 transition-all ${
                  billingPeriod === 'annual'
                    ? 'bg-[#D4AF37] text-black shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Anual (10×)
                <span className="bg-emerald-500 text-black text-[9px] px-1.5 py-0.2 rounded-full font-black">
                  2 MESES OFF
                </span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-[11px] text-gray-400 font-inter">
                Período PRO PARCEIRO (R$ 149/mês / R$ 1.490 anual):
              </span>
              <div className="flex items-center bg-[#101010] p-1 rounded-xl border border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold transition-all ${
                    billingPeriod === 'monthly'
                      ? 'bg-[#00C853] text-black shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Mensal (R$ 149)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold transition-all ${
                    billingPeriod === 'annual'
                      ? 'bg-[#00C853] text-black shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Anual (R$ 1.490)
                </button>
              </div>
            </div>
          )}

          {!isAluno && (
            <div>
              {isWindowOpen ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-[11px] font-montserrat font-bold">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Janela Aberta (Dia {currentDay} de 1-3)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[11px] font-montserrat font-bold">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Janela Bloqueada (Dia {currentDay})</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Selo e Aviso de Vínculo do Aluno */}
      {isAluno && isLinked && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase font-montserrat">
              ✓ Grátis enquanto vinculado a um profissional
            </div>
            <p className="text-gray-200 leading-relaxed font-inter">
              Você está vinculado ao profissional mentor da sua carteira. Sua mensalidade é{' '}
              <strong>100% gratuita</strong> durante o vínculo e você pontua com o multiplicador do
              plano do seu mentor!
            </p>
          </div>
        </div>
      )}
      {/* Inadimplência Alert */}
      {user?.subscription_status === 'inadimplente' && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-red-300 font-montserrat uppercase">
              Assinatura Inadimplente — Downgrade Temporário para Plano Grátis (0x)
            </p>
            <p className="text-gray-300 font-inter">
              Sua última mensalidade está pendente. A pontuação no ranking e o cashback estão
              suspensos temporariamente até a confirmação do pagamento.
            </p>
          </div>
        </div>
      )}
      {/* Plan Cards Grid */}
      <div
        className={`grid grid-cols-1 ${plansList.length > 3 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-6 pt-2`}
      >
        {plansList.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const Icon = plan.icon
          const canChange = isAluno || isFromGratis || isWindowOpen

          let displayPrice = plan.tarifa
          let periodLabel = ''
          if (isAluno) {
            if (isLinked) {
              displayPrice = 'R$ 0'
              periodLabel = 'Grátis (Vínculo Ativo)'
            } else {
              displayPrice =
                billingPeriod === 'annual'
                  ? plan.anualAluno || plan.tarifa
                  : plan.mensalidadeAluno || plan.tarifa
              periodLabel = billingPeriod === 'annual' ? '' : ''
            }
          } else if (plan.isProParceiro) {
            displayPrice = billingPeriod === 'annual' ? 'R$ 1.490 / ano' : 'R$ 149 / mês'
            periodLabel = 'Tarifa R$ 2,00/serviço + Mensalidade'
          } else {
            // Planos do profissional (Básico R$ 1, Pro R$ 2, Premium R$ 3) SEM MENSALIDADE FIXA
            displayPrice = `Tarifa R$ ${plan.tarifaValor.toFixed(2).replace('.', ',')} / serviço`
            periodLabel = 'Sem mensalidade fixa'
          }

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

              {/* Recommended or Pro Parceiro Badge */}
              {!isCurrent && plan.isProParceiro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#00C853] text-black font-montserrat font-extrabold text-[10px] uppercase shadow-md">
                  Parceiro PRO
                </div>
              )}
              {!isCurrent && !plan.isProParceiro && plan.recommended && (
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
                        plan.isProParceiro
                          ? 'bg-[#00C853]/10 border-[#00C853]/30 text-[#00C853]'
                          : plan.id === 'premium'
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
                        {plan.name}
                      </h3>
                      <span className="text-[10px] text-gray-400 font-inter uppercase tracking-wider">
                        {plan.multiplicador} Ranking
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price Display */}
                <div className="my-4 p-3 rounded-xl bg-[#0F0F0F] border border-[#222222]">
                  <p className="text-2xl font-black font-montserrat text-white">{displayPrice}</p>
                  {periodLabel && (
                    <p className="text-[11px] font-bold text-emerald-400 font-inter">
                      {periodLabel}
                    </p>
                  )}
                  {isAluno && isLinked && (
                    <div className="mt-2 inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      Selo: Grátis enquanto vinculado a um profissional
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 font-inter mt-1.5">{plan.description}</p>
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
                          plan.isProParceiro
                            ? 'text-[#00C853]'
                            : plan.id === 'premium'
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
                    disabled={!canChange}
                    className={`w-full font-bold text-xs uppercase transition-all shadow-md ${
                      !canChange
                        ? 'bg-[#222222] text-gray-500 border border-gray-800 cursor-not-allowed hover:bg-[#222222]'
                        : plan.isProParceiro
                          ? 'bg-[#00C853] text-black hover:bg-[#00B048]'
                          : plan.id === 'premium'
                            ? 'bg-[#D4AF37] text-black hover:bg-[#E6C65C]'
                            : plan.id === 'pro'
                              ? 'bg-[#0057FF] text-white hover:bg-[#1e69ff]'
                              : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {!canChange ? (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1.5" /> Bloqueado (Dias 1-3)
                      </>
                    ) : (
                      <>
                        {!isAluno && !plan.isProParceiro ? 'Escolher' : 'Assinar'} {plan.name}{' '}
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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
              <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Confirmar Assinatura / Troca de Plano
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter pt-2">
              Você está prestes a atualizar sua modalidade no ecossistema 369TRAINING.
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
                      selectedPlanToChange.isProParceiro
                        ? 'text-[#00C853]'
                        : selectedPlanToChange.id === 'premium'
                          ? 'text-[#D4AF37]'
                          : selectedPlanToChange.id === 'pro'
                            ? 'text-[#0057FF]'
                            : 'text-white'
                    }`}
                  >
                    {selectedPlanToChange.name}
                  </span>
                </div>
                {/* Ciclo Selecionado: apenas para Aluno ou para PRO PARCEIRO */}
                {(isAluno || selectedPlanToChange.isProParceiro) && (
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-[#262626]">
                    <span className="text-gray-400 font-montserrat uppercase">
                      Ciclo Selecionado:
                    </span>
                    <span className="font-mono font-bold text-white">
                      {billingPeriod === 'annual' ? 'Anual 10× (2 meses off)' : 'Mensal Recorrente'}
                    </span>
                  </div>
                )}
                {/* Para profissionais Básico / Pro / Premium: indicar que não há mensalidade */}
                {!isAluno && !selectedPlanToChange.isProParceiro && (
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-[#262626]">
                    <span className="text-gray-400 font-montserrat uppercase">
                      Cobrança Recorrente:
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      R$ 0,00 (Sem mensalidade fixa)
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[#262626]">
                  <span className="text-gray-400 font-montserrat uppercase">Valor a Liquidar:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {isAluno && isLinked
                      ? 'R$ 0,00 (Vínculo Ativo com Profissional)'
                      : isAluno
                        ? billingPeriod === 'annual'
                          ? selectedPlanToChange.anualAluno
                          : selectedPlanToChange.mensalidadeAluno
                        : selectedPlanToChange.isProParceiro
                          ? billingPeriod === 'annual'
                            ? 'R$ 1.490,00 / ano'
                            : 'R$ 149,00 / mês'
                          : `R$ 0,00 (Sem mensalidade fixa — Tarifa R$ ${selectedPlanToChange.tarifaValor.toFixed(2).replace('.', ',')} por serviço)`}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 font-inter leading-relaxed">
                Em conformidade com o <strong>Art. 49 do CDC</strong> e o{' '}
                <strong>Regulamento de Planos e Mensalidades</strong>, você possui 7 dias de
                garantia incondicional de reembolso.
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
                  <CheckCircle2 className="w-4 h-4" />{' '}
                  {!isAluno && !selectedPlanToChange.isProParceiro
                    ? 'Confirmar Escolha de Plano'
                    : 'Confirmar Assinatura'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>{' '}
    </Card>
  )
}

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Lock, Sparkles, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  requiredPlan: 'Básico' | 'Pro' | 'Premium'
  featureName: string
  currentPlanName?: string
}

export const CrmUpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onClose,
  requiredPlan,
  featureName,
  currentPlanName,
}) => {
  const navigate = useNavigate()

  const handleGoToFinance = () => {
    onClose()
    navigate('/profissional/carteira')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#121212] border border-[#2A2A2A] text-white max-w-md p-6">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center mx-auto text-[#D4AF37]">
            <Lock className="w-6 h-6" />
          </div>
          <DialogTitle className="text-center text-base sm:text-lg font-bold font-montserrat uppercase text-white">
            Disponível no plano {requiredPlan}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-gray-300 font-inter leading-relaxed">
            O recurso <strong className="text-white">{featureName}</strong> está disponível
            exclusivamente a partir do{' '}
            <strong className="text-[#D4AF37]">Plano {requiredPlan}</strong>.
            {currentPlanName && (
              <span className="block mt-1 text-[11px] text-gray-400">
                Seu plano atual: <span className="uppercase text-gray-200">{currentPlanName}</span>.
              </span>
            )}
            <span className="block mt-2 text-[#D4AF37] font-semibold">
              Disponível no plano {requiredPlan} — atualize na aba Financeiro
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={handleGoToFinance}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black font-bold text-xs h-10 hover:opacity-95 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Ir para a aba Financeiro
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-xs text-gray-400 hover:text-white h-9"
          >
            Continuar no plano atual
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

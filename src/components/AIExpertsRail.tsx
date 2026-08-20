import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BrainCircuit,
  Film,
  Send,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Bot,
  Zap,
  Loader2,
  Lock,
} from 'lucide-react'
import { api } from '@/services/api'
import { toast } from 'sonner'

interface AIExpertsRailProps {
  planTier?: string
  isOpen: boolean
  onToggle: () => void
}

export const AIExpertsRail: React.FC<AIExpertsRailProps> = ({
  planTier = 'pro',
  isOpen,
  onToggle,
}) => {
  const navigate = useNavigate()

  // Quick Chat Drawer state
  const [activeExpert, setActiveExpert] = useState<'mentor' | 'roteirista' | null>(null)
  const [quickInput, setQuickInput] = useState('')
  const [quickResponse, setQuickResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleQuickAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickInput.trim() || !activeExpert) return

    setLoading(true)
    setQuickResponse(null)
    try {
      const slug = activeExpert === 'mentor' ? 'mentor-expansao-369' : 'roteirista-saude-10'
      const res = await api.expertChat({
        expert_slug: slug,
        message: quickInput,
      })
      setQuickResponse(res.content)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao consultar o Expert.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#181818] border-l border-y border-[#D4AF37] p-2.5 rounded-l-xl text-[#D4AF37] shadow-2xl hover:bg-[#202020] transition-all flex flex-col items-center gap-2 group"
      >
        <Bot className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span className="[writing-mode:vertical-rl] text-[10px] font-bold font-montserrat uppercase tracking-wider text-white">
          AI Experts 369
        </span>
        <ChevronLeft className="w-4 h-4 text-[#D4AF37]" />
      </button>
    )
  }

  return (
    <aside className="w-80 shrink-0 bg-[#141414] border-l border-[#2A2A2A] h-[calc(100vh-70px)] sticky top-[70px] overflow-y-auto p-4 flex flex-col justify-between shadow-2xl z-30 animate-fade-in">
      <div className="space-y-4">
        {/* Rail Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-extrabold font-montserrat text-white text-xs uppercase">
              AI Experts 369
            </h3>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="text-gray-400 hover:text-white text-xs p-1 rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 1. MENTOR DE EXPANSÃO 369 */}
        <Card
          className={`p-4 rounded-xl border transition-all ${
            activeExpert === 'mentor'
              ? 'bg-[#181818] border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.15)]'
              : 'bg-[#181818] border-[#2A2A2A] hover:border-[#D4AF37]/50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] font-montserrat">
              {planTier.toUpperCase()}
            </span>
          </div>

          <h4 className="text-xs font-bold font-montserrat text-white">MENTOR DE EXPANSÃO 369</h4>
          <p className="text-[11px] text-gray-400 font-inter mt-1 leading-tight">
            Crescimento, captação de alunos, precificação e métricas do BackOffice.
          </p>

          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => setActiveExpert(activeExpert === 'mentor' ? null : 'mentor')}
              className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-[10px] h-7"
            >
              {activeExpert === 'mentor' ? 'Fechar' : 'Quick Chat'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/profissional/experts/mentor-expansao-369')}
              className="text-[10px] h-7 border-[#2A2A2A] text-gray-300 hover:text-white"
            >
              Abrir
            </Button>
          </div>
        </Card>

        {/* 2. ROTEIRISTA DE SAÚDE NOTA 10 */}
        <Card
          className={`p-4 rounded-xl border transition-all ${
            activeExpert === 'roteirista'
              ? 'bg-[#181818] border-[#0057FF] shadow-[0_0_15px_rgba(0,87,255,0.15)]'
              : 'bg-[#181818] border-[#2A2A2A] hover:border-[#0057FF]/50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/30 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#0057FF]/10 text-[#0057FF] font-montserrat">
              {planTier.toUpperCase()}
            </span>
          </div>

          <h4 className="text-xs font-bold font-montserrat text-white">ROTEIRISTA NOTA 10</h4>
          <p className="text-[11px] text-gray-400 font-inter mt-1 leading-tight">
            Roteiros de Reels, carrosséis, lives e roteiros de aulas e cursos.
          </p>

          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => setActiveExpert(activeExpert === 'roteirista' ? null : 'roteirista')}
              className="flex-1 bg-[#0057FF] text-white hover:bg-[#1f6cff] font-bold text-[10px] h-7"
            >
              {activeExpert === 'roteirista' ? 'Fechar' : 'Quick Chat'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/profissional/experts/roteirista-saude-10')}
              className="text-[10px] h-7 border-[#2A2A2A] text-gray-300 hover:text-white"
            >
              Abrir
            </Button>
          </div>
        </Card>

        {/* Quick Chat Response Box */}
        {activeExpert && (
          <div className="p-3 rounded-xl bg-[#0B0B0C] border border-[#2A2A2A] space-y-2 animate-fade-in">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-gray-400 font-montserrat">
              <span>Chat Rápido: {activeExpert === 'mentor' ? 'Mentor 369' : 'Roteirista 10'}</span>
            </div>

            {quickResponse && (
              <div className="p-2.5 rounded-lg bg-[#141414] text-[11px] text-gray-300 leading-relaxed font-inter max-h-48 overflow-y-auto border border-[#2A2A2A]">
                {quickResponse}
              </div>
            )}

            <form onSubmit={handleQuickAsk} className="flex gap-1.5">
              <Input
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="Faça uma pergunta rápida..."
                className="bg-[#141414] border-[#2A2A2A] rounded-lg text-xs text-white h-8"
              />
              <Button
                type="submit"
                disabled={loading || !quickInput.trim()}
                className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] h-8 px-2.5 rounded-lg"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            </form>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[#2A2A2A] text-center">
        <span className="text-[10px] text-gray-500 font-inter">
          Skip AI Gateway v2 • Model: Fast
        </span>
      </div>
    </aside>
  )
}

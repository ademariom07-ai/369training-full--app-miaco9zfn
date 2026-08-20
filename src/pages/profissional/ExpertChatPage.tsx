import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BrainCircuit,
  Film,
  Send,
  Sparkles,
  ArrowLeft,
  RotateCcw,
  Zap,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  sender: 'user' | 'expert'
  content: string
  citations?: Array<{ excerpt: string; source_id: string }>
  time: string
}

export default function ExpertChatPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const isMentor = slug === 'mentor-expansao-369'
  const expertName = isMentor ? 'MENTOR DE EXPANSÃO 369' : 'ROTEIRISTA DE SAÚDE NOTA 10'
  const expertIcon = isMentor ? BrainCircuit : Film
  const expertTheme = isMentor ? 'text-[#D4AF37]' : 'text-[#0057FF]'

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'expert',
      content: isMentor
        ? `Olá, Prof. ${user?.name || ''}! Sou seu consultor estratégico de crescimento 369. Posso analisar seus alunos, sugerir estratégias de atração, precificação de consultorias ou otimização de retenção. Como posso impulsionar sua carreira hoje?`
        : `Olá, Prof. ${user?.name || ''}! Sou o Roteirista de Saúde Nota 10. Posso criar roteiros magnéticos de Reels, carrosséis educativos de alta retenção, copys para WhatsApp ou videoaulas completas. Sobre qual tema vamos criar hoje?`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [remainingQuota, setRemainingQuota] = useState<number>(45)
  const [maxQuota, setMaxQuota] = useState<number>(50)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userText = input
    setInput('')

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      content: userText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await api.expertChat({
        expert_slug: slug || 'mentor-expansao-369',
        message: userText,
        conversation_id: conversationId,
      })

      setConversationId(res.conversation_id)
      setRemainingQuota(res.remaining_quota)
      setMaxQuota(res.max_quota)

      const expertMsg: ChatMessage = {
        id: res.message_id || 'exp_' + Date.now(),
        sender: 'expert',
        content: res.content,
        citations: res.citations,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, expertMsg])
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao consultar o Expert.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetConversation = () => {
    setConversationId(null)
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'expert',
        content: 'Nova conversa iniciada. Em que posso te apoiar agora?',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    toast.info('Conversa reiniciada.')
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-4 max-w-4xl mx-auto">
      {/* Top Header Bar */}
      <div className="p-4 rounded-t-2xl bg-[#181818] border border-[#2A2A2A] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/profissional/dashboard')}
            className="text-gray-400 hover:text-white p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              isMentor
                ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                : 'bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/30'
            }`}
          >
            {isMentor ? <BrainCircuit className="w-5 h-5" /> : <Film className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-montserrat text-white">{expertName}</h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                Plano {user?.plan?.toUpperCase() || 'PREMIUM'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-inter">
              Cota restante:{' '}
              <strong className="text-white">
                {remainingQuota} de {maxQuota} interações
              </strong>
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleResetConversation}
          className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Nova Conversa
        </Button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#101010] border-x border-[#2A2A2A]">
        {messages.map((m) => {
          const isMe = m.sender === 'user'
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-2xl text-xs font-inter leading-relaxed ${
                  isMe
                    ? 'bg-[#0057FF] text-white rounded-br-none shadow-md'
                    : 'bg-[#181818] text-gray-200 border border-[#D4AF37]/40 rounded-bl-none shadow-lg'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Citations rendered in gold per spec */}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-[#2A2A2A] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#D4AF37] font-montserrat block">
                      Fontes & Referências 369:
                    </span>
                    {m.citations.map((c, i) => (
                      <p key={i} className="text-[10px] text-[#D4AF37]/80 italic">
                        • {c.excerpt}
                      </p>
                    ))}
                  </div>
                )}

                <span className="block text-right text-[10px] opacity-60 font-mono mt-1">
                  {m.time}
                </span>
              </div>
            </div>
          )
        })}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#D4AF37] font-montserrat">
            <Loader2 className="w-4 h-4 animate-spin" /> O Expert está formulando sua resposta...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-b-2xl">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Pergunte ao ${expertName}...`}
            className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-6 rounded-xl shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

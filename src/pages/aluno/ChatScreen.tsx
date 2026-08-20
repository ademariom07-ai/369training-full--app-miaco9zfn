import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { MessageRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Video, Phone, User, CheckCheck, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ChatScreen() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Identify linked contact (if aluno -> load Carlos; if prof -> load Lucas)
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; role: string }>({
    id: 'carlos_coach',
    name: 'Prof. Carlos Silva',
    role: 'Personal & Nutrição',
  })

  // Load message history
  useEffect(() => {
    if (!user) return

    // Resolve target contact
    pb.collection('users')
      .getList(1, 1, {
        filter:
          user.role === 'aluno' ? 'role = "profissional" && approved = true' : 'role = "aluno"',
      })
      .then((res) => {
        if (res.items.length > 0) {
          const u = res.items[0]
          setTargetUser({ id: u.id, name: u.name, role: u.role })
        }
      })
      .catch(() => {})

    // Fetch initial messages
    pb.collection('messages')
      .getList<MessageRecord>(1, 50, {
        filter: `(sender = "${user.id}" || receiver = "${user.id}")`,
        sort: 'created',
      })
      .then((res) => {
        setMessages(res.items)
      })
      .catch(() => {})

    // Subscribe to realtime messages SSE
    const unsubscribe = pb.collection('messages').subscribe('*', (e) => {
      if (e.action === 'create') {
        const newMsg = e.record as unknown as MessageRecord
        setMessages((prev) => [...prev, newMsg])
      }
    })

    return () => {
      pb.collection('messages').unsubscribe('*')
    }
  }, [user])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !user) return

    setSending(true)
    try {
      await pb.collection('messages').create({
        sender: user.id,
        receiver: targetUser.id,
        content: inputText,
        read: false,
      })
      setInputText('')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao enviar mensagem.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-4">
      {/* Chat Top Bar */}
      <div className="p-4 rounded-t-2xl bg-[#181818] border border-[#2A2A2A] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center font-montserrat text-sm border-2 border-[#D4AF37]">
            {targetUser.name[0]}
          </div>
          <div>
            <h3 className="text-sm font-bold font-montserrat text-white">{targetUser.name}</h3>
            <p className="text-[11px] text-[#22C55E] flex items-center gap-1 font-inter">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              Online • {targetUser.role}
            </p>
          </div>
        </div>

        {/* Videochamada placeholder per spec */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.info('Videochamada em alta definição: Recurso em fase final de testes!')
            }
            className="border-[#2A2A2A] text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37] text-xs flex items-center gap-1.5"
          >
            <Video className="w-4 h-4" />
            <span>Videochamada (em breve)</span>
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#101010] border-x border-[#2A2A2A]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-xs">
            <p className="font-montserrat font-bold text-gray-400 mb-1">
              Início da Conversa Direta
            </p>
            <p className="font-inter">
              Tire dúvidas sobre seus treinos, cargas ou planejamento nutricional.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender === user?.id
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[78%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl text-xs font-inter leading-relaxed ${
                    isMe
                      ? 'bg-[#0057FF] text-white rounded-br-none shadow-[0_4px_15px_rgba(0,87,255,0.25)]'
                      : 'bg-[#181818] text-gray-200 border border-[#D4AF37]/50 rounded-bl-none shadow-md'
                  }`}
                >
                  <p>{m.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75 font-mono">
                    <span>
                      {new Date(m.created).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMe && <CheckCheck className="w-3 h-3 text-[#D4AF37]" />}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-b-2xl">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite sua mensagem para o profissional..."
            className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
          />
          <Button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-5 rounded-xl shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}

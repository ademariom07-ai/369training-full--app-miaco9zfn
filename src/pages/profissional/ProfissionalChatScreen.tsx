import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { MessageRecord } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Send,
  Video,
  Download,
  CheckCheck,
  Loader2,
  Users,
  Search,
  MessageSquare,
  ChevronLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { ChatTermsModal } from '@/components/ChatTermsModal'
import { exportChatToPdf } from '@/lib/chatExport'

interface StudentContact {
  id: string
  name: string
  email: string
  avatar?: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount?: number
}

export default function ProfissionalChatScreen() {
  const { user } = useAuth()
  const { alunoId } = useParams<{ alunoId?: string }>()
  const navigate = useNavigate()

  const [students, setStudents] = useState<StudentContact[]>([])
  const [activeStudent, setActiveStudent] = useState<StudentContact | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Termos do Chat
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [checkingTerms, setCheckingTerms] = useState(true)

  // 1. Check Chat Terms
  useEffect(() => {
    if (!user) return

    setCheckingTerms(true)
    pb.collection('chat_terms_accepted')
      .getFirstListItem(`user_id = "${user.id}"`)
      .then(() => {
        setTermsAccepted(true)
      })
      .catch(() => {
        setTermsAccepted(false)
      })
      .finally(() => {
        setCheckingTerms(false)
      })
  }, [user])

  // 2. Load Students List
  useEffect(() => {
    if (!user) return

    setLoadingStudents(true)
    pb.collection('users')
      .getList<StudentContact>(1, 100, {
        filter: 'role = "aluno"',
        sort: 'name',
      })
      .then((res) => {
        setStudents(res.items)
        if (alunoId) {
          const target = res.items.find((s) => s.id === alunoId)
          if (target) {
            setActiveStudent(target)
          } else if (res.items.length > 0) {
            setActiveStudent(res.items[0])
          }
        } else if (res.items.length > 0) {
          setActiveStudent(res.items[0])
        }
      })
      .catch(() => {
        setStudents([])
      })
      .finally(() => {
        setLoadingStudents(false)
      })
  }, [user, alunoId])

  // 3. Load Active Chat Messages & Subscribe to Realtime
  useEffect(() => {
    if (!user || !activeStudent) return

    // Fetch message history between prof and selected student
    pb.collection('messages')
      .getList<MessageRecord>(1, 100, {
        filter: `(sender = "${user.id}" && receiver = "${activeStudent.id}") || (sender = "${activeStudent.id}" && receiver = "${user.id}")`,
        sort: 'created',
      })
      .then((res) => {
        setMessages(res.items)
      })
      .catch(() => {
        setMessages([])
      })

    // Realtime subscription
    try {
      pb.collection('messages')
        .subscribe('*', (e) => {
          if (e.action === 'create') {
            const newMsg = e.record as unknown as MessageRecord
            if (
              (newMsg.sender === user.id && newMsg.receiver === activeStudent.id) ||
              (newMsg.sender === activeStudent.id && newMsg.receiver === user.id)
            ) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev
                return [...prev, newMsg]
              })
            }
          }
        })
        .catch(() => {})
    } catch {
      // Ignore fallback
    }

    return () => {
      try {
        pb.collection('messages')
          .unsubscribe('*')
          .catch(() => {})
      } catch {
        /* intentionally ignored */
      }
    }
  }, [user, activeStudent])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectStudent = (student: StudentContact) => {
    setActiveStudent(student)
    navigate(`/profissional/chat/${student.id}`)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !user || !activeStudent) return

    setSending(true)
    try {
      await pb.collection('messages').create({
        sender: user.id,
        receiver: activeStudent.id,
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

  const handleExportChat = async () => {
    if (!user || !activeStudent) return
    setExporting(true)
    try {
      const formattedMessages = messages.map((m) => ({
        id: m.id,
        sender_name: m.sender === user.id ? user.name : activeStudent.name,
        content: m.content,
        created: m.created,
      }))

      await exportChatToPdf({
        participants: [user.name, activeStudent.name],
        messages: formattedMessages,
        title: `Histórico Oficial de Atendimento — ${user.name} & ${activeStudent.name}`,
      })
      toast.success('Histórico PDF oficial com hash SHA-256 gerado!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao exportar conversa.')
    } finally {
      setExporting(false)
    }
  }

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (checkingTerms) {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-130px)] flex flex-col pb-2">
      {/* Modal de Termos do Chat */}
      {user && !termsAccepted && (
        <ChatTermsModal
          open={!termsAccepted}
          userId={user.id}
          onAccepted={() => setTermsAccepted(true)}
        />
      )}

      {/* Main Chat Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 h-full overflow-hidden">
        {/* Left Sidebar: Conversations List */}
        <Card className="md:col-span-4 lg:col-span-3 bg-[#181818] border border-[#2A2A2A] rounded-2xl flex flex-col overflow-hidden h-full">
          <div className="p-4 border-b border-[#2A2A2A] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#D4AF37]" /> Mensagens & Alunos
              </h2>
              <span className="text-[10px] bg-[#2A2A2A] text-gray-300 px-2 py-0.5 rounded-full font-mono">
                {students.length} alunos
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar aluno..."
                className="pl-8 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white h-8"
              />
            </div>
          </div>

          {/* Students List Scroll */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingStudents ? (
              <div className="p-6 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                <span>Carregando alunos...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">Nenhum aluno encontrado.</div>
            ) : (
              filteredStudents.map((student) => {
                const isSelected = activeStudent?.id === student.id
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => handleSelectStudent(student)}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[#0057FF]/20 border border-[#0057FF] text-white shadow-md'
                        : 'bg-[#141414]/60 border border-transparent hover:border-[#2A2A2A] text-gray-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#202020] border border-[#2A2A2A] flex items-center justify-center font-bold text-xs text-[#D4AF37] font-montserrat shrink-0">
                      {student.name[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold font-montserrat truncate text-white">
                          {student.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate font-mono">
                        {student.email}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </Card>

        {/* Right Area: Active Chat */}
        <Card className="md:col-span-8 lg:col-span-9 bg-[#181818] border border-[#2A2A2A] rounded-2xl flex flex-col overflow-hidden h-full shadow-2xl">
          {activeStudent ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 px-5 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center font-montserrat text-sm border-2 border-[#D4AF37]">
                    {activeStudent.name[0]?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-montserrat text-white flex items-center gap-2">
                      {activeStudent.name}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/40 text-[#0057FF]">
                        Aluno
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#22C55E] flex items-center gap-1 font-inter">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                      Atendimento Ativo • {activeStudent.email}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportChat}
                    disabled={exporting || messages.length === 0}
                    className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs flex items-center gap-1.5 font-montserrat font-bold"
                  >
                    {exporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Exportar Conversa (PDF)</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.info('Videochamada em alta definição: Recurso em fase final de testes!')
                    }
                    className="hidden sm:flex border-[#2A2A2A] text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37] text-xs items-center gap-1.5"
                  >
                    <Video className="w-4 h-4" />
                    <span>Vídeo</span>
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#101010]">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-xs p-6">
                    <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="font-montserrat font-bold text-gray-300 mb-1">
                      Início da conversa com {activeStudent.name}
                    </p>
                    <p className="font-inter max-w-sm">
                      Envie orientações de treino, tire dúvidas nutricionais ou alinhe a evolução do
                      aluno.
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
                          className={`max-w-[80%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl text-xs font-inter leading-relaxed ${
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

              {/* Chat Input */}
              <div className="p-3 bg-[#181818] border-t border-[#2A2A2A]">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Enviar mensagem para ${activeStudent.name}...`}
                    className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
                  />
                  <Button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-5 rounded-xl shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <Users className="w-12 h-12 text-gray-600 mb-3" />
              <h3 className="font-montserrat font-bold text-white text-base">
                Nenhum aluno selecionado
              </h3>
              <p className="text-xs text-gray-500 font-inter mt-1">
                Escolha um aluno na lista ao lado para iniciar a conversa.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

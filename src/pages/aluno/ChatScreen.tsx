import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { MessageRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Send,
  Video,
  Download,
  CheckCheck,
  Loader2,
  Users,
  Search,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { ChatTermsModal } from '@/components/ChatTermsModal'
import { exportChatToPdf } from '@/lib/chatExport'

interface ProfessionalContact {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  specialties?: string[] | string
  plan?: string
  isLinked?: boolean
}

export default function ChatScreen() {
  const { user } = useAuth()
  const { profId } = useParams<{ profId?: string }>()
  const navigate = useNavigate()

  const [professionals, setProfessionals] = useState<ProfessionalContact[]>([])
  const [activeProf, setActiveProf] = useState<ProfessionalContact | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingProfs, setLoadingProfs] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Termos do Chat
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [checkingTerms, setCheckingTerms] = useState(true)

  // 1. Check terms acceptance
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

  // 2. Load professionals & determine linked professional
  useEffect(() => {
    if (!user) return

    let isMounted = true
    setLoadingProfs(true)

    const fetchAllData = async () => {
      try {
        // Fetch all approved professionals
        const profsRes = await pb.collection('users').getList<ProfessionalContact>(1, 100, {
          filter: 'role = "profissional" && approved = true',
          sort: 'name',
        })

        const allProfs = profsRes.items

        // Find linked professional via appointments or services
        let linkedProfId: string | null = null

        // Try appointments sorted by updated/created descending
        try {
          const appRes = await pb.collection('appointments').getList(1, 1, {
            filter: `aluno = "${user.id}"`,
            sort: '-updated,-created',
          })
          if (appRes.items.length > 0 && appRes.items[0].profissional) {
            linkedProfId = appRes.items[0].profissional
          }
        } catch {
          // Ignora se não houver appointments
        }

        // Try services sorted by updated/created descending
        if (!linkedProfId) {
          try {
            const srvRes = await pb.collection('services').getList(1, 1, {
              filter: `student = "${user.id}"`,
              sort: '-updated,-created',
            })
            if (srvRes.items.length > 0 && srvRes.items[0].professional) {
              linkedProfId = srvRes.items[0].professional
            }
          } catch {
            // Ignora se não houver services
          }
        }

        // Mark isLinked
        const mappedProfs = allProfs.map((p) => ({
          ...p,
          isLinked: linkedProfId ? p.id === linkedProfId : false,
        }))

        // Sort: linked first, then alphabetical
        mappedProfs.sort((a, b) => {
          if (a.isLinked && !b.isLinked) return -1
          if (!a.isLinked && b.isLinked) return 1
          return a.name.localeCompare(b.name)
        })

        if (!isMounted) return
        setProfessionals(mappedProfs)

        // Select active professional:
        // Priority 1: profId from URL params
        // Priority 2: linked professional (if user has a linked one)
        // Priority 3: none (show list to let student choose)
        if (profId) {
          const target = mappedProfs.find((p) => p.id === profId)
          if (target) {
            setActiveProf(target)
          } else if (mappedProfs.length > 0) {
            setActiveProf(mappedProfs[0])
          }
        } else if (linkedProfId) {
          const linked = mappedProfs.find((p) => p.id === linkedProfId)
          if (linked) {
            setActiveProf(linked)
          }
        }
      } catch (err) {
        console.error('Erro ao buscar profissionais:', err)
        if (isMounted) setProfessionals([])
      } finally {
        if (isMounted) setLoadingProfs(false)
      }
    }

    fetchAllData()

    return () => {
      isMounted = false
    }
  }, [user, profId])

  // 3. Load active chat messages & subscribe to realtime
  useEffect(() => {
    if (!user || !activeProf) {
      setMessages([])
      return
    }

    pb.collection('messages')
      .getList<MessageRecord>(1, 100, {
        filter: `(sender = "${user.id}" && receiver = "${activeProf.id}") || (sender = "${activeProf.id}" && receiver = "${user.id}")`,
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
              (newMsg.sender === user.id && newMsg.receiver === activeProf.id) ||
              (newMsg.sender === activeProf.id && newMsg.receiver === user.id)
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
      // Ignora erro de realtime
    }

    return () => {
      try {
        pb.collection('messages')
          .unsubscribe('*')
          .catch(() => {})
      } catch {
        // Ignora erro
      }
    }
  }, [user, activeProf])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectProf = (prof: ProfessionalContact) => {
    setActiveProf(prof)
    navigate(`/aluno/chat/${prof.id}`)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !user || !activeProf) return

    setSending(true)
    try {
      await pb.collection('messages').create({
        sender: user.id,
        receiver: activeProf.id,
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
    if (!user || !activeProf) return
    setExporting(true)
    try {
      const formattedMessages = messages.map((m) => ({
        id: m.id,
        sender_name: m.sender === user.id ? user.name : activeProf.name,
        content: m.content,
        created: m.created,
      }))

      await exportChatToPdf({
        participants: [user.name, activeProf.name],
        messages: formattedMessages,
        title: `Histórico de Conversa — ${user.name} & ${activeProf.name}`,
      })
      toast.success('Documento PDF com hash SHA-256 gerado com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao exportar conversa em PDF.')
    } finally {
      setExporting(false)
    }
  }

  const filteredProfs = professionals.filter((p) => {
    const q = searchTerm.toLowerCase()
    const nameMatch = p.name.toLowerCase().includes(q)
    const emailMatch = p.email?.toLowerCase().includes(q)
    const specMatch = Array.isArray(p.specialties)
      ? p.specialties.some((s) => s.toLowerCase().includes(q))
      : typeof p.specialties === 'string' && p.specialties.toLowerCase().includes(q)
    return nameMatch || emailMatch || specMatch
  })

  const getSpecialtyLabel = (prof: ProfessionalContact) => {
    if (Array.isArray(prof.specialties) && prof.specialties.length > 0) {
      return prof.specialties.join(', ')
    }
    if (typeof prof.specialties === 'string' && prof.specialties) {
      return prof.specialties
    }
    return 'Profissional'
  }

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

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 h-full overflow-hidden">
        {/* Left Sidebar: Professionals List */}
        <Card className="md:col-span-4 lg:col-span-3 bg-[#181818] border border-[#2A2A2A] rounded-2xl flex flex-col overflow-hidden h-full">
          <div className="p-4 border-b border-[#2A2A2A] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#D4AF37]" /> Profissionais
              </h2>
              <span className="text-[10px] bg-[#2A2A2A] text-gray-300 px-2 py-0.5 rounded-full font-mono">
                {professionals.length} disponíveis
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou especialidade..."
                className="pl-8 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white h-8"
              />
            </div>
          </div>

          {/* Professionals List Scroll */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingProfs ? (
              <div className="p-6 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                <span>Carregando profissionais...</span>
              </div>
            ) : filteredProfs.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                Nenhum profissional encontrado.
              </div>
            ) : (
              filteredProfs.map((prof) => {
                const isSelected = activeProf?.id === prof.id
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => handleSelectProf(prof)}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[#0057FF]/20 border border-[#0057FF] text-white shadow-md'
                        : 'bg-[#141414]/60 border border-transparent hover:border-[#2A2A2A] text-gray-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#202020] border border-[#2A2A2A] flex items-center justify-center font-bold text-xs text-[#D4AF37] font-montserrat shrink-0">
                      {prof.name?.[0]?.toUpperCase() || 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold font-montserrat truncate text-white">
                          {prof.name}
                        </span>
                        {prof.isLinked && (
                          <span className="shrink-0 text-[9px] bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 px-1.5 py-0.2 rounded font-mono font-medium">
                            Seu Profissional
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 truncate font-inter">
                        {getSpecialtyLabel(prof)}
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
          {activeProf ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 px-5 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center font-montserrat text-sm border-2 border-[#D4AF37]">
                    {activeProf.name?.[0]?.toUpperCase() || 'P'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-montserrat text-white flex items-center gap-2">
                      {activeProf.name}
                      {activeProf.isLinked && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Vinculado
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-[#22C55E] flex items-center gap-1 font-inter">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                      Online • {getSpecialtyLabel(activeProf)}
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
                      Início da conversa com {activeProf.name}
                    </p>
                    <p className="font-inter max-w-sm">
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
                    placeholder={`Enviar mensagem para ${activeProf.name}...`}
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
                Nenhum profissional selecionado
              </h3>
              <p className="text-xs text-gray-500 font-inter mt-1">
                Escolha um profissional na lista ao lado para iniciar a conversa.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

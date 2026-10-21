import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { MessageRecord } from '@/services/api'
import { useChatMessages, type ChatMessage } from '@/hooks/use-chat-messages'
import { useRealtime } from '@/hooks/use-realtime'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Send,
  Video,
  Download,
  Check,
  CheckCheck,
  Loader2,
  Users,
  Search,
  MessageSquare,
  Sparkles,
  Flag,
  ChevronLeft,
  Headphones,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { ChatTermsModal } from '@/components/ChatTermsModal'
import { exportChatToPdf } from '@/lib/chatExport'
import { ReportMessageModal } from '@/components/ReportMessageModal'

interface ProfessionalContact {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  specialties?: string[] | string
  plan?: string
  isSupport?: boolean
  isLinked?: boolean
  unreadCount?: number
}

export default function ChatScreen() {
  const { user } = useAuth()
  const { profId } = useParams<{ profId?: string }>()
  const navigate = useNavigate()

  const [professionals, setProfessionals] = useState<ProfessionalContact[]>([])
  const [activeProf, setActiveProf] = useState<ProfessionalContact | null>(null)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingProfs, setLoadingProfs] = useState(true)
  const [mobileShowConversation, setMobileShowConversation] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Denúncia de mensagem
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportingMsg, setReportingMsg] = useState<MessageRecord | null>(null)

  // Termos do Chat
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [checkingTerms, setCheckingTerms] = useState(true)

  // 1. Check terms acceptance (suporta chat_terms_accepted e chat_terms_acceptances)
  useEffect(() => {
    if (!user) return

    let isMounted = true
    setCheckingTerms(true)

    const checkTerms = async () => {
      try {
        await pb.collection('chat_terms_accepted').getFirstListItem(`user_id = "${user.id}"`)
        if (isMounted) setTermsAccepted(true)
      } catch {
        try {
          await pb.collection('chat_terms_acceptances').getFirstListItem(`user = "${user.id}"`)
          if (isMounted) setTermsAccepted(true)
        } catch {
          if (isMounted) setTermsAccepted(false)
        }
      } finally {
        if (isMounted) setCheckingTerms(false)
      }
    }

    checkTerms()

    return () => {
      isMounted = false
    }
  }, [user])

  const activeProfRef = useRef<ProfessionalContact | null>(null)
  activeProfRef.current = activeProf

  // 2. Load professionals & determine linked professional (UMA vez ao montar a tela)
  useEffect(() => {
    if (!user) return

    let isMounted = true
    setLoadingProfs(true)

    const fetchAllData = async () => {
      try {
        // 1. Fetch Admin Support User (Ademario / Superadmin)
        let supportContact: ProfessionalContact | null = null
        try {
          const adminRes = await pb.collection('users').getList<ProfessionalContact>(1, 5, {
            filter: 'role = "admin"',
            sort: 'created',
          })
          if (adminRes.items.length > 0) {
            // Prioriza Ademario se existir na lista, senão o primeiro admin
            const mainAdmin =
              adminRes.items.find((a) => a.email === 'ademariom07@gmail.com') || adminRes.items[0]
            supportContact = {
              ...mainAdmin,
              name: 'Suporte',
              specialties: ['Central Oficial 369WELLNESS', 'Atendimento & Dúvidas'],
              isSupport: true,
            }
          }
        } catch (errAdmin) {
          console.warn('Não foi possível carregar contato de Suporte:', errAdmin)
        }

        // 2. Fetch all approved professionals
        const profsRes = await pb.collection('users').getList<ProfessionalContact>(1, 100, {
          filter: 'role = "profissional" && approved = true',
          sort: 'name',
        })

        const allProfs = profsRes.items

        // Find linked professional via user profile, appointments or services
        let linkedProfId: string | null = (user as any).linked_professional || null

        // Fallback: check appointments
        if (!linkedProfId) {
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
        }

        // Fallback: check services
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

        // Buscar mensagens não lidas recebidas de cada profissional
        const unreadCountsBySender: Record<string, number> = {}
        try {
          const unreadRes = await pb.collection('messages').getList<MessageRecord>(1, 200, {
            filter: `receiver = "${user.id}" && read = false`,
          })
          unreadRes.items.forEach((m) => {
            unreadCountsBySender[m.sender] = (unreadCountsBySender[m.sender] || 0) + 1
          })
        } catch {
          // Mantém contagem zerada se falhar
        }

        // Mark isLinked e unreadCount
        const mappedProfs = allProfs.map((p) => ({
          ...p,
          isLinked: linkedProfId ? p.id === linkedProfId : false,
          unreadCount: unreadCountsBySender[p.id] || 0,
        }))

        // Sort: linked first, then alphabetical
        mappedProfs.sort((a, b) => {
          if (a.isLinked && !b.isLinked) return -1
          if (!a.isLinked && b.isLinked) return 1
          return a.name.localeCompare(b.name)
        })

        // Lista final: Suporte sempre no topo, seguido dos profissionais
        const finalContacts: ProfessionalContact[] = []
        if (supportContact) {
          finalContacts.push({
            ...supportContact,
            unreadCount: unreadCountsBySender[supportContact.id] || 0,
          })
        }
        finalContacts.push(...mappedProfs)

        if (!isMounted) return
        setProfessionals(finalContacts)

        // Select active professional:
        // Priority 1: profId from URL params
        // Priority 2: linked professional (if user has a linked one)
        // Priority 3: none (show list to let student choose)
        if (profId) {
          const target = finalContacts.find((p) => p.id === profId)
          if (target) {
            setActiveProf(target)
            setMobileShowConversation(true)
          } else if (finalContacts.length > 0) {
            setActiveProf(finalContacts[0])
          }
        } else if (linkedProfId) {
          const linked = mappedProfs.find((p) => p.id === linkedProfId)
          if (linked) {
            setActiveProf(linked)
          } else if (finalContacts.length > 0) {
            setActiveProf(finalContacts[0])
          }
        } else if (finalContacts.length > 0) {
          setActiveProf((cur) => cur || finalContacts[0])
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
  }, [user?.id])

  // Sincroniza activeProf caso o profId na URL mude sem recarregar a lista
  useEffect(() => {
    if (!profId || professionals.length === 0) return
    const target = professionals.find((p) => p.id === profId)
    if (target && target.id !== activeProf?.id) {
      setActiveProf(target)
      setMobileShowConversation(true)
    }
  }, [profId, professionals])

  // Atualizar contadores de unread em tempo real sem refetch
  useRealtime<MessageRecord>(
    'messages',
    (e) => {
      if (!user) return
      const msg = e.record
      if (msg.receiver !== user.id) return

      const currentActive = activeProfRef.current

      if (e.action === 'create') {
        if (currentActive && msg.sender === currentActive.id) {
          // Se a mensagem for do contato ativo, já foi/será marcada como lida pelo useChatMessages
          setProfessionals((prev) =>
            prev.map((p) => (p.id === msg.sender ? { ...p, unreadCount: 0 } : p)),
          )
        } else {
          setProfessionals((prev) =>
            prev.map((p) =>
              p.id === msg.sender ? { ...p, unreadCount: (p.unreadCount || 0) + 1 } : p,
            ),
          )
        }
      } else if (e.action === 'update' && msg.read) {
        setProfessionals((prev) =>
          prev.map((p) => {
            if (p.id === msg.sender) {
              return { ...p, unreadCount: Math.max(0, (p.unreadCount || 1) - 1) }
            }
            return p
          }),
        )
      }
    },
    !!user?.id,
  )

  // 3. Mensagens da conversa ativa (histórico, tempo real e checagem de reserva)
  const { messages, setMessages, addMessage } = useChatMessages(user?.id, activeProf?.id)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectProf = (prof: ProfessionalContact) => {
    setActiveProf(prof)
    setMobileShowConversation(true)
    navigate(`/aluno/chat/${prof.id}`)
    setProfessionals((prev) => prev.map((p) => (p.id === prof.id ? { ...p, unreadCount: 0 } : p)))
  }

  const handleBackToList = () => {
    setMobileShowConversation(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || !user || !activeProf) return

    if (trimmed.length > 2000) {
      toast.error('A mensagem excede o limite máximo de 2.000 caracteres.')
      return
    }

    setSending(true)
    try {
      const sent = await pb.collection('messages').create<ChatMessage>({
        sender: user.id,
        receiver: activeProf.id,
        content: inputText,
        read: false,
      })
      addMessage(sent)
      setInputText('')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao enviar mensagem.')
    } finally {
      setSending(false)
    }
  }

  const handleOpenReport = (msg: MessageRecord) => {
    setReportingMsg(msg)
    setReportModalOpen(true)
  }

  const handleConfirmReport = async (msgId: string, reason: string) => {
    try {
      await pb.collection('messages').update(msgId, {
        reported: true,
        report_reason: reason,
      })
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reported: true, report_reason: reason } : m)),
      )
      toast.success('Denúncia registrada com sucesso para auditoria da moderação.')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao registrar denúncia.')
      throw err
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
    const q = (searchTerm || '').trim().toLowerCase()
    if (!q) return true
    const nameStr = (p.name || '').toLowerCase()
    const emailStr = (p.email || '').toLowerCase()
    const nameMatch = nameStr.includes(q)
    const emailMatch = emailStr.includes(q)
    const specMatch = Array.isArray(p.specialties)
      ? p.specialties.some((s) => (s || '').toLowerCase().includes(q))
      : typeof p.specialties === 'string' && (p.specialties || '').toLowerCase().includes(q)
    return nameMatch || emailMatch || specMatch
  })

  const getSpecialtyLabel = (prof: ProfessionalContact) => {
    if (prof.isSupport) {
      return 'Central Oficial 369WELLNESS'
    }
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
    <div className="h-[calc(100vh-140px)] sm:h-[calc(100vh-130px)] flex flex-col pb-2">
      {/* Modal de Termos do Chat */}
      {user && !termsAccepted && (
        <ChatTermsModal
          open={!termsAccepted}
          userId={user.id}
          onAccepted={() => setTermsAccepted(true)}
        />
      )}

      {/* Modal de Denúncia de Mensagem */}
      <ReportMessageModal
        open={reportModalOpen}
        messageId={reportingMsg?.id || null}
        messageContent={reportingMsg?.content}
        senderName={reportingMsg?.sender === user?.id ? user.name : activeProf?.name}
        onClose={() => {
          setReportModalOpen(false)
          setReportingMsg(null)
        }}
        onConfirmReport={handleConfirmReport}
      />

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 h-full overflow-hidden">
        {/* Left Sidebar: Professionals List */}
        <Card
          className={`md:col-span-4 lg:col-span-3 bg-[#181818] border border-[#2A2A2A] rounded-2xl flex flex-col overflow-hidden h-full ${
            mobileShowConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3 sm:p-4 border-b border-[#2A2A2A] space-y-3">
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
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs font-montserrat shrink-0 border ${
                        prof.isSupport
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                          : 'bg-[#202020] border-[#2A2A2A] text-[#D4AF37]'
                      }`}
                    >
                      {prof.isSupport ? (
                        <Headphones className="w-4 h-4 text-[#D4AF37]" />
                      ) : (
                        prof.name?.[0]?.toUpperCase() || 'P'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold font-montserrat truncate text-white flex items-center gap-1.5">
                          {prof.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {prof.isSupport && (
                            <span className="text-[9px] bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" /> Suporte
                            </span>
                          )}
                          {prof.isLinked && !prof.isSupport && (
                            <span className="text-[9px] bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 px-1.5 py-0.2 rounded font-mono font-medium">
                              Seu Profissional
                            </span>
                          )}
                          {(prof.unreadCount || 0) > 0 && (
                            <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-[10px] flex items-center justify-center font-mono animate-pulse shadow-sm">
                              {prof.unreadCount}
                            </span>
                          )}
                        </div>
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
        <Card
          className={`md:col-span-8 lg:col-span-9 bg-[#181818] border border-[#2A2A2A] rounded-2xl flex flex-col overflow-hidden h-full shadow-2xl ${
            mobileShowConversation ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeProf ? (
            <>
              {/* Chat Header */}
              <div className="p-3 sm:p-3.5 sm:px-5 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="md:hidden p-1.5 rounded-lg bg-[#202020] text-gray-300 hover:text-white"
                    aria-label="Voltar para lista de profissionais"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center font-montserrat text-xs sm:text-sm border-2 border-[#D4AF37] shrink-0">
                    {activeProf.isSupport ? (
                      <Headphones className="w-4 h-4 text-black" />
                    ) : (
                      activeProf.name?.[0]?.toUpperCase() || 'P'
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold font-montserrat text-white flex items-center gap-1.5 truncate">
                      <span className="truncate">{activeProf.name}</span>
                      {activeProf.isSupport ? (
                        <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center gap-1 shrink-0 font-bold">
                          <Shield className="w-2.5 h-2.5" /> Suporte
                        </span>
                      ) : activeProf.isLinked ? (
                        <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] flex items-center gap-1 shrink-0">
                          <Sparkles className="w-2.5 h-2.5" /> Vinculado
                        </span>
                      ) : null}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-[#22C55E] flex items-center gap-1 font-inter truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
                      <span className="truncate">Online • {getSpecialtyLabel(activeProf)}</span>
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
                      {activeProf.isSupport
                        ? 'Envie sua mensagem para o Suporte da 369WELLNESS. O atendimento é direto entre você e o admin.'
                        : 'Tire dúvidas sobre seus treinos, cargas ou planejamento nutricional.'}
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
                          className={`relative group max-w-[80%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl text-xs font-inter leading-relaxed ${
                            isMe
                              ? 'bg-[#0057FF] text-white rounded-br-none shadow-[0_4px_15px_rgba(0,87,255,0.25)]'
                              : 'bg-[#181818] text-gray-200 border border-[#D4AF37]/50 rounded-bl-none shadow-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>

                          <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-white/10 text-[10px] opacity-80 font-mono">
                            {/* Botão de Denúncia (Report) */}
                            {m.reported ? (
                              <span className="inline-flex items-center gap-1 text-red-400 font-semibold font-montserrat">
                                <Flag className="w-3 h-3 fill-red-400" /> Denunciada
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenReport(m)}
                                title="Denunciar mensagem à moderação"
                                className="opacity-60 hover:opacity-100 text-gray-300 hover:text-red-400 inline-flex items-center gap-1 transition-colors"
                              >
                                <Flag className="w-3 h-3" />
                                <span className="hidden group-hover:inline text-[9px] font-sans">
                                  Denunciar
                                </span>
                              </button>
                            )}

                            <div className="flex items-center gap-1 ml-auto">
                              <span>
                                {new Date(m.created).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isMe &&
                                (m.read ? (
                                  <span title="Lida">
                                    <CheckCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                                  </span>
                                ) : (
                                  <span title="Enviada">
                                    <Check className="w-3.5 h-3.5 text-white/70" />
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-2.5 sm:p-3 bg-[#181818] border-t border-[#2A2A2A]">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={`Enviar mensagem para ${activeProf.name}...`}
                      maxLength={2000}
                      className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white pr-12 h-10"
                    />
                    {inputText.length > 1500 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono">
                        {2000 - inputText.length}
                      </span>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-4 sm:px-5 h-10 rounded-xl shrink-0"
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

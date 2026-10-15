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
  Download,
  Check,
  CheckCheck,
  Loader2,
  Users,
  Search,
  MessageSquare,
  ChevronLeft,
  Flag,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportChatToPdf } from '@/lib/chatExport'
import { ReportMessageModal } from '@/components/ReportMessageModal'

interface AdminChatContact {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  lastMessage?: string
  unreadCount?: number
}

export default function AdminChat() {
  const { user } = useAuth()
  const { contactId } = useParams<{ contactId?: string }>()
  const navigate = useNavigate()

  const [contacts, setContacts] = useState<AdminChatContact[]>([])
  const [activeContact, setActiveContact] = useState<AdminChatContact | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'todos' | 'aluno' | 'profissional'>('todos')
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [mobileShowConversation, setMobileShowConversation] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Denúncia / Moderação rápida
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportingMsg, setReportingMsg] = useState<MessageRecord | null>(null)

  // 1. Carregar lista de usuários (alunos e profissionais) com quem o admin pode conversar
  useEffect(() => {
    if (!user) return

    setLoadingContacts(true)
    const fetchContacts = async () => {
      try {
        const [usersRes, unreadRes] = await Promise.all([
          pb.collection('users').getList<AdminChatContact>(1, 150, {
            filter: `id != "${user.id}"`,
            sort: 'name',
          }),
          pb.collection('messages').getList<MessageRecord>(1, 200, {
            filter: `receiver = "${user.id}" && read = false`,
          }),
        ])

        const unreadCountsBySender: Record<string, number> = {}
        unreadRes.items.forEach((m) => {
          unreadCountsBySender[m.sender] = (unreadCountsBySender[m.sender] || 0) + 1
        })

        const mapped = usersRes.items.map((u) => ({
          ...u,
          unreadCount: unreadCountsBySender[u.id] || 0,
        }))

        setContacts(mapped)

        if (contactId) {
          const target = mapped.find((c) => c.id === contactId)
          if (target) {
            setActiveContact(target)
            setMobileShowConversation(true)
          } else if (mapped.length > 0) {
            setActiveContact(mapped[0])
          }
        } else if (mapped.length > 0) {
          setActiveContact(mapped[0])
        }
      } catch (err) {
        console.warn('Erro ao carregar contatos do chat admin:', err)
        setContacts([])
      } finally {
        setLoadingContacts(false)
      }
    }

    fetchContacts()
  }, [user, contactId])

  // 2. Carregar mensagens da conversa ativa + Realtime
  useEffect(() => {
    if (!user || !activeContact) return

    const markIncomingAsRead = (list: MessageRecord[]) => {
      const unreadIncoming = list.filter((m) => m.receiver === user.id && !m.read)
      unreadIncoming.forEach((m) => {
        pb.collection('messages')
          .update(m.id, { read: true })
          .catch(() => {})
      })
      if (unreadIncoming.length > 0) {
        setContacts((prev) =>
          prev.map((c) => (c.id === activeContact.id ? { ...c, unreadCount: 0 } : c)),
        )
      }
    }

    pb.collection('messages')
      .getList<MessageRecord>(1, 100, {
        filter: `(sender = "${user.id}" && receiver = "${activeContact.id}") || (sender = "${activeContact.id}" && receiver = "${user.id}")`,
        sort: 'created',
      })
      .then((res) => {
        setMessages(res.items)
        markIncomingAsRead(res.items)
      })
      .catch(() => {
        setMessages([])
      })

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    pb.collection('messages')
      .subscribe('*', (e) => {
        const changedMsg = e.record as unknown as MessageRecord
        const isCurrentConv =
          (changedMsg.sender === user.id && changedMsg.receiver === activeContact.id) ||
          (changedMsg.sender === activeContact.id && changedMsg.receiver === user.id)

        if (e.action === 'create') {
          if (isCurrentConv) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === changedMsg.id)) return prev
              return [...prev, changedMsg]
            })
            if (changedMsg.receiver === user.id) {
              pb.collection('messages')
                .update(changedMsg.id, { read: true })
                .catch(() => {})
            }
          } else if (changedMsg.receiver === user.id) {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === changedMsg.sender ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c,
              ),
            )
          }
        } else if (e.action === 'update' && isCurrentConv) {
          setMessages((prev) => prev.map((m) => (m.id === changedMsg.id ? changedMsg : m)))
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch((err) => {
        console.warn('[Admin Chat Realtime] Ignorando erro silenciosamente:', err?.message || err)
      })

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      } else {
        pb.collection('messages')
          .unsubscribe('*')
          .catch(() => {})
      }
    }
  }, [user, activeContact])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectContact = (contact: AdminChatContact) => {
    setActiveContact(contact)
    setMobileShowConversation(true)
    navigate(`/admin/chat/${contact.id}`)
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, unreadCount: 0 } : c)))
  }

  const handleBackToList = () => {
    setMobileShowConversation(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || !user || !activeContact) return

    if (trimmed.length > 2000) {
      toast.error('A mensagem excede o limite máximo de 2.000 caracteres.')
      return
    }

    setSending(true)
    try {
      await pb.collection('messages').create({
        sender: user.id,
        receiver: activeContact.id,
        content: trimmed,
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
      toast.success('Mensagem sinalizada para a fila de moderação.')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao reportar mensagem.')
      throw err
    }
  }

  const handleExportChat = async () => {
    if (!user || !activeContact) return
    setExporting(true)
    try {
      const formattedMessages = messages.map((m) => ({
        id: m.id,
        sender_name: m.sender === user.id ? user.name || 'Administrador' : activeContact.name,
        content: m.content,
        created: m.created,
      }))

      await exportChatToPdf({
        participants: [user.name || 'Administrador', activeContact.name],
        messages: formattedMessages,
        title: `Histórico Oficial de Comunicação — Admin & ${activeContact.name}`,
      })
      toast.success('Histórico PDF oficial exportado!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao exportar conversa.')
    } finally {
      setExporting(false)
    }
  }

  const filteredContacts = contacts.filter((c) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    const matchesRole = roleFilter === 'todos' || c.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="h-[calc(100vh-140px)] sm:h-[calc(100vh-130px)] flex flex-col pb-2">
      <ReportMessageModal
        open={reportModalOpen}
        messageId={reportingMsg?.id || null}
        messageContent={reportingMsg?.content}
        senderName={reportingMsg?.sender === user?.id ? user.name : activeContact?.name}
        onClose={() => {
          setReportModalOpen(false)
          setReportingMsg(null)
        }}
        onConfirmReport={handleConfirmReport}
      />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 h-full overflow-hidden">
        {/* Left Sidebar: Contacts List */}
        <Card
          className={`md:col-span-4 lg:col-span-3 bg-[#181818] border border-[#2A2A2A] rounded-2xl flex flex-col overflow-hidden h-full ${
            mobileShowConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3 sm:p-4 border-b border-[#2A2A2A] space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold font-montserrat text-white uppercase flex items-center gap-1.5 sm:gap-2">
                <MessageSquare className="w-4 h-4 text-[#D4AF37]" /> Chat Direto
              </h2>
              <span className="text-[10px] bg-[#2A2A2A] text-gray-300 px-2 py-0.5 rounded-full font-mono">
                {filteredContacts.length}
              </span>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] text-[10px] font-bold font-montserrat uppercase">
              <button
                type="button"
                onClick={() => setRoleFilter('todos')}
                className={`flex-1 py-1 rounded-lg transition-colors ${
                  roleFilter === 'todos'
                    ? 'bg-[#D4AF37] text-black font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('aluno')}
                className={`flex-1 py-1 rounded-lg transition-colors ${
                  roleFilter === 'aluno'
                    ? 'bg-[#0057FF] text-white font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Alunos
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('profissional')}
                className={`flex-1 py-1 rounded-lg transition-colors ${
                  roleFilter === 'profissional'
                    ? 'bg-emerald-600 text-white font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Parceiros
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar usuário..."
                className="pl-8 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white h-8"
              />
            </div>
          </div>

          {/* Contacts List Scroll */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {loadingContacts ? (
              <div className="p-6 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                <span>Carregando usuários...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                Nenhum usuário encontrado.
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = activeContact?.id === contact.id
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full p-2.5 sm:p-3 rounded-xl text-left transition-all flex items-center gap-2.5 sm:gap-3 ${
                      isSelected
                        ? 'bg-[#0057FF]/20 border border-[#0057FF] text-white shadow-md'
                        : 'bg-[#141414]/60 border border-transparent hover:border-[#2A2A2A] text-gray-300'
                    }`}
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#202020] border border-[#2A2A2A] flex items-center justify-center font-bold text-xs text-[#D4AF37] font-montserrat shrink-0">
                      {contact.name[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold font-montserrat truncate text-white">
                          {contact.name}
                        </span>
                        {(contact.unreadCount || 0) > 0 && (
                          <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-600 text-white font-bold text-[9px] sm:text-[10px] flex items-center justify-center font-mono animate-pulse shadow-sm shrink-0">
                            {contact.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                        <span className="truncate font-mono">{contact.email}</span>
                        <span className="uppercase text-[9px] font-bold font-montserrat px-1.5 py-0.2 rounded bg-white/5 shrink-0">
                          {contact.role}
                        </span>
                      </div>
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
          {activeContact ? (
            <>
              {/* Chat Header */}
              <div className="p-3 sm:p-3.5 sm:px-5 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="md:hidden p-1.5 rounded-lg bg-[#202020] text-gray-300 hover:text-white"
                    aria-label="Voltar para lista de contatos"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center font-montserrat text-xs sm:text-sm border-2 border-[#D4AF37] shrink-0">
                    {activeContact.name[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold font-montserrat text-white flex items-center gap-1.5 truncate">
                      <span className="truncate">{activeContact.name}</span>
                      <span className="text-[9px] sm:text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#0057FF]/20 border border-[#0057FF]/40 text-[#0057FF] shrink-0">
                        {activeContact.role}
                      </span>
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-gray-400 truncate font-mono">
                      {activeContact.email}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportChat}
                    disabled={exporting || messages.length === 0}
                    className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs flex items-center gap-1 font-montserrat font-bold px-2.5 sm:px-3 h-8"
                  >
                    {exporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Exportar PDF</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/admin/chat-moderacao')}
                    className="border-[#2A2A2A] text-gray-300 hover:text-[#D4AF37] text-xs items-center gap-1 px-2 sm:px-3 h-8 hidden sm:inline-flex"
                    title="Ir para moderação de denúncias"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Moderação</span>
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-[#101010] custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-xs p-6">
                    <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="font-montserrat font-bold text-gray-300 mb-1">
                      Início da conversa com {activeContact.name}
                    </p>
                    <p className="font-inter max-w-sm text-gray-400">
                      Como administrador, você pode trocar suporte, avisos operacionais ou tirar
                      dúvidas diretamente com este usuário.
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
                          className={`relative group max-w-[85%] sm:max-w-[70%] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs font-inter leading-relaxed ${
                            isMe
                              ? 'bg-[#0057FF] text-white rounded-br-none shadow-[0_4px_15px_rgba(0,87,255,0.25)]'
                              : 'bg-[#181818] text-gray-200 border border-[#D4AF37]/50 rounded-bl-none shadow-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>

                          <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-white/10 text-[10px] opacity-80 font-mono">
                            {m.reported ? (
                              <span className="inline-flex items-center gap-1 text-red-400 font-semibold font-montserrat">
                                <Flag className="w-3 h-3 fill-red-400" /> Denunciada
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenReport(m)}
                                title="Sinalizar mensagem à moderação"
                                className="opacity-60 hover:opacity-100 text-gray-300 hover:text-red-400 inline-flex items-center gap-1 transition-colors"
                              >
                                <Flag className="w-3 h-3" />
                                <span className="hidden group-hover:inline text-[9px] font-sans">
                                  Moderar
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
                      placeholder={`Mensagem para ${activeContact.name}...`}
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
                Nenhum usuário selecionado
              </h3>
              <p className="text-xs text-gray-500 font-inter mt-1">
                Selecione um aluno ou profissional na lista ao lado para iniciar a conversa.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

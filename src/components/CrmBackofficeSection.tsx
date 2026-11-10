import React, { useState, useEffect, useMemo, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Users,
  Kanban,
  CalendarClock,
  StickyNote,
  Phone,
  ChevronDown,
  Loader2,
  RefreshCw,
  Plus,
  MessageCircle,
  Bot,
  X,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  crmApi,
  crmHistoryApi,
  crmTemplatesApi,
  inferCategory,
  CRM_STATUS_LABELS,
  CRM_CATEGORY_LABELS,
  type CrmContactRecord,
  type CrmStatus,
  type CrmCategory,
  type CrmSummary,
  type CrmTemplate,
} from '@/services/crm'

const STATUSES: CrmStatus[] = ['novo', 'em_contato', 'ativo', 'inativo']

const STATUS_STYLES: Record<CrmStatus, string> = {
  novo: 'bg-[#0057FF]/15 text-[#0057FF] border-[#0057FF]/30',
  em_contato: 'bg-[#FF7A00]/15 text-[#FF7A00] border-[#FF7A00]/30',
  ativo: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  inativo: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
}

// ---------- HOOK: contato por ID com expand student ----------
function useCrmContacts(profId: string | undefined, refreshKey: number) {
  const [contacts, setContacts] = useState<CrmContactRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profId) return
    setLoading(true)
    try {
      const res = await crmApi.listContacts(profId, 1, 100)
      setContacts(res.items as CrmContactRecord[])
    } catch (_) {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [profId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return { contacts, loading, reload: load }
}

// ---------- CARD DO CONTATO ----------
const ContactCard: React.FC<{
  contact: CrmContactRecord
  onOpen: (c: CrmContactRecord) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}> = ({ contact, onOpen, draggable, onDragStart }) => {
  const today = new Date().toISOString().slice(0, 10)
  const fuDate = contact.next_followup_at ? contact.next_followup_at.slice(0, 10) : null
  const overdue = fuDate && fuDate < today

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onOpen(contact)}
      className={`p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/50 cursor-pointer transition-all ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold font-montserrat text-white truncate">
            {contact.contact_name}
          </p>
          <p className="text-[10px] text-gray-400 font-inter">
            {CRM_CATEGORY_LABELS[contact.category] || contact.category}
          </p>
        </div>
        {contact.estimated_value > 0 && (
          <span className="text-[10px] font-mono text-[#22C55E] shrink-0">
            R$ {contact.estimated_value.toFixed(0)}
          </span>
        )}
      </div>
      {fuDate && (
        <Badge
          className={`mt-2 text-[9px] font-bold ${overdue ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'}`}
        >
          <CalendarClock className="w-2.5 h-2.5 mr-1" />
          {overdue ? 'Vencido' : 'Follow-up'} {fuDate.slice(8, 10)}/{fuDate.slice(5, 7)}
        </Badge>
      )}
      {contact.origin === 'chat' && contact.status === 'novo' && (
        <Badge className="mt-1 ml-1 text-[9px] bg-[#0057FF]/10 text-[#0057FF] border-[#0057FF]/20">
          <MessageCircle className="w-2.5 h-2.5 mr-1" /> via chat
        </Badge>
      )}
    </div>
  )
}

// ---------- KANBAN ----------
const CrmKanban: React.FC<{
  contacts: CrmContactRecord[]
  onOpen: (c: CrmContactRecord) => void
  onMove: (id: string, status: CrmStatus) => void
}> = ({ contacts, onOpen, onMove }) => {
  const [dragOver, setDragOver] = useState<CrmStatus | null>(null)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {STATUSES.map((status) => {
        const items = contacts.filter((c) => c.status === status)
        const total = items.reduce((s, c) => s + (c.estimated_value || 0), 0)
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(status)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(null)
              const id = e.dataTransfer.getData('text/plain')
              if (id) onMove(id, status)
            }}
            className={`rounded-xl p-2.5 min-h-[140px] transition-colors ${
              dragOver === status
                ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/40'
                : 'bg-[#101010] border border-[#2A2A2A]'
            }`}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span
                className={`text-[10px] font-bold uppercase font-montserrat px-2 py-0.5 rounded border ${STATUS_STYLES[status]}`}
              >
                {CRM_STATUS_LABELS[status]}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">{items.length}</span>
            </div>
            {total > 0 && (
              <p className="text-[9px] text-gray-500 font-mono px-1 mb-1.5">
                R$ {total.toFixed(0)} estimado
              </p>
            )}
            <div className="space-y-2">
              {items.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  onOpen={onOpen}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- FICHA DO CONTATO (drawer) ----------
const ContactSheet: React.FC<{
  contact: CrmContactRecord | null
  profId: string
  onClose: () => void
  onUpdate: () => void
}> = ({ contact, profId, onClose, onUpdate }) => {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof crmHistoryApi.load>> | null>(
    null,
  )
  const [noteDraft, setNoteDraft] = useState('')
  const [fuDate, setFuDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<CrmTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')

  useEffect(() => {
    if (!contact) return
    setNoteDraft(contact.notes || '')
    setFuDate(contact.next_followup_at ? contact.next_followup_at.slice(0, 10) : '')
    setHistory(null)
    crmHistoryApi
      .load(profId, contact.student)
      .then(setHistory)
      .catch(() => setHistory(null))
    crmTemplatesApi
      .list(profId)
      .then(setTemplates)
      .catch(() => {})
  }, [contact?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!contact) return null

  const applyStatus = async (status: CrmStatus) => {
    setSaving(true)
    try {
      await crmApi.updateContact(contact.id, { status })
      toast.success('Status atualizado: ' + CRM_STATUS_LABELS[status])
      onUpdate()
    } catch (_) {
      toast.error('Erro ao atualizar status')
    } finally {
      setSaving(false)
    }
  }

  const saveNotes = async () => {
    setSaving(true)
    try {
      await crmApi.updateContact(contact.id, { notes: noteDraft })
      toast.success('Anotação salva')
      onUpdate()
    } catch (_) {
      toast.error('Erro ao salvar anotação')
    } finally {
      setSaving(false)
    }
  }

  const saveFollowup = async () => {
    if (!fuDate) return
    setSaving(true)
    try {
      await crmApi.updateContact(contact.id, { next_followup_at: fuDate })
      toast.success('Follow-up agendado')
      onUpdate()
    } catch (_) {
      toast.error('Erro ao agendar follow-up')
    } finally {
      setSaving(false)
    }
  }

  const rendered = selectedTemplate
    ? crmTemplatesApi.renderTemplate(templates.find((t) => t.id === selectedTemplate)?.body || '', {
        nome: contact.contact_name.split(' ')[0],
        profissional: 'seu profissional',
      })
    : ''

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#101010] border-l border-[#2A2A2A] h-full overflow-y-auto p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold font-montserrat text-white">{contact.contact_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          {CRM_CATEGORY_LABELS[contact.category]} • origem: {contact.origin}
        </p>

        {/* Ações rápidas: status */}
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400 mb-1.5">Mudar status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => applyStatus(s)}
                className={`text-[10px] px-2.5 py-1 rounded border font-bold ${
                  contact.status === s ? STATUS_STYLES[s] : 'border-[#2A2A2A] text-gray-400'
                }`}
              >
                {CRM_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Anotação */}
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400 mb-1.5 flex items-center gap-1">
            <StickyNote className="w-3 h-3" /> Anotações
          </p>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            className="w-full bg-[#181818] border border-[#2A2A2A] rounded-lg p-2 text-xs text-white"
            placeholder="Anotações sobre o contato..."
          />
          <Button
            size="sm"
            onClick={saveNotes}
            disabled={saving}
            className="mt-1.5 bg-[#D4AF37] text-black text-[10px] h-7"
          >
            Salvar anotação
          </Button>
        </div>

        {/* Follow-up */}
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400 mb-1.5 flex items-center gap-1">
            <CalendarClock className="w-3 h-3" /> Próximo follow-up
          </p>
          <div className="flex gap-2">
            <Input
              type="date"
              value={fuDate}
              onChange={(e) => setFuDate(e.target.value)}
              className="bg-[#181818] border-[#2A2A2A] text-xs text-white h-8"
            />
            <Button
              size="sm"
              onClick={saveFollowup}
              disabled={saving || !fuDate}
              className="bg-[#0057FF] text-white text-[10px] h-8"
            >
              Agendar
            </Button>
          </div>
        </div>

        {/* Templates de mensagem */}
        {templates.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-1.5">Mensagem-modelo</p>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full bg-[#181818] border border-[#2A2A2A] rounded-lg p-2 text-xs text-white"
            >
              <option value="">Selecione um template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {rendered && (
              <div className="mt-1.5 p-2 bg-[#181818] border border-[#2A2A2A] rounded-lg text-[11px] text-gray-300">
                {rendered}
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(rendered)
                    toast.success('Copiado')
                  }}
                  className="ml-2 text-[#D4AF37] hover:underline text-[10px]"
                >
                  copiar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Histórico */}
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400 mb-1.5">Histórico</p>
          {!history ? (
            <div className="flex items-center gap-2 text-[11px] text-gray-500 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> carregando...
            </div>
          ) : (
            <div className="space-y-3">
              <HistoryBlock
                title="Mensagens do chat"
                items={history.messages.map(
                  (m) => `${m.mine ? '→' : '←'} ${m.content.slice(0, 80)}`,
                )}
                empty="Sem mensagens"
              />
              <HistoryBlock
                title="Agendamentos"
                items={history.appointments.map((a) => `${a.servico_tipo} — ${a.status}`)}
                empty="Sem agendamentos"
              />
              <HistoryBlock
                title="Serviços concluídos"
                items={history.services.map(
                  (s) => `${s.title} — ${s.status} (R$ ${s.value.toFixed(0)})`,
                )}
                empty="Sem serviços"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const HistoryBlock: React.FC<{ title: string; items: string[]; empty: string }> = ({
  title,
  items,
  empty,
}) => (
  <div>
    <p className="text-[10px] font-bold text-[#D4AF37] mb-1">{title}</p>
    {items.length === 0 ? (
      <p className="text-[10px] text-gray-500">{empty}</p>
    ) : (
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {items.slice(0, 15).map((item, i) => (
          <p key={i} className="text-[10px] text-gray-300 truncate">
            {item}
          </p>
        ))}
      </div>
    )}
  </div>
)

// ---------- CHATBOT BACKOFFICE ----------
const BackofficeChat: React.FC<{ profId: string; onClose: () => void }> = ({ profId, onClose }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'bot'; content: string }>>([
    {
      role: 'bot',
      content:
        'Olá! Sou o BackOffice 369. Posso resumir seus alunos, sugerir follow-ups e responder dúvidas sobre seus contatos, serviços e agendamentos.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await crmApi.backofficeChat(msg, conversationId)
      setConversationId(res.conversation_id)
      setMessages((prev) => [...prev, { role: 'bot', content: res.reply }])
    } catch (_) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'Não consegui responder agora. Tente novamente.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[#101010] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl h-[70vh] sm:h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[#2A2A2A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-bold font-montserrat text-white">
              BackOffice 369 (IA)
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-xs max-w-[85%] px-3 py-2 rounded-xl whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto bg-[#0057FF] text-white' : 'bg-[#181818] text-gray-200 border border-[#2A2A2A]'}`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 text-[#D4AF37] text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin" /> analisando…
            </div>
          )}
        </div>
        <div className="p-3 border-t border-[#2A2A2A]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre seus alunos..."
              className="bg-[#181818] border-[#2A2A2A] text-xs text-white"
            />
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="bg-[#D4AF37] text-black px-3"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ---------- COMPONENTE PRINCIPAL ----------
export const CrmBackofficeSection: React.FC = () => {
  const { user } = useAuth()
  const profId = user?.id
  const [tab, setTab] = useState<'lista' | 'kanban'>('lista')
  const [kanbanLoaded, setKanbanLoaded] = useState(false) // lazy-load mobile
  const [statusFilter, setStatusFilter] = useState<CrmStatus | ''>('')
  const [summary, setSummary] = useState<CrmSummary | null>(null)
  const [sheetContact, setSheetContact] = useState<CrmContactRecord | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { contacts, loading, reload } = useCrmContacts(profId, refreshKey)

  const loadSummary = useCallback(async () => {
    if (!profId) return
    try {
      const s = await crmApi.summary()
      setSummary(s)
    } catch {
      /* intentionally ignored */
    }
  }, [profId])

  useEffect(() => {
    loadSummary()
  }, [loadSummary, refreshKey])

  const filtered = useMemo(
    () => (statusFilter ? contacts.filter((c) => c.status === statusFilter) : contacts),
    [contacts, statusFilter],
  )

  const handleMove = async (id: string, status: CrmStatus) => {
    try {
      await crmApi.updateContact(id, { status })
      toast.success('Movido para ' + CRM_STATUS_LABELS[status])
      setRefreshKey((k) => k + 1)
    } catch (_) {
      toast.error('Erro ao mover contato')
      setRefreshKey((k) => k + 1)
    }
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || !profId) return
    setCreating(true)
    try {
      // Criação manual na tela Meus Clientes: origem sempre 'perfil'.
      // Todos os campos obrigatórios da coleção são enviados explicitamente
      // (professional, student, contact_name, category, status, origin).
      await crmApi.createContact({
        professional: profId,
        student: profId, // contato manual sem aluno vinculado (lead externo)
        contact_name: name,
        category: inferCategory(user?.specialties) as CrmCategory,
        status: 'novo',
        origin: 'perfil',
      })
      setNewName('')
      toast.success('Contato criado')
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status
      const reason = err?.response?.message || err?.message || ''
      if (status === 400 && /unique|idx_crm_prof_student/i.test(reason)) {
        toast.error('Este contato já existe na sua lista.')
      } else if (status === 400 || status === 403) {
        toast.error(
          'Não foi possível criar o contato: verifique os dados e tente novamente. ' +
            (reason ? `(${reason})` : ''),
        )
      } else {
        toast.error('Erro ao criar contato. Verifique sua conexão e tente novamente.')
      }
    } finally {
      setCreating(false)
    }
  }

  const openKanban = () => {
    setTab('kanban')
    if (!kanbanLoaded) setKanbanLoaded(true)
  }

  if (!profId) return null

  return (
    <div className="space-y-4">
      {/* Header + métricas */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold font-montserrat uppercase text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#D4AF37]" /> Meus Clientes (CRM)
        </h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setChatOpen(true)}
            className="bg-[#181818] border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black text-[11px] h-8"
          >
            <Bot className="w-3.5 h-3.5 mr-1" /> BackOffice IA
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              reload()
              loadSummary()
            }}
            className="border-[#2A2A2A] text-gray-300 h-8"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniKpi
            label="Follow-ups hoje"
            value={String(summary.followups_today_count)}
            highlight={summary.followups_overdue_count > 0}
            sub={
              summary.followups_overdue_count > 0
                ? `${summary.followups_overdue_count} vencido(s)`
                : 'em dia'
            }
          />
          <MiniKpi label="Novos leads" value={String(summary.counts.novo)} />
          <MiniKpi label="Ativos" value={String(summary.counts.ativo)} />
          <MiniKpi
            label="Conversão do mês"
            value={summary.conversion_rate + '%'}
            sub={`${summary.won_this_month} ganho(s)`}
          />
        </div>
      )}

      {/* Follow-ups de hoje */}
      {summary && summary.followups_today.length > 0 && (
        <Card className="bg-[#181818] border border-[#D4AF37]/40 p-4 rounded-2xl">
          <p className="text-xs font-bold uppercase font-montserrat text-[#D4AF37] mb-2 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> Follow-ups de hoje
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.followups_today.slice(0, 8).map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  const c = contacts.find((x) => x.id === f.id)
                  if (c) setSheetContact(c)
                }}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-bold ${f.overdue ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'}`}
              >
                {f.overdue ? '⚠ ' : ''}
                {f.name} {f.followup_date.slice(8, 10)}/{f.followup_date.slice(5, 7)}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs Lista/Kanban */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('lista')}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${tab === 'lista' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'border-[#2A2A2A] text-gray-400'}`}
        >
          Lista
        </button>
        <button
          onClick={openKanban}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${tab === 'kanban' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'border-[#2A2A2A] text-gray-400'}`}
        >
          <Kanban className="w-3.5 h-3.5" /> Kanban
        </button>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CrmStatus | '')}
          className="ml-auto bg-[#181818] border border-[#2A2A2A] rounded-lg px-2 text-[11px] text-white"
        >
          <option value="">Todos os status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {CRM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Novo contato rápido */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do novo lead..."
          className="bg-[#181818] border-[#2A2A2A] text-xs text-white h-8"
        />
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="bg-[#22C55E] text-black h-8 text-[11px]"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-xs py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando contatos...
        </div>
      ) : tab === 'kanban' && kanbanLoaded ? (
        <CrmKanban contacts={filtered} onOpen={setSheetContact} onMove={handleMove} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-500 col-span-full py-4">
              Nenhum contato ainda. Leads capturados no chat aparecem aqui automaticamente.
            </p>
          ) : (
            filtered.map((c) => <ContactCard key={c.id} contact={c} onOpen={setSheetContact} />)
          )}
        </div>
      )}

      {/* Kanban lazy no mobile: só monta quando a aba é acessada */}
      {tab !== 'kanban' && !kanbanLoaded && null}

      <ContactSheet
        contact={sheetContact}
        profId={profId}
        onClose={() => setSheetContact(null)}
        onUpdate={() => setRefreshKey((k) => k + 1)}
      />
      {chatOpen && <BackofficeChat profId={profId} onClose={() => setChatOpen(false)} />}
    </div>
  )
}

const MiniKpi: React.FC<{ label: string; value: string; sub?: string; highlight?: boolean }> = ({
  label,
  value,
  sub,
  highlight,
}) => (
  <Card
    className={`p-3 rounded-xl border ${highlight ? 'bg-red-500/5 border-red-500/30' : 'bg-[#181818] border-[#2A2A2A]'}`}
  >
    <p className="text-[10px] text-gray-400 uppercase font-montserrat">{label}</p>
    <p
      className={`text-lg font-extrabold font-montserrat ${highlight ? 'text-red-400' : 'text-white'}`}
    >
      {value}
    </p>
    {sub && <p className="text-[9px] text-gray-500">{sub}</p>}
  </Card>
)

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Kanban,
  CalendarClock,
  StickyNote,
  Phone,
  Mail,
  ChevronDown,
  Loader2,
  RefreshCw,
  Plus,
  MessageCircle,
  Bot,
  X,
  Send,
  Lock,
  Download,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Handshake,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  crmApi,
  crmHistoryApi,
  crmTemplatesApi,
  inferCategory,
  CRM_STATUS_LABELS,
  CRM_CATEGORY_LABELS,
  CRM_CONTACT_TYPE_LABELS,
  type CrmContactRecord,
  type CrmStatus,
  type CrmContactType,
  type CrmCategory,
  type CrmSummary,
  type CrmTemplate,
} from '@/services/crm'
import { CrmUpgradeModal } from '@/components/CrmUpgradeModal'

const STATUSES: CrmStatus[] = ['novo', 'em_contato', 'ativo', 'inativo']
const CONTACT_TYPES: CrmContactType[] = ['cliente', 'parceiro', 'fornecedor']

const STATUS_STYLES: Record<CrmStatus, string> = {
  novo: 'bg-[#0057FF]/15 text-[#0057FF] border-[#0057FF]/30',
  em_contato: 'bg-[#FF7A00]/15 text-[#FF7A00] border-[#FF7A00]/30',
  ativo: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  inativo: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
}

const CONTACT_TYPE_BADGES: Record<
  CrmContactType,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  cliente: {
    label: 'Cliente',
    className: 'bg-[#0057FF]/15 text-[#60A5FA] border-[#0057FF]/40',
    icon: UserCheck,
  },
  parceiro: {
    label: 'Parceiro',
    className: 'bg-[#22C55E]/15 text-[#4ADE80] border-[#22C55E]/40',
    icon: Handshake,
  },
  fornecedor: {
    label: 'Fornecedor',
    className: 'bg-[#A855F7]/15 text-[#C084FC] border-[#A855F7]/40',
    icon: Truck,
  },
}

const ORIGIN_LABELS: Record<string, string> = {
  vinculo: 'Vínculo direto',
  chat: 'Captura via chat',
  perfil: 'Cadastro manual',
}

// Limites e gatilhos por plano do profissional
export interface CrmPlanFeatures {
  planName: 'Grátis' | 'Básico' | 'Pro' | 'Premium'
  rawPlan: string
  maxContacts: number // 10 para grátis, Infinity para os demais
  maxTemplates: number // 1 para grátis, 3 para básico, Infinity para pro/premium
  hasKanban: boolean // apenas pro/premium/pro_parceiro
  hasMetrics: boolean // basico, pro, premium, pro_parceiro (gratis NÃO)
  hasExportCsv: boolean // apenas premium
}

export function getCrmPlanFeatures(rawPlan?: string): CrmPlanFeatures {
  const p = (rawPlan || 'gratis').toLowerCase().trim()
  if (p === 'premium') {
    return {
      planName: 'Premium',
      rawPlan: p,
      maxContacts: Infinity,
      maxTemplates: Infinity,
      hasKanban: true,
      hasMetrics: true,
      hasExportCsv: true,
    }
  }
  if (p === 'pro' || p === 'pro_parceiro') {
    return {
      planName: 'Pro',
      rawPlan: p,
      maxContacts: Infinity,
      maxTemplates: Infinity,
      hasKanban: true,
      hasMetrics: true,
      hasExportCsv: false,
    }
  }
  if (p === 'basico') {
    return {
      planName: 'Básico',
      rawPlan: p,
      maxContacts: Infinity,
      maxTemplates: 3,
      hasKanban: false,
      hasMetrics: true,
      hasExportCsv: false,
    }
  }
  return {
    planName: 'Grátis',
    rawPlan: p,
    maxContacts: 10,
    maxTemplates: 1,
    hasKanban: false,
    hasMetrics: false,
    hasExportCsv: false,
  }
}

// ---------- HOOK: contatos ----------
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

  const typeConfig =
    CONTACT_TYPE_BADGES[contact.contact_type || 'cliente'] || CONTACT_TYPE_BADGES.cliente
  const TypeIcon = typeConfig.icon

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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-bold font-montserrat text-white truncate">
              {contact.contact_name}
            </p>
            <Badge
              className={`text-[9px] font-bold px-1.5 py-0 h-4 border flex items-center gap-1 ${typeConfig.className}`}
            >
              <TypeIcon className="w-2.5 h-2.5" />
              {typeConfig.label}
            </Badge>
          </div>
          <p className="text-[10px] text-gray-400 font-inter mt-0.5">
            {CRM_CATEGORY_LABELS[contact.category] || contact.category}
          </p>
        </div>
        {contact.estimated_value > 0 && (
          <span className="text-[10px] font-mono text-[#22C55E] shrink-0 font-bold">
            R$ {contact.estimated_value.toFixed(0)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {fuDate && (
          <Badge
            className={`text-[9px] font-bold ${
              overdue
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'
            }`}
          >
            <CalendarClock className="w-2.5 h-2.5 mr-1" />
            {overdue ? 'Vencido' : 'Follow-up'} {fuDate.slice(8, 10)}/{fuDate.slice(5, 7)}
          </Badge>
        )}
        {contact.origin === 'chat' && (
          <Badge className="text-[9px] bg-[#0057FF]/10 text-[#0057FF] border-[#0057FF]/20">
            <MessageCircle className="w-2.5 h-2.5 mr-1" /> chat
          </Badge>
        )}
        {contact.origin === 'vinculo' && (
          <Badge className="text-[9px] bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20">
            vínculo
          </Badge>
        )}
        {(contact.phone || contact.expand?.student?.phone) && (
          <span title="Possui WhatsApp/telefone">
            <Phone className="w-2.5 h-2.5 text-gray-400" />
          </span>
        )}
        {(contact.email || contact.expand?.student?.email) && (
          <span title="Possui e-mail">
            <Mail className="w-2.5 h-2.5 text-gray-400" />
          </span>
        )}
      </div>
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
  features: CrmPlanFeatures
  onClose: () => void
  onUpdate: () => void
  onRequestUpgrade: (plan: 'Básico' | 'Pro' | 'Premium', feature: string) => void
}> = ({ contact, profId, features, onClose, onUpdate, onRequestUpgrade }) => {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof crmHistoryApi.load>> | null>(
    null,
  )
  const [noteDraft, setNoteDraft] = useState('')
  const [fuDate, setFuDate] = useState('')
  const [contactType, setContactType] = useState<CrmContactType>('cliente')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<CrmTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')

  useEffect(() => {
    if (!contact) return
    setNoteDraft(contact.notes || '')
    setFuDate(contact.next_followup_at ? contact.next_followup_at.slice(0, 10) : '')
    setContactType(contact.contact_type || 'cliente')
    setPhoneDraft(contact.phone || contact.expand?.student?.phone || '')
    setEmailDraft(contact.email || contact.expand?.student?.email || '')
    setHistory(null)
    crmHistoryApi
      .load(profId, contact.student)
      .then(setHistory)
      .catch(() => setHistory(null))
    crmTemplatesApi
      .list(profId)
      .then((all) => {
        // Limita a exibição conforme o plano
        const cap = features.maxTemplates
        setTemplates(cap === Infinity ? all : all.slice(0, cap))
      })
      .catch(() => {})
  }, [contact?.id, features.maxTemplates]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!contact) return null

  const effectivePhone = phoneDraft || contact.phone || contact.expand?.student?.phone || ''
  const effectiveEmail = emailDraft || contact.email || contact.expand?.student?.email || ''

  // Formata telefone para link do WhatsApp: apenas dígitos
  const cleanPhone = effectivePhone.replace(/\D/g, '')
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.length <= 11 ? '55' + cleanPhone : cleanPhone}`
    : ''

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

  const saveClassification = async (newType: CrmContactType) => {
    setSaving(true)
    try {
      await crmApi.updateContact(contact.id, { contact_type: newType })
      setContactType(newType)
      toast.success('Classificação atualizada: ' + CRM_CONTACT_TYPE_LABELS[newType])
      onUpdate()
    } catch (_) {
      toast.error('Erro ao atualizar classificação')
    } finally {
      setSaving(false)
    }
  }

  const saveContactChannels = async () => {
    setSaving(true)
    try {
      await crmApi.updateContact(contact.id, {
        phone: phoneDraft.trim(),
        email: emailDraft.trim(),
      })
      toast.success('Telefone/e-mail atualizados')
      onUpdate()
    } catch (_) {
      toast.error('Erro ao atualizar telefone e e-mail')
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

  const typeConfig = CONTACT_TYPE_BADGES[contactType] || CONTACT_TYPE_BADGES.cliente
  const TypeIcon = typeConfig.icon

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#101010] border-l border-[#2A2A2A] h-full overflow-y-auto p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold font-montserrat text-white truncate">
              {contact.contact_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge
                className={`text-[10px] font-bold px-2 py-0.5 border flex items-center gap-1 ${typeConfig.className}`}
              >
                <TypeIcon className="w-3 h-3" />
                {typeConfig.label}
              </Badge>
              <Badge className="text-[10px] bg-[#181818] text-gray-300 border-[#2A2A2A]">
                Origem: {ORIGIN_LABELS[contact.origin] || contact.origin}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#181818]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400">
          Especialidade: {CRM_CATEGORY_LABELS[contact.category] || contact.category}
        </p>

        {/* Classificação: Cliente / Parceiro / Fornecedor */}
        <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl space-y-2">
          <p className="text-[10px] font-bold uppercase text-gray-400">Classificação do Contato</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CONTACT_TYPES.map((t) => {
              const cfg = CONTACT_TYPE_BADGES[t]
              const Icon = cfg.icon
              const isSelected = contactType === t
              return (
                <button
                  key={t}
                  disabled={saving}
                  onClick={() => saveClassification(t)}
                  className={`text-[11px] py-1.5 px-2 rounded-lg border font-bold flex items-center justify-center gap-1 transition-all ${
                    isSelected
                      ? cfg.className + ' ring-1 ring-[#D4AF37]/60'
                      : 'border-[#2A2A2A] text-gray-400 hover:text-white hover:bg-[#121212]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Canais rápidos: WhatsApp / E-mail */}
        <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl space-y-2.5">
          <p className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
            <Phone className="w-3 h-3 text-[#22C55E]" /> Contato Rápido (WhatsApp / E-mail)
          </p>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Telefone / WhatsApp</label>
              <div className="flex gap-1.5">
                <Input
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="bg-[#121212] border-[#2A2A2A] text-xs text-white h-8"
                />
                {whatsappUrl && (
                  <Button
                    size="sm"
                    asChild
                    className="bg-[#22C55E] hover:bg-[#1ea750] text-black text-[10px] font-bold h-8 px-2.5 shrink-0"
                  >
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">E-mail</label>
              <div className="flex gap-1.5">
                <Input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="contato@exemplo.com"
                  className="bg-[#121212] border-[#2A2A2A] text-xs text-white h-8"
                />
                {effectiveEmail && (
                  <Button
                    size="sm"
                    asChild
                    className="bg-[#0057FF] hover:bg-[#0047d4] text-white text-[10px] font-bold h-8 px-2.5 shrink-0"
                  >
                    <a href={`mailto:${effectiveEmail}`}>
                      <Mail className="w-3.5 h-3.5 mr-1" /> E-mail
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <Button
              size="sm"
              onClick={saveContactChannels}
              disabled={saving}
              className="w-full bg-[#2A2A2A] hover:bg-[#333] text-gray-200 text-[10px] h-7"
            >
              Salvar telefone e e-mail
            </Button>
          </div>
        </div>

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
            className="mt-1.5 bg-[#D4AF37] text-black text-[10px] h-7 font-bold"
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
              className="bg-[#0057FF] text-white text-[10px] h-8 font-bold"
            >
              Agendar
            </Button>
          </div>
        </div>

        {/* Templates de mensagem */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase text-gray-400">
              Mensagens-modelo ({templates.length} disponível
              {templates.length === 1 ? '' : 'is'})
            </p>
            {features.maxTemplates < 3 && (
              <button
                onClick={() =>
                  onRequestUpgrade('Básico', 'Acesso a 3 mensagens-modelo (ou ilimitadas no Pro)')
                }
                className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1"
              >
                <Lock className="w-2.5 h-2.5" /> Mais modelos
              </button>
            )}
          </div>
          {templates.length > 0 ? (
            <div>
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
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(rendered)
                        toast.success('Copiado para a área de transferência')
                      }}
                      className="text-[#D4AF37] hover:underline text-[10px] font-bold"
                    >
                      Copiar texto
                    </button>
                    {whatsappUrl && (
                      <a
                        href={`${whatsappUrl}?text=${encodeURIComponent(rendered)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#22C55E] hover:underline text-[10px] font-bold flex items-center gap-1"
                      >
                        Enviar via WhatsApp <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500">Nenhum template disponível.</p>
          )}
        </div>

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
              className={`text-xs max-w-[85%] px-3 py-2 rounded-xl whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'ml-auto bg-[#0057FF] text-white'
                  : 'bg-[#181818] text-gray-200 border border-[#2A2A2A]'
              }`}
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

  // Plano do profissional logado
  const features = useMemo(() => getCrmPlanFeatures(user?.plan), [user?.plan])

  const [tab, setTab] = useState<'lista' | 'kanban'>('lista')
  const [kanbanLoaded, setKanbanLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<CrmStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<CrmContactType | ''>('')
  const [summary, setSummary] = useState<CrmSummary | null>(null)
  const [sheetContact, setSheetContact] = useState<CrmContactRecord | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  // Criação de novo contato
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CrmContactType>('cliente')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [showAdvancedCreation, setShowAdvancedCreation] = useState(false)
  const [creating, setCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Modal explicativo de upgrade
  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean
    requiredPlan: 'Básico' | 'Pro' | 'Premium'
    featureName: string
  }>({
    open: false,
    requiredPlan: 'Básico',
    featureName: '',
  })

  const { contacts, loading, reload } = useCrmContacts(profId, refreshKey)

  const openUpgradeModal = (requiredPlan: 'Básico' | 'Pro' | 'Premium', featureName: string) => {
    setUpgradeModal({
      open: true,
      requiredPlan,
      featureName,
    })
  }

  // Métricas: só carrega se o plano do profissional permitir (Básico, Pro, Premium)
  const loadSummary = useCallback(async () => {
    if (!profId || !features.hasMetrics) {
      setSummary(null)
      return
    }
    try {
      const s = await crmApi.summary()
      setSummary(s)
    } catch {
      /* silencioso */
    }
  }, [profId, features.hasMetrics])

  useEffect(() => {
    loadSummary()
  }, [loadSummary, refreshKey])

  // Contadores por classificação
  const typeCounts = useMemo(() => {
    const counts = { cliente: 0, parceiro: 0, fornecedor: 0, total: contacts.length }
    for (const c of contacts) {
      const t = c.contact_type || 'cliente'
      if (counts[t] !== undefined) counts[t]++
      else counts.cliente++
    }
    return counts
  }, [contacts])

  // Filtros combinados (status + contact_type)
  const filtered = useMemo(() => {
    let list = contacts
    if (statusFilter) {
      list = list.filter((c) => c.status === statusFilter)
    }
    if (typeFilter) {
      list = list.filter((c) => (c.contact_type || 'cliente') === typeFilter)
    }
    // No plano Grátis: lista limitada aos primeiros 10 contatos
    if (features.maxContacts !== Infinity) {
      list = list.slice(0, features.maxContacts)
    }
    return list
  }, [contacts, statusFilter, typeFilter, features.maxContacts])

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

    // Limite de 10 contatos no plano Grátis
    if (features.maxContacts !== Infinity && contacts.length >= features.maxContacts) {
      openUpgradeModal(
        'Básico',
        `Limite de ${features.maxContacts} contatos atingido no Plano Grátis`,
      )
      return
    }

    setCreating(true)
    try {
      await crmApi.createContact({
        professional: profId,
        student: profId, // contato manual sem aluno vinculado (lead externo)
        contact_name: name,
        category: inferCategory(user?.specialties) as CrmCategory,
        status: 'novo',
        origin: 'perfil',
        contact_type: newType,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
      })
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setShowAdvancedCreation(false)
      toast.success(`Contato criado como ${CRM_CONTACT_TYPE_LABELS[newType]}`)
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

  const handleSelectKanban = () => {
    if (!features.hasKanban) {
      openUpgradeModal('Pro', 'Visualização e gestão em Kanban arrastável')
      return
    }
    setTab('kanban')
    if (!kanbanLoaded) setKanbanLoaded(true)
  }

  // Exportação CSV dos contatos (recurso exclusivo do Plano Premium)
  const handleExportCsv = () => {
    if (!features.hasExportCsv) {
      openUpgradeModal('Premium', 'Exportação completa da carteira de contatos em CSV')
      return
    }

    if (contacts.length === 0) {
      toast.error('Não há contatos para exportar.')
      return
    }

    try {
      const headers = [
        'Nome',
        'Classificação',
        'Status',
        'Origem',
        'Telefone',
        'E-mail',
        'Valor Estimado (R$)',
        'Próximo Follow-up',
        'Anotações',
        'Criado em',
      ]

      const rows = contacts.map((c) => [
        `"${(c.contact_name || '').replace(/"/g, '""')}"`,
        `"${CRM_CONTACT_TYPE_LABELS[c.contact_type || 'cliente']}"`,
        `"${CRM_STATUS_LABELS[c.status] || c.status}"`,
        `"${ORIGIN_LABELS[c.origin] || c.origin}"`,
        `"${(c.phone || c.expand?.student?.phone || '').replace(/"/g, '""')}"`,
        `"${(c.email || c.expand?.student?.email || '').replace(/"/g, '""')}"`,
        c.estimated_value || 0,
        c.next_followup_at ? c.next_followup_at.slice(0, 10) : '',
        `"${(c.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        c.created ? c.created.slice(0, 10) : '',
      ])

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `369crm_contatos_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Planilha CSV exportada com sucesso')
    } catch (_) {
      toast.error('Erro ao gerar exportação CSV.')
    }
  }

  if (!profId) return null

  return (
    <div className="space-y-4">
      {/* Header + métricas */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-montserrat uppercase text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D4AF37]" /> Meus Clientes (CRM)
          </h2>
          <p className="text-[11px] text-gray-400 font-inter mt-0.5">
            Plano atual:{' '}
            <span className="text-[#D4AF37] font-bold uppercase">{features.planName}</span>
            {features.maxContacts !== Infinity && (
              <span className="text-gray-400"> • limite de {features.maxContacts} contatos</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Botão de Exportação CSV (destaque Premium ou cadeado para outros) */}
          <Button
            size="sm"
            onClick={handleExportCsv}
            variant="outline"
            className="border-[#2A2A2A] text-gray-200 hover:text-white hover:border-[#D4AF37] text-[11px] h-8 flex items-center gap-1.5"
            title={
              features.hasExportCsv
                ? 'Exportar contatos em CSV'
                : 'Disponível no Plano Premium — atualize na aba Financeiro'
            }
          >
            {features.hasExportCsv ? (
              <Download className="w-3.5 h-3.5 text-[#22C55E]" />
            ) : (
              <Lock className="w-3 h-3 text-[#D4AF37]" />
            )}
            Exportar CSV
          </Button>

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

      {/* Contadores no topo por classificação (Cliente, Parceiro, Fornecedor) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          onClick={() => setTypeFilter(typeFilter === 'cliente' ? '' : 'cliente')}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
            typeFilter === 'cliente'
              ? 'bg-[#0057FF]/15 border-[#0057FF] ring-1 ring-[#0057FF]'
              : 'bg-[#181818] border-[#2A2A2A] hover:border-[#0057FF]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase font-montserrat text-[#60A5FA] flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Clientes
            </span>
            <span className="text-base sm:text-lg font-extrabold font-montserrat text-white">
              {typeCounts.cliente}
            </span>
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5">Alunos e clientes finais</p>
        </button>

        <button
          onClick={() => setTypeFilter(typeFilter === 'parceiro' ? '' : 'parceiro')}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
            typeFilter === 'parceiro'
              ? 'bg-[#22C55E]/15 border-[#22C55E] ring-1 ring-[#22C55E]'
              : 'bg-[#181818] border-[#2A2A2A] hover:border-[#22C55E]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase font-montserrat text-[#4ADE80] flex items-center gap-1">
              <Handshake className="w-3 h-3" /> Parceiros
            </span>
            <span className="text-base sm:text-lg font-extrabold font-montserrat text-white">
              {typeCounts.parceiro}
            </span>
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5">Profissionais e parceiros</p>
        </button>

        <button
          onClick={() => setTypeFilter(typeFilter === 'fornecedor' ? '' : 'fornecedor')}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
            typeFilter === 'fornecedor'
              ? 'bg-[#A855F7]/15 border-[#A855F7] ring-1 ring-[#A855F7]'
              : 'bg-[#181818] border-[#2A2A2A] hover:border-[#A855F7]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase font-montserrat text-[#C084FC] flex items-center gap-1">
              <Truck className="w-3 h-3" /> Fornecedores
            </span>
            <span className="text-base sm:text-lg font-extrabold font-montserrat text-white">
              {typeCounts.fornecedor}
            </span>
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5">Serviços e suprimentos</p>
        </button>
      </div>

      {/* Métricas: apenas para Básico, Pro e Premium (Grátis tem banner explicativo) */}
      {features.hasMetrics ? (
        summary && (
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
        )
      ) : (
        <Card className="bg-[#181818]/60 border border-[#2A2A2A] p-3 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <p className="text-xs text-gray-300">
              <strong className="text-white">Métricas de conversão e follow-ups</strong> disponíveis
              a partir do <strong className="text-[#D4AF37]">Plano Básico</strong>.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              openUpgradeModal('Básico', 'Painel de métricas e conversão mensal do CRM')
            }
            className="bg-[#D4AF37] text-black text-[10px] font-bold h-7 px-3 shrink-0"
          >
            Ver planos
          </Button>
        </Card>
      )}

      {/* Follow-ups de hoje (se métricas ativas) */}
      {features.hasMetrics && summary && summary.followups_today.length > 0 && (
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
                className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-bold ${
                  f.overdue
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
                }`}
              >
                {f.overdue ? '⚠ ' : ''}
                {f.name} {f.followup_date.slice(8, 10)}/{f.followup_date.slice(5, 7)}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs Lista/Kanban + Filtros de Status e Classificação */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab('lista')}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
            tab === 'lista'
              ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
              : 'border-[#2A2A2A] text-gray-400'
          }`}
        >
          Lista ({filtered.length})
        </button>

        <button
          onClick={handleSelectKanban}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
            tab === 'kanban'
              ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
              : 'border-[#2A2A2A] text-gray-400'
          }`}
          title={
            features.hasKanban
              ? 'Kanban arrastável'
              : 'Disponível no Plano Pro — atualize na aba Financeiro'
          }
        >
          {features.hasKanban ? (
            <Kanban className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3 h-3 text-[#D4AF37]" />
          )}
          Kanban
        </button>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Filtro por classificação */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CrmContactType | '')}
            className="bg-[#181818] border border-[#2A2A2A] rounded-lg px-2 text-[11px] text-white h-8"
          >
            <option value="">Todas as classificações</option>
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CRM_CONTACT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          {/* Filtro por status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CrmStatus | '')}
            className="bg-[#181818] border border-[#2A2A2A] rounded-lg px-2 text-[11px] text-white h-8"
          >
            <option value="">Todos os status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CRM_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cadastro de novo lead com Classificação (Cliente / Parceiro / Fornecedor) */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-3 rounded-2xl space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo contato (lead)..."
            className="bg-[#121212] border-[#2A2A2A] text-xs text-white h-9 flex-1"
          />

          {/* Seletor obrigatório da Classificação (Cliente, Parceiro ou Fornecedor) */}
          <div className="flex rounded-lg border border-[#2A2A2A] bg-[#121212] p-0.5 shrink-0">
            {CONTACT_TYPES.map((t) => {
              const isSelected = newType === t
              const cfg = CONTACT_TYPE_BADGES[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                    isSelected
                      ? 'bg-[#D4AF37] text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-[#22C55E] hover:bg-[#1ea750] text-black h-9 text-[11px] font-bold px-4 shrink-0"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <Plus className="w-3.5 h-3.5 mr-1" />
            )}
            Cadastrar {CRM_CONTACT_TYPE_LABELS[newType]}
          </Button>
        </div>

        {/* Toggle para telefone/WhatsApp e E-mail opcionais na criação */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAdvancedCreation(!showAdvancedCreation)}
            className="text-[10px] text-gray-400 hover:text-[#D4AF37] flex items-center gap-1 font-inter"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showAdvancedCreation ? 'rotate-180' : ''}`}
            />
            {showAdvancedCreation
              ? 'Ocultar telefone e e-mail'
              : '+ Adicionar telefone/WhatsApp e e-mail agora'}
          </button>
          <span className="text-[10px] text-gray-500 font-inter">
            Sem campo de plano no contato • classifique apenas cliente/parceiro/fornecedor
          </span>
        </div>

        {showAdvancedCreation && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#2A2A2A]">
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="WhatsApp / Telefone (ex: 11 99999-9999)"
              className="bg-[#121212] border-[#2A2A2A] text-xs text-white h-8"
            />
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="E-mail (ex: contato@exemplo.com)"
              className="bg-[#121212] border-[#2A2A2A] text-xs text-white h-8"
            />
          </div>
        )}
      </Card>

      {/* Conteúdo: Lista ou Kanban */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-xs py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando contatos...
        </div>
      ) : tab === 'kanban' && features.hasKanban && kanbanLoaded ? (
        <CrmKanban contacts={filtered} onOpen={setSheetContact} onMove={handleMove} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-500 col-span-full py-4 text-center">
              Nenhum contato encontrado com os filtros selecionados.
            </p>
          ) : (
            filtered.map((c) => <ContactCard key={c.id} contact={c} onOpen={setSheetContact} />)
          )}
        </div>
      )}

      {/* Ficha lateral */}
      <ContactSheet
        contact={sheetContact}
        profId={profId}
        features={features}
        onClose={() => setSheetContact(null)}
        onUpdate={() => setRefreshKey((k) => k + 1)}
        onRequestUpgrade={openUpgradeModal}
      />

      {/* Chatbot IA */}
      {chatOpen && <BackofficeChat profId={profId} onClose={() => setChatOpen(false)} />}

      {/* Modal explicativo de upgrade */}
      <CrmUpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal((prev) => ({ ...prev, open: false }))}
        requiredPlan={upgradeModal.requiredPlan}
        featureName={upgradeModal.featureName}
        currentPlanName={features.planName}
      />
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
    className={`p-3 rounded-xl border ${
      highlight ? 'bg-red-500/5 border-red-500/30' : 'bg-[#181818] border-[#2A2A2A]'
    }`}
  >
    <p className="text-[10px] text-gray-400 uppercase font-montserrat">{label}</p>
    <p
      className={`text-lg font-extrabold font-montserrat ${
        highlight ? 'text-red-400' : 'text-white'
      }`}
    >
      {value}
    </p>
    {sub && <p className="text-[9px] text-gray-500">{sub}</p>}
  </Card>
)

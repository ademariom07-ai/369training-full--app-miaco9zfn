import pb from '@/lib/pocketbase/client'

// ---------- TIPOS CRM ----------
export type CrmStatus = 'novo' | 'em_contato' | 'ativo' | 'inativo'
export type CrmOrigin = 'vinculo' | 'chat' | 'perfil'
export type CrmContactType = 'cliente' | 'parceiro' | 'fornecedor'
export type CrmCategory =
  | 'personal_trainer'
  | 'nutricionista'
  | 'fisioterapeuta'
  | 'psicologo'
  | 'professor_artes_marciais'

export const CRM_CONTACT_TYPE_LABELS: Record<CrmContactType, string> = {
  cliente: 'Cliente',
  parceiro: 'Parceiro',
  fornecedor: 'Fornecedor',
}

export const CRM_CATEGORY_LABELS: Record<CrmCategory, string> = {
  personal_trainer: 'Personal Trainer',
  nutricionista: 'Nutricionista',
  fisioterapeuta: 'Fisioterapeuta',
  psicologo: 'Psicólogo',
  professor_artes_marciais: 'Professor de Artes Marciais',
}

export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export interface CrmContactRecord {
  id: string
  professional: string
  student: string
  contact_name: string
  category: CrmCategory
  status: CrmStatus
  origin: CrmOrigin
  contact_type?: CrmContactType
  phone?: string
  email?: string
  notes: string
  next_followup_at: string
  estimated_value: number
  created: string
  updated: string
  expand?: {
    student?: { id: string; name: string; avatar: string; email?: string; phone?: string }
  }
}

export interface CrmFollowupItem {
  id: string
  name: string
  status: CrmStatus
  followup_date: string
  overdue: boolean
  notes: string
  estimated_value: number
}

export interface CrmSummary {
  counts: Record<CrmStatus, number> & { total: number }
  followups_today: CrmFollowupItem[]
  followups_today_count: number
  followups_overdue_count: number
  won_this_month: number
  pipeline_value: number
  conversion_rate: number
  month: string
  professional_id: string
  category: CrmCategory | null
}

export interface CrmAdminByCategory {
  category: CrmCategory
  total_contacts: number
  professionals: number
  counts: Record<string, number>
  won_this_month: number
  overdue_followups: number
  conversion_rate: number
}

export interface CrmAdminOverview {
  month: string
  by_category: CrmAdminByCategory[]
  totals: {
    contacts: number
    won_this_month: number
    professionals: number
    linked_students: number
  }
  professionals_by_category: Record<CrmCategory, number>
  professionals_lifecycle: { novo: number; ativo: number; inativo: number }
  students_lifecycle: {
    ativo: number
    inadimplente: number
    cancelado: number
    sem_vinculo: number
  }
}

// Sanitização de strings sem acionar eslint no-control-regex
export const sanitizeInputText = (str: string, maxLength = 255): string => {
  if (!str) return ''
  return Array.from(str)
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      // Permite caracteres legíveis, recusa caracteres de controle (0-31 e 127) exceto tab/newline onde permitido
      return (code >= 32 && code !== 127) || code > 127
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

export const sanitizeMultilineText = (str: string, maxLength = 5000): string => {
  if (!str) return ''
  return Array.from(str)
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      // Permite tab (9), newline (10), carriage return (13) e caracteres normais
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127) || code > 127
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

export const inferCategory = (specialties?: string[] | string): string => {
  const list = Array.isArray(specialties) ? specialties.join(' ') : specialties || ''
  const s = list.toLowerCase()
  if (s.includes('nutri')) return 'nutricionista'
  if (s.includes('fisio')) return 'fisioterapeuta'
  if (s.includes('psic')) return 'psicologo'
  if (s.includes('artes marciais') || s.includes('marcial')) return 'professor_artes_marciais'
  return 'personal_trainer'
}

// ---------- CRUD DIRETO (regras da coleção limitam ao profissional dono) ----------

export const crmApi = {
  listContacts: async (
    profId: string,
    page = 1,
    perPage = 50,
    status?: CrmStatus,
    contactType?: CrmContactType,
  ) => {
    let filter = `professional = "${profId}"`
    if (status) filter += ` && status = "${status}"`
    if (contactType) filter += ` && contact_type = "${contactType}"`
    return pb.collection('crm_contacts').getList<CrmContactRecord>(page, perPage, {
      filter,
      sort: '-updated',
      expand: 'student',
    })
  },

  createContact: async (data: {
    professional: string
    student: string
    contact_name: string
    category: CrmCategory
    status?: CrmStatus
    origin?: CrmOrigin
    contact_type?: CrmContactType
    phone?: string
    email?: string
    notes?: string
    next_followup_at?: string
    estimated_value?: number
  }) => {
    // Sanitização e validação de segurança centralizada
    const sanitizedName = sanitizeInputText(data.contact_name || '', 120)
    const sanitizedPhone = data.phone ? sanitizeInputText(data.phone, 30) : undefined
    const sanitizedEmail = data.email ? sanitizeInputText(data.email, 100).toLowerCase() : undefined
    const sanitizedNotes = data.notes ? sanitizeMultilineText(data.notes, 5000) : undefined

    return pb.collection('crm_contacts').create<CrmContactRecord>({
      ...data,
      contact_name: sanitizedName,
      phone: sanitizedPhone || '',
      email: sanitizedEmail || '',
      notes: sanitizedNotes || '',
    })
  },

  updateContact: async (id: string, data: Partial<CrmContactRecord>) => {
    // Sanitização defensiva nos campos editáveis
    const payload: Partial<CrmContactRecord> = { ...data }
    if (payload.contact_name !== undefined) {
      payload.contact_name = sanitizeInputText(payload.contact_name, 120)
    }
    if (payload.phone !== undefined) {
      payload.phone = payload.phone ? sanitizeInputText(payload.phone, 30) : ''
    }
    if (payload.email !== undefined) {
      payload.email = payload.email ? sanitizeInputText(payload.email, 100).toLowerCase() : ''
    }
    if (payload.notes !== undefined) {
      payload.notes = payload.notes ? sanitizeMultilineText(payload.notes, 5000) : ''
    }
    return pb.collection('crm_contacts').update<CrmContactRecord>(id, payload)
  },

  deleteContact: async (id: string) => {
    return pb.collection('crm_contacts').delete(id)
  },

  // ---------- ENDPOINTS DE BACKEND ----------

  captureLead: async (professionalId: string, message: string) => {
    return pb.send<{ created: boolean; reason?: string; contact_id?: string }>(
      '/backend/v1/crm/capture_lead',
      {
        method: 'POST',
        body: JSON.stringify({ professional_id: professionalId, message }),
      },
    )
  },

  summary: async (category?: CrmCategory) => {
    return pb.send<CrmSummary>('/backend/v1/crm/summary', {
      method: 'POST',
      body: JSON.stringify({ category }),
    })
  },

  adminOverview: async () => {
    return pb.send<CrmAdminOverview>('/backend/v1/crm/admin_overview', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  backofficeChat: async (message: string, conversationId?: string | null) => {
    return pb.send<{ reply: string; conversation_id: string | null }>(
      '/backend/v1/crm/backoffice_chat',
      {
        method: 'POST',
        body: JSON.stringify({ message, conversation_id: conversationId }),
      },
    )
  },
}

// ---------- HISTÓRICO DO CONTATO (mensagens + agendamentos + serviços) ----------

export interface CrmHistory {
  messages: Array<{ id: string; content: string; mine: boolean; created: string }>
  appointments: Array<{
    id: string
    servico_tipo: string
    status: string
    valor: number
    created: string
  }>
  services: Array<{ id: string; title: string; status: string; value: number; created: string }>
}

const MAX_HISTORY = 50

export const crmHistoryApi = {
  load: async (profId: string, studentId: string): Promise<CrmHistory> => {
    const [msgRes, aptRes, svcRes] = await Promise.all([
      pb.collection('messages').getList(1, MAX_HISTORY, {
        filter: `(sender = "${studentId}" && receiver = "${profId}") || (sender = "${profId}" && receiver = "${studentId}")`,
        sort: '-created',
      }),
      pb.collection('appointments').getList(1, MAX_HISTORY, {
        filter: `profissional = "${profId}" && aluno = "${studentId}"`,
        sort: '-created',
      }),
      pb.collection('services').getList(1, MAX_HISTORY, {
        filter: `professional = "${profId}" && student = "${studentId}"`,
        sort: '-created',
      }),
    ])

    return {
      messages: msgRes.items.map((m: any) => ({
        id: m.id,
        content: m.content,
        mine: m.sender === profId,
        created: m.created,
      })),
      appointments: aptRes.items.map((a: any) => ({
        id: a.id,
        servico_tipo: a.servico_tipo,
        status: a.status,
        valor: a.valor || 0,
        created: a.created,
      })),
      services: svcRes.items.map((s: any) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        value: s.value || 0,
        created: s.created,
      })),
    }
  },
}

// ---------- TEMPLATES DE MENSAGEM (persistidos em platform_config por profissional) ----------

export interface CrmTemplate {
  id: string
  name: string
  body: string
}

const TEMPLATE_KEY = (profId: string) => 'crm_templates_' + profId

const DEFAULT_TEMPLATES: CrmTemplate[] = [
  {
    id: 'tmpl_1',
    name: 'Follow-up pós-aula',
    body: 'Oi {nome}! Como foi o treino de hoje? Qualquer dúvida me chama.',
  },
  {
    id: 'tmpl_2',
    name: 'Reativar inativo',
    body: '{nome}, faz um tempo que não te vejo! Que tal retomarmos com uma aula especial?',
  },
  {
    id: 'tmpl_3',
    name: 'Agendar avaliação',
    body: 'Olá {nome}! Podemos agendar sua avaliação esta semana? Tenho horários na {data}.',
  },
]

const VARIABLE_PATTERN = /\{(nome|data|horario|profissional|servico)\}/g

export const crmTemplatesApi = {
  list: async (profId: string): Promise<CrmTemplate[]> => {
    try {
      const rec = await pb
        .collection('platform_config')
        .getFirstListItem(`key = "${TEMPLATE_KEY(profId)}"`)
      const parsed = rec.get('value')
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as CrmTemplate[]
    } catch {
      /* intentionally ignored */
    }
    return DEFAULT_TEMPLATES
  },

  save: async (profId: string, templates: CrmTemplate[]) => {
    const key = TEMPLATE_KEY(profId)
    try {
      const rec = await pb.collection('platform_config').getFirstListItem(`key = "${key}"`)
      await pb.collection('platform_config').update(rec.id, { value: templates })
    } catch (_) {
      await pb
        .collection('platform_config')
        .create({ key, value: templates, description: 'Templates de follow-up CRM' })
    }
  },

  renderTemplate: (body: string, vars: Record<string, string>) => {
    return body.replace(VARIABLE_PATTERN, (_, v) => vars[v] || `{${v}}`)
  },

  extractVariables: (body: string) => {
    return Array.from(new Set(Array.from(body.matchAll(VARIABLE_PATTERN)).map((m) => m[1])))
  },
}

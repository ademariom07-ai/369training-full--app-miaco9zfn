import pb from '@/lib/pocketbase/client'

// ---------- TIPOS CRM ----------
export type CrmStatus = 'novo' | 'em_contato' | 'ativo' | 'inativo'
export type CrmOrigin = 'vinculo' | 'chat' | 'perfil'
export type CrmCategory =
  | 'personal_trainer'
  | 'nutricionista'
  | 'fisioterapeuta'
  | 'psicologo'
  | 'professor_artes_marciais'

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
  notes: string
  next_followup_at: string
  estimated_value: number
  created: string
  updated: string
  expand?: { student?: { id: string; name: string; avatar: string } }
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
  listContacts: async (profId: string, page = 1, perPage = 50, status?: CrmStatus) => {
    let filter = `professional = "${profId}"`
    if (status) filter += ` && status = "${status}"`
    return pb.collection('crm_contacts').getList<CrmContactRecord>(page, perPage, {
      filter,
      sort: '-updated',
    })
  },

  createContact: async (data: {
    professional: string
    student: string
    contact_name: string
    category: CrmCategory
    status?: CrmStatus
    origin?: CrmOrigin
    notes?: string
    next_followup_at?: string
    estimated_value?: number
  }) => {
    return pb.collection('crm_contacts').create<CrmContactRecord>(data)
  },

  updateContact: async (id: string, data: Partial<CrmContactRecord>) => {
    return pb.collection('crm_contacts').update<CrmContactRecord>(id, data)
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

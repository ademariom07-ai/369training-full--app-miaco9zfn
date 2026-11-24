// 369 WELLNESS · Edge Function "isis": a assistente virtual do profissional.
// O profissional conversa ("Ísis, cria o treino da semana da dona Célia, ela sentiu a lombar"); a Ísis lê os alunos
// com vínculo ativo, o treino atual e os registros recentes (esforço, dor, recados), monta ou ajusta o RASCUNHO e,
// quando o profissional confirma ("pode enviar"), publica para o aluno.
// Tudo é gravado com o login do próprio profissional (funções save_routine/publish_routine), que conferem as permissões.
// Arquivo único para colar no painel do Supabase (Edge Functions › Deploy a new function › Via editor), com o nome "isis".
// Usa os mesmos segredos da "routine-ai": ANTHROPIC_API_KEY (obrigatório), ROUTINE_MODEL e ROUTINE_ALLOWED_ORIGINS.
// Opcional: ISIS_LIMIT_PRO (mensagens por dia por profissional, padrão 60).
import Anthropic from 'npm:@anthropic-ai/sdk@1.10.0'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const NAME = 'Ísis'
const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'] as const
const envModel = Deno.env.get('ROUTINE_MODEL') || ''
const MODEL: (typeof MODELS)[number] = (MODELS as readonly string[]).includes(envModel) ? (envModel as (typeof MODELS)[number]) : 'claude-sonnet-5-5'
const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const
const DAY_NAMES: Record<string, string> = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sábado', dom: 'domingo' }
const LIBRARY = ["Remada curvada com barra", "Agachamento livre", "Flexão de braço", "Elevação de quadril (ponte)", "Agachamento com barra", "Agachamento goblet com halter", "Afundo (avanço)", "Levantamento terra", "Stiff com barra", "Panturrilha em pé", "Cadeira extensora", "Mesa flexora", "Leg press 45°", "Elevação pélvica com barra", "Supino reto com barra", "Supino reto com halteres", "Supino inclinado com halteres", "Flexão inclinada (mãos no banco)", "Remada curvada com halteres", "Puxada frontal no pulley", "Remada baixa no cabo", "Superman (extensão lombar no solo)", "Desenvolvimento com halteres (sentado)", "Elevação frontal com halteres", "Rosca direta com halteres", "Tríceps francês com halter", "Tríceps testa com barra", "Prancha", "Abdominal (crunch)", "Elevação de pernas"]
const TRAINING_AREAS = ['educacao_fisica', 'fisioterapia', 'artes_marciais']
const limitEnv = Number(Deno.env.get('ISIS_LIMIT_PRO'))
const LIMIT = Number.isInteger(limitEnv) && limitEnv >= 1 && limitEnv <= 500 ? limitEnv : 60
const ORIGINS = (Deno.env.get('ROUTINE_ALLOWED_ORIGINS') || 'https://369wellness.app,https://www.369wellness.app,https://369wellness.ademariom07.workers.dev')
  .split(',').map((v) => v.trim()).filter(Boolean)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

function cors(origin: string | null) {
  const allowed = origin && ORIGINS.includes(origin) ? origin : ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
}

const daySchema = {
  type: 'object', additionalProperties: false, required: ['key', 'name', 'items'],
  properties: {
    key: { type: 'string', enum: [...DAYS] }, name: { type: 'string' },
    items: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['library', 'name', 'sets', 'reps', 'rest', 'load', 'notes'],
      properties: { library: { type: 'string', enum: [...LIBRARY, ''] }, name: { type: 'string' }, sets: { type: 'integer' }, reps: { type: 'string' }, rest: { type: 'string' }, load: { type: 'string' }, notes: { type: 'string' } },
    } },
  },
}
const outputSchema = {
  type: 'object', additionalProperties: false, required: ['reply', 'actions'],
  properties: {
    reply: { type: 'string' },
    actions: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['type', 'student', 'title', 'notes', 'days'],
      properties: { type: { type: 'string', enum: ['criar', 'alterar', 'enviar'] }, student: { type: 'integer' }, title: { type: 'string' }, notes: { type: 'string' }, days: { type: 'array', items: daySchema } },
    } },
  },
}

const SYSTEM = `Você é a ${NAME}, assistente virtual da 369 WELLNESS (pilares: foco, disciplina e estratégia). Você trabalha para um profissional de educação física (ou fisioterapia/artes marciais) e o ajuda a montar e ajustar os treinos dos alunos dele. Fale em português do Brasil, de forma curta, simpática e direta, como uma colega de trabalho. O profissional é quem decide: você sugere, ele valida.

Você recebe a lista numerada dos alunos ativos do profissional, com objetivo, treino publicado, rascunho atual e registros recentes (o que o aluno fez, cargas, esforço de 1 a 10, dor e recados). Use esses relatórios: se o aluno relatou dor numa região, evite exercícios que forcem aquela região e explique a troca; se o esforço está baixo e ele fez tudo, pode progredir carga ou volume; se ele pula exercícios, simplifique.

Ações (campo "actions"; use "student" com o número do aluno na lista):
- "criar": monta um treino novo (rascunho) para o aluno. Preencha title, notes e days.
- "alterar": muda o RASCUNHO atual do aluno. Devolva o treino COMPLETO já com as mudanças pedidas (não só a parte alterada). Se o aluno não tem rascunho, use "criar" partindo do treino publicado.
- "enviar": publica o rascunho atual para o aluno. Use SOMENTE quando o profissional disser claramente para enviar/confirmar/finalizar/publicar e o aluno tiver rascunho (ou um que você está criando agora). Para "enviar", deixe title e notes vazios e days como [].
- Pode haver várias ações numa resposta (ex.: criar treinos de dois alunos). Sem pedido de mudança, actions = [].

Regras dos treinos:
- Dias: se o profissional não disser, use os mesmos dias do treino publicado; se não houver, 3 dias (seg, qua, sex). Um treino por dia, com nome curto (ex.: "Treino A — pernas e glúteos"). 4 a 8 exercícios por dia, nunca mais de 10.
- Preencha "library" com o exercício da lista quando for o mesmo movimento (tem animação no app); prefira exercícios da lista. Deixe vazio só quando nenhum servir.
- Em "load", a carga ou intensidade (ex.: "12 kg", "leve", "peso para 12 repetições"). Em "notes" de cada exercício, uma dica curta. Em "notes" do plano, aquecimento, progressão e o aviso de parar se sentir dor, tontura ou falta de ar.
- Nunca faça diagnóstico, não prescreva remédios nem suplementos, não prometa resultados. Dieta: diga que, por enquanto, você monta só treinos (dieta é com o nutricionista).
- Se o nome do aluno não estiver na lista, ou houver dúvida entre dois alunos, pergunte antes de agir (actions = []).

Em "reply": diga em 1 a 4 frases o que fez e por quê (cite o relatório quando usar, ex.: "tirei o levantamento terra porque ela relatou dor lombar") e termine pedindo para o profissional revisar ("Confere e me diz se posso enviar."). Depois de enviar, confirme que o aluno já recebe no celular. Não repita o treino inteiro no texto: ele aparece em um cartão na tela.`

type Msg = { role: 'user' | 'assistant'; content: string }
type Plan = { plan_id: string; student_id: string; kind: string; status: string; title: string; notes: string | null; structure: { days?: { key: string; name: string; items: Record<string, unknown>[] }[] }; mine: boolean; updated_at: string }
type Session = { student_id: string; day_name: string | null; day_key: string; done_on: string; effort: number | null; pain: number; note: string | null; entries: { name: string; done: boolean; sets: number | null; reps: string; load: string }[] }

const planText = (p: Plan, full: boolean) => (p.structure.days || []).map((d) =>
  `  ${DAY_NAMES[d.key] || d.key} — ${d.name}: ` + d.items.map((i) => full
    ? `${i.name} ${i.sets ?? ''}x${i.reps ?? ''}${i.load ? ` (${i.load})` : ''}${i.rest ? ` desc ${i.rest}` : ''}${i.notes ? ` [${clip(i.notes, 80)}]` : ''}`
    : `${i.name} ${i.sets ?? ''}x${i.reps ?? ''}${i.load ? ` (${i.load})` : ''}`).join('; ')).join('\n')
const painText = ['sem dor', 'DOR LEVE', 'DOR FORTE']
const sessionText = (s: Session) => {
  const skipped = s.entries.filter((e) => !e.done).map((e) => e.name)
  const loads = s.entries.filter((e) => e.done && e.load).map((e) => `${e.name} ${e.load}`).slice(0, 6)
  return `  ${s.done_on} ${s.day_name || s.day_key}: esforço ${s.effort ?? '?'}/10, ${painText[s.pain] || 'sem dor'}` +
    (s.note ? `, recado: "${clip(s.note, 200)}"` : '') + (skipped.length ? `; não fez: ${skipped.join(', ')}` : '; fez tudo') +
    (loads.length ? `; cargas: ${loads.join(', ')}` : '')
}

// Ajusta o treino que voltou da IA aos limites do banco (o banco valida de novo).
function normalizeDays(raw: unknown) {
  const seen = new Set<string>()
  return (Array.isArray(raw) ? raw : []).flatMap((d: Record<string, unknown>) => {
    const key = String(d?.key)
    if (!(DAYS as readonly string[]).includes(key) || seen.has(key)) return []
    seen.add(key)
    const items = (Array.isArray(d.items) ? d.items : []).slice(0, 12).map((i: Record<string, unknown>) => ({
      name: LIBRARY.includes(String(i.library)) ? String(i.library) : clip(i.name, 80),
      sets: Number.isInteger(i.sets) && (i.sets as number) >= 1 && (i.sets as number) <= 10 ? i.sets : 3,
      reps: clip(i.reps, 20), rest: clip(i.rest, 20), load: clip(i.load, 40), video: null, notes: clip(i.notes, 300),
    })).filter((i) => i.name)
    return items.length ? [{ key, name: clip(d.name, 60) || 'Treino', items }] : []
  })
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, { message: 'Método não permitido.' })
  const origin = req.headers.get('Origin')
  if (origin && !ORIGINS.includes(origin)) return reply(403, { message: 'Origem não permitida.' })
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return reply(503, { message: 'A IA ainda não foi configurada.' })
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { message: 'Entre na sua conta.' })

  const url = Deno.env.get('SUPABASE_URL')!
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: auth, error: authError } = await user.auth.getUser(token)
  if (authError || !auth.user || auth.user.is_anonymous) return reply(401, { message: 'Entre na sua conta.' })
  const me = auth.user.id
  const { data: profile } = await service.from('profiles').select('role,approved,display_name').eq('id', me).maybeSingle()
  if (profile?.role !== 'profissional' || !profile.approved) return reply(403, { message: `A ${NAME} está disponível para profissionais aprovados.` })
  const { data: app } = await service.from('professional_applications').select('specialty').eq('applicant_id', me).eq('status', 'approved').maybeSingle()
  if (!TRAINING_AREAS.includes(String(app?.specialty))) return reply(403, { message: `Por enquanto, a ${NAME} monta treinos (educação física, fisioterapia e artes marciais).` })

  let body: { messages?: Msg[] }
  try { body = await req.json() } catch { return reply(400, { message: 'Pedido inválido.' }) }
  const messages = (Array.isArray(body?.messages) ? body.messages : []).slice(-12)
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
  while (messages.length && messages[0].role !== 'user') messages.shift()
  if (!messages.length || messages[messages.length - 1].role !== 'user') return reply(400, { message: 'Escreva uma mensagem.' })

  // Limite diário de mensagens.
  const since = new Date(Date.now() - 86400000).toISOString()
  const { count } = await service.from('assistant_calls').select('id', { count: 'exact', head: true }).eq('user_id', me).gte('created_at', since)
  if ((count ?? 0) >= LIMIT) return reply(429, { message: `Limite de ${LIMIT} mensagens por dia com a ${NAME} atingido. Tente amanhã.` })
  await service.from('assistant_calls').insert({ user_id: me })

  // Alunos ativos e seus relatórios (lidos com o login do profissional, então valem as mesmas permissões do app).
  const { data: links } = await service.from('student_professional_links').select('student_id').eq('professional_id', me).eq('state', 'active').limit(40)
  const ids = (links || []).map((l) => l.student_id as string)
  if (!ids.length) return reply(200, { reply: `Oi! Sou a ${NAME}. Assim que você aceitar um aluno em "Meus alunos", eu monto e ajusto os treinos dele com você.`, results: [] })
  const [{ data: people }, { data: goals }, { data: sessionRows }] = await Promise.all([
    service.from('profiles').select('id,display_name').in('id', ids),
    service.from('account_goals').select('user_id,goal').in('user_id', ids),
    user.rpc('list_routine_sessions', { p_student: null }),
  ])
  const plans = await Promise.all(ids.map(async (id) => { const { data } = await user.rpc('list_routines', { p_student: id }); return (data || []) as Plan[] }))
  const students = ids.map((id, i) => {
    const own = plans[i].filter((p) => p.kind === 'treino')
    return {
      id, name: clip((people || []).find((p) => p.id === id)?.display_name, 80) || 'Aluno sem nome',
      goal: clip((goals || []).find((g) => g.user_id === id)?.goal, 60),
      published: own.find((p) => p.status === 'publicado') || null,
      draft: own.filter((p) => p.mine && p.status === 'rascunho').sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] || null,
      review: own.find((p) => p.status === 'revisao') || null,
      sessions: ((sessionRows || []) as Session[]).filter((s) => s.student_id === id).slice(0, 6),
    }
  })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const context = `Hoje: ${today}. Profissional: ${clip(profile.display_name, 80) || 'profissional'}.\nAlunos ativos:\n` + students.map((s, i) => [
    `${i + 1}. ${s.name}${s.goal ? ` — objetivo: ${s.goal}` : ''}`,
    s.published ? ` Treino publicado: "${s.published.title}"\n${planText(s.published, false)}` : ' Sem treino publicado.',
    s.draft ? ` RASCUNHO atual: "${s.draft.title}"${s.draft.notes ? ` (orientações: ${clip(s.draft.notes, 300)})` : ''}\n${planText(s.draft, true)}` : ' Sem rascunho.',
    s.review ? ` Há um treino gerado pelo aluno com IA aguardando revisão: "${s.review.title}".` : '',
    s.sessions.length ? ` Registros recentes:\n${s.sessions.map(sessionText).join('\n')}` : ' Sem registros de treino ainda.',
  ].filter(Boolean).join('\n')).join('\n\n')

  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 })
  let out: { reply?: unknown; actions?: unknown }
  try {
    const fallback = MODEL === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    const convo = messages.map((m, i) => i === messages.length - 1 ? { role: m.role, content: `${context}\n\n---\nMensagem do profissional: ${m.content}` } : m)
    const message = await client.beta.messages.create({
      model: MODEL, max_tokens: 16000, ...fallback, system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: outputSchema } },
      messages: convo,
    })
    if (message.stop_reason === 'refusal') return reply(200, { reply: 'Não consigo ajudar com isso. Posso montar ou ajustar o treino de algum aluno?', results: [] })
    if (message.stop_reason === 'max_tokens') return reply(502, { message: 'Ficou grande demais. Peça um aluno por vez.' })
    out = JSON.parse(message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(''))
  } catch (err) {
    const code = err instanceof Anthropic.APIError ? String(err.status ?? 'API') : err instanceof SyntaxError ? 'PARSE' : 'REDE'
    console.error('isis', MODEL, code, err instanceof Error ? err.message : String(err))
    return reply(502, { message: `A ${NAME} está indisponível agora (código ${code}). Tente de novo em alguns minutos.` })
  }

  // Executa as ações com o login do profissional.
  const results: { type: string; student_id: string; student_name: string; plan_id: string | null; status: string; error?: string }[] = []
  for (const a of (Array.isArray(out.actions) ? out.actions : []).slice(0, 5) as Record<string, unknown>[]) {
    const s = students[Number(a.student) - 1]
    if (!s || !['criar', 'alterar', 'enviar'].includes(String(a.type))) continue
    const type = String(a.type)
    if (type === 'enviar') {
      const target = results.find((r) => r.student_id === s.id && r.plan_id && r.status === 'rascunho')?.plan_id || s.draft?.plan_id
      if (!target) { results.push({ type, student_id: s.id, student_name: s.name, plan_id: null, status: 'erro', error: 'Não há rascunho para enviar.' }); continue }
      const { data, error } = await user.rpc('publish_routine', { p_id: target })
      results.push({ type, student_id: s.id, student_name: s.name, plan_id: target, status: error ? 'erro' : String(data), error: error?.message })
      continue
    }
    const days = normalizeDays(a.days)
    if (!days.length) { results.push({ type, student_id: s.id, student_name: s.name, plan_id: null, status: 'erro', error: 'Treino vazio.' }); continue }
    const id = type === 'alterar' ? (results.find((r) => r.student_id === s.id && r.plan_id)?.plan_id || s.draft?.plan_id || null) : null
    const { data, error } = await user.rpc('save_routine', {
      p_id: id, p_student: s.id, p_kind: 'treino', p_source: 'ia_profissional',
      p_title: clip(a.title, 120) || (id && s.draft ? s.draft.title : 'Treino da semana'), p_notes: clip(a.notes, 2000) || null, p_structure: { days },
    })
    results.push({ type, student_id: s.id, student_name: s.name, plan_id: typeof data === 'string' && uuid.test(data) ? data : null, status: error ? 'erro' : 'rascunho', error: error?.message })
  }
  return reply(200, { reply: clip(out.reply, 1500) || 'Pronto.', results })
})

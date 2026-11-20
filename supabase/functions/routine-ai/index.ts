// 369 WELLNESS · Edge Function "routine-ai": gera treino (aluno ou profissional) ou dieta (profissional) com o Claude.
// O plano volta como RASCUNHO pela função do banco save_routine, que confere de novo quem pode criar o quê.
// Arquivo único para colar no painel do Supabase (Edge Functions › Deploy a new function › Via editor).
// Segredo necessário: ANTHROPIC_API_KEY. Opcionais: ROUTINE_ALLOWED_ORIGINS (lista separada por vírgula) e
// ROUTINE_MODEL: claude-sonnet-5-5 (padrão, ~US$ 0,02-0,04 por plano), claude-haiku-5-5 (~US$ 0,002-0,005,
// o mais barato) ou claude-opus-5-5 (~US$ 0,05-0,15, o mais caprichado).
import Anthropic from 'npm:@anthropic-ai/sdk@1.10.0'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'] as const
const envModel = Deno.env.get('ROUTINE_MODEL') || ''
const MODEL: (typeof MODELS)[number] = (MODELS as readonly string[]).includes(envModel) ? (envModel as (typeof MODELS)[number]) : 'claude-sonnet-5-5'
const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const
const LIMITS = { aluno: 3, profissional: 15 } // gerações por 24 h
const ORIGINS = (Deno.env.get('ROUTINE_ALLOWED_ORIGINS') || 'https://369wellness.ademariom07.workers.dev')
  .split(',').map((v) => v.trim()).filter(Boolean)

type Answers = {
  goal: string; level: string; days: string[]; minutes: number; place: string; equipment: string; limitations: string
  meals_per_day?: number; avoid_foods?: string; restrictions?: string; parq?: boolean[]
}
type Body = { kind: 'treino' | 'dieta'; student_id: string; answers: Answers }

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function cors(origin: string | null) {
  const allowed = origin && ORIGINS.includes(origin) ? origin : ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

// Esquemas de saída (structured outputs): o Claude devolve exatamente este JSON.
const trainingSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'notes', 'days'],
  properties: {
    title: { type: 'string' }, notes: { type: 'string' },
    days: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['key', 'name', 'items'],
      properties: {
        key: { type: 'string', enum: [...DAYS] }, name: { type: 'string' },
        items: { type: 'array', items: {
          type: 'object', additionalProperties: false, required: ['name', 'sets', 'reps', 'rest', 'load', 'notes'],
          properties: { name: { type: 'string' }, sets: { type: 'integer' }, reps: { type: 'string' }, rest: { type: 'string' }, load: { type: 'string' }, notes: { type: 'string' } },
        } },
      },
    } },
  },
}
const dietSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'notes', 'meals'],
  properties: {
    title: { type: 'string' }, notes: { type: 'string' },
    meals: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['name', 'time', 'items'],
      properties: {
        name: { type: 'string' }, time: { type: 'string' },
        items: { type: 'array', items: {
          type: 'object', additionalProperties: false, required: ['food', 'qty', 'notes', 'subs'],
          properties: { food: { type: 'string' }, qty: { type: 'string' }, notes: { type: 'string' }, subs: { type: 'string' } },
        } },
      },
    } },
  },
}

const SYSTEM_TRAINING = `Você monta treinos para a plataforma brasileira 369 WELLNESS. Escreva tudo em português do Brasil, simples e direto.
Regras:
- Use somente os dias da semana informados, um treino por dia, com nome curto (ex.: "Treino A — pernas e glúteos").
- Respeite o tempo por sessão: em geral 4 a 8 exercícios por dia; nunca mais de 10.
- Respeite o local e os equipamentos disponíveis; não use aparelhos que a pessoa não tem.
- Para iniciantes, comece leve: menos séries, cargas leves e foco em técnica. Distribua os grupos musculares para permitir recuperação.
- Respeite as limitações e lesões informadas: evite exercícios que forcem a região e prefira alternativas seguras.
- Em "notes" de cada exercício, dê uma dica curta de execução. Em "load", descreva a intensidade (ex.: "leve", "moderada", "peso que permita 12 repetições").
- Em "notes" do plano, inclua aquecimento, progressão nas próximas semanas e o aviso de parar e procurar um profissional se sentir dor, tontura ou falta de ar.
- Nunca faça diagnóstico, não prescreva remédios nem suplementos e não prometa resultados.
- Sempre que servir ao objetivo, use exatamente estes nomes (eles têm animação no app): Remada curvada com barra, Agachamento livre, Flexão de braço, Elevação de quadril (ponte), Agachamento com barra, Agachamento goblet com halter, Afundo (avanço), Levantamento terra, Stiff com barra, Panturrilha em pé, Cadeira extensora, Mesa flexora, Leg press 45°, Elevação pélvica com barra, Supino reto com barra, Supino reto com halteres, Supino inclinado com halteres, Flexão inclinada (mãos no banco), Remada curvada com halteres, Puxada frontal no pulley, Remada baixa no cabo, Superman (extensão lombar no solo), Desenvolvimento com halteres (sentado), Elevação frontal com halteres, Rosca direta com halteres, Tríceps francês com halter, Tríceps testa com barra, Prancha, Abdominal (crunch), Elevação de pernas.`
const SYSTEM_DIET = `Você ajuda nutricionistas da plataforma brasileira 369 WELLNESS a montar um RASCUNHO de plano alimentar, que será revisado e ajustado pelo nutricionista antes de chegar ao paciente. Escreva em português do Brasil.
Regras:
- Use alimentos comuns no Brasil, acessíveis, com quantidades em medidas caseiras (colheres, unidades, xícaras) e gramas quando útil.
- Respeite o número de refeições, os alimentos a evitar e as restrições informadas (alergias, intolerâncias, vegetarianismo etc.).
- Em "subs", dê 1 a 3 substituições equivalentes. Em "time", use o formato HH:MM.
- Planos equilibrados: nada de dietas extremas, jejuns prolongados, suplementos ou remédios.
- Em "notes" do plano, inclua hidratação e lembretes gerais; deixe claro que o nutricionista deve ajustar às necessidades do paciente.`

function describe(kind: string, a: Answers) {
  const lines = [
    `Objetivo: ${clip(a.goal, 80)}`, `Nível: ${clip(a.level, 40)}`,
    kind === 'treino' ? `Dias disponíveis: ${a.days.join(', ')}` : '', kind === 'treino' ? `Minutos por sessão: ${a.minutes}` : '',
    kind === 'treino' ? `Local: ${clip(a.place, 40)}` : '', kind === 'treino' ? `Equipamentos: ${clip(a.equipment, 300) || 'nenhum informado'}` : '',
    `Limitações, lesões ou condições: ${clip(a.limitations, 400) || 'nenhuma informada'}`,
    kind === 'dieta' ? `Refeições por dia: ${a.meals_per_day ?? 5}` : '',
    kind === 'dieta' ? `Alimentos a evitar: ${clip(a.avoid_foods, 300) || 'nenhum'}` : '',
    kind === 'dieta' ? `Restrições: ${clip(a.restrictions, 300) || 'nenhuma'}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

// Ajusta o que voltou da IA aos limites do banco (o banco valida de novo).
function normalize(kind: string, raw: Record<string, unknown>, days: string[]) {
  const title = clip(raw.title, 120) || (kind === 'treino' ? 'Treino sugerido' : 'Plano alimentar sugerido')
  const notes = clip(raw.notes, 2000)
  if (kind === 'treino') {
    const seen = new Set<string>()
    const list = (Array.isArray(raw.days) ? raw.days : []).flatMap((d: Record<string, unknown>) => {
      const key = String(d?.key)
      if (!days.includes(key) || seen.has(key)) return []
      seen.add(key)
      const items = (Array.isArray(d.items) ? d.items : []).slice(0, 12).map((i: Record<string, unknown>) => ({
        name: clip(i.name, 80), sets: Number.isInteger(i.sets) && (i.sets as number) >= 1 && (i.sets as number) <= 10 ? i.sets : 3,
        reps: clip(i.reps, 20), rest: clip(i.rest, 20), load: clip(i.load, 40), video: null, notes: clip(i.notes, 300),
      })).filter((i) => i.name)
      return items.length ? [{ key, name: clip(d.name, 60) || 'Treino', items }] : []
    })
    return { title, notes, structure: { days: list } }
  }
  const meals = (Array.isArray(raw.meals) ? raw.meals : []).slice(0, 8).map((m: Record<string, unknown>) => ({
    name: clip(m.name, 60) || 'Refeição',
    time: /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(m.time)) ? String(m.time) : null,
    items: (Array.isArray(m.items) ? m.items : []).slice(0, 15).map((i: Record<string, unknown>) => ({
      food: clip(i.food, 80), qty: clip(i.qty, 40), notes: clip(i.notes, 200), subs: clip(i.subs, 200),
    })).filter((i) => i.food),
  })).filter((m) => m.items.length)
  return { title, notes, structure: { meals } }
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
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth, error: authError } = await user.auth.getUser(token)
  if (authError || !auth.user || auth.user.is_anonymous) return reply(401, { message: 'Entre na sua conta.' })
  const { data: profile } = await user.from('profiles').select('role,approved').eq('id', auth.user.id).maybeSingle()
  const role = profile?.role === 'aluno' ? 'aluno' : profile?.role === 'profissional' && profile.approved ? 'profissional' : null
  if (!role) return reply(403, { message: 'Disponível para alunos e profissionais aprovados.' })

  let body: Body
  try { body = await req.json() } catch { return reply(400, { message: 'Pedido inválido.' }) }
  const a = body?.answers
  if (!body || !['treino', 'dieta'].includes(body.kind) || !uuid.test(String(body.student_id)) || !a || typeof a !== 'object') {
    return reply(400, { message: 'Pedido inválido.' })
  }
  const days = Array.isArray(a.days) ? [...new Set(a.days.filter((d) => (DAYS as readonly string[]).includes(d)))] : []
  const minutes = Math.round(Number(a.minutes))
  if (body.kind === 'treino' && (!days.length || !(minutes >= 15 && minutes <= 120))) {
    return reply(400, { message: 'Escolha os dias e um tempo entre 15 e 120 minutos.' })
  }
  if (role === 'aluno') {
    if (body.kind !== 'treino' || body.student_id !== auth.user.id) return reply(403, { message: 'O aluno pode gerar só o próprio treino.' })
    if (!Array.isArray(a.parq) || a.parq.length !== 7) return reply(400, { message: 'Responda o questionário de saúde.' })
    if (a.parq.some(Boolean)) {
      return reply(422, { message: 'Pelas suas respostas, o mais seguro é começar com um profissional e liberação médica. Procure um em "Encontrar profissionais".' })
    }
  }

  // Limite diário de gerações (contado no banco, com a chave de serviço).
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const since = new Date(Date.now() - 86400000).toISOString()
  const { count } = await service.from('routine_plans').select('id', { count: 'exact', head: true })
    .eq('author_id', auth.user.id).in('source', ['ia_aluno', 'ia_profissional']).gte('created_at', since)
  if ((count ?? 0) >= LIMITS[role]) return reply(429, { message: `Limite de ${LIMITS[role]} gerações por dia atingido. Tente amanhã.` })

  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 })
  let raw: Record<string, unknown>
  try {
    // Esforço baixo: o plano é um formato simples e o banco valida tudo depois; mantém o custo menor.
    // Sonnet e Opus têm troca automática de modelo em caso de recusa; o Haiku não tem esse recurso.
    const fallback = MODEL === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      ...fallback,
      system: body.kind === 'treino' ? SYSTEM_TRAINING : SYSTEM_DIET,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: body.kind === 'treino' ? trainingSchema : dietSchema } },
      messages: [{ role: 'user', content: `Monte ${body.kind === 'treino' ? 'o treino semanal' : 'o plano alimentar'} para esta pessoa:\n${describe(body.kind, { ...a, days, minutes })}` }],
    })
    if (message.stop_reason === 'refusal') return reply(422, { message: 'A IA não conseguiu montar este plano. Ajuste as informações ou fale com um profissional.' })
    if (message.stop_reason === 'max_tokens') return reply(502, { message: 'O plano ficou grande demais. Tente com menos dias.' })
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    raw = JSON.parse(text)
  } catch (err) {
    console.error('routine-ai', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err))
    return reply(502, { message: 'A IA está indisponível agora. Tente de novo em alguns minutos.' })
  }

  const plan = normalize(body.kind, raw, days)
  const { data: planId, error } = await user.rpc('save_routine', {
    p_id: null, p_student: body.student_id, p_kind: body.kind, p_source: role === 'aluno' ? 'ia_aluno' : 'ia_profissional',
    p_title: plan.title, p_notes: plan.notes || null, p_structure: plan.structure,
  })
  if (error || typeof planId !== 'string') return reply(422, { message: error?.message || 'Não foi possível salvar o plano.' })
  return reply(200, { plan_id: planId })
})

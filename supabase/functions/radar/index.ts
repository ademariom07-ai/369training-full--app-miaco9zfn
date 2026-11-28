// 369 WELLNESS · Edge Function "radar": Radar 369 — estudos científicos recentes do PubMed, resumidos em português.
// Chamada toda semana pelo agendador do banco (x-cron-token) ou pelo admin logado ("Atualizar agora").
// Publique com o nome "radar" (minúsculo) e DESLIGUE "Verify JWT with legacy secret" (a função confere quem chama).
// Segredos: os mesmos da Ísis (ANTHROPIC_API_KEY, ROUTINE_MODEL). Fonte: PubMed E-utilities (gratuito, oficial).
import Anthropic from 'npm:@anthropic-ai/sdk@1.10.0'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'] as const
const envModel = Deno.env.get('ROUTINE_MODEL') || ''
const MODEL: (typeof MODELS)[number] = (MODELS as readonly string[]).includes(envModel) ? (envModel as (typeof MODELS)[number]) : 'claude-haiku-5-5'
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const ORIGINS = (Deno.env.get('ROUTINE_ALLOWED_ORIGINS') || 'https://369wellness.app,https://www.369wellness.app,https://369wellness.ademariom07.workers.dev').split(',').map((v) => v.trim()).filter(Boolean)
const QUALITY = '(meta-analysis[pt] OR systematic review[pt] OR randomized controlled trial[pt] OR practice guideline[pt])'
// Buscas por especialidade (em inglês, como o PubMed indexa). Artes marciais têm poucos ensaios: aceita outros tipos.
export const SEARCHES: Record<string, { term: string; strict: boolean; days: number }> = {
  educacao_fisica: { term: '(resistance training[tiab] OR strength training[tiab] OR high-intensity interval training[tiab] OR aerobic exercise[tiab]) AND humans[mh]', strict: true, days: 45 },
  nutricao: { term: '(dietary protein[tiab] OR diet quality[tiab] OR weight loss diet[tiab] OR sports nutrition[tiab] OR intermittent fasting[tiab]) AND humans[mh]', strict: true, days: 45 },
  fisioterapia: { term: '(low back pain[tiab] OR exercise therapy[tiab] OR physiotherapy[tiab] OR knee osteoarthritis[tiab] OR rehabilitation exercise[tiab]) AND humans[mh]', strict: true, days: 45 },
  psicologia: { term: '(exercise adherence[tiab] OR physical activity motivation[tiab] OR sport psychology[tiab] OR exercise depression[tiab] OR exercise anxiety[tiab]) AND humans[mh]', strict: true, days: 60 },
  artes_marciais: { term: '(martial arts[tiab] OR judo[tiab] OR karate[tiab] OR jiu-jitsu[tiab] OR taekwondo[tiab] OR combat sports[tiab])', strict: false, days: 120 },
}
const PER_SPECIALTY = 3

// Nível de evidência pelo tipo de publicação do PubMed (não pela IA).
export function evidenceFrom(types: string[]) {
  const t = types.map((x) => x.toLowerCase())
  if (t.some((x) => x.includes('meta-analysis'))) return 'metanalise'
  if (t.some((x) => x.includes('systematic review'))) return 'revisao_sistematica'
  if (t.some((x) => x.includes('randomized controlled trial') || x.includes('clinical trial'))) return 'ensaio_clinico'
  if (t.some((x) => x.includes('guideline'))) return 'diretriz'
  if (t.some((x) => x === 'review')) return 'revisao'
  return 'estudo'
}
// Texto do resumo (abstract) a partir do XML do efetch, por PMID.
export function abstractsFromXml(xml: string) {
  const out: Record<string, string> = {}
  for (const art of xml.split('<PubmedArticle>').slice(1)) {
    const pmid = art.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1]
    if (!pmid) continue
    const parts = [...art.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map((m) => {
      const label = m[1].match(/Label="([^"]+)"/)?.[1]
      const text = m[2].replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x?[0-9a-f]+;/gi, ' ').replace(/\s+/g, ' ').trim()
      return label ? `${label}: ${text}` : text
    })
    out[pmid] = parts.join(' ').slice(0, 3500)
  }
  return out
}
type Summary = { uid: string; title: string; fulljournalname?: string; source?: string; pubdate?: string; pubtype?: string[] }
export function summariesFromJson(json: { result?: Record<string, unknown> }) {
  const r = json?.result || {}
  const uids = (r.uids as string[]) || []
  return uids.map((u) => r[u] as Summary).filter((s) => s && s.uid && s.title)
}

const SYSTEM = `Você escreve o "Radar 369" para profissionais de saúde e bem-estar (educação física, nutrição, fisioterapia, psicologia, artes marciais) no Brasil.
Para cada estudo recebido (título e resumo originais do PubMed), escreva em português do Brasil, claro e sem exagero:
- title_pt: título traduzido e curto (até 140 caracteres).
- summary_pt: o que o estudo fez e encontrou, em 2 a 4 frases (até 600 caracteres), com números quando o resumo trouxer. Diga o tipo de participante.
- practice_pt: como isso pode ajudar o profissional na prática, com cautela (até 300 caracteres). Se o estudo for pequeno, preliminar ou em população muito específica, diga isso.
- content_idea_pt: uma ideia curta de post ou vídeo educativo para os alunos (até 200 caracteres).
- relevant: false se o estudo não tem utilidade prática para esses profissionais (ex.: só laboratório/animais, tema muito distante).
Regras: use SOMENTE o que está no título e no resumo; não invente números, autores, links nem conclusões; não prometa resultados; não recomende remédios.`
const schema = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['pmid', 'relevant', 'title_pt', 'summary_pt', 'practice_pt', 'content_idea_pt'],
    properties: { pmid: { type: 'string' }, relevant: { type: 'boolean' }, title_pt: { type: 'string' }, summary_pt: { type: 'string' }, practice_pt: { type: 'string' }, content_idea_pt: { type: 'string' } } } } },
}

async function getJson(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(`PubMed ${r.status}`); return await r.json() }
async function getText(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(`PubMed ${r.status}`); return await r.text() }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function cors(origin: string | null) {
  const allowed = origin && ORIGINS.includes(origin) ? origin : ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Content-Type': 'application/json' }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'))
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json(405, { message: 'Método não permitido.' })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

  // Quem chama: agendador (x-cron-token) ou admin logado.
  const { data: cfg } = await db.rpc('push_worker_config')
  const token = Array.isArray(cfg) ? cfg[0]?.cron_token : null
  let allowed = !!token && req.headers.get('x-cron-token') === token
  if (!allowed) {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (jwt) {
      const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data } = await user.auth.getUser(jwt)
      if (data.user) { const { data: isAdmin } = await db.rpc('radar_worker_is_admin', { p_user: data.user.id }); allowed = isAdmin === true }
    }
  }
  if (!allowed) return json(401, { message: 'Não autorizado.' })
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json(503, { message: 'A IA ainda não foi configurada.' })
  const ai = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 })

  const report: Record<string, number | string> = {}
  for (const [specialty, s] of Object.entries(SEARCHES)) {
    try {
      const { data: knownRows } = await db.rpc('radar_worker_known', { p_specialty: specialty })
      const known = new Set(((knownRows || []) as { pmid: string }[]).map((k) => k.pmid))
      const term = s.strict ? `${s.term} AND ${QUALITY} AND hasabstract` : `${s.term} AND hasabstract`
      const search = await getJson(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=15&datetype=pdat&reldate=${s.days}&tool=369wellness&term=${encodeURIComponent(term)}`)
      const ids = ((search?.esearchresult?.idlist || []) as string[]).filter((id) => !known.has(id)).slice(0, 6)
      if (!ids.length) { report[specialty] = 0; continue }
      await sleep(400)
      const summaries = summariesFromJson(await getJson(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&tool=369wellness&id=${ids.join(',')}`))
      await sleep(400)
      const abstracts = abstractsFromXml(await getText(`${EUTILS}/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&tool=369wellness&id=${ids.join(',')}`))
      const candidates = summaries.filter((x) => (abstracts[x.uid] || '').length > 200)
      if (!candidates.length) { report[specialty] = 0; continue }
      const prompt = candidates.map((x) => `PMID: ${x.uid}\nTítulo: ${x.title}\nResumo: ${abstracts[x.uid]}`).join('\n\n---\n\n')
      const fallback = MODEL === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
      const msg = await ai.beta.messages.create({ model: MODEL, max_tokens: 8000, ...fallback, system: SYSTEM,
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content: `Especialidade: ${specialty}\n\n${prompt}` }] })
      const out = JSON.parse(msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as { items: { pmid: string; relevant: boolean; title_pt: string; summary_pt: string; practice_pt: string; content_idea_pt: string }[] }
      const rows = out.items.filter((i) => i.relevant && candidates.some((c) => c.uid === i.pmid)).slice(0, PER_SPECIALTY).map((i) => {
        const c = candidates.find((x) => x.uid === i.pmid)!
        const year = Number((c.pubdate || '').slice(0, 4))
        return { specialty, pmid: c.uid, title_original: c.title.slice(0, 600), title_pt: i.title_pt.slice(0, 300), journal: (c.fulljournalname || c.source || '').slice(0, 300),
          pub_year: Number.isFinite(year) && year > 1990 ? String(year) : '', evidence: evidenceFrom(c.pubtype || []), summary_pt: i.summary_pt.slice(0, 900),
          practice_pt: i.practice_pt.slice(0, 500), content_idea_pt: i.content_idea_pt.slice(0, 300) }
      })
      const { data: saved } = await db.rpc('radar_worker_save', { p_items: rows })
      report[specialty] = typeof saved === 'number' ? saved : 0
      await sleep(400)
    } catch (err) {
      console.error('radar', specialty, err instanceof Error ? err.message : String(err))
      report[specialty] = 'erro'
    }
  }
  return json(200, { novos: report })
})

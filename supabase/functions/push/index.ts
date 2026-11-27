// 369 WELLNESS · Edge Function "push": envia as notificações da fila (chamada a cada minuto pelo pg_cron).
// Publique com o nome "push" (minúsculo) e DESLIGUE "Verify JWT" (Enforce JWT verification) nas configurações da função:
// quem chama é o agendador do banco, que se identifica com um código secreto (x-cron-token) guardado no próprio banco.
// Na primeira execução a função cria as chaves VAPID (de quem envia) e guarda no banco. Nenhum segredo novo é necessário.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const SUBJECT = 'mailto:contato@369wellness.app'

Deno.serve(async (req) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { message: 'Método não permitido.' })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: cfgRows, error: cfgError } = await db.rpc('push_worker_config')
  const cfg = Array.isArray(cfgRows) ? cfgRows[0] : null
  if (cfgError || !cfg?.cron_token) return json(500, { message: 'Configuração indisponível.' })
  if (req.headers.get('x-cron-token') !== cfg.cron_token) return json(401, { message: 'Não autorizado.' })

  // Chaves VAPID: cria na primeira vez.
  let pub = cfg.vapid_public as string | null, priv = cfg.vapid_private as string | null
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys()
    await db.rpc('push_worker_set_vapid', { p_public: keys.publicKey, p_private: keys.privateKey })
    const { data: again } = await db.rpc('push_worker_config')
    pub = again?.[0]?.vapid_public ?? keys.publicKey; priv = again?.[0]?.vapid_private ?? keys.privateKey
  }
  webpush.setVapidDetails(SUBJECT, pub!, priv!)

  const { data: batch, error } = await db.rpc('push_worker_batch', { p_limit: 200 })
  if (error) { console.error('push batch', error.message); return json(500, { message: 'Falha ao ler a fila.' }) }
  const rows = (batch || []) as { queue_id: number; subscription_id: string; endpoint: string; p256dh: string; auth: string; title: string; body: string; url: string; kind: string }[]
  const sent = new Set<number>(), gone: string[] = [], ok: string[] = []
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.kind }), { TTL: 3600, urgency: r.kind === 'mensagem' ? 'high' : 'normal' })
      sent.add(r.queue_id); ok.push(r.subscription_id)
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) { gone.push(r.subscription_id); sent.add(r.queue_id) }
      else console.error('push send', status ?? 'erro', (err as Error)?.message)
    }
  }))
  if (rows.length) await db.rpc('push_worker_done', { p_sent: [...sent], p_gone: gone, p_ok: ok })
  return json(200, { enviados: sent.size, aparelhos_removidos: gone.length, na_fila: rows.length })
})

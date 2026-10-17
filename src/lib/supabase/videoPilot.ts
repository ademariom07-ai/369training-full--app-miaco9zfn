import type { SupabaseClient } from '@supabase/supabase-js'
export type PilotResult = {
  video: null | { id: string; title: string; channel: string; url: string; checkedAt: string }
  message: string
}
export async function runVideoPilot(
  client: SupabaseClient,
  owner: string,
  exercise: string,
): Promise<PilotResult> {
  const label = exercise.trim()
  if (!label || label.length > 160 || /[\x00-\x1f]/.test(label))
    throw Error('Informe um exercício de até 160 caracteres.')
  const before = await client.auth.getSession()
  const session = before.data.session
  if (before.error || !session || session.user.id !== owner)
    throw Error('Entre novamente na conta Supabase.')
  const { data, error } = await client.functions.invoke('exercise-video-search', {
    body: { exercise: label },
  })
  const after = await client.auth.getSession()
  if (
    after.error ||
    after.data.session?.user.id !== owner ||
    after.data.session?.access_token !== session.access_token
  )
    throw Error('A sessão mudou. Faça uma nova consulta.')
  if (error) {
    const status = error.context instanceof Response ? error.context.status : 0
    if (status === 401) throw Error('Sessão não aceita pelo servidor. Entre novamente.')
    if (status === 403)
      throw Error('O piloto exige um perfil administrativo autorizado no Supabase.')
    if (status === 429) throw Error('Limite do piloto atingido. Aguarde antes de tentar novamente.')
    throw Error('Busca indisponível. Confira a configuração e os provedores no servidor.')
  }
  if (!data || !Object.hasOwn(data, 'video') || typeof data.message !== 'string')
    throw Error('Resposta de vídeo inválida.')
  if (data.video !== null) {
    const v = data.video
    if (
      !v ||
      typeof v.id !== 'string' ||
      !/^[A-Za-z0-9_-]{11}$/.test(v.id) ||
      v.url !== 'https://www.youtube.com/watch?v=' + v.id ||
      typeof v.title !== 'string' ||
      typeof v.channel !== 'string' ||
      typeof v.checkedAt !== 'string' ||
      !Number.isFinite(Date.parse(v.checkedAt))
    )
      throw Error('Resposta de vídeo inválida.')
  }
  // Render only bounded, validated values; never pass arbitrary provider fields through.
  return {
    video: data.video
      ? {
          id: data.video.id,
          title: data.video.title.slice(0, 200),
          channel: data.video.channel.slice(0, 160),
          url: data.video.url,
          checkedAt: data.video.checkedAt,
        }
      : null,
    message: data.video
      ? 'Sugestão automática por metadados; não revisada pelo profissional.'
      : 'Nenhuma demonstração correspondente encontrada.',
  }
}

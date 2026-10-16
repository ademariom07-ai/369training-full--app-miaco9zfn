/** Administrative pilot. Does not certify video safety or select a video with AI. */
export type Candidate = { id: string; title: string; channel: string; url: string }
export interface Dependencies {
  authenticate: (token: string) => Promise<'admin' | 'user' | null>
  apiKey: () => string | undefined
  fetch: typeof fetch
  reserve: () => boolean
}
export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const reply = (status: number, body: unknown) =>
      Response.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store' },
      })
    if (req.method !== 'POST') return reply(405, { code: 'METHOD_NOT_ALLOWED' })
    const bearer = /^Bearer (\S+)$/.exec(req.headers.get('authorization') || '')
    if (!bearer) return reply(401, { code: 'UNAUTHENTICATED' })
    try {
      const role = await deps.authenticate(bearer[1])
      if (!role) return reply(401, { code: 'UNAUTHENTICATED' })
      if (role !== 'admin') return reply(403, { code: 'ADMIN_PILOT_ONLY' })
      // Stream cap also covers chunked requests without a Content-Length header.
      const reader = req.body?.getReader()
      if (!reader) return reply(400, { code: 'INVALID_EXERCISE' })
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 1024) {
          await reader.cancel()
          return reply(413, { code: 'BODY_TOO_LARGE' })
        }
        chunks.push(part.value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      let body: unknown
      try {
        body = JSON.parse(new TextDecoder().decode(bytes))
      } catch {
        return reply(400, { code: 'INVALID_EXERCISE' })
      }
      const exercise = (body as { exercise?: unknown } | null)?.exercise
      if (
        typeof exercise !== 'string' ||
        !exercise.trim() ||
        exercise.length > 160 ||
        /[\x00-\x1f]/.test(exercise)
      )
        return reply(400, { code: 'INVALID_EXERCISE' })
      const key = deps.apiKey()
      if (!key) return reply(503, { code: 'YOUTUBE_NOT_CONFIGURED' })
      if (!deps.reserve()) return reply(429, { code: 'RATE_LIMITED' })
      const get = async (resource: string, params: Record<string, string>) => {
        const url =
          'https://www.googleapis.com/youtube/v3/' + resource + '?' + new URLSearchParams(params)
        const res = await deps.fetch(url, {
          headers: { 'X-Goog-Api-Key': key },
          signal: AbortSignal.timeout(12000),
          redirect: 'error',
        })
        if (!res.ok) throw Error('provider unavailable')
        const data = await res.json()
        if (!Array.isArray(data.items)) throw Error('invalid provider response')
        return data.items
      }
      const found = await get('search', {
        part: 'snippet',
        q: exercise.trim() + ' execução técnica exercício',
        type: 'video',
        maxResults: '10',
        relevanceLanguage: 'pt',
        regionCode: 'BR',
        safeSearch: 'strict',
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        order: 'relevance',
      })
      const ids: string[] = [
        ...new Set<string>(
          found
            .map((v: any) => v.id?.videoId)
            .filter((id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)),
        ),
      ].slice(0, 10)
      const details = ids.length
        ? await get('videos', { part: 'snippet,status,contentDetails', id: ids.join(',') })
        : []
      const candidates: Candidate[] = details
        .filter((v: any) => {
          const d = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(v.contentDetails?.duration || '')
          const seconds = d
            ? Number(d[1] || 0) * 3600 + Number(d[2] || 0) * 60 + Number(d[3] || 0)
            : 0
          const region = v.contentDetails?.regionRestriction || {}
          return (
            ids.includes(v.id) &&
            v.status?.privacyStatus === 'public' &&
            v.status?.embeddable === true &&
            v.status?.uploadStatus === 'processed' &&
            v.snippet?.liveBroadcastContent === 'none' &&
            v.contentDetails?.contentRating?.ytRating !== 'ytAgeRestricted' &&
            !(region.blocked || []).includes('BR') &&
            (!region.allowed || region.allowed.includes('BR')) &&
            seconds >= 20 &&
            seconds <= 900 &&
            typeof v.snippet?.title === 'string'
          )
        })
        .slice(0, 10)
        .map((v: any) => ({
          id: v.id,
          title: v.snippet.title.slice(0, 200),
          channel: String(v.snippet.channelTitle || '').slice(0, 160),
          url: 'https://www.youtube.com/watch?v=' + v.id,
        }))
      return reply(200, {
        candidates,
        selectionStatus: 'pending_ai_review',
        message:
          'Candidatos por metadados. Não selecionados pela IA nem revisados pelo profissional.',
      })
    } catch {
      return reply(503, { code: 'VIDEO_SEARCH_UNAVAILABLE' })
    }
  }
}

/** URL validation only; does not verify availability or approve clinical content. */
export function normalizeExerciseVideo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
    let id: string | null = null
    if (host === 'youtu.be') {
      if (/^\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) id = url.pathname.slice(1)
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) id = url.searchParams.get('v')
      else {
        const match = /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)
        if (match) id = match[1]
      }
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null
  } catch { return null }
}

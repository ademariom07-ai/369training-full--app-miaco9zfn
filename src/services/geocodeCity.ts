/**
 * Geocodificação de cidade via Nominatim (OpenStreetMap) no navegador.
 *
 * Regras de uso da API pública:
 * - Cache em memória por "cidade|estado" — no máximo 1 requisição por cidade por sessão.
 * - Fila sequencial com atraso entre requisições (nunca chamadas em lote paralelo).
 * - Se falhar, o chamador mantém o fallback atual (coordenada padrão de São Paulo).
 */

import type { UserProfile } from '@/contexts/AuthContext'

const REQUEST_DELAY_MS = 1100

export interface GeoCoords {
  lat: number
  lon: number
}

// Cache em memória por sessão de página (chave "cidade|uf").
const memoryCache = new Map<string, GeoCoords | null>()

// Fila sequencial: uma requisição por vez, com atraso entre elas.
let chain: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, REQUEST_DELAY_MS - (Date.now() - lastRequestAt))
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait))
    }
    lastRequestAt = Date.now()
    return task()
  })
  chain = run.catch(() => {})
  return run
}

export function normalizeCityKey(city?: string | null, state?: string | null): string {
  return `${(city || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')}|${(state || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')}`
}

/**
 * Geocodifica cidade+estado via Nominatim. Retorna null se não encontrar
 * ou se a requisição falhar (o chamador mantém o fallback atual).
 */
export async function geocodeCity(
  city?: string | null,
  state?: string | null,
): Promise<GeoCoords | null> {
  const c = (city || '').trim()
  const s = (state || '').trim()
  if (!c || !s) return null

  const key = normalizeCityKey(c, s)
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as GeoCoords | null
  }

  const result = await schedule(async () => {
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br' +
        '&city=' +
        encodeURIComponent(c) +
        '&state=' +
        encodeURIComponent(s)
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
      if (!Array.isArray(data) || data.length === 0) return null
      const lat = Number(data[0]?.lat)
      const lon = Number(data[0]?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return { lat, lon }
    } catch (_) {
      return null
    }
  })

  memoryCache.set(key, result)
  return result
}

/** Chave de cache de um profissional (usa cidade/uf quando as coordenadas são 0/0). */
export function profGeoKey(prof: UserProfile): string {
  return normalizeCityKey(prof.city, prof.state)
}

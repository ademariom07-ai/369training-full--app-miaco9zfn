import { useEffect, useState } from 'react'
import type { UserProfile } from '@/contexts/AuthContext'
import { geocodeCity, normalizeCityKey } from '@/services/geocodeCity'
import type { GeoCoords } from '@/services/geocodeCity'

export interface Coordinates extends GeoCoords {}

export function hasRealCoords(prof: Pick<UserProfile, 'latitude' | 'longitude'>): boolean {
  return (
    typeof prof.latitude === 'number' &&
    typeof prof.longitude === 'number' &&
    (prof.latitude !== 0 || prof.longitude !== 0)
  )
}

/**
 * Geocodifica (via Nominatim, com cache/fila) as cidades dos profissionais
 * que não têm coordenadas próprias. Retorna um mapa prof.id -> coords.
 * Idempotente: profissionais já com coordenadas reais não entram na fila.
 */
export function useProfessionalsCoords(professionals: UserProfile[]): {
  coordsByProfId: Record<string, Coordinates>
  geocoding: boolean
} {
  const [coordsByProfId, setCoordsByProfId] = useState<Record<string, Coordinates>>({})
  const [geocoding, setGeocoding] = useState(false)

  const profKey = professionals.map((p) => p.id).join(',')

  useEffect(() => {
    let cancelled = false

    const missing = professionals.filter(
      (p) => !hasRealCoords(p) && p.city && p.state && !coordsByProfId[p.id],
    )
    if (missing.length === 0) return

    setGeocoding(true)
    ;(async () => {
      const results: Record<string, Coordinates> = {}
      for (const prof of missing) {
        const c = await geocodeCity(prof.city, prof.state)
        if (cancelled) return
        if (c) {
          results[prof.id] = c
        }
      }
      if (!cancelled && Object.keys(results).length > 0) {
        setCoordsByProfId((prev) => ({ ...prev, ...results }))
      }
      if (!cancelled) setGeocoding(false)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profKey])

  return { coordsByProfId, geocoding }
}

/**
 * Geocodifica uma lista de chaves "cidade|uf" (uma vez por chave por sessão).
 * `tick` força re-resolução quando a lista precisa ser recalculada.
 */
export function useCitiesCoords(
  cityKeys: string[],
  tick: number = 0,
): { coordsByCity: Record<string, Coordinates> } {
  const [coordsByCity, setCoordsByCity] = useState<Record<string, Coordinates>>({})

  const keysSignature = cityKeys.join('||')

  useEffect(() => {
    let cancelled = false
    const missing = Array.from(new Set(cityKeys)).filter((k) => !(k in coordsByCity))
    if (missing.length === 0) return

    ;(async () => {
      const results: Record<string, Coordinates> = {}
      for (const key of missing) {
        const [city, state] = key.split('|')
        const c = await geocodeCity(city, state)
        if (cancelled) return
        if (c) {
          results[key] = c
        } else {
          // Marca como resolvido (sem coordenada) para não refazer a requisição.
          results[key] = undefined as unknown as Coordinates
        }
      }
      if (!cancelled) {
        setCoordsByCity((prev) => ({ ...prev, ...results }))
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature, tick])

  return { coordsByCity }
}

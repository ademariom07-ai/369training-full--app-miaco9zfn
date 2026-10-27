import pb from '@/lib/pocketbase/client'
import type { UserProfile } from '@/contexts/AuthContext'
import type { CredentialVerificationRecord } from '@/services/api'

// Cache em memória compartilhado entre todas as telas e seções do app
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos de validade

let cachedProsPromise: Promise<UserProfile[]> | null = null
let cachedProsEntry: CacheEntry<UserProfile[]> | null = null

let cachedCredsPromise: Promise<CredentialVerificationRecord[]> | null = null
let cachedCredsEntry: CacheEntry<CredentialVerificationRecord[]> | null = null

/**
 * Busca profissionais aprovados com cache compartilhado em memória.
 * Evita múltiplas chamadas simultâneas ou redundantes na mesma sessão.
 */
export async function getApprovedProfessionalsCached(forceRefresh = false): Promise<UserProfile[]> {
  const now = Date.now()
  if (!forceRefresh && cachedProsEntry && now - cachedProsEntry.timestamp < CACHE_TTL_MS) {
    return cachedProsEntry.data
  }

  if (!forceRefresh && cachedProsPromise) {
    return cachedProsPromise
  }

  cachedProsPromise = pb
    .collection('users')
    .getList<UserProfile>(1, 100, {
      filter: 'role = "profissional" && approved = true',
      sort: '-rating_avg',
    })
    .then((res) => {
      cachedProsEntry = { data: res.items, timestamp: Date.now() }
      cachedProsPromise = null
      return res.items
    })
    .catch((err) => {
      cachedProsPromise = null
      console.warn('Aviso: falha ao carregar profissionais em cache:', err)
      return cachedProsEntry?.data || []
    })

  return cachedProsPromise
}

/**
 * Busca credenciais verificadas com cache compartilhado em memória.
 */
export async function getVerifiedCredentialsCached(
  forceRefresh = false,
): Promise<CredentialVerificationRecord[]> {
  const now = Date.now()
  if (!forceRefresh && cachedCredsEntry && now - cachedCredsEntry.timestamp < CACHE_TTL_MS) {
    return cachedCredsEntry.data
  }

  if (!forceRefresh && cachedCredsPromise) {
    return cachedCredsPromise
  }

  cachedCredsPromise = pb
    .collection('credential_verifications')
    .getList<CredentialVerificationRecord>(1, 100, {
      filter: 'status = "verificado"',
    })
    .then((res) => {
      cachedCredsEntry = { data: res.items, timestamp: Date.now() }
      cachedCredsPromise = null
      return res.items
    })
    .catch((err) => {
      cachedCredsPromise = null
      console.warn('Aviso: falha ao carregar credenciais em cache:', err)
      return cachedCredsEntry?.data || []
    })

  return cachedCredsPromise
}

/**
 * Retorna profissionais aprovados já enriquecidos com a marcação de credencial verificada.
 */
export async function getVerifiedProfessionalsWithStatusCached(
  forceRefresh = false,
): Promise<{ professionals: UserProfile[]; verifiedProfIds: Set<string> }> {
  const [pros, creds] = await Promise.all([
    getApprovedProfessionalsCached(forceRefresh),
    getVerifiedCredentialsCached(forceRefresh),
  ])

  const verifiedProfIds = new Set(creds.map((c: any) => c.professional || c.user || c.id))
  return { professionals: pros, verifiedProfIds }
}

/**
 * Invalida o cache para permitir recarregamento manual quando necessário
 */
export function invalidateProfessionalsCache(): void {
  cachedProsPromise = null
  cachedProsEntry = null
  cachedCredsPromise = null
  cachedCredsEntry = null
}

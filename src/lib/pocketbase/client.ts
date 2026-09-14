import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Resiliência para conexões Realtime SSE:
 * Corrige o erro 400 "Invalid realtime client" quando o servidor descarta a conexão SSE
 * (ex: hibernação, reconexão de rede ou expiração do clientId) mas o SDK tenta reenviar
 * subscriptions com o clientId órfão.
 *
 * Intercepta requisições de sendSubscriptions no /api/realtime:
 * 1. Captura o 400 silenciosamente (warning no console) para nunca propagar erro de runtime não tratado à UI.
 * 2. Limpa o clientId antigo e desconecta o RealtimeService.
 * 3. Dispara reconexão com clientId limpo e backoff progressivo para evitar loops.
 */
let isRecoveringRealtime = false
let realtimeRecoveryAttempts = 0
let realtimeRecoveryTimer: any = null
const MAX_REALTIME_RECOVERIES = 5

export function forceRealtimeReconnect() {
  if (isRecoveringRealtime) return
  isRecoveringRealtime = true

  const realtime = (pb as any).realtime
  if (!realtime) {
    isRecoveringRealtime = false
    return
  }

  // Desconecta e limpa o clientId órfão
  try {
    if (typeof realtime.disconnect === 'function') {
      realtime.disconnect()
    } else if (typeof realtime.unsubscribe === 'function') {
      realtime.unsubscribe().catch(() => {})
    }
  } catch (err) {
    console.warn('[Realtime Recovery] Erro ao desconectar realtime:', err)
  }

  realtime.clientId = ''
  realtime.lastSentSubscriptions = []

  const delay = Math.min(500 * 2 ** realtimeRecoveryAttempts, 8000)
  if (realtimeRecoveryTimer) clearTimeout(realtimeRecoveryTimer)

  realtimeRecoveryTimer = setTimeout(() => {
    isRecoveringRealtime = false

    // Se ainda houver subscriptions registradas no realtime, reconectar
    const hasSubs =
      realtime.subscriptions &&
      Object.keys(realtime.subscriptions).some(
        (k) => Array.isArray(realtime.subscriptions[k]) && realtime.subscriptions[k].length > 0,
      )

    if (hasSubs && typeof realtime.connect === 'function') {
      realtimeRecoveryAttempts++
      realtime.connect().catch((err: any) => {
        console.warn('[Realtime Recovery] Falha ao restabelecer conexão:', err?.message || err)
      })
    } else {
      realtimeRecoveryAttempts = 0
    }
  }, delay)
}

// Intercepta chamadas de send no client para capturar erros 400 em /api/realtime
const originalSend = pb.send.bind(pb)
pb.send = async function (path: string, options: any) {
  try {
    return await originalSend(path, options)
  } catch (err: any) {
    const isRealtimeEndpoint =
      typeof path === 'string' && (path === '/api/realtime' || path.endsWith('/api/realtime'))
    const isInvalidClient =
      err?.status === 400 &&
      (err?.message?.includes?.('Invalid realtime client') ||
        err?.response?.message?.includes?.('Invalid realtime client') ||
        err?.data?.message?.includes?.('Invalid realtime client'))

    if (isRealtimeEndpoint && isInvalidClient) {
      console.warn(
        '[PocketBase Realtime] Client ID expirou ou não é reconhecido pelo servidor (HTTP 400). Recuperando com novo clientId...',
      )

      if (realtimeRecoveryAttempts < MAX_REALTIME_RECOVERIES) {
        forceRealtimeReconnect()
      } else {
        console.warn(
          '[PocketBase Realtime] Limite de tentativas de reconexão realtime atingido. Tentativa de recuperação pausada.',
        )
      }

      // Retorna resposta neutra simulada para satisfazer a promise e nunca estourar exceção não tratada na UI
      return { success: false, handled: true }
    }

    throw err
  }
}

// Reset do contador de tentativas quando a conexão realtime for bem sucedida
if (typeof window !== 'undefined') {
  try {
    const realtime = (pb as any).realtime
    if (realtime && typeof realtime.subscribe === 'function') {
      realtime.subscribe('PB_CONNECT', () => {
        realtimeRecoveryAttempts = 0
      })
    }
  } catch {
    /* intentionally ignored */
  }

  // Suporte global para capturar rejeições de promessa não tratadas de realtime como redundância de proteção
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const isRealtime400 =
      reason?.status === 400 &&
      (reason?.message?.includes?.('Invalid realtime client') ||
        reason?.url?.includes?.('/api/realtime') ||
        reason?.response?.message?.includes?.('Invalid realtime client'))

    if (isRealtime400) {
      event.preventDefault() // Previne o popup de runtime / unhandled rejection
      console.warn(
        '[PocketBase Realtime] Capturada rejeição não tratada de realtime (Invalid realtime client). Silenciada com sucesso.',
      )
      forceRealtimeReconnect()
    }
  })
}

export default pb

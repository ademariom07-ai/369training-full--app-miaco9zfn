/**
 * Recuperação de tela branca por chunk ausente.
 *
 * Depois de cada nova publicação, um index.html em cache (service worker) pode
 * referenciar chunks JS antigos que não existem mais no servidor. A importação
 * dinâmica falha, o Suspense nunca resolve e a rota protegida (RoleGuard) fica
 * totalmente branca. Aqui detectamos esse cenário, limpamos os caches do service
 * worker e recarregamos a página UMA única vez por sessão, evitando loop.
 */

const RELOAD_FLAG = '369_chunk_recovery_v1'

function isChunkLoadError(message: string): boolean {
  if (!message) return false
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Loading chunk') ||
    message.includes('dynamically imported module')
  )
}

function recoverFromChunkError() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return // já tentamos uma vez — não entrar em loop
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch (_) {
    // sessionStorage indisponível: segue a recuperação mesmo assim
  }

  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {})
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {})
  }
  window.location.reload()
}

export function installChunkErrorRecovery() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement | null
    // Falha ao carregar <script type="module" src="/assets/..."> do bundle
    if (target && target.tagName === 'SCRIPT' && (target as HTMLScriptElement).src) {
      recoverFromChunkError()
      return
    }
    if (event.message && isChunkLoadError(event.message)) recoverFromChunkError()
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    const message =
      typeof reason === 'string' ? reason : (reason?.message as string | undefined) || ''
    if (isChunkLoadError(message)) {
      event.preventDefault()
      recoverFromChunkError()
    }
  })

  // Recarga bem-sucedida: libera o mecanismo para o próximo deploy
  window.addEventListener('load', () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch (_) {
      /* noop */
    }
  })
}

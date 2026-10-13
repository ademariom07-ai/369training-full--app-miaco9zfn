import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Download, Share, X } from 'lucide-react'

const DISMISS_KEY = 'install-app-dismissed-at'
const DISMISS_DAYS = 14

// Evento do Chrome/Android que permite abrir o diálogo de instalação do app
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIosSafari = () => {
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  return isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

const wasDismissedRecently = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch (_) {
    return false
  }
}

export default function InstallAppBanner() {
  const location = useLocation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(wasDismissedRecently)

  useEffect(() => {
    if (isStandalone()) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferredPrompt(null)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    setShowIosHint(isIosSafari())

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Só nas áreas logadas, para não disputar espaço com o aviso de cookies das páginas públicas
  const inApp = /^\/(aluno|profissional|admin)(\/|$)/.test(location.pathname)
  if (!inApp || dismissed || isStandalone() || (!deferredPrompt && !showIosHint)) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch (_) {
      // Armazenamento bloqueado (ex.: aba anônima): o aviso só fica fechado nesta visita
    }
    setDismissed(true)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice.catch(() => null)
    setDeferredPrompt(null)
  }

  return (
    <div
      role="region"
      aria-label="Instalar o app 369WELLNESS"
      className="fixed bottom-24 inset-x-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-white border border-[#E4E2DC] rounded-2xl shadow-lg p-4 flex gap-3 items-start font-inter animate-fade-in"
    >
      <img
        src="/icons/icon-192.png"
        alt=""
        className="w-11 h-11 rounded-xl shrink-0"
        width={44}
        height={44}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1A1A1A] font-montserrat">
          Instale o app 369WELLNESS
        </p>
        {deferredPrompt ? (
          <>
            <p className="text-xs text-gray-600 mt-0.5">
              Acesse direto pela tela inicial, em tela cheia.
            </p>
            <Button
              size="sm"
              onClick={install}
              className="mt-2 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold rounded-lg"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Instalar app
            </Button>
          </>
        ) : (
          <p className="text-xs text-gray-600 mt-0.5">
            No Safari, toque em{' '}
            <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Compartilhar" />{' '}
            <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso de instalação"
        className="text-gray-400 hover:text-gray-700 p-1 -m-1 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

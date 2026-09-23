import React, { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Cookie, ShieldCheck, X } from 'lucide-react'

const COOKIE_STORAGE_KEY = 'cookie-consent-accepted'

export default function CookieConsentBanner() {
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Apenas em páginas públicas: / (Index), /login, /cadastro
    const publicPaths = ['/', '/login', '/cadastro']
    const isPublic = publicPaths.includes(location.pathname)

    const accepted = localStorage.getItem(COOKIE_STORAGE_KEY) === 'true'

    if (isPublic && !accepted) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [location.pathname])

  const handleAccept = () => {
    localStorage.setItem(COOKIE_STORAGE_KEY, 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      role="region"
      aria-label="Consentimento de Cookies"
      className="fixed bottom-0 inset-x-0 z-40 p-4 sm:p-6 bg-white/95 backdrop-blur-xl border-t border-[#E4E2DC] shadow-[0_-10px_25px_rgba(0,0,0,0.06)] animate-fade-in font-inter"
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 text-xs text-[#374151]">
          <div className="p-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#B8962E] shrink-0 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <p className="leading-relaxed">
            Utilizamos cookies essenciais para o funcionamento da plataforma. Ao continuar
            navegando, você concorda com nossa{' '}
            <Link
              to="/politica-de-privacidade"
              className="text-[#B8962E] font-semibold underline hover:text-[#99771C]"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <Link
            to="/politica-de-privacidade"
            className="text-xs text-[#6B7280] hover:text-[#1A1A1A] underline font-medium px-2"
          >
            Saiba mais
          </Link>
          <Button
            onClick={handleAccept}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-6 py-2 rounded-xl shadow-md flex-1 md:flex-initial"
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}

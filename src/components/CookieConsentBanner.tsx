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
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 bg-[#0E0E0E]/95 backdrop-blur-xl border-t border-[#D4AF37]/30 shadow-[0_-10px_35px_rgba(0,0,0,0.8)] animate-fade-in font-inter">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 text-xs text-gray-300">
          <div className="p-2 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] shrink-0 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <p className="leading-relaxed">
            Utilizamos cookies essenciais para o funcionamento da plataforma. Ao continuar
            navegando, você concorda com nossa{' '}
            <Link
              to="/politica-de-privacidade"
              className="text-[#D4AF37] font-semibold underline hover:text-[#E6C65C]"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <Link
            to="/politica-de-privacidade"
            className="text-xs text-gray-400 hover:text-white underline font-medium px-2"
          >
            Saiba mais
          </Link>
          <Button
            onClick={handleAccept}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-6 py-2 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.25)] flex-1 md:flex-initial"
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}

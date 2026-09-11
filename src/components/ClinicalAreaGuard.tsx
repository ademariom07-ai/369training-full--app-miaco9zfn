import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { pb } from '@/lib/pocketbase/client'
import { SensitiveDataConsentModal } from '@/components/SensitiveDataConsentModal'
import { Loader2 } from 'lucide-react'

interface ClinicalAreaGuardProps {
  areaName: string
  children: React.ReactNode
}

export function ClinicalAreaGuard({ areaName, children }: ClinicalAreaGuardProps) {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [checkingConsent, setCheckingConsent] = useState(true)
  const [hasConsent, setHasConsent] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const verifyConsent = async () => {
    if (!user) {
      setCheckingConsent(false)
      return
    }

    try {
      // Verificar se o usuário possui consentimento ativo de dados sensíveis na coleção legal_acceptances
      const res = await pb.collection('legal_acceptances').getList(1, 1, {
        filter: `user = "${user.id}" && document_slug = "consentimento-dados-sensiveis-saude"`,
        sort: '-created',
      })

      if (res.items && res.items.length > 0) {
        setHasConsent(true)
        setModalOpen(false)
      } else {
        setHasConsent(false)
        setModalOpen(true)
      }
    } catch {
      // Se der erro ou não encontrar, abrir o modal de consentimento
      setHasConsent(false)
      setModalOpen(true)
    } finally {
      setCheckingConsent(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      verifyConsent()
    }
  }, [user, authLoading])

  if (authLoading || checkingConsent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
        <span className="text-xs text-gray-400 font-montserrat uppercase tracking-wider">
          Validando Termos de Proteção de Dados...
        </span>
      </div>
    )
  }

  return (
    <>
      <SensitiveDataConsentModal
        open={modalOpen && !hasConsent}
        areaName={areaName}
        onConsented={() => {
          setHasConsent(true)
          setModalOpen(false)
        }}
        onDismiss={() => {
          setModalOpen(false)
          navigate('/')
        }}
      />
      {hasConsent ? children : null}
    </>
  )
}

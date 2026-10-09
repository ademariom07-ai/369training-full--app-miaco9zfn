import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useAuth } from '@/contexts/AuthContext'

export default function ConfirmarVerificacaoEmail() {
  const { token: urlToken } = useParams<{ token?: string }>()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [tokenInput, setTokenInput] = useState(urlToken || '')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>(urlToken ? 'idle' : 'idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleVerify = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) {
      toast.error('Token de verificação inválido.')
      return
    }

    setLoading(true)
    setStatus('idle')
    try {
      await pb.collection('users').confirmVerification(tokenToUse.trim())
      setStatus('success')
      toast.success('E-mail verificado com sucesso!')
      await refreshUser().catch(() => {})
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2500)
    } catch (err: unknown) {
      const msg = getErrorMessage(err) || 'Token de verificação expirado ou inválido.'
      setStatus('error')
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (urlToken) {
      handleVerify(urlToken)
    }
  }, [urlToken])

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4AF37]/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <CrestLogo size={72} />
          </Link>
          <h1 className="text-3xl font-extrabold font-montserrat uppercase gold-gradient-text tracking-wider">
            369WELLNESS
          </h1>
          <p className="text-sm text-gray-600 font-inter mt-1 tracking-wider uppercase font-semibold">
            Confirmação de E-mail
          </p>
        </div>

        <Card className="bg-white border border-[#E5E3DC] rounded-2xl p-6 sm:p-8 shadow-lg text-center">
          {loading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-[#0057FF] animate-spin mx-auto" />
              <h3 className="text-xl font-bold font-montserrat text-[#1A1A1A]">
                Validando seu e-mail...
              </h3>
              <p className="text-sm text-gray-600 font-inter">
                Aguarde enquanto confirmamos sua conta.
              </p>
            </div>
          ) : status === 'success' ? (
            <div className="py-6 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h2 className="text-2xl font-bold font-montserrat text-[#1A1A1A]">
                E-mail Confirmado com Sucesso!
              </h2>
              <p className="text-base text-gray-600 font-inter">
                Sua conta 369WELLNESS está 100% ativa. Redirecionando para o login...
              </p>
              <div className="pt-2">
                <Link to="/login">
                  <Button className="w-full bg-[#0057FF] hover:bg-[#0047D6] text-white font-bold py-6 text-base rounded-xl">
                    Ir para o Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="py-6 space-y-4">
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold font-montserrat text-[#1A1A1A]">
                Falha na Verificação
              </h2>
              <p className="text-sm text-red-600 font-inter font-medium">{errorMessage}</p>
              <p className="text-sm text-gray-600 font-inter">
                O link pode ter expirado ou já ter sido utilizado. Você pode solicitar um novo
                e-mail de verificação.
              </p>
              <div className="pt-4 flex flex-col gap-2">
                <Link to="/login">
                  <Button className="w-full bg-[#0057FF] hover:bg-[#0047D6] text-white font-bold py-6 text-base rounded-xl">
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <div>
                <h2 className="text-xl font-bold font-montserrat text-[#1A1A1A] mb-1">
                  Verificar Conta
                </h2>
                <p className="text-sm text-gray-600 font-inter mb-4">
                  Cole o código de verificação recebido em sua caixa de entrada.
                </p>
              </div>
              <Input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Token de verificação"
                className="bg-white border-[#E5E3DC] rounded-xl text-[#1A1A1A] font-mono text-sm h-12 focus-visible:ring-[#0057FF]"
                required
              />
              <Button
                onClick={() => handleVerify(tokenInput)}
                className="w-full bg-[#0057FF] hover:bg-[#0047D6] text-white font-bold py-6 text-base rounded-xl"
              >
                Confirmar Verificação
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

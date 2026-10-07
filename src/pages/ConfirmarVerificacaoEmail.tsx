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
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4AF37]/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <CrestLogo size={68} />
          </Link>
          <h1 className="text-3xl font-extrabold font-montserrat uppercase gold-gradient-text tracking-wider">
            369WELLNESS
          </h1>
          <p className="text-xs text-gray-400 font-inter mt-1 tracking-wider uppercase font-semibold">
            Confirmação de E-mail
          </p>
        </div>

        <Card className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
          {loading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto" />
              <h3 className="text-lg font-bold font-montserrat text-white">
                Validando seu e-mail...
              </h3>
              <p className="text-xs text-gray-400 font-inter">
                Aguarde enquanto confirmamos sua conta.
              </p>
            </div>
          ) : status === 'success' ? (
            <div className="py-6 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
              <h2 className="text-xl font-bold font-montserrat text-white">
                E-mail Confirmado com Sucesso!
              </h2>
              <p className="text-sm text-gray-300 font-inter">
                Sua conta 369WELLNESS está 100% ativa. Redirecionando para a área de acesso...
              </p>
              <div className="pt-2">
                <Link to="/login">
                  <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold">
                    Ir para o Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="py-6 space-y-4">
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-xl font-bold font-montserrat text-white">Falha na Verificação</h2>
              <p className="text-xs text-red-400 font-inter">{errorMessage}</p>
              <p className="text-xs text-gray-400 font-inter">
                O link pode ter expirado ou já ter sido utilizado. Você pode solicitar um novo
                e-mail de verificação.
              </p>
              <div className="pt-4 flex flex-col gap-2">
                <Link to="/verificacao-pendente">
                  <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs">
                    Reenviar Novo Link
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    variant="outline"
                    className="w-full border-gray-700 text-gray-300 text-xs"
                  >
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <div>
                <h2 className="text-lg font-bold font-montserrat text-white mb-1">
                  Verificar Conta
                </h2>
                <p className="text-xs text-gray-400 font-inter mb-4">
                  Cole o código de verificação recebido em sua caixa de entrada.
                </p>
              </div>
              <Input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Token de verificação"
                className="bg-[#1A1A1A] border-[#333333] rounded-xl text-white font-mono text-xs focus-visible:ring-[#D4AF37]"
                required
              />
              <Button
                onClick={() => handleVerify(tokenInput)}
                className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold py-5 rounded-xl"
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

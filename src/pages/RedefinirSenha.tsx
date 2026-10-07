import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function RedefinirSenha() {
  const { token: urlToken } = useParams<{ token?: string }>()
  const navigate = useNavigate()

  const [tokenInput, setTokenInput] = useState(urlToken || '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const activeToken = urlToken || tokenInput

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeToken.trim()) {
      toast.error('Token de redefinição não encontrado ou inválido.')
      return
    }
    if (password.length < 8) {
      toast.error('A senha deve conter no mínimo 8 caracteres.')
      return
    }
    if (password !== passwordConfirm) {
      toast.error('As senhas digitadas não coincidem.')
      return
    }

    setLoading(true)
    try {
      await pb
        .collection('users')
        .confirmPasswordReset(activeToken.trim(), password, passwordConfirm)
      setSuccess(true)
      toast.success('Senha redefinida com sucesso!')
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast.error(msg || 'Token expirado ou inválido. Solicite uma nova recuperação.')
    } finally {
      setLoading(false)
    }
  }

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
            Criar Nova Senha
          </p>
        </div>

        <Card className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-2xl">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
              <h2 className="text-xl font-bold font-montserrat text-white">Senha Redefinida!</h2>
              <p className="text-sm text-gray-300 font-inter">
                Sua senha foi atualizada com sucesso. Redirecionando para o login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold font-montserrat text-white mb-1">
                  Defina sua nova senha
                </h2>
                <p className="text-xs text-gray-400 font-inter mb-4">
                  Crie uma senha segura com no mínimo 8 caracteres.
                </p>
              </div>

              {!urlToken && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
                    Código / Token do E-mail
                  </label>
                  <Input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Cole o token recebido no e-mail"
                    className="bg-[#1A1A1A] border-[#333333] rounded-xl text-white font-mono text-xs focus-visible:ring-[#D4AF37]"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-10 bg-[#1A1A1A] border-[#333333] rounded-xl text-white placeholder:text-gray-500 focus-visible:ring-[#D4AF37]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="pl-10 bg-[#1A1A1A] border-[#333333] rounded-xl text-white placeholder:text-gray-500 focus-visible:ring-[#D4AF37]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold py-6 rounded-xl transition-all shadow-md mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Nova Senha'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

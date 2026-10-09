import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Informe o e-mail cadastrado.')
      return
    }

    setLoading(true)
    try {
      await pb.collection('users').requestPasswordReset(email.trim().toLowerCase())
      setSent(true)
      toast.success('Instruções de redefinição enviadas para seu e-mail!')
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast.error(msg || 'Não foi possível solicitar a redefinição. Verifique o e-mail digitado.')
    } finally {
      setLoading(false)
    }
  }

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
            Recuperação de Acesso
          </p>
        </div>

        <Card className="bg-white border border-[#E5E3DC] rounded-2xl p-6 sm:p-8 shadow-lg">
          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-bold font-montserrat text-[#1A1A1A]">E-mail Enviado!</h2>
              <p className="text-base text-gray-600 font-inter leading-relaxed">
                Enviamos um link seguro de redefinição de senha para{' '}
                <strong className="text-black font-semibold">{email}</strong>. Verifique sua caixa
                de entrada e pasta de lixo eletrônico.
              </p>
              <div className="pt-4">
                <Link to="/login">
                  <Button className="w-full bg-[#0057FF] hover:bg-[#0047D6] text-white font-bold py-6 text-base rounded-xl">
                    Voltar para o Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold font-montserrat text-[#1A1A1A] mb-1">
                  Esqueceu sua senha?
                </h2>
                <p className="text-sm sm:text-base text-gray-600 font-inter mb-4">
                  Digite seu e-mail cadastrado na 369WELLNESS para receber o link seguro de
                  redefinição.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2 font-montserrat">
                  Seu E-mail Cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="pl-11 h-13 text-base bg-white border-[#E5E3DC] rounded-xl text-[#1A1A1A] placeholder:text-gray-400 focus-visible:ring-[#0057FF]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0057FF] hover:bg-[#0047D6] text-white font-bold py-6 text-base rounded-xl transition-all shadow-md mt-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Enviar Link de Redefinição'
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black font-semibold font-inter"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

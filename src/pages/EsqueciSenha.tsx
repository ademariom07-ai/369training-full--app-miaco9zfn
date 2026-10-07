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
            Recuperação de Acesso
          </p>
        </div>

        <Card className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-2xl">
          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold font-montserrat text-white">E-mail Enviado!</h2>
              <p className="text-sm text-gray-300 font-inter leading-relaxed">
                Enviamos um link de redefinição de senha para{' '}
                <strong className="text-white">{email}</strong>. Verifique sua caixa de entrada e
                pasta de spam.
              </p>
              <div className="pt-4">
                <Link to="/login">
                  <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold">
                    Voltar para o Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold font-montserrat text-white mb-1">
                  Esqueceu sua senha?
                </h2>
                <p className="text-xs text-gray-400 font-inter mb-4">
                  Digite seu e-mail cadastrado na 369WELLNESS para receber o link seguro de
                  redefinição.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
                  Seu E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
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
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Enviar Link de Redefinição'
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white font-inter"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

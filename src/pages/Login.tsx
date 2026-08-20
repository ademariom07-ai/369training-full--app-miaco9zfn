import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { CrestLogo } from '@/components/CrestLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Lock, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [roleSelection, setRoleSelection] = useState<'aluno' | 'profissional'>('aluno')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Quick fill helper for testing/demo
  const handleQuickFill = (targetRole: 'admin' | 'profissional' | 'aluno') => {
    if (targetRole === 'admin') {
      setEmail('ademariom07@gmail.com')
      setPassword('Skip@Pass')
    } else if (targetRole === 'profissional') {
      setEmail('carlos.coach@369training.com')
      setPassword('Skip@Pass')
      setRoleSelection('profissional')
    } else {
      setEmail('aluno.lucas@369training.com')
      setPassword('Skip@Pass')
      setRoleSelection('aluno')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Preencha o e-mail e a senha.')
      return
    }

    setLoading(true)
    try {
      const user = await login(email, password)
      setSuccess(true)
      toast.success('Login efetuado com sucesso!')

      setTimeout(() => {
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname
        if (from && from !== '/login') {
          navigate(from, { replace: true })
          return
        }

        if (user.role === 'admin') {
          navigate('/admin', { replace: true })
        } else if (user.role === 'profissional') {
          navigate('/profissional', { replace: true })
        } else {
          navigate('/aluno', { replace: true })
        }
      }, 700)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Falha ao autenticar. Verifique seus dados.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#0057FF]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <CrestLogo size={72} />
          </Link>
          <h1 className="text-3xl font-extrabold font-montserrat uppercase gold-gradient-text tracking-wider">
            369TRAINING
          </h1>
          <p className="text-xs text-gray-400 font-inter mt-1 tracking-wider uppercase">
            Acesso à Plataforma
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-[#D4AF37] mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold font-montserrat text-white">
                Autenticado com Sucesso
              </h3>
              <p className="text-sm text-gray-400 mt-2 font-inter">
                Redirecionando para seu ambiente...
              </p>
            </div>
          ) : (
            <>
              {/* Role Toggle Pills */}
              <div className="flex bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] mb-6">
                <button
                  type="button"
                  onClick={() => setRoleSelection('aluno')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                    roleSelection === 'aluno'
                      ? 'bg-[#0057FF] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sou Aluno
                </button>
                <button
                  type="button"
                  onClick={() => setRoleSelection('profissional')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                    roleSelection === 'profissional'
                      ? 'bg-[#D4AF37] text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sou Profissional
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-montserrat">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white placeholder:text-gray-500 focus-visible:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-montserrat">
                      Senha
                    </label>
                    <a
                      href="#esqueci"
                      onClick={(e) => {
                        e.preventDefault()
                        toast.info('Instruções enviadas para seu e-mail cadastrado.')
                      }}
                      className="text-xs text-[#D4AF37] hover:underline font-inter"
                    >
                      Esqueceu a senha?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white placeholder:text-gray-500 focus-visible:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold py-6 rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)] mt-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar na Plataforma'}
                </Button>
              </form>

              {/* Demo Quick Logins */}
              <div className="mt-6 pt-4 border-t border-[#2A2A2A]">
                <p className="text-[11px] text-gray-500 uppercase font-semibold text-center mb-2 font-montserrat">
                  Acesso Rápido de Demonstração
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('admin')}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#141414] border border-[#2A2A2A] text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('profissional')}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#141414] border border-[#2A2A2A] text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all"
                  >
                    Profissional
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('aluno')}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#141414] border border-[#2A2A2A] text-gray-300 hover:border-[#0057FF] hover:text-[#0057FF] transition-all"
                  >
                    Aluno
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Cadastro Link */}
        <p className="text-center text-xs text-gray-400 mt-6 font-inter">
          Ainda não tem uma conta?{' '}
          <Link to="/cadastro" className="text-[#D4AF37] font-semibold hover:underline">
            Cadastre-se agora
          </Link>
        </p>
      </div>
    </div>
  )
}

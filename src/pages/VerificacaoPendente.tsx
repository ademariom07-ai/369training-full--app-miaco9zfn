import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Clock, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function VerificacaoPendente() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const stateEmail = (location.state as { email?: string })?.email
  const defaultEmail = user?.email || stateEmail || ''

  const [inputEmail, setInputEmail] = useState(defaultEmail)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)

  // Countdown timer para reenviar e-mail (60s)
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  // Se o usuário já estiver verificado, redireciona
  useEffect(() => {
    if (user && (user as any).verified === true) {
      if (user.role === 'admin') navigate('/admin', { replace: true })
      else if (user.role === 'profissional') navigate('/profissional', { replace: true })
      else navigate('/aluno', { replace: true })
    }
  }, [user, navigate])

  const handleResend = async () => {
    const targetEmail = (user?.email || inputEmail).trim().toLowerCase()
    if (!targetEmail) {
      toast.error('Informe seu e-mail para reenviar a confirmação.')
      return
    }

    setSending(true)
    try {
      await pb.collection('users').requestVerification(targetEmail)
      toast.success(`E-mail de verificação reenviado para ${targetEmail}!`)
      setCountdown(60)
      setCanResend(false)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast.error(msg || 'Erro ao reenviar verificação. Tente novamente mais tarde.')
    } finally {
      setSending(false)
    }
  }

  const handleCheckStatus = async () => {
    setChecking(true)
    try {
      const refreshed = await refreshUser()
      if (refreshed && (refreshed as any).verified === true) {
        toast.success('E-mail verificado! Acesso liberado.')
        if (refreshed.role === 'admin') navigate('/admin', { replace: true })
        else if (refreshed.role === 'profissional') navigate('/profissional', { replace: true })
        else navigate('/aluno', { replace: true })
      } else {
        toast.info('E-mail ainda não verificado. Clique no link enviado para sua caixa de entrada.')
      }
    } catch {
      toast.info('Aguardando verificação do e-mail...')
    } finally {
      setChecking(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4AF37]/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <CrestLogo size={68} />
          </Link>
          <h1 className="text-3xl font-extrabold font-montserrat uppercase gold-gradient-text tracking-wider">
            369WELLNESS
          </h1>
          <p className="text-xs text-gray-400 font-inter mt-1 tracking-wider uppercase font-semibold">
            Confirmação de Segurança
          </p>
        </div>

        <Card className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold font-montserrat text-white mb-2">
              Confirme seu E-mail
            </h2>
            <p className="text-sm text-gray-300 font-inter leading-relaxed">
              Enviamos um link de ativação para{' '}
              <strong className="text-white">{user?.email || inputEmail || 'seu e-mail'}</strong>.
              Para proteger sua conta e manter a integridade da plataforma, confirme seu endereço
              antes de continuar.
            </p>
          </div>

          {!user && (
            <div className="text-left">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 font-montserrat">
                Seu E-mail
              </label>
              <Input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="bg-[#1A1A1A] border-[#333333] text-white text-xs rounded-xl"
              />
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#0F0F0F] border border-[#222222] text-xs text-gray-400 font-inter space-y-1 text-left">
            <div className="flex items-center gap-2 text-white font-semibold mb-1">
              <Clock className="w-4 h-4 text-[#D4AF37]" /> Dicas de entrega:
            </div>
            <p>• Verifique sua pasta de Spam ou Lixo Eletrônico.</p>
            <p>
              • O remetente oficial é <strong>ademariom07@gmail.com</strong>.
            </p>
            <p>• Após clicar no link do e-mail, clique no botão abaixo para avançar.</p>
          </div>

          <div className="space-y-3">
            {user && (
              <Button
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {checking ? 'Verificando...' : 'Já Confirmei meu E-mail'}
              </Button>
            )}

            <Button
              onClick={handleResend}
              disabled={!canResend || sending}
              className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold py-5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${sending ? 'animate-spin' : ''}`} />
              {canResend ? 'Reenviar Verificação' : `Aguarde ${countdown}s para reenviar`}
            </Button>
          </div>

          <div className="pt-2 border-t border-[#222222] flex justify-between items-center text-xs">
            <Link to="/login" className="text-gray-400 hover:text-white font-inter">
              Ir para o Login
            </Link>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair da Conta
              </button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  )
}

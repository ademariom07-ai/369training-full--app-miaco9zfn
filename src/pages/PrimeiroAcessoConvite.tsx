import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CrestLogo } from '@/components/CrestLogo'
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  KeyRound,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

interface InviteData {
  valid: boolean
  status: 'pendente' | 'aceito' | 'ativado' | 'expirado'
  role_name: string
  license_number: number
  email_licenca: string
  expires_at: string
  accepted_at?: string
  personal_name?: string
  message?: string
}

export default function PrimeiroAcessoConvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Formulário
  const [personalName, setPersonalName] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (!token) {
      setErrorMsg('Token de convite não encontrado no endereço.')
      setLoading(false)
      return
    }

    const checkToken = async () => {
      try {
        setLoading(true)
        setErrorMsg(null)
        const res: any = await pb.send(
          `/backend/v1/public/invite/check?token=${encodeURIComponent(token)}`,
          { method: 'GET' },
        )

        setInvite(res)
        if (!res.valid) {
          if (res.status === 'expirado') {
            setErrorMsg(
              'Este link de convite expirou (validade de 7 dias ultrapassada). Solicite um novo link ao administrador principal.',
            )
          } else if (res.status === 'aceito' || res.status === 'ativado') {
            setErrorMsg(
              'Este convite já realizou o primeiro acesso e está aguardando ou já foi ativado.',
            )
          } else {
            setErrorMsg(res.message || 'Convite inválido ou não encontrado.')
          }
        }
      } catch (err: any) {
        setErrorMsg(
          err?.message ||
            'Não foi possível verificar o convite. Verifique se o endereço está correto.',
        )
      } finally {
        setLoading(false)
      }
    }

    checkToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!personalName.trim()) {
      toast.error('Informe seu nome completo.')
      return
    }

    if (!personalEmail.trim() || !personalEmail.includes('@') || !personalEmail.includes('.')) {
      toast.error('Informe um e-mail pessoal válido para recuperação.')
      return
    }

    if (!tempPassword) {
      toast.error('Informe a senha temporária fornecida pelo administrador.')
      return
    }

    if (newPassword.length < 8) {
      toast.error('A nova senha deve possuir pelo menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('A confirmação da nova senha não confere.')
      return
    }

    setSubmitting(true)
    try {
      const res: any = await pb.send('/backend/v1/public/invite/accept', {
        method: 'POST',
        body: {
          token,
          temp_password: tempPassword,
          new_password: newPassword,
          personal_email: personalEmail.trim().toLowerCase(),
          personal_name: personalName.trim(),
        },
      })

      if (res?.success) {
        setSuccess(true)
        toast.success('Primeiro acesso concluído com sucesso!')
      } else {
        throw new Error(res?.message || 'Falha ao processar primeiro acesso.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao concluir primeiro acesso. Verifique a senha temporária.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0057FF]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-[#D4AF37]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <CrestLogo size={68} />
          </Link>
          <h1 className="text-3xl font-extrabold font-montserrat uppercase gold-gradient-text tracking-wider">
            369WELLNESS
          </h1>
          <p className="text-xs text-gray-400 font-inter mt-1 tracking-wider uppercase">
            Portal Administrativo • Primeiro Acesso
          </p>
        </div>

        <Card className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-2xl">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
              <p className="text-xs font-montserrat uppercase text-gray-400">
                Verificando credencial de convite...
              </p>
            </div>
          ) : success ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 flex items-center justify-center mx-auto text-[#22C55E]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-extrabold font-montserrat uppercase text-white">
                Primeiro Acesso Concluído!
              </h2>
              <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-left text-xs space-y-2 text-gray-300">
                <p>
                  <strong>Cargo:</strong> {invite?.role_name}
                </p>
                <p>
                  <strong>E-mail Institucional:</strong> {invite?.email_licenca}
                </p>
                <p>
                  <strong>E-mail Pessoal Vinculado:</strong> {personalEmail}
                </p>
                <div className="pt-2 border-t border-[#2A2A2A] flex items-center gap-2 text-amber-400">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    Status da conta: <strong>Pendente de Ativação</strong>
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed font-inter">
                Sua senha foi redefinida com segurança e seu e-mail pessoal foi gravado para
                recuperação. Por governança de segurança, sua conta administrativa aguarda agora a
                validação/ativação do administrador principal (Ademario). Assim que validada, você
                poderá fazer login normalmente.
              </p>
              <div className="pt-4">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-[#D4AF37] hover:bg-[#e6c154] text-black font-extrabold uppercase text-xs py-3 rounded-xl"
                >
                  Ir para Tela de Login
                </Button>
              </div>
            </div>
          ) : errorMsg ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold font-montserrat uppercase text-white">
                Link de Convite Indisponível
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed">{errorMsg}</p>
              <div className="pt-2">
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs uppercase"
                >
                  Voltar ao Login
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* Badge do Cargo */}
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[#0057FF]/15 to-[#D4AF37]/15 border border-[#0057FF]/30">
                <div className="flex items-center gap-2 text-[#0057FF] text-xs font-bold uppercase font-montserrat mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  Licença Administrativa #{invite?.license_number}
                </div>
                <h3 className="text-lg font-extrabold font-montserrat text-white uppercase">
                  {invite?.role_name}
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-1">{invite?.email_licenca}</p>
              </div>

              <div className="mb-6 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 space-y-1 font-inter">
                <p className="font-bold font-montserrat uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Etapas Obrigatórias de Primeiro Acesso
                </p>
                <p className="text-[11px] text-gray-300">
                  Para assumir esta licença, confirme sua autenticação com a senha temporária
                  fornecida pelo administrador, defina sua nova senha definitiva e cadastre seu
                  e-mail pessoal para recuperação.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase font-montserrat text-gray-300 mb-1">
                    Seu Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="text"
                      required
                      value={personalName}
                      onChange={(e) => setPersonalName(e.target.value)}
                      placeholder="Ex: Carlos Oliveira"
                      className="pl-9 bg-[#181818] border-[#2A2A2A] text-white text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase font-montserrat text-gray-300 mb-1">
                    Seu E-mail Pessoal (Recuperação) *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="email"
                      required
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      placeholder="seu.email@gmail.com"
                      className="pl-9 bg-[#181818] border-[#2A2A2A] text-white text-xs rounded-xl"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Utilizado para auditoria, comunicação e recuperação da sua licença.
                  </p>
                </div>

                <div className="pt-2 border-t border-[#2A2A2A]">
                  <label className="block text-xs font-bold uppercase font-montserrat text-amber-300 mb-1">
                    Senha Temporária da Licença *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="password"
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Cole a senha temporária entregue pelo admin"
                      className="pl-9 bg-[#181818] border-amber-500/40 text-white text-xs rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase font-montserrat text-gray-300 mb-1">
                      Sua Nova Senha *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="pl-9 bg-[#181818] border-[#2A2A2A] text-white text-xs rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase font-montserrat text-gray-300 mb-1">
                      Confirmar Nova Senha *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        className="pl-9 bg-[#181818] border-[#2A2A2A] text-white text-xs rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#0057FF] hover:bg-[#0046d6] text-white font-extrabold uppercase text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gravando Nova Senha & Dados...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                        Concluir Primeiro Acesso
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

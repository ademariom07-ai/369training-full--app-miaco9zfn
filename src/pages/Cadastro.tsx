import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CrestLogo } from '@/components/CrestLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Award,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'

export default function Cadastro() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const initialRole = searchParams.get('tipo') === 'profissional' ? 'profissional' : 'aluno'
  const [role, setRole] = useState<'aluno' | 'profissional'>(initialRole)

  // Common Fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('São Paulo')
  const [state, setState] = useState('SP')

  // Aluno specific
  const [objective, setObjective] = useState('Hipertrofia')

  // Profissional specific
  const [professionalType, setProfessionalType] = useState<'Pessoa Física' | 'MEI'>('Pessoa Física')
  const [specialties, setSpecialties] = useState<string[]>(['Educação Física'])
  const [cref, setCref] = useState('')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentLgpd, setConsentLgpd] = useState(false)

  const [loading, setLoading] = useState(false)
  const [createdSuccess, setCreatedSuccess] = useState(false)

  const toggleSpecialty = (spec: string) => {
    if (specialties.includes(spec)) {
      if (specialties.length > 1) {
        setSpecialties(specialties.filter((s) => s !== spec))
      }
    } else {
      setSpecialties([...specialties, spec])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !email || !password || !phone) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }

    if (password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (role === 'profissional') {
      if (!cref) {
        toast.error('Informe seu número de registro profissional (CREF/CRN/CREFITO).')
        return
      }
      if (!consentTerms || !consentLgpd) {
        toast.error('É necessário aceitar os Termos de Uso e a Política de Privacidade/LGPD.')
        return
      }
    }

    setLoading(true)
    try {
      const referralCode =
        name
          .substring(0, 4)
          .toUpperCase()
          .replace(/[^A-Z]/g, 'X') + Math.floor(100 + Math.random() * 900)

      const payload = {
        email,
        password,
        passwordConfirm: password,
        name,
        role,
        plan: role === 'profissional' ? 'basico' : 'gratis',
        plan_type: role,
        approved: role === 'aluno', // alunos are auto-approved, profissionais require review
        phone,
        city,
        state,
        referral_code: referralCode,
        objective: role === 'aluno' ? objective : undefined,
        professional_type: role === 'profissional' ? professionalType : undefined,
        cref: role === 'profissional' ? cref : undefined,
        specialties: role === 'profissional' ? specialties : undefined,
        rating_avg: 5.0,
      }

      await pb.collection('users').create(payload)

      setCreatedSuccess(true)
      toast.success('Cadastro realizado com sucesso!')

      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao realizar cadastro. Verifique os dados inseridos.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <CrestLogo size={68} />
          </Link>
          <h1 className="text-3xl font-extrabold font-montserrat uppercase gold-gradient-text tracking-wider">
            369TRAINING
          </h1>
          <p className="text-xs text-gray-400 font-inter mt-1 tracking-wider uppercase">
            Criar Nova Conta no Ecossistema
          </p>
        </div>

        <Card className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-2xl">
          {createdSuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-[#22C55E] mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold font-montserrat text-white">
                Conta Criada com Sucesso!
              </h3>
              <p className="text-sm text-gray-400 mt-2 font-inter">
                {role === 'profissional'
                  ? 'Seu cadastro de profissional foi recebido e passará por análise de credenciais.'
                  : 'Sua conta de aluno está ativa. Redirecionando para o login...'}
              </p>
            </div>
          ) : (
            <>
              {/* Segmented Control */}
              <div className="flex bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] mb-6">
                <button
                  type="button"
                  onClick={() => setRole('aluno')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                    role === 'aluno'
                      ? 'bg-[#0057FF] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sou Aluno
                </button>
                <button
                  type="button"
                  onClick={() => setRole('profissional')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                    role === 'profissional'
                      ? 'bg-[#D4AF37] text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sou Profissional
                </button>
              </div>

              {role === 'profissional' && (
                <div className="mb-6 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200">
                  <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0" />
                  <span>
                    <strong>Aviso de Auditoria:</strong> Seu perfil será analisado antes da oferta
                    pública de serviços para garantir a segurança dos alunos.
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white focus-visible:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                {/* E-mail & Senha (2 cols) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                      E-mail *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@email.com"
                        className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                      Senha * (mín. 8 caracteres)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Telefone & Cidade/Estado */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                      Telefone / WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                      Cidade *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="São Paulo"
                        className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                      Estado (UF) *
                    </label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="SP"
                      maxLength={2}
                      className="bg-[#141414] border-[#2A2A2A] rounded-xl text-white text-center font-bold focus-visible:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                {/* ALUNO SPECIFIC: Objetivo */}
                {role === 'aluno' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                      Objetivo Principal
                    </label>
                    <select
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    >
                      <option value="Aumentar força">Aumentar força</option>
                      <option value="Hipertrofia">Hipertrofia</option>
                      <option value="Ganho de massa">Ganho de massa</option>
                      <option value="Perda de peso">Perda de peso</option>
                      <option value="Resistência aeróbica">Resistência aeróbica</option>
                      <option value="Artes marciais">Artes marciais</option>
                    </select>
                  </div>
                )}

                {/* PROFISSIONAL SPECIFIC */}
                {role === 'profissional' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                          Tipo de Atuação
                        </label>
                        <select
                          value={professionalType}
                          onChange={(e) =>
                            setProfessionalType(e.target.value as 'Pessoa Física' | 'MEI')
                          }
                          className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        >
                          <option value="Pessoa Física">Pessoa Física</option>
                          <option value="MEI">MEI / Pessoa Jurídica</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                          Nº de Registro (CREF / CRN / CREFITO) *
                        </label>
                        <div className="relative">
                          <Award className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <Input
                            value={cref}
                            onChange={(e) => setCref(e.target.value)}
                            placeholder="Ex: CREF 123456-G/SP"
                            className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white focus-visible:ring-[#D4AF37]"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 font-montserrat">
                        Especialidades (selecione uma ou mais)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Educação Física', 'Nutrição', 'Fisioterapia', 'Artes Marciais'].map(
                          (spec) => {
                            const isSelected = specialties.includes(spec)
                            return (
                              <button
                                type="button"
                                key={spec}
                                onClick={() => toggleSpecialty(spec)}
                                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                                  isSelected
                                    ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                                    : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                                }`}
                              >
                                <span>{spec}</span>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />}
                              </button>
                            )
                          },
                        )}
                      </div>
                    </div>

                    {/* Consents */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="terms"
                          checked={consentTerms}
                          onCheckedChange={(c) => setConsentTerms(!!c)}
                          className="mt-0.5 border-[#2A2A2A] data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                        />
                        <label
                          htmlFor="terms"
                          className="text-xs text-gray-400 cursor-pointer font-inter"
                        >
                          Li e concordo com os{' '}
                          <a href="#termos" className="text-[#D4AF37] underline">
                            Termos de Uso v2.4
                          </a>{' '}
                          e as Diretrizes Profissionais 369.
                        </label>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="lgpd"
                          checked={consentLgpd}
                          onCheckedChange={(c) => setConsentLgpd(!!c)}
                          className="mt-0.5 border-[#2A2A2A] data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                        />
                        <label
                          htmlFor="lgpd"
                          className="text-xs text-gray-400 cursor-pointer font-inter"
                        >
                          Concordo com o tratamento de dados pessoais conforme a{' '}
                          <a href="#privacidade" className="text-[#D4AF37] underline">
                            Política de Privacidade & LGPD
                          </a>
                          .
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className={`w-full font-bold py-6 rounded-xl transition-all shadow-lg mt-4 ${
                    role === 'profissional'
                      ? 'bg-[#D4AF37] text-black hover:bg-[#E6C65C]'
                      : 'bg-[#0057FF] text-white hover:bg-[#1F6CFF]'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : role === 'profissional' ? (
                    'Cadastrar como Profissional'
                  ) : (
                    'Cadastrar como Aluno'
                  )}
                </Button>
              </form>
            </>
          )}
        </Card>

        {/* Login Link */}
        <p className="text-center text-xs text-gray-400 mt-6 font-inter">
          Já possui cadastro?{' '}
          <Link to="/login" className="text-[#D4AF37] font-semibold hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}

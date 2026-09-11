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
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function Cadastro() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const initialRole = searchParams.get('tipo') === 'profissional' ? 'profissional' : 'aluno'
  const [role, setRole] = useState<'aluno' | 'profissional'>(initialRole)

  // Referral code from URL param ?ref= or typed
  const urlRef = searchParams.get('ref') || ''
  const [referralCodeInput, setReferralCodeInput] = useState(urlRef)
  const [referralValidationMsg, setReferralValidationMsg] = useState<{
    text: string
    type: 'success' | 'warning' | 'idle'
  }>({ text: '', type: 'idle' })

  // Common Fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('Brasil')
  const [city, setCity] = useState('São Paulo')
  const [state, setState] = useState('SP')

  // Selected Plan: Grátis (0x), Básico (1x), Pro (2x), Premium (3x)
  const [selectedPlan, setSelectedPlan] = useState<'gratis' | 'basico' | 'pro' | 'premium'>(
    initialRole === 'profissional' ? 'basico' : 'gratis',
  )

  // Aluno specific
  const [objective, setObjective] = useState('Hipertrofia')

  // Profissional specific
  const [professionalType, setProfessionalType] = useState<'Pessoa Física' | 'MEI'>('Pessoa Física')
  const [specialties, setSpecialties] = useState<string[]>(['Educação Física'])
  const [subSpecialties, setSubSpecialties] = useState<string[]>([])
  const [cref, setCref] = useState('')
  const [crp, setCrp] = useState('')
  const [council, setCouncil] = useState<'CREF' | 'CRN' | 'CREFITO' | 'CRP' | 'FEDERACAO'>('CREF')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentLgpd, setConsentLgpd] = useState(false)
  const [consentSensitiveHealth, setConsentSensitiveHealth] = useState(false)

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

  const toggleSubSpecialty = (sub: string) => {
    if (subSpecialties.includes(sub)) {
      setSubSpecialties(subSpecialties.filter((s) => s !== sub))
    } else {
      setSubSpecialties([...subSpecialties, sub])
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
      const isPsychology = specialties.includes('Psicologia')
      const regNumber = isPsychology ? crp.trim() : cref.trim()
      if (!regNumber) {
        toast.error(
          specialties.includes('Artes Marciais')
            ? 'Informe o número do certificado ou registro na federação.'
            : 'Informe o número de registro profissional do conselho.',
        )
        return
      }
      if (!documentFile) {
        toast.error(
          specialties.includes('Artes Marciais')
            ? 'Anexe obrigatoriamente a foto do certificado de graduação/federação.'
            : 'Anexe obrigatoriamente a foto ou PDF da cédula de identidade profissional.',
        )
        return
      }
      if (!consentTerms || !consentLgpd || !consentSensitiveHealth) {
        toast.error(
          'É necessário aceitar o Contrato de Parceria, a Política de Privacidade e o Consentimento para Dados Sensíveis de Saúde.',
        )
        return
      }
    } else {
      // Aluno
      if (!consentTerms || !consentLgpd || !consentSensitiveHealth) {
        toast.error(
          'É necessário aceitar os Termos de Uso do Aluno, a Política de Privacidade e o Consentimento para Dados Sensíveis de Saúde (Art. 11 LGPD).',
        )
        return
      }
    }

    setLoading(true)
    try {
      const cleanName = name.trim()
      const referralPrefix = (
        cleanName
          .substring(0, 4)
          .toUpperCase()
          .replace(/[^A-Z]/g, '') || 'USER'
      ).padEnd(4, 'X')
      const referralCode = referralPrefix + Math.floor(100 + Math.random() * 900)

      const payload: Record<string, unknown> = {
        email: email.trim().toLowerCase(),
        password,
        passwordConfirm: password,
        name: cleanName,
        role,
        plan: selectedPlan,
        plan_type: role,
        approved: role === 'aluno', // alunos are auto-approved, profissionais require review
        phone: phone.trim(),
        country,
        city: city.trim(),
        state: state.trim().toUpperCase(),
        referral_code: referralCode,
        rating_avg: 5.0,
      }

      if (role === 'aluno') {
        payload.objective = objective
      } else {
        payload.professional_type = professionalType
        payload.cref = cref.trim()
        payload.crp = crp.trim()
        payload.specialties = specialties
        payload.sub_specialties = subSpecialties
      }

      // Validar código de indicação antes de criar o usuário e o vínculo
      let referrerUser: any = null
      const cleanRefInput = referralCodeInput.trim().toUpperCase()
      if (cleanRefInput) {
        try {
          const found = await pb
            .collection('users')
            .getFirstListItem(`referral_code = "${cleanRefInput}"`)
          referrerUser = found
        } catch (_) {
          // Código não encontrado - permitir continuar conforme spec, apenas alertar
          toast.warning(
            `Código de indicação "${cleanRefInput}" não foi localizado. O cadastro continuará normalmente.`,
          )
        }
      }

      const createdUser = await pb.collection('users').create(payload)

      // Registrar aceites legais na coleção legal_acceptances
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const userAgent = navigator.userAgent || 'web-browser'
      const clientIp = 'client-registration'

      try {
        // 1. Termos de Uso do Aluno OU Contrato de Parceria Profissional
        const primaryDocSlug =
          role === 'profissional' ? 'contrato-parceria-profissional' : 'termos-aluno'
        let primaryDoc: any = null
        try {
          primaryDoc = await pb
            .collection('legal_documents')
            .getFirstListItem(`slug = '${primaryDocSlug}'`)
        } catch {
          /* intentionally ignored */
        }

        if (primaryDoc) {
          await pb.collection('legal_acceptances').create({
            user: createdUser.id,
            document: primaryDoc.id,
            document_slug: primaryDoc.slug,
            version: primaryDoc.version || 1,
            accepted_at: nowIso,
            ip: clientIp,
            user_agent: userAgent,
            consent_type: primaryDocSlug,
          })
        }

        // 2. Política de Privacidade
        let privDoc: any = null
        try {
          privDoc = await pb
            .collection('legal_documents')
            .getFirstListItem("slug = 'politica-privacidade'")
        } catch {
          /* intentionally ignored */
        }

        if (privDoc) {
          await pb.collection('legal_acceptances').create({
            user: createdUser.id,
            document: privDoc.id,
            document_slug: privDoc.slug,
            version: privDoc.version || 1,
            accepted_at: nowIso,
            ip: clientIp,
            user_agent: userAgent,
            consent_type: 'politica-privacidade',
          })
        }

        // 3. Consentimento Específico para Dados Sensíveis de Saúde (Art. 11 LGPD)
        let sensDoc: any = null
        try {
          sensDoc = await pb
            .collection('legal_documents')
            .getFirstListItem("slug = 'lgpd-consentimentos'")
        } catch {
          /* intentionally ignored */
        }

        if (sensDoc) {
          await pb.collection('legal_acceptances').create({
            user: createdUser.id,
            document: sensDoc.id,
            document_slug: sensDoc.slug,
            version: sensDoc.version || 1,
            accepted_at: nowIso,
            ip: clientIp,
            user_agent: userAgent,
            consent_type: 'dados_sensiveis_saude_art11',
          })
        }
      } catch (errAccept) {
        console.warn('Registro secundário de aceite legal gravado localmente:', errAccept)
      }

      // Se for profissional, registrar a verificação de credencial na coleção credential_verifications
      if (role === 'profissional' && createdUser?.id) {
        try {
          const finalRegNumber =
            specialties.includes('Psicologia') && crp ? crp.trim() : cref.trim()
          const credFormData = new FormData()
          credFormData.append('professional', createdUser.id)
          credFormData.append('council', council)
          credFormData.append('registration_number', finalRegNumber)
          credFormData.append('status', 'pendente')
          if (documentFile) {
            credFormData.append('document_file', documentFile)
          }

          await pb.collection('credential_verifications').create(credFormData)
        } catch (credErr) {
          console.warn('Erro ao salvar documento em credential_verifications:', credErr)
        }
      }

      // Se código de indicação existir e for válido, criar vínculo na tabela referrals
      if (referrerUser && createdUser?.id) {
        try {
          await pb.collection('referrals').create({
            referrer: referrerUser.id,
            referred: createdUser.id,
            code: cleanRefInput,
            level: 1,
            status: 'pending',
            services_count: 0,
            referral_bonus_paid: false,
          })
        } catch (_) {
          /* Ignora erro no vínculo secundário para não travar o cadastro */
        }
      }

      setCreatedSuccess(true)
      toast.success('Cadastro realizado com sucesso!')

      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err: unknown) {
      const detailedMessage = getErrorMessage(err)
      toast.error(detailedMessage || 'Erro ao realizar cadastro. Verifique os dados inseridos.', {
        duration: 5000,
      })
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
                  onClick={() => {
                    setRole('aluno')
                    setSelectedPlan('gratis')
                  }}
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
                  onClick={() => {
                    setRole('profissional')
                    setSelectedPlan('basico')
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                    role === 'profissional'
                      ? 'bg-[#D4AF37] text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sou Profissional
                </button>
              </div>

              {/* SELEÇÃO DE PLANO NO CADASTRO (GRÁTIS 0x, BÁSICO 1x, PRO 2x, PREMIUM 3x) */}
              <div className="mb-6 p-4 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-3">
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider font-montserrat flex items-center justify-between">
                  <span>Escolha seu Plano Inicial:</span>
                  <span className="text-[10px] text-[#D4AF37] font-semibold">
                    Multiplicador de Ranking
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'gratis' as const,
                      name: 'GRÁTIS',
                      multiplier: '0x',
                      badge: 'Sem Ranking',
                      desc: 'Acesso básico',
                      forRole: 'aluno',
                    },
                    {
                      id: 'basico' as const,
                      name: 'BÁSICO',
                      multiplier: '1.0x',
                      badge: 'Pontuação 1x',
                      desc: 'R$ 1,00/serviço',
                      forRole: 'all',
                    },
                    {
                      id: 'pro' as const,
                      name: 'PRO',
                      multiplier: '2.0x',
                      badge: 'Pontuação 2x',
                      desc: 'R$ 2,00/serviço',
                      forRole: 'all',
                    },
                    {
                      id: 'premium' as const,
                      name: 'PREMIUM',
                      multiplier: '3.0x',
                      badge: 'Acelerador 3x',
                      desc: 'R$ 3,00/serviço',
                      forRole: 'all',
                    },
                  ].map((p) => {
                    const isSelected = selectedPlan === p.id
                    if (role === 'profissional' && p.id === 'gratis') return null

                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setSelectedPlan(p.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                          isSelected
                            ? p.id === 'premium'
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                              : p.id === 'pro'
                                ? 'bg-[#0057FF]/20 border-[#0057FF] shadow-[0_0_15px_rgba(0,87,255,0.2)]'
                                : 'bg-[#22C55E]/20 border-[#22C55E]'
                            : 'bg-[#181818] border-[#2A2A2A] hover:border-gray-600'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black font-montserrat text-white">
                              {p.name}
                            </span>
                            {isSelected && (
                              <CheckCircle2
                                className={`w-3.5 h-3.5 ${
                                  p.id === 'premium'
                                    ? 'text-[#D4AF37]'
                                    : p.id === 'pro'
                                      ? 'text-[#0057FF]'
                                      : 'text-[#22C55E]'
                                }`}
                              />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold block ${
                              p.id === 'gratis'
                                ? 'text-gray-400'
                                : p.id === 'premium'
                                  ? 'text-[#D4AF37]'
                                  : p.id === 'pro'
                                    ? 'text-[#0057FF]'
                                    : 'text-[#22C55E]'
                            }`}
                          >
                            Multiplicador {p.multiplier}
                          </span>
                        </div>
                        <span className="text-[9px] text-gray-400 font-inter mt-1 block">
                          {p.desc}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {selectedPlan === 'gratis' && (
                  <p className="text-[11px] text-amber-300/90 font-inter bg-amber-950/20 p-2 rounded-lg border border-amber-500/20">
                    ℹ️ <strong>Plano Grátis (0x):</strong> O aluno tem acesso às funcionalidades
                    essenciais, mas não pontua no ranking mensal e não gera cashback de rede até
                    evoluir para um plano pago.
                  </p>
                )}
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

                {/* País, Telefone & Localização (RECURSO 7: SELEÇÃO DE PAÍS) */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#D4AF37] uppercase tracking-wider mb-1 font-montserrat">
                      País *
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#D4AF37]/40 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    >
                      <option value="Brasil">Brasil (LGPD)</option>
                      <option value="Portugal">Portugal (GDPR)</option>
                      <option value="Estados Unidos">Estados Unidos (CCPA)</option>
                      <option value="Reino Unido">Reino Unido (UK GDPR)</option>
                      <option value="Canadá">Canadá (PIPEDA)</option>
                      <option value="Austrália">Austrália (Privacy Act)</option>
                      <option value="Outro">Outro País</option>
                    </select>
                  </div>

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
                      Estado / Província *
                    </label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="SP"
                      maxLength={10}
                      className="bg-[#141414] border-[#2A2A2A] rounded-xl text-white text-center font-bold focus-visible:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                {/* RECURSO 1: Campo Código de Indicação */}
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider font-montserrat">
                      Código de Indicação{' '}
                      <span className="text-gray-500 font-normal lowercase">(opcional)</span>
                    </label>
                    {urlRef && (
                      <span className="text-[10px] text-[#D4AF37] font-bold uppercase font-mono">
                        Preenchido via link
                      </span>
                    )}
                  </div>
                  <Input
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ex: SILV369"
                    className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono uppercase tracking-wider text-xs focus-visible:ring-[#D4AF37]"
                  />
                  <p className="text-[11px] text-gray-400 font-inter">
                    Se você foi indicado por um amigo ou profissional, insira o código para vincular
                    benefícios e bônus de rede.
                  </p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                          Tipo de Atuação
                        </label>
                        <select
                          value={professionalType}
                          onChange={(e) =>
                            setProfessionalType(e.target.value as 'Pessoa Física' | 'MEI')
                          }
                          className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        >
                          <option value="Pessoa Física">Pessoa Física</option>
                          <option value="MEI">MEI / Pessoa Jurídica</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#D4AF37] uppercase tracking-wider mb-1 font-montserrat">
                          Conselho / Entidade *
                        </label>
                        <select
                          value={council}
                          onChange={(e) =>
                            setCouncil(
                              e.target.value as 'CREF' | 'CRN' | 'CREFITO' | 'CRP' | 'FEDERACAO',
                            )
                          }
                          className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#D4AF37]/50 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        >
                          <option value="CREF">CREF (Educação Física)</option>
                          <option value="CRN">CRN (Nutrição)</option>
                          <option value="CREFITO">CREFITO (Fisioterapia)</option>
                          <option value="CRP">CRP (Psicologia)</option>
                          <option value="FEDERACAO">Federação (Artes Marciais)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-montserrat">
                          Número de Registro *
                        </label>
                        <div className="relative">
                          <Award className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <Input
                            value={specialties.includes('Psicologia') && crp ? crp : cref}
                            onChange={(e) => {
                              if (specialties.includes('Psicologia')) {
                                setCrp(e.target.value)
                              }
                              setCref(e.target.value)
                            }}
                            placeholder="Ex: 098765-G/SP"
                            className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-white text-xs focus-visible:ring-[#D4AF37]"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* UPLOAD OBRIGATÓRIO DO DOCUMENTO (TAREFA 3) */}
                    <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4AF37]/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white uppercase font-montserrat flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                          Foto do Documento Profissional / Cédula (Obrigatório) *
                        </label>
                        <span className="text-[10px] text-[#D4AF37] font-semibold">
                          Validação Modelo Uber/CNH
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {council === 'FEDERACAO'
                          ? 'Para Artes Marciais: envie o certificado de graduação emitido por federação oficial + comprovante de antecedentes.'
                          : 'Envie a foto ou arquivo (JPG, PNG ou PDF) da sua cédula de identidade profissional emitida pelo respectivo conselho regional.'}
                      </p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setDocumentFile(file)
                        }}
                        className="w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37] file:text-black hover:file:bg-[#e0be4a] cursor-pointer"
                        required
                      />
                      {documentFile && (
                        <p className="text-[11px] text-[#22C55E] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Arquivo selecionado:{' '}
                          {documentFile.name} ({(documentFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>

                    {/* RECURSO 5: PSICOLOGIA & SUB-ESPECIALIDADES */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 font-montserrat">
                        Especialidades (selecione uma ou mais)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          'Educação Física',
                          'Nutrição',
                          'Psicologia',
                          'Fisioterapia',
                          'Artes Marciais',
                        ].map((spec) => {
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
                        })}
                      </div>

                      {/* Sub-especialidades de Psicologia quando selecionado */}
                      {specialties.includes('Psicologia') && (
                        <div className="mt-3 p-3 rounded-xl bg-[#141414] border border-[#D4AF37]/30 space-y-2">
                          <label className="block text-[11px] font-bold text-[#D4AF37] uppercase font-montserrat">
                            Sub-especialidades de Psicologia:
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {[
                              'Clínica',
                              'Esportiva',
                              'Organizacional',
                              'Infantil',
                              'Neuropsicologia',
                            ].map((sub) => {
                              const isSubSelected = subSpecialties.includes(sub)
                              return (
                                <button
                                  type="button"
                                  key={sub}
                                  onClick={() => toggleSubSpecialty(sub)}
                                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-between transition-all ${
                                    isSubSelected
                                      ? 'bg-[#0057FF]/20 border-[#0057FF] text-[#0057FF] font-bold'
                                      : 'bg-[#181818] border-[#2A2A2A] text-gray-400 hover:text-white'
                                  }`}
                                >
                                  <span>{sub}</span>
                                  {isSubSelected && (
                                    <CheckCircle2 className="w-3 h-3 text-[#0057FF]" />
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Consents Profissional (Tarefa 1 - Aceite por Documento) */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="terms-prof"
                          checked={consentTerms}
                          onCheckedChange={(c) => setConsentTerms(!!c)}
                          className="mt-0.5 border-[#2A2A2A] data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                        />
                        <label
                          htmlFor="terms-prof"
                          className="text-xs text-gray-300 cursor-pointer font-inter"
                        >
                          Li e concordo com o{' '}
                          <Link
                            to="/contrato-parceria"
                            target="_blank"
                            className="text-[#D4AF37] underline font-semibold"
                          >
                            Contrato de Parceria Comercial do Profissional
                          </Link>{' '}
                          (autonomia técnica, emissão de NFS-e, não exclusividade e regras de
                          suspensão com ampla defesa).
                        </label>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="lgpd-prof"
                          checked={consentLgpd}
                          onCheckedChange={(c) => setConsentLgpd(!!c)}
                          className="mt-0.5 border-[#2A2A2A] data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                        />
                        <label
                          htmlFor="lgpd-prof"
                          className="text-xs text-gray-300 cursor-pointer font-inter"
                        >
                          Li e concordo com a{' '}
                          <Link
                            to="/politica-de-privacidade"
                            target="_blank"
                            className="text-[#D4AF37] underline font-semibold"
                          >
                            Política de Privacidade
                          </Link>{' '}
                          e o{' '}
                          <Link
                            to="/regulamento-cashback"
                            target="_blank"
                            className="text-[#D4AF37] underline font-semibold"
                          >
                            Regulamento de Cashback
                          </Link>
                          .
                        </label>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-start gap-2.5">
                        <Checkbox
                          id="sensitive-health-prof"
                          checked={consentSensitiveHealth}
                          onCheckedChange={(c) => setConsentSensitiveHealth(!!c)}
                          className="mt-0.5 border-[#D4AF37] data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                        />
                        <label
                          htmlFor="sensitive-health-prof"
                          className="text-[11px] text-gray-200 cursor-pointer leading-relaxed"
                        >
                          <strong className="text-[#D4AF37] block font-montserrat uppercase">
                            Consentimento para Dados Sensíveis de Saúde (Art. 11 LGPD)
                          </strong>
                          Autorizo o compartilhamento e tratamento estritamente técnico de dados
                          clínicos, métricas biométricas e prescrições para os alunos sob meu
                          acompanhamento, conforme o{' '}
                          <Link
                            to="/lgpd-consentimentos"
                            target="_blank"
                            className="text-[#D4AF37] underline"
                          >
                            Termo de Consentimento Art. 11 LGPD
                          </Link>
                          .
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {/* Consents Aluno (Tarefa 1 - Aceite por Documento) */}
                {role === 'aluno' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="terms-aluno"
                        checked={consentTerms}
                        onCheckedChange={(c) => setConsentTerms(!!c)}
                        className="mt-0.5 border-[#2A2A2A] data-[state=checked]:bg-[#0057FF] data-[state=checked]:text-white"
                      />
                      <label
                        htmlFor="terms-aluno"
                        className="text-xs text-gray-300 cursor-pointer font-inter"
                      >
                        Li e concordo com os{' '}
                        <Link
                          to="/termos-de-uso"
                          target="_blank"
                          className="text-[#0057FF] underline font-semibold"
                        >
                          Termos de Uso do Aluno
                        </Link>{' '}
                        (intermediação tecnológica, disclaimer clínico de emergência, direito de
                        arrependimento de 7 dias — CDC art. 49 e regras de conduta).
                      </label>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="lgpd-aluno"
                        checked={consentLgpd}
                        onCheckedChange={(c) => setConsentLgpd(!!c)}
                        className="mt-0.5 border-[#2A2A2A] data-[state=checked]:bg-[#0057FF] data-[state=checked]:text-white"
                      />
                      <label
                        htmlFor="lgpd-aluno"
                        className="text-xs text-gray-300 cursor-pointer font-inter"
                      >
                        Li e concordo com a{' '}
                        <Link
                          to="/politica-de-privacidade"
                          target="_blank"
                          className="text-[#0057FF] underline font-semibold"
                        >
                          Política de Privacidade
                        </Link>{' '}
                        e o{' '}
                        <Link
                          to="/regulamento-cashback"
                          target="_blank"
                          className="text-[#0057FF] underline font-semibold"
                        >
                          Regulamento de Cashback
                        </Link>
                        .
                      </label>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 flex items-start gap-2.5">
                      <Checkbox
                        id="sensitive-health-aluno"
                        checked={consentSensitiveHealth}
                        onCheckedChange={(c) => setConsentSensitiveHealth(!!c)}
                        className="mt-0.5 border-[#0057FF] data-[state=checked]:bg-[#0057FF] data-[state=checked]:text-white"
                      />
                      <label
                        htmlFor="sensitive-health-aluno"
                        className="text-[11px] text-gray-200 cursor-pointer leading-relaxed"
                      >
                        <strong className="text-[#0057FF] block font-montserrat uppercase">
                          Consentimento Específico para Dados Sensíveis de Saúde (Art. 11 LGPD)
                        </strong>
                        Autorizo expressamente a coleta e o processamento dos meus dados de saúde
                        (frequência cardíaca via smartwatches, dores, lesões, rotinas de exercícios)
                        exclusivamente para prescrição personalizada pelos profissionais e
                        assistentes de IA, nos termos do{' '}
                        <Link
                          to="/lgpd-consentimentos"
                          target="_blank"
                          className="text-[#0057FF] underline font-semibold"
                        >
                          Termo de Consentimento Art. 11 LGPD
                        </Link>
                        .
                      </label>
                    </div>
                  </div>
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

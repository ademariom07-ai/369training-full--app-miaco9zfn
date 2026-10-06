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

  // Selected Plan: Grátis (0x), Básico (1x), Pro (2x), Premium (3x), PRO Parceiro
  const [selectedPlan, setSelectedPlan] = useState<
    'gratis' | 'basico' | 'pro' | 'premium' | 'pro_parceiro'
  >(initialRole === 'profissional' ? 'basico' : 'gratis')

  // Aluno specific
  const [objective, setObjective] = useState('Hipertrofia')

  // Novo Questionário de Objetivos do Aluno
  const [showStudentSurveyModal, setShowStudentSurveyModal] = useState(false)
  const [registeredStudentUser, setRegisteredStudentUser] = useState<any>(null)
  const [surveyMainGoal, setSurveyMainGoal] = useState('Ganho de massa muscular')
  const [surveyFrequency, setSurveyFrequency] = useState('4-5x na semana')
  const [surveyExperience, setSurveyExperience] = useState('Iniciante')
  const [surveyHealthLimitations, setSurveyHealthLimitations] = useState('')
  const [savingSurvey, setSavingSurvey] = useState(false)

  const handleSaveStudentSurvey = async (skip: boolean = false) => {
    if (!registeredStudentUser?.id) {
      navigate('/login')
      return
    }

    if (!skip) {
      setSavingSurvey(true)
      try {
        await pb.collection('student_onboarding_surveys').create({
          user: registeredStudentUser.id,
          main_goal: surveyMainGoal,
          training_frequency: surveyFrequency,
          experience_level: surveyExperience,
          health_limitations: surveyHealthLimitations.trim(),
        })
        toast.success('Objetivos salvos com sucesso!')
      } catch (errSurvey) {
        console.warn('Aviso: erro ao salvar respostas do questionário:', errSurvey)
        toast.info('Cadastro concluído! Você poderá atualizar seus objetivos no perfil.')
      } finally {
        setSavingSurvey(false)
      }
    }

    setShowStudentSurveyModal(false)
    navigate('/login')
  }

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
  const [missingConsentHighlight, setMissingConsentHighlight] = useState<
    'terms' | 'lgpd' | 'sensitive' | null
  >(null)
  const [pulseConsent, setPulseConsent] = useState<'terms' | 'lgpd' | 'sensitive' | null>(null)

  const triggerPulse = (type: 'terms' | 'lgpd' | 'sensitive') => {
    setPulseConsent(type)
    setTimeout(() => {
      setPulseConsent((prev) => (prev === type ? null : prev))
    }, 350)
  }

  const [loading, setLoading] = useState(false)
  const [createdSuccess, setCreatedSuccess] = useState(false)

  const toggleSpecialty = (spec: string) => {
    let nextSpecialties: string[]
    if (specialties.includes(spec)) {
      if (specialties.length > 1) {
        nextSpecialties = specialties.filter((s) => s !== spec)
      } else {
        nextSpecialties = specialties
      }
    } else {
      nextSpecialties = [...specialties, spec]
    }
    setSpecialties(nextSpecialties)

    // Ajustar automaticamente o conselho/entidade de acordo com a especialidade prioritária selecionada
    if (
      nextSpecialties.includes('Artes Marciais') &&
      (!nextSpecialties.includes('Educação Física') || spec === 'Artes Marciais')
    ) {
      setCouncil('FEDERACAO')
    } else if (nextSpecialties.includes('Educação Física') && spec === 'Educação Física') {
      setCouncil('CREF')
    } else if (nextSpecialties.includes('Nutrição') && spec === 'Nutrição') {
      setCouncil('CRN')
    } else if (nextSpecialties.includes('Fisioterapia') && spec === 'Fisioterapia') {
      setCouncil('CREFITO')
    } else if (nextSpecialties.includes('Psicologia') && spec === 'Psicologia') {
      setCouncil('CRP')
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
      if (!consentTerms) {
        setMissingConsentHighlight('terms')
        const el = document.getElementById('consent-terms-container')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setMissingConsentHighlight(null), 2500)
        toast.error('Falta aceitar o Contrato de Parceria Comercial do Profissional.')
        return
      }
      if (!consentLgpd) {
        setMissingConsentHighlight('lgpd')
        const el = document.getElementById('consent-lgpd-container')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setMissingConsentHighlight(null), 2500)
        toast.error('Falta aceitar a Política de Privacidade e Regulamento de Cashback.')
        return
      }
      if (!consentSensitiveHealth) {
        setMissingConsentHighlight('sensitive')
        const el = document.getElementById('consent-sensitive-container')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setMissingConsentHighlight(null), 2500)
        toast.error('Falta aceitar o Consentimento para Dados Sensíveis de Saúde (Art. 11 LGPD).')
        return
      }
    } else {
      // Aluno
      if (!consentTerms) {
        setMissingConsentHighlight('terms')
        const el = document.getElementById('consent-terms-container')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setMissingConsentHighlight(null), 2500)
        toast.error('Falta aceitar os Termos de Uso do Aluno.')
        return
      }
      if (!consentLgpd) {
        setMissingConsentHighlight('lgpd')
        const el = document.getElementById('consent-lgpd-container')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setMissingConsentHighlight(null), 2500)
        toast.error('Falta aceitar a Política de Privacidade e Regulamento de Cashback.')
        return
      }
      if (!consentSensitiveHealth) {
        setMissingConsentHighlight('sensitive')
        const el = document.getElementById('consent-sensitive-container')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setMissingConsentHighlight(null), 2500)
        toast.error('Falta aceitar o Consentimento para Dados Sensíveis de Saúde (Art. 11 LGPD).')
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

      // HOTFIX 369: Autenticar imediatamente o usuário recém-criado ANTES de gravar os aceites legais.
      // A regra de criação de legal_acceptances exige @request.body.user = @request.auth.id.
      // Executado para ambos os papéis (aluno e profissional).
      let isAuthenticated = false
      try {
        await pb.collection('users').authWithPassword(email.trim().toLowerCase(), password)
        isAuthenticated = true
      } catch (authErr) {
        console.warn('Auto-login pós-cadastro falhou:', authErr)
      }

      // Registrar aceites legais na coleção legal_acceptances para TODOS os documentos aplicáveis ao papel
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const userAgent = navigator.userAgent || 'web-browser'
      const clientIp = 'client-registration'
      let failedAcceptancesCount = 0

      try {
        const targetAudience = role === 'profissional' ? 'profissional' : 'aluno'
        const filter = `status = 'publicado' && (audience = 'todos' || audience = '${targetAudience}')`
        const applicableDocs = await pb.collection('legal_documents').getFullList({ filter })

        for (const doc of applicableDocs) {
          let recorded = false
          // Tentativa direta com o usuário autenticado
          if (isAuthenticated && pb.authStore.isValid) {
            try {
              await pb.collection('legal_acceptances').create({
                user: createdUser.id,
                document: doc.id,
                document_slug: doc.slug,
                version: doc.version || 1,
                accepted_at: nowIso,
                ip: clientIp,
                user_agent: userAgent,
                consent_type: doc.slug,
              })
              recorded = true
            } catch (itemErr) {
              console.warn(`Tentativa direta de registrar aceite de ${doc.slug} falhou:`, itemErr)
            }
          }

          // Fallback via rota de backend /backend/v1/legal/accept se a direta falhou ou se precisou autenticar
          if (!recorded) {
            try {
              // Se ainda não estiver autenticado, tentar autenticar novamente
              if (!pb.authStore.isValid) {
                await pb.collection('users').authWithPassword(email.trim().toLowerCase(), password)
                isAuthenticated = true
              }
              await pb.send('/backend/v1/legal/accept', {
                method: 'POST',
                body: {
                  document_id: doc.id,
                  document_slug: doc.slug,
                  version: doc.version || 1,
                  consent_type: doc.slug,
                },
              })
              recorded = true
            } catch (fallbackErr) {
              console.warn(
                `Fallback de aceite via rota de backend de ${doc.slug} falhou:`,
                fallbackErr,
              )
              failedAcceptancesCount++
            }
          }
        }
      } catch (errAccept) {
        console.warn('Erro ao consultar documentos aplicáveis pós-cadastro:', errAccept)
        failedAcceptancesCount++
      }

      if (failedAcceptancesCount > 0) {
        toast.error(
          'Alguns aceites legais não puderam ser gravados no momento e serão solicitados novamente no seu próximo login.',
          { duration: 6000 },
        )
      }

      // Se for profissional, registrar a verificação de credencial na coleção credential_verifications
      if (role === 'profissional' && createdUser?.id) {
        try {
          if (!pb.authStore.isValid) {
            try {
              await pb.collection('users').authWithPassword(email.trim().toLowerCase(), password)
            } catch (authErr) {
              console.warn('Tentativa de login para credencial falhou:', authErr)
            }
          }

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

          try {
            await pb.collection('credential_verifications').create(credFormData)
          } catch (createErr: any) {
            console.warn(
              'Tentativa direta de criar credencial falhou, usando endpoint alternativo do backend:',
              createErr?.response?.data || createErr?.message,
            )
            // Fallback para o endpoint de backend com upload de arquivo
            await pb.send('/backend/v1/professional/submit-credential', {
              method: 'POST',
              body: credFormData,
            })
          }
        } catch (credErr: any) {
          console.error(
            'Erro ao salvar documento em credential_verifications:',
            credErr,
            credErr?.response?.data || credErr?.data || credErr?.message,
          )
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

      // Se for aluno, abrir questionário referente ao seu objetivo
      if (role === 'aluno' && createdUser?.id) {
        setRegisteredStudentUser(createdUser)
        setShowStudentSurveyModal(true)
        setLoading(false)
        return
      }

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
    <div className="min-h-screen bg-[#f7f6f3] flex flex-col justify-center items-center px-4 pt-12 pb-32 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <CrestLogo size={68} />
          </Link>
          <h1 className="text-3xl font-extrabold font-montserrat uppercase gold-gradient-text tracking-wider">
            369WELLNESS
          </h1>
          <p className="text-xs text-[#6B7280] font-inter mt-1 tracking-wider uppercase">
            Criar Nova Conta no Ecossistema
          </p>
        </div>

        <Card className="bg-white border border-[#E4E2DC] rounded-2xl p-6 sm:p-8 shadow-xl">
          {createdSuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-[#15803d] mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold font-montserrat text-[#1A1A1A]">
                Conta Criada com Sucesso!
              </h3>
              <p className="text-sm text-[#4B5563] mt-2 font-inter">
                {role === 'profissional'
                  ? 'Seu cadastro de profissional foi recebido e passará por análise de credenciais.'
                  : 'Sua conta de aluno está ativa. Redirecionando para o login...'}
              </p>
            </div>
          ) : (
            <>
              {/* Segmented Control */}
              <div className="flex bg-[#F7F5F0] p-1 rounded-xl border border-[#E4E2DC] mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setRole('aluno')
                    setSelectedPlan('gratis')
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                    role === 'aluno'
                      ? 'bg-[#0057FF] text-white shadow-md'
                      : 'text-[#4B5563] hover:text-[#1A1A1A]'
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
                      : 'text-[#4B5563] hover:text-[#1A1A1A]'
                  }`}
                >
                  Sou Profissional
                </button>
              </div>

              {/* SELEÇÃO DE PLANO NO CADASTRO (GRÁTIS 0x, BÁSICO 1x, PRO 2x, PREMIUM 3x) */}
              <div className="mb-6 p-4 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC] space-y-3">
                <label className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider font-montserrat flex items-center justify-between">
                  <span>Escolha seu Plano Inicial:</span>
                  <span className="text-[10px] text-[#B8962E] font-semibold">
                    Multiplicador de Ranking
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'gratis' as const,
                      name: 'GRÁTIS',
                      multiplier: role === 'profissional' ? '1.0x' : '0.0x',
                      badge: role === 'profissional' ? 'Pontua 1x' : 'Sem Ranking',
                      desc:
                        role === 'aluno'
                          ? 'R$ 0 / mês'
                          : 'R$ 0 / mês • Pontua como Básico (sem cashback)',
                      forRole: 'all',
                    },
                    {
                      id: 'basico' as const,
                      name: 'BÁSICO',
                      multiplier: '1.0x',
                      badge: 'Pontuação 1x',
                      desc:
                        role === 'aluno' ? 'R$ 10 / mês' : 'Sem mensalidade fixa • R$ 1,00/serviço',
                      forRole: 'all',
                    },
                    {
                      id: 'pro' as const,
                      name: 'PRO',
                      multiplier: '2.0x',
                      badge: 'Pontuação 2x',
                      desc:
                        role === 'aluno' ? 'R$ 20 / mês' : 'Sem mensalidade fixa • R$ 2,00/serviço',
                      forRole: 'all',
                    },
                    {
                      id: 'premium' as const,
                      name: 'PREMIUM',
                      multiplier: '3.0x',
                      badge: 'Acelerador 3x',
                      desc:
                        role === 'aluno' ? 'R$ 30 / mês' : 'Sem mensalidade fixa • R$ 3,00/serviço',
                      forRole: 'all',
                    },
                    {
                      id: 'pro_parceiro' as const,
                      name: 'PRO PARCEIRO',
                      multiplier: '1.0x (Teto 150)',
                      badge: 'Parceiro PRO',
                      desc: 'R$ 149/mês • Teto 150 (SEM tarifa por serviço)',
                      forRole: 'profissional',
                    },
                  ].map((p) => {
                    const isSelected = selectedPlan === p.id
                    if (role === 'aluno' && p.id === 'pro_parceiro') return null
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setSelectedPlan(p.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                          isSelected
                            ? p.id === 'premium'
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-sm'
                              : p.id === 'pro'
                                ? 'bg-[#0057FF]/15 border-[#0057FF] shadow-sm'
                                : 'bg-[#22C55E]/15 border-[#22C55E]'
                            : 'bg-white border-[#E4E2DC] hover:border-[#D4AF37]/60'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black font-montserrat text-[#1A1A1A]">
                              {p.name}
                            </span>
                            {isSelected && (
                              <CheckCircle2
                                className={`w-3.5 h-3.5 ${
                                  p.id === 'premium'
                                    ? 'text-[#B8962E]'
                                    : p.id === 'pro'
                                      ? 'text-[#0057FF]'
                                      : 'text-[#15803d]'
                                }`}
                              />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold block ${
                              p.id === 'gratis'
                                ? 'text-[#6B7280]'
                                : p.id === 'premium'
                                  ? 'text-[#B8962E]'
                                  : p.id === 'pro'
                                    ? 'text-[#0057FF]'
                                    : 'text-[#15803d]'
                            }`}
                          >
                            Multiplicador {p.multiplier}
                          </span>
                        </div>
                        <span className="text-[9px] text-[#6B7280] font-inter mt-1 block">
                          {p.desc}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {selectedPlan === 'gratis' && (
                  <p className="text-[11px] text-amber-800 font-inter bg-amber-50 p-2 rounded-lg border border-amber-300">
                    ℹ️ <strong>Plano Grátis (0x):</strong> O aluno tem acesso às funcionalidades
                    essenciais. Caso se vincule a um profissional credenciado, passa a usufruir de
                    isenção total e pontuação no plano do mentor!
                  </p>
                )}
              </div>

              {role === 'profissional' && (
                <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-3 text-xs text-amber-900">
                  <ShieldCheck className="w-5 h-5 text-[#B8962E] shrink-0" />
                  <span>
                    <strong>Aviso de Auditoria:</strong> Seu perfil será analisado antes da oferta
                    pública de serviços para garantir a segurança dos alunos.
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] focus-visible:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                {/* E-mail & Senha (2 cols) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                      E-mail *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@email.com"
                        className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                      Senha * (mín. 8 caracteres)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* País, Telefone & Localização (RECURSO 7: SELEÇÃO DE PAÍS) */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#B8962E] uppercase tracking-wider mb-1 font-montserrat">
                      País *
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white border border-[#D4AF37]/50 text-[#1A1A1A] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
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
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                      Telefone / WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                      Cidade *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="São Paulo"
                        className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] focus-visible:ring-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                      Estado / Província *
                    </label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="SP"
                      maxLength={10}
                      className="bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] text-center font-bold focus-visible:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                {/* RECURSO 1: Campo Código de Indicação */}
                <div className="p-3.5 rounded-xl bg-[#F7F5F0] border border-[#E4E2DC] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider font-montserrat">
                      Código de Indicação{' '}
                      <span className="text-[#6B7280] font-normal lowercase">(opcional)</span>
                    </label>
                    {urlRef && (
                      <span className="text-[10px] text-[#B8962E] font-bold uppercase font-mono">
                        Preenchido via link
                      </span>
                    )}
                  </div>
                  <Input
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ex: SILV369"
                    className="bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] font-mono uppercase tracking-wider text-xs focus-visible:ring-[#D4AF37]"
                  />
                  <p className="text-[11px] text-[#6B7280] font-inter">
                    Se você foi indicado por um amigo ou profissional, insira o código para vincular
                    benefícios e bônus de rede.
                  </p>
                </div>

                {/* ALUNO SPECIFIC: Objetivo */}
                {role === 'aluno' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                      Objetivo Principal
                    </label>
                    <select
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white border border-[#E4E2DC] text-[#1A1A1A] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
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
                        <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                          Tipo de Atuação
                        </label>
                        <select
                          value={professionalType}
                          onChange={(e) =>
                            setProfessionalType(e.target.value as 'Pessoa Física' | 'MEI')
                          }
                          className="w-full h-10 px-3 rounded-xl bg-white border border-[#E4E2DC] text-[#1A1A1A] text-xs focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        >
                          <option value="Pessoa Física">Pessoa Física</option>
                          <option value="MEI">MEI / Pessoa Jurídica</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#B8962E] uppercase tracking-wider mb-1 font-montserrat">
                          Conselho / Entidade *
                        </label>
                        <select
                          value={council}
                          onChange={(e) =>
                            setCouncil(
                              e.target.value as 'CREF' | 'CRN' | 'CREFITO' | 'CRP' | 'FEDERACAO',
                            )
                          }
                          className="w-full h-10 px-3 rounded-xl bg-white border border-[#D4AF37]/50 text-[#1A1A1A] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        >
                          <option value="CREF">CREF (Educação Física)</option>
                          <option value="CRN">CRN (Nutrição)</option>
                          <option value="CREFITO">CREFITO (Fisioterapia)</option>
                          <option value="CRP">CRP (Psicologia)</option>
                          <option value="FEDERACAO">Federação (Artes Marciais)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 font-montserrat">
                          Número de Registro *
                        </label>
                        <div className="relative">
                          <Award className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <Input
                            value={specialties.includes('Psicologia') && crp ? crp : cref}
                            onChange={(e) => {
                              if (specialties.includes('Psicologia')) {
                                setCrp(e.target.value)
                              }
                              setCref(e.target.value)
                            }}
                            placeholder="Ex: 098765-G/SP"
                            className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-[#1A1A1A] text-xs focus-visible:ring-[#D4AF37]"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* UPLOAD OBRIGATÓRIO DO DOCUMENTO (TAREFA 3) */}
                    <div className="p-3.5 rounded-xl bg-[#F7F5F0] border border-[#D4AF37]/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#1A1A1A] uppercase font-montserrat flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#B8962E]" />
                          Foto do Documento Profissional / Cédula (Obrigatório) *
                        </label>
                        <span className="text-[10px] text-[#B8962E] font-semibold">
                          Validação Modelo Uber/CNH
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4B5563]">
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
                        className="w-full text-xs text-[#374151] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37] file:text-black hover:file:bg-[#e0be4a] cursor-pointer"
                        required
                      />
                      {documentFile && (
                        <p className="text-[11px] text-[#15803d] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Arquivo selecionado:{' '}
                          {documentFile.name} ({(documentFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>

                    {/* RECURSO 5: PSICOLOGIA & SUB-ESPECIALIDADES */}
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-2 font-montserrat">
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
                                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#1A1A1A]'
                                  : 'bg-white border-[#E4E2DC] text-[#4B5563] hover:text-[#1A1A1A]'
                              }`}
                            >
                              <span>{spec}</span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-[#B8962E]" />}
                            </button>
                          )
                        })}
                      </div>

                      {/* Sub-especialidades de Psicologia quando selecionado */}
                      {specialties.includes('Psicologia') && (
                        <div className="mt-3 p-3 rounded-xl bg-[#F7F5F0] border border-[#D4AF37]/30 space-y-2">
                          <label className="block text-[11px] font-bold text-[#B8962E] uppercase font-montserrat">
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
                                      ? 'bg-[#0057FF]/15 border-[#0057FF] text-[#0057FF] font-bold'
                                      : 'bg-white border-[#E4E2DC] text-[#4B5563] hover:text-[#1A1A1A]'
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

                    {/* Consents Profissional */}
                    <div className="space-y-3 pt-2 relative z-10">
                      <div
                        id="consent-terms-container"
                        className={`rounded-xl p-2.5 transition-all flex items-start gap-3 bg-white border ${
                          missingConsentHighlight === 'terms'
                            ? 'border-red-500 ring-2 ring-red-500/50 bg-red-50'
                            : 'border-[#E4E2DC] hover:border-[#D4AF37]/60'
                        }`}
                      >
                        <label
                          htmlFor="terms-prof"
                          className={`min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -m-2 cursor-pointer rounded-xl transition-all ${
                            pulseConsent === 'terms'
                              ? 'ring-4 ring-emerald-500/80 bg-emerald-50'
                              : 'active:bg-gray-100'
                          }`}
                        >
                          <Checkbox
                            id="terms-prof"
                            checked={consentTerms}
                            onCheckedChange={(c) => {
                              const next = !!c
                              setConsentTerms(next)
                              if (next) triggerPulse('terms')
                            }}
                            className="w-5 h-5 border-[#D1D5DB] transition-none data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                          />
                        </label>
                        <label
                          htmlFor="terms-prof"
                          className="text-xs text-[#374151] cursor-pointer font-inter select-none py-1 flex-1 leading-relaxed"
                        >
                          Li e concordo com o{' '}
                          <Link
                            to="/contrato-parceria"
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#B8962E] underline font-semibold relative z-20 hover:text-[#99771C]"
                          >
                            Contrato de Parceria Comercial do Profissional
                          </Link>{' '}
                          (autonomia técnica, emissão de NFS-e, não exclusividade e regras de
                          suspensão com ampla defesa).
                        </label>
                      </div>

                      <div
                        id="consent-lgpd-container"
                        className={`rounded-xl p-2.5 transition-all flex items-start gap-3 bg-white border ${
                          missingConsentHighlight === 'lgpd'
                            ? 'border-red-500 ring-2 ring-red-500/50 bg-red-50'
                            : 'border-[#E4E2DC] hover:border-[#D4AF37]/60'
                        }`}
                      >
                        <label
                          htmlFor="lgpd-prof"
                          className={`min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -m-2 cursor-pointer rounded-xl transition-all ${
                            pulseConsent === 'lgpd'
                              ? 'ring-4 ring-emerald-500/80 bg-emerald-50'
                              : 'active:bg-gray-100'
                          }`}
                        >
                          <Checkbox
                            id="lgpd-prof"
                            checked={consentLgpd}
                            onCheckedChange={(c) => {
                              const next = !!c
                              setConsentLgpd(next)
                              if (next) triggerPulse('lgpd')
                            }}
                            className="w-5 h-5 border-[#D1D5DB] transition-none data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                          />
                        </label>
                        <label
                          htmlFor="lgpd-prof"
                          className="text-xs text-[#374151] cursor-pointer font-inter select-none py-1 flex-1 leading-relaxed"
                        >
                          Li e concordo com a{' '}
                          <Link
                            to="/politica-de-privacidade"
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#B8962E] underline font-semibold relative z-20 hover:text-[#99771C]"
                          >
                            Política de Privacidade
                          </Link>{' '}
                          e o{' '}
                          <Link
                            to="/regulamento-cashback"
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#B8962E] underline font-semibold relative z-20 hover:text-[#99771C]"
                          >
                            Regulamento de Cashback
                          </Link>
                          .
                        </label>
                      </div>

                      <div
                        id="consent-sensitive-container"
                        className={`p-2.5 rounded-xl bg-[#D4AF37]/10 border flex items-start gap-3 transition-all ${
                          missingConsentHighlight === 'sensitive'
                            ? 'border-red-500 ring-2 ring-red-500/50 bg-red-50'
                            : 'border-[#D4AF37]/30 hover:border-[#D4AF37]/50'
                        }`}
                      >
                        <label
                          htmlFor="sensitive-health-prof"
                          className={`min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -m-2 cursor-pointer rounded-xl transition-all ${
                            pulseConsent === 'sensitive'
                              ? 'ring-4 ring-emerald-500/80 bg-emerald-50'
                              : 'active:bg-gray-100'
                          }`}
                        >
                          <Checkbox
                            id="sensitive-health-prof"
                            checked={consentSensitiveHealth}
                            onCheckedChange={(c) => {
                              const next = !!c
                              setConsentSensitiveHealth(next)
                              if (next) triggerPulse('sensitive')
                            }}
                            className="w-5 h-5 border-[#D4AF37] transition-none data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                          />
                        </label>
                        <label
                          htmlFor="sensitive-health-prof"
                          className="text-[11px] text-[#374151] cursor-pointer leading-relaxed select-none py-1 flex-1"
                        >
                          <strong className="text-[#B8962E] block font-montserrat uppercase">
                            Consentimento para Dados Sensíveis de Saúde (Art. 11 LGPD)
                          </strong>
                          Autorizo o compartilhamento e tratamento estritamente técnico de dados
                          clínicos, métricas biométricas e prescrições para os alunos sob meu
                          acompanhamento, conforme o{' '}
                          <Link
                            to="/lgpd-consentimentos"
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#B8962E] underline relative z-20 hover:text-[#99771C]"
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
                  <div className="space-y-3 pt-2 relative z-10">
                    <div
                      id="consent-terms-container"
                      className={`rounded-xl p-2.5 transition-all flex items-start gap-3 bg-white border ${
                        missingConsentHighlight === 'terms'
                          ? 'border-red-500 ring-2 ring-red-500/50 bg-red-50'
                          : 'border-[#E4E2DC] hover:border-[#0057FF]/50'
                      }`}
                    >
                      <label
                        htmlFor="terms-aluno"
                        className={`min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -m-2 cursor-pointer rounded-xl transition-all ${
                          pulseConsent === 'terms'
                            ? 'ring-4 ring-emerald-500/80 bg-emerald-50'
                            : 'active:bg-gray-100'
                        }`}
                      >
                        <Checkbox
                          id="terms-aluno"
                          checked={consentTerms}
                          onCheckedChange={(c) => {
                            const next = !!c
                            setConsentTerms(next)
                            if (next) triggerPulse('terms')
                          }}
                          className="w-5 h-5 border-[#D1D5DB] transition-none data-[state=checked]:bg-[#0057FF] data-[state=checked]:text-white"
                        />
                      </label>
                      <label
                        htmlFor="terms-aluno"
                        className="text-xs text-[#374151] cursor-pointer font-inter select-none py-1 flex-1 leading-relaxed"
                      >
                        Li e concordo com os{' '}
                        <Link
                          to="/termos-de-uso"
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#0057FF] underline font-semibold relative z-20 hover:text-[#3B82F6]"
                        >
                          Termos de Uso do Aluno
                        </Link>{' '}
                        (intermediação tecnológica, disclaimer clínico de emergência, direito de
                        arrependimento de 7 dias — CDC art. 49 e regras de conduta).
                      </label>
                    </div>

                    <div
                      id="consent-lgpd-container"
                      className={`rounded-xl p-2.5 transition-all flex items-start gap-3 bg-white border ${
                        missingConsentHighlight === 'lgpd'
                          ? 'border-red-500 ring-2 ring-red-500/50 bg-red-50'
                          : 'border-[#E4E2DC] hover:border-[#0057FF]/50'
                      }`}
                    >
                      <label
                        htmlFor="lgpd-aluno"
                        className={`min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -m-2 cursor-pointer rounded-xl transition-all ${
                          pulseConsent === 'lgpd'
                            ? 'ring-4 ring-emerald-500/80 bg-emerald-50'
                            : 'active:bg-gray-100'
                        }`}
                      >
                        <Checkbox
                          id="lgpd-aluno"
                          checked={consentLgpd}
                          onCheckedChange={(c) => {
                            const next = !!c
                            setConsentLgpd(next)
                            if (next) triggerPulse('lgpd')
                          }}
                          className="w-5 h-5 border-[#D1D5DB] transition-none data-[state=checked]:bg-[#0057FF] data-[state=checked]:text-white"
                        />
                      </label>
                      <label
                        htmlFor="lgpd-aluno"
                        className="text-xs text-[#374151] cursor-pointer font-inter select-none py-1 flex-1 leading-relaxed"
                      >
                        Li e concordo com a{' '}
                        <Link
                          to="/politica-de-privacidade"
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#0057FF] underline font-semibold relative z-20 hover:text-[#3B82F6]"
                        >
                          Política de Privacidade
                        </Link>{' '}
                        e o{' '}
                        <Link
                          to="/regulamento-cashback"
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#0057FF] underline font-semibold relative z-20 hover:text-[#3B82F6]"
                        >
                          Regulamento de Cashback
                        </Link>
                        .
                      </label>
                    </div>

                    <div
                      id="consent-sensitive-container"
                      className={`p-2.5 rounded-xl bg-[#0057FF]/10 border flex items-start gap-3 transition-all ${
                        missingConsentHighlight === 'sensitive'
                          ? 'border-red-500 ring-2 ring-red-500/50 bg-red-50'
                          : 'border-[#0057FF]/30 hover:border-[#0057FF]/50'
                      }`}
                    >
                      <label
                        htmlFor="sensitive-health-aluno"
                        className={`min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -m-2 cursor-pointer rounded-xl transition-all ${
                          pulseConsent === 'sensitive'
                            ? 'ring-4 ring-emerald-500/80 bg-emerald-50'
                            : 'active:bg-gray-100'
                        }`}
                      >
                        <Checkbox
                          id="sensitive-health-aluno"
                          checked={consentSensitiveHealth}
                          onCheckedChange={(c) => {
                            const next = !!c
                            setConsentSensitiveHealth(next)
                            if (next) triggerPulse('sensitive')
                          }}
                          className="w-5 h-5 border-[#0057FF] transition-none data-[state=checked]:bg-[#0057FF] data-[state=checked]:text-white"
                        />
                      </label>
                      <label
                        htmlFor="sensitive-health-aluno"
                        className="text-[11px] text-[#374151] cursor-pointer leading-relaxed select-none py-1 flex-1"
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
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#0057FF] underline font-semibold relative z-20 hover:text-[#3B82F6]"
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
        <p className="text-center text-xs text-[#6B7280] mt-6 font-inter">
          Já possui cadastro?{' '}
          <Link to="/login" className="text-[#B8962E] font-semibold hover:underline">
            Fazer login
          </Link>
        </p>
      </div>

      {/* MODAL DO QUESTIONÁRIO DE OBJETIVOS NA INSCRIÇÃO DO ALUNO */}
      {showStudentSurveyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-[#E4E2DC] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#0057FF]/10 text-[#0057FF] mb-2 font-montserrat">
                Personalização do seu Treino
              </span>
              <h2 className="text-xl sm:text-2xl font-black font-montserrat text-[#1A1A1A]">
                Conte-nos sobre seu Objetivo
              </h2>
              <p className="text-xs text-[#6B7280] font-inter mt-1.5">
                Responda este breve questionário para que os profissionais e assistentes da
                369WELLNESS adaptem seus treinos desde o primeiro dia.
              </p>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Pergunta 1: Objetivo principal */}
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-1.5 font-montserrat">
                  1. Qual é o seu principal objetivo? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Perda de peso',
                    'Ganho de massa muscular',
                    'Condicionamento físico',
                    'Saúde geral e bem-estar',
                    'Performance esportiva',
                  ].map((goal) => (
                    <button
                      type="button"
                      key={goal}
                      onClick={() => setSurveyMainGoal(goal)}
                      className={`text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                        surveyMainGoal === goal
                          ? 'bg-[#0057FF] text-white border-[#0057FF] shadow-sm'
                          : 'bg-[#F7F5F0] text-[#374151] border-[#E4E2DC] hover:border-[#0057FF]/40'
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pergunta 2: Frequência */}
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-1.5 font-montserrat">
                  2. Com que frequência você pretende treinar? *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['2-3x na semana', '4-5x na semana', '6x ou mais', 'Ainda não sei'].map(
                    (freq) => (
                      <button
                        type="button"
                        key={freq}
                        onClick={() => setSurveyFrequency(freq)}
                        className={`text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                          surveyFrequency === freq
                            ? 'bg-[#0057FF] text-white border-[#0057FF] shadow-sm'
                            : 'bg-[#F7F5F0] text-[#374151] border-[#E4E2DC] hover:border-[#0057FF]/40'
                        }`}
                      >
                        {freq}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Pergunta 3: Experiência */}
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-1.5 font-montserrat">
                  3. Qual é o seu nível de experiência? *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Iniciante', 'Intermediário', 'Avançado'].map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setSurveyExperience(lvl)}
                      className={`text-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                        surveyExperience === lvl
                          ? 'bg-[#0057FF] text-white border-[#0057FF] shadow-sm'
                          : 'bg-[#F7F5F0] text-[#374151] border-[#E4E2DC] hover:border-[#0057FF]/40'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pergunta 4: Limitações físicas / saúde */}
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-1.5 font-montserrat flex items-center justify-between">
                  <span>4. Possui alguma limitação física ou de saúde?</span>
                  <span className="text-[10px] text-[#6B7280] font-normal lowercase">
                    (opcional)
                  </span>
                </label>
                <textarea
                  value={surveyHealthLimitations}
                  onChange={(e) => setSurveyHealthLimitations(e.target.value)}
                  placeholder="Ex: Dor na lombar, cirurgia no joelho direito, hipertensão..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-white border border-[#E4E2DC] text-xs text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#0057FF]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSaveStudentSurvey(true)}
                disabled={savingSurvey}
                className="w-full sm:w-1/3 text-xs border-[#E4E2DC] text-[#6B7280] hover:text-[#1A1A1A]"
              >
                Pular por enquanto
              </Button>
              <Button
                type="button"
                onClick={() => handleSaveStudentSurvey(false)}
                disabled={savingSurvey}
                className="w-full sm:w-2/3 bg-[#0057FF] text-white hover:bg-[#1F6CFF] text-xs font-bold py-5 rounded-xl shadow-md"
              >
                {savingSurvey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Salvar Respostas e Continuar'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

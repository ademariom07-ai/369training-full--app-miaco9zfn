import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  User,
  Star,
  Award,
  ShieldCheck,
  PlayCircle,
  Sparkles,
  Layers,
  Video,
  CheckCircle2,
  DollarSign,
  MessageSquare,
} from 'lucide-react'
import { PlanChangeSection } from '@/components/PlanChangeSection'
import { toast } from 'sonner'

export default function ProfissionalPerfil() {
  const { user, refreshUser } = useAuth()

  const [bio, setBio] = useState(
    user?.bio ||
      'Especialista em biomecânica de alta performance e periodização científica de força. Mais de 12 anos atuando com atletas de elite e transformação corporal sustentável.',
  )
  const [phone, setPhone] = useState(user?.phone || '(11) 98765-4321')
  const [city, setCity] = useState(user?.city || 'São Paulo')
  const [state, setState] = useState(user?.state || 'SP')
  const [cref, setCref] = useState(user?.cref || 'CREF 098765-G/SP')
  const [crp, setCrp] = useState(user?.crp || '')
  const [videoUrl, setVideoUrl] = useState(user?.video_url || '')
  const [videoEnabled, setVideoEnabled] = useState(user?.video_enabled ?? false)
  const [saving, setSaving] = useState(false)

  // Referrals List State
  interface ReferralItem {
    id: string
    referred: string
    status?: 'pending' | 'validated'
    services_count?: number
    created: string
    validated_at?: string
    referral_bonus_paid?: boolean
    expand?: {
      referred?: {
        name: string
        email: string
        avatar?: string
      }
    }
  }
  const [referralsList, setReferralsList] = useState<ReferralItem[]>([])
  const [minServicesNeeded, setMinServicesNeeded] = useState(5)
  const [loadingReferrals, setLoadingReferrals] = useState(false)

  // Load referrals and min_services config
  React.useEffect(() => {
    if (!user) return

    setLoadingReferrals(true)
    Promise.all([
      pb.collection('referrals').getList<ReferralItem>(1, 100, {
        filter: `referrer = "${user.id}"`,
        sort: '-created',
        expand: 'referred',
      }),
      pb.collection('platform_config').getFullList(),
    ])
      .then(([refRes, configs]) => {
        setReferralsList(refRes.items)
        const cfg = configs.find((c) => c.key === 'min_services_to_validate_referral')
        if (cfg && cfg.value) {
          setMinServicesNeeded(Number(cfg.value) || 5)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingReferrals(false))
  }, [user])

  // Sync state if user loads later
  React.useEffect(() => {
    if (user) {
      if (user.bio !== undefined) setBio(user.bio)
      if (user.phone !== undefined) setPhone(user.phone)
      if (user.city !== undefined) setCity(user.city)
      if (user.state !== undefined) setState(user.state)
      if (user.cref !== undefined) setCref(user.cref)
      if (user.crp !== undefined) setCrp(user.crp)
      if (user.video_url !== undefined) setVideoUrl(user.video_url)
      if (user.video_enabled !== undefined) setVideoEnabled(user.video_enabled)
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await pb.collection('users').update(user.id, {
        bio,
        phone,
        city,
        state,
        cref,
        crp,
        video_url: videoUrl,
        video_enabled: videoEnabled,
      })
      await refreshUser()
      toast.success('Perfil público atualizado com sucesso!')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao atualizar perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#1C1A14] via-[#141414] to-[#1C1A14] border border-[#D4AF37]/50 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <img
              src="https://img.usecurling.com/ppl/large?gender=male&seed=2"
              alt={user?.name}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-widest font-montserrat px-2.5 py-0.5 rounded-full border ${
                    user?.plan === 'premium'
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                      : user?.plan === 'pro'
                        ? 'bg-[#0057FF]/15 border-[#0057FF] text-[#0057FF]'
                        : 'bg-gray-800 border-gray-700 text-gray-300'
                  }`}
                >
                  Plano {user?.plan?.toUpperCase() || 'BASICO'}
                </span>
                <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
              </div>
              <h1 className="text-3xl font-extrabold font-montserrat text-white mt-1">
                {user?.name || 'Prof. Carlos Silva'}
              </h1>
              <p className="text-xs text-[#0057FF] font-semibold mt-0.5">
                {user?.specialties?.join(' • ') || 'Educação Física & Nutrição'}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-2 font-inter">
                <span className="flex items-center gap-1 text-[#D4AF37] font-bold">
                  <Star className="w-3.5 h-3.5 fill-[#D4AF37]" /> {user?.rating_avg || 4.9} (48
                  avaliações)
                </span>
                {cref && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-gray-300">{cref}</span>
                  </>
                )}
                {crp && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                      CRP: {crp}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <Button className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs">
              Assinar Meu Plano
            </Button>
            <Button
              variant="outline"
              className="border-[#0057FF] text-white hover:bg-[#0057FF]/10 text-xs"
            >
              Falar Comigo
            </Button>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE TROCA DE PLANO PROFISSIONAL (Dias 1 a 3) */}
      <PlanChangeSection />

      {/* EDIT PROFILE FORM & BRANDING */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl">
        <h2 className="text-lg font-bold font-montserrat text-white uppercase mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Informações & Metodologia Focada
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5 font-montserrat">
              Biografia, Formação & Carreira/Legado
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full p-3 bg-[#141414] border border-[#2A2A2A] rounded-xl text-white text-xs leading-relaxed focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Nº de Registro (CREF)
              </label>
              <Input
                value={cref}
                onChange={(e) => setCref(e.target.value)}
                placeholder="Ex: CREF 123456-G/SP"
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4AF37] uppercase mb-1 font-montserrat">
                CRP (Psicologia)
              </label>
              <Input
                value={crp}
                onChange={(e) => setCrp(e.target.value)}
                placeholder="Ex: CRP 06/123456"
                className="bg-[#141414] border-[#D4AF37]/40 rounded-xl text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Telefone / WhatsApp
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Cidade / UF
              </label>
              <Input
                value={`${city} - ${state}`}
                onChange={(e) => {
                  const parts = e.target.value.split('-')
                  setCity(parts[0]?.trim() || city)
                  if (parts[1]) setState(parts[1]?.trim().toUpperCase())
                }}
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* Seção de Configuração do Vídeo de Apresentação */}
          <div className="pt-4 border-t border-[#2A2A2A] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-white uppercase font-montserrat flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#D4AF37]" />
                  Vídeo de Apresentação (Pitch de 30s)
                </label>
                <p className="text-[11px] text-gray-400 font-inter mt-0.5">
                  Insira o link do seu vídeo de apresentação (YouTube, Vimeo ou link direto MP4).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={videoEnabled}
                  onChange={(e) => setVideoEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#141414] border-[#2A2A2A] text-[#D4AF37] focus:ring-[#D4AF37]"
                />
                <span className="text-xs font-semibold text-gray-300">
                  {videoEnabled ? 'Exibição Ativa' : 'Desativado'}
                </span>
              </label>
            </div>

            <div>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... ou https://vimeo.com/... ou https://.../video.mp4"
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-8 py-5 rounded-xl shadow-lg mt-2"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações do Perfil'}
          </Button>
        </form>
      </Card>

      {/* SEÇÃO DE INDICAÇÕES (RECURSO 2: VALIDADOS E PENDENTES COM CONTADOR DE SERVIÇOS) */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
              <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
              Rede de Indicados Diretos
            </div>
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              Minhas Indicações & Validações de Serviços
            </h2>
            <p className="text-xs text-gray-400 font-inter mt-1">
              Para liberar o bônus de indicação na sua carteira, o aluno indicado deve concluir no
              mínimo <strong className="text-[#D4AF37]">{minServicesNeeded} serviços</strong> na
              plataforma.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-[#141414] border border-[#22C55E]/40 text-center">
              <span className="block text-[10px] uppercase text-gray-400 font-semibold">
                Validados
              </span>
              <span className="text-base font-black text-[#22C55E] font-mono">
                {
                  referralsList.filter(
                    (r) => r.status === 'validated' || (r.services_count || 0) >= minServicesNeeded,
                  ).length
                }
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#141414] border border-amber-500/40 text-center">
              <span className="block text-[10px] uppercase text-gray-400 font-semibold">
                Pendentes
              </span>
              <span className="text-base font-black text-amber-400 font-mono">
                {
                  referralsList.filter(
                    (r) => r.status !== 'validated' && (r.services_count || 0) < minServicesNeeded,
                  ).length
                }
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Indicados */}
        {loadingReferrals ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            Carregando lista de indicados...
          </div>
        ) : referralsList.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center space-y-2">
            <p className="text-white font-bold font-montserrat text-xs uppercase">
              Nenhum aluno indicado ainda
            </p>
            <p className="text-gray-400 text-xs font-inter">
              Compartilhe seu código de indicação{' '}
              <strong className="text-[#D4AF37] font-mono">
                {user?.referral_code || '369PRO'}
              </strong>{' '}
              com seus alunos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {referralsList.map((ref) => {
              const currentServices = ref.services_count || 0
              const isValidated = ref.status === 'validated' || currentServices >= minServicesNeeded
              const progressPct = Math.min(
                100,
                Math.round((currentServices / minServicesNeeded) * 100),
              )
              const studentName = ref.expand?.referred?.name || `Aluno #${ref.referred.slice(0, 6)}`
              const studentEmail = ref.expand?.referred?.email || ''

              return (
                <div
                  key={ref.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isValidated
                      ? 'bg-[#141414] border-[#22C55E]/40 shadow-[0_0_15px_rgba(34,197,94,0.08)]'
                      : 'bg-[#141414] border-[#2A2A2A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1c1c1c] border border-[#2A2A2A] flex items-center justify-center text-sm font-bold font-montserrat text-[#D4AF37]">
                        {studentName[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold font-montserrat text-white">
                          {studentName}
                        </h4>
                        {studentEmail && (
                          <p className="text-[10px] text-gray-400 font-mono">{studentEmail}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isValidated
                          ? 'bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]'
                          : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      }`}
                    >
                      {isValidated ? 'Validado' : 'Pendente'}
                    </span>
                  </div>

                  {/* Barra de Progresso de Serviços */}
                  <div className="space-y-1.5 pt-2 border-t border-[#2A2A2A]/60">
                    <div className="flex justify-between items-center text-[11px] font-inter">
                      <span className="text-gray-400">Progresso da Indicação:</span>
                      <span className="font-mono font-bold text-white">
                        {currentServices} de {minServicesNeeded} serviços
                      </span>
                    </div>

                    <div className="w-full h-2 bg-[#202020] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isValidated ? 'bg-[#22C55E]' : 'bg-[#D4AF37]'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    {isValidated ? (
                      <p className="text-[10px] text-[#22C55E] flex items-center gap-1 font-semibold pt-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Bônus de indicação liberado e creditado na sua carteira!
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-400 font-inter pt-1">
                        Faltam {Math.max(0, minServicesNeeded - currentServices)} serviços para
                        validar esta indicação.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* SEÇÃO DE VÍDEOS & CURSOS À VENDA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-[#D4AF37]" /> Vídeos & Conteúdos em Destaque
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white font-montserrat">
                  Apresentação da Consultoria 369
                </p>
                <p className="text-[10px] text-gray-400 font-inter">
                  Duração: 1:45 • Alta definição
                </p>
              </div>
              <PlayCircle className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white font-montserrat">
                  Biomecânica do Agachamento Perfeito
                </p>
                <p className="text-[10px] text-gray-400 font-inter">Duração: 4:12 • Aula técnica</p>
              </div>
              <PlayCircle className="w-6 h-6 text-[#0057FF]" />
            </div>
          </div>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#22C55E]" /> Serviços & Cursos Disponíveis
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white font-montserrat">
                  Consultoria Mensal Completa
                </p>
                <p className="text-[10px] text-gray-400 font-inter">
                  Treinos semanais + Suporte WhatsApp
                </p>
              </div>
              <span className="text-xs font-bold text-[#D4AF37] font-mono">R$ 250,00/mês</span>
            </div>
            <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white font-montserrat">
                  Curso Online: Hipertrofia Científica
                </p>
                <p className="text-[10px] text-gray-400 font-inter">
                  12 módulos em vídeo + E-book 369
                </p>
              </div>
              <span className="text-xs font-bold text-[#22C55E] font-mono">R$ 197,00</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

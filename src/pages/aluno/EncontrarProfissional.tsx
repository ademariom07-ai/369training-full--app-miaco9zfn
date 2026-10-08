import React, { useState, useEffect, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import type { UserProfile } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  MapPin,
  Star,
  Award,
  Navigation,
  MessageSquare,
  ShieldCheck,
  PlayCircle,
  Briefcase,
  CheckCircle2,
  SlidersHorizontal,
  Calendar as CalendarIcon,
  Clock,
  Zap,
  DollarSign,
  AlertTriangle,
  Loader2,
  Video,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Phone,
} from 'lucide-react'
import type { WeeklyScheduleRecord, AppointmentRecord } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { PresentationVideoPlayer } from '@/components/PresentationVideoPlayer'
import { UserCheck, UserX } from 'lucide-react'
import type { MatchingProfileRecord } from '@/services/api'
import {
  HelpCircle,
  CheckCircle,
  Filter,
  X,
  Target,
  Dumbbell,
  Compass,
  ArrowUpDown,
} from 'lucide-react'

// Haversine formula to compute distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371 // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function EncontrarProfissional() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [linkingProfId, setLinkingProfId] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<boolean>(false)

  // User coords (default to São Paulo)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number }>({
    lat: -23.55052,
    lon: -46.633308,
  })
  const [geoEnabled, setGeoEnabled] = useState(false)
  const [geoLoading, setGeoLoading] = useState(true)

  // Filters
  const [radiusKm, setRadiusKm] = useState<number>(50)
  const [searchCity, setSearchCity] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('Todas')
  const [selectedPlanBadge, setSelectedPlanBadge] = useState<string>('Todos')

  // Matching Questionnaire State
  const [matchingModalOpen, setMatchingModalOpen] = useState(false)
  const [matchingProfile, setMatchingProfile] = useState<MatchingProfileRecord | null>(null)
  const [savingMatching, setSavingMatching] = useState(false)
  const [loadingMatching, setLoadingMatching] = useState(false)

  // Matching form fields
  const [mAgeGroup, setMAgeGroup] = useState<string>('')
  const [mPrimaryGoal, setMPrimaryGoal] = useState<string>('')
  const [mTrainingType, setMTrainingType] = useState<string>('')
  const [mSpecialtyNeeded, setMSpecialtyNeeded] = useState<string>('')
  const [mAvailability, setMAvailability] = useState<string>('')
  const [mLocationPref, setMLocationPref] = useState<string>('')

  // Professionals list
  const [professionals, setProfessionals] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Profile Drawer/Dialog
  const [selectedProf, setSelectedProf] = useState<UserProfile | null>(null)

  // Agenda / Agendamento Modal State
  const [agendaModalOpen, setAgendaModalOpen] = useState(false)
  const [profSchedules, setProfSchedules] = useState<WeeklyScheduleRecord[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<WeeklyScheduleRecord | null>(null)
  const [selectedServiceType, setSelectedServiceType] = useState<
    'treino' | 'nutrição' | 'psicologia' | 'fisioterapia' | 'artes_marciais'
  >('treino')
  const [isPartnerListStudent, setIsPartnerListStudent] = useState<boolean>(false)
  const [checkingPartnerList, setCheckingPartnerList] = useState<boolean>(false)
  const [isFirstConsultation, setIsFirstConsultation] = useState<boolean>(false)
  const [checkingFirstConsultation, setCheckingFirstConsultation] = useState<boolean>(false)
  const [loadingAgenda, setLoadingAgenda] = useState<boolean>(false)
  const [confirmingBooking, setConfirmingBooking] = useState<boolean>(false)

  // Request browser geolocation on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          })
          setGeoEnabled(true)
          setGeoLoading(false)
        },
        (err) => {
          console.warn(
            'Geolocation unavailable or denied, falling back to rating sort:',
            err.message,
          )
          setGeoEnabled(false)
          setGeoLoading(false)
        },
        { timeout: 8000, enableHighAccuracy: true },
      )
    } else {
      setGeoEnabled(false)
      setGeoLoading(false)
    }
  }, [])

  // Fetch matching profile of the current user
  useEffect(() => {
    if (!user || user.role !== 'aluno') return
    setLoadingMatching(true)
    pb.collection('matching_profiles')
      .getFirstListItem<MatchingProfileRecord>(`user = "${user.id}"`)
      .then((rec) => {
        setMatchingProfile(rec)
        setMAgeGroup(rec.age_group || '')
        setMPrimaryGoal(rec.primary_goal || '')
        setMTrainingType(rec.training_type || '')
        setMSpecialtyNeeded(rec.specialty_needed || '')
        setMAvailability(rec.availability || '')
        setMLocationPref(rec.location_pref || '')
      })
      .catch(() => {
        setMatchingProfile(null)
      })
      .finally(() => {
        setLoadingMatching(false)
      })
  }, [user])

  // Fetch approved professionals
  useEffect(() => {
    setLoading(true)
    pb.collection('users')
      .getList<UserProfile>(1, 100, {
        filter: 'role = "profissional" && approved = true',
      })
      .then((res) => {
        setProfessionals(res.items)
      })
      .catch((err) => {
        console.error('Error loading professionals:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Save questionnaire
  const handleSaveMatching = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user) {
      toast.error('Faça login para salvar suas preferências.')
      return
    }

    if (!mSpecialtyNeeded && !mPrimaryGoal && !mTrainingType) {
      toast.error('Selecione pelo menos a especialidade necessária ou seu objetivo principal.')
      return
    }

    setSavingMatching(true)
    try {
      const payload = {
        user: user.id,
        age_group: mAgeGroup,
        primary_goal: mPrimaryGoal,
        training_type: mTrainingType,
        specialty_needed: mSpecialtyNeeded,
        availability: mAvailability,
        location_pref: mLocationPref,
        answers: {
          age_group: mAgeGroup,
          primary_goal: mPrimaryGoal,
          training_type: mTrainingType,
          specialty_needed: mSpecialtyNeeded,
          availability: mAvailability,
          location_pref: mLocationPref,
          updated_at: new Date().toISOString(),
        },
      }

      let saved: MatchingProfileRecord
      if (matchingProfile?.id) {
        saved = await pb
          .collection('matching_profiles')
          .update<MatchingProfileRecord>(matchingProfile.id, payload)
      } else {
        saved = await pb.collection('matching_profiles').create<MatchingProfileRecord>(payload)
      }

      setMatchingProfile(saved)
      setMatchingModalOpen(false)
      toast.success('Questionário de matching salvo! Especialistas ordenados por compatibilidade.')
    } catch (err: any) {
      console.error('Erro ao salvar questionário:', err)
      toast.error(err?.message || 'Falha ao salvar questionário.')
    } finally {
      setSavingMatching(false)
    }
  }

  const handleClearMatching = async () => {
    if (!matchingProfile?.id) {
      setMAgeGroup('')
      setMPrimaryGoal('')
      setMTrainingType('')
      setMSpecialtyNeeded('')
      setMAvailability('')
      setMLocationPref('')
      setMatchingModalOpen(false)
      return
    }
    setSavingMatching(true)
    try {
      await pb.collection('matching_profiles').delete(matchingProfile.id)
      setMatchingProfile(null)
      setMAgeGroup('')
      setMPrimaryGoal('')
      setMTrainingType('')
      setMSpecialtyNeeded('')
      setMAvailability('')
      setMLocationPref('')
      setMatchingModalOpen(false)
      toast.info('Questionário removido. Busca retornou ao modo padrão.')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover questionário.')
    } finally {
      setSavingMatching(false)
    }
  }

  // Process and sort professionals with matching algorithm
  // If matchingProfile exists: calculate compatibility score and generate justification badges
  // Then sort by compatibility score desc, distance asc, rating desc
  const hasMatching = Boolean(
    matchingProfile &&
    (matchingProfile.specialty_needed ||
      matchingProfile.primary_goal ||
      matchingProfile.training_type ||
      matchingProfile.location_pref),
  )

  const processedProfessionals = professionals
    .map((p) => {
      // Coords default fallback if professional has no exact coords
      const pLat = typeof p.latitude === 'number' && p.latitude !== 0 ? p.latitude : -23.561684
      const pLon = typeof p.longitude === 'number' && p.longitude !== 0 ? p.longitude : -46.655981
      const dist = calculateDistance(userCoords.lat, userCoords.lon, pLat, pLon)

      // Score matching
      let score = 0
      const matchedReasons: string[] = []

      if (hasMatching && matchingProfile) {
        const specNeeded = (matchingProfile.specialty_needed || '').toLowerCase()
        const profSpecs = (p.specialties || []).map((s) => s.toLowerCase())
        const profBio = (p.bio || '').toLowerCase()
        const profSub = Array.isArray(p.sub_specialties)
          ? p.sub_specialties.map((s: any) => String(s).toLowerCase()).join(' ')
          : ''

        // 1. Especialidade solicitada bate com especialidade do profissional (+50 pts)
        if (specNeeded && profSpecs.some((s) => s.includes(specNeeded) || specNeeded.includes(s))) {
          score += 50
          matchedReasons.push(`Especialista em ${matchingProfile.specialty_needed}`)
        }

        // 2. Tipo de treino preferido no bio/subspecialties (+25 pts)
        const tType = (matchingProfile.training_type || '').toLowerCase()
        if (
          tType &&
          (profBio.includes(tType) ||
            profSub.includes(tType) ||
            profSpecs.some((s) => s.includes(tType)))
        ) {
          score += 25
          matchedReasons.push(`Foco em ${matchingProfile.training_type}`)
        }

        // 3. Objetivo principal alinhado (+20 pts)
        const goal = (matchingProfile.primary_goal || '').toLowerCase()
        if (goal) {
          const goalKeywords = goal.split(/[\s,/]+/).filter((w) => w.length > 3)
          const hitsGoal = goalKeywords.some((w) => profBio.includes(w) || profSub.includes(w))
          if (hitsGoal) {
            score += 20
            matchedReasons.push(`Atende ${matchingProfile.primary_goal}`)
          }
        }

        // 4. Proximidade geográfica (+15 pts se <= 10km, +10 pts se <= 25km)
        if (geoEnabled && dist <= 10) {
          score += 15
          matchedReasons.push('Perto de você (<10km)')
        } else if (geoEnabled && dist <= 25) {
          score += 10
          matchedReasons.push('Região próxima (<25km)')
        }

        // 5. Preferência de localização (presencial/online)
        const locPref = (matchingProfile.location_pref || '').toLowerCase()
        if (locPref.includes('online')) {
          score += 10
          if (!matchedReasons.some((r) => r.includes('Online'))) {
            matchedReasons.push('Atendimento online disponível')
          }
        }

        // 6. Avaliação média (+ até 10 pts)
        const rating = Number(p.rating_avg) || 5
        score += Math.round(rating * 2)
      }

      return {
        ...p,
        calculatedDistance: dist,
        matchingScore: score,
        matchingReasons: matchedReasons,
      }
    })
    .filter((p) => {
      if (searchCity && !p.city?.toLowerCase().includes(searchCity.toLowerCase())) {
        return false
      }
      if (selectedSpecialty !== 'Todas' && !p.specialties?.includes(selectedSpecialty)) {
        return false
      }
      if (selectedPlanBadge !== 'Todos' && p.plan !== selectedPlanBadge.toLowerCase()) {
        return false
      }
      // If user enabled geolocation and set a radius limit, filter accordingly
      if (geoEnabled && radiusKm < 100 && p.calculatedDistance > radiusKm) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      if (hasMatching) {
        // Se matching estiver ativo, ordenar por compatibilidade (maior pontuação primeiro)
        if (b.matchingScore !== a.matchingScore) {
          return b.matchingScore - a.matchingScore
        }
      }
      if (geoEnabled) {
        // Ordenar por proximidade (menor distância primeiro)
        if (a.calculatedDistance !== b.calculatedDistance) {
          return a.calculatedDistance - b.calculatedDistance
        }
        return (b.rating_avg || 0) - (a.rating_avg || 0)
      } else {
        // Se a geolocalização estiver indisponível, listar todos os profissionais ordenados por avaliação
        return (b.rating_avg || 0) - (a.rating_avg || 0)
      }
    })

  // Open Agenda & Check Partner Referral List
  const handleOpenAgenda = async (prof: UserProfile) => {
    setSelectedProf(prof)
    setAgendaModalOpen(true)
    setSelectedSchedule(null)
    setLoadingAgenda(true)
    setCheckingPartnerList(true)

    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const [schedRes, appRes] = await Promise.all([
        pb.collection('weekly_schedules').getList<WeeklyScheduleRecord>(1, 200, {
          filter: `profissional = "${prof.id}" && disponivel = true && dia_liberado = true && data >= "${todayStr}"`,
          sort: 'data,hora_inicio',
        }),
        pb.collection('appointments').getList<AppointmentRecord>(1, 200, {
          filter: `profissional = "${prof.id}" && (status = "confirmado" || status = "pendente")`,
        }),
      ])

      const bookedScheduleIds = new Set(
        appRes.items.map((a) => a.schedule).filter((id): id is string => Boolean(id)),
      )

      const availableSchedules = schedRes.items.filter((s) => !bookedScheduleIds.has(s.id))
      setProfSchedules(availableSchedules)
    } catch (err) {
      console.error('Error loading professional schedule:', err)
      setProfSchedules([])
    } finally {
      setLoadingAgenda(false)
    }

    if (user) {
      setCheckingFirstConsultation(true)
      try {
        const [ref, priorAppointments] = await Promise.all([
          pb
            .collection('referrals')
            .getFirstListItem(`referrer = "${prof.id}" && referred = "${user.id}"`)
            .catch(() => null),
          pb
            .collection('appointments')
            .getList(1, 1, {
              filter: `profissional = "${prof.id}" && aluno = "${user.id}" && status = "concluido"`,
            })
            .catch(() => ({ totalItems: 0 })),
        ])
        setIsPartnerListStudent(!!ref)
        setIsFirstConsultation(priorAppointments.totalItems === 0)
      } catch (_) {
        setIsPartnerListStudent(false)
        setIsFirstConsultation(true)
      } finally {
        setCheckingPartnerList(false)
        setCheckingFirstConsultation(false)
      }
    } else {
      setIsPartnerListStudent(false)
      setCheckingPartnerList(false)
      setIsFirstConsultation(true)
      setCheckingFirstConsultation(false)
    }
  }

  // Base price for service type
  const getBaseServicePrice = (type: string, _plan?: string) => {
    switch (type) {
      case 'psicologia':
        return 190.0
      case 'nutrição':
        return 180.0
      case 'fisioterapia':
        return 200.0
      case 'artes_marciais':
        return 160.0
      case 'treino':
      default:
        return 150.0
    }
  }

  // Professional tariff by plan
  const getPlanTarifa = (plan?: string) => {
    if (plan === 'premium') return 3.0
    if (plan === 'pro') return 2.0
    return 1.0 // basico
  }

  // Ações de Vínculo Aluno <-> Profissional (HOTFIX 369)
  const handleLinkProfessional = async (prof: UserProfile) => {
    if (!user) {
      toast.error('Você precisa estar autenticado como aluno para se vincular.')
      return
    }
    if (user.role !== 'aluno') {
      toast.error('Apenas contas do tipo aluno podem treinar vinculado a um profissional.')
      return
    }

    setLinkingProfId(prof.id)
    try {
      const res = await pb.send('/backend/v1/link/create', {
        method: 'POST',
        body: { professional_id: prof.id },
      })

      if (res && res.success) {
        toast.success(
          res.message ||
            `Agora você treina com ${prof.name}! Seus pontos contam no plano dele e você não paga mensalidade.`,
        )
        await refreshUser()
      } else {
        throw new Error(res?.message || 'Falha ao vincular profissional.')
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Erro ao vincular profissional.'
      toast.error(msg)
    } finally {
      setLinkingProfId(null)
    }
  }

  const handleUnlinkProfessional = async (profName?: string) => {
    if (!user) return
    const confirmed = window.confirm(
      `Deseja realmente se desvincular ${profName ? `de ${profName}` : 'deste profissional'}? Você voltará ao plano individual.`,
    )
    if (!confirmed) return

    setUnlinking(true)
    try {
      const res = await pb.send('/backend/v1/link/remove', {
        method: 'POST',
        body: {},
      })

      if (res && res.success) {
        toast.success(res.message || 'Vínculo removido com sucesso.')
        await refreshUser()
      } else {
        throw new Error(res?.message || 'Falha ao desvincular.')
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Erro ao desvincular.'
      toast.error(msg)
    } finally {
      setUnlinking(false)
    }
  }

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (!user) {
      toast.error('Você precisa estar autenticado como aluno para agendar.')
      return
    }
    if (!selectedProf || !selectedSchedule) {
      toast.error('Selecione um horário disponível.')
      return
    }

    setConfirmingBooking(true)
    try {
      const basePrice = getBaseServicePrice(selectedServiceType, selectedProf.plan)
      const extraFee = isPartnerListStudent ? 0 : basePrice * 0.5
      const totalPrice = basePrice + extraFee
      const sinalAmount = isFirstConsultation ? totalPrice * 0.3 : 0
      const remainingAmount = isFirstConsultation ? totalPrice * 0.7 : totalPrice

      const appt = await pb.collection('appointments').create({
        profissional: selectedProf.id,
        aluno: user.id,
        schedule: selectedSchedule.id,
        servico_tipo: selectedServiceType,
        status: 'confirmado',
        valor: basePrice,
        taxa_extra: extraFee,
        requires_advance: isFirstConsultation,
        advance_percentage: isFirstConsultation ? 30 : 0,
        advance_amount: sinalAmount,
        remaining_amount: remainingAmount,
      })

      // Se for 1ª consulta, gerar o depósito de adiantamento (PIX) via endpoint seguro
      if (isFirstConsultation && sinalAmount > 0) {
        try {
          const depositData = new FormData()
          depositData.append('amount', String(sinalAmount))
          depositData.append(
            'description',
            `Adiantamento de 30% (Sinal PIX) - 1ª Consulta #${appt.id} com ${selectedProf.name}`,
          )
          await pb.send('/backend/v1/wallet/deposit', {
            method: 'POST',
            body: depositData,
          })
        } catch (e) {
          console.warn('Erro ao registrar depósito de sinal:', e)
        }
      }

      toast.success(
        isFirstConsultation
          ? `1ª Consulta agendada! Sinal de R$ ${sinalAmount.toFixed(2)} (30%) gerado para pagamento.`
          : `Agendamento confirmado com sucesso para ${selectedSchedule.dia_da_semana} (${selectedSchedule.data}) das ${selectedSchedule.hora_inicio} às ${selectedSchedule.hora_fim}!`,
      )
      setAgendaModalOpen(false)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao realizar agendamento.')
    } finally {
      setConfirmingBooking(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 max-w-6xl mx-auto">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <Navigation className="w-3.5 h-3.5" />
            {geoEnabled ? 'Geolocalização Ativa' : 'Timeline de Profissionais'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            Encontrar Profissional 369
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-inter mt-1">
            Feed vertical contínuo de especialistas. Toque em qualquer card para ver a apresentação
            e o vídeo de 30s.
          </p>
        </div>

        {/* Actions: Matching Questionnaire & Location Indicator */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setMatchingModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 shadow-md ${
              hasMatching
                ? 'bg-[#0057FF] hover:bg-[#0046D5] text-white border border-[#0057FF]'
                : 'bg-[#D4AF37] hover:bg-[#E6C65C] text-black border border-[#D4AF37]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{hasMatching ? 'Matching Ativo (Editar)' : 'Questionário de Matching'}</span>
            {hasMatching && <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />}
          </Button>

          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              geoEnabled
                ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                : 'bg-[#181818] border-[#2A2A2A] text-gray-400'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {geoLoading ? 'Obtendo GPS...' : geoEnabled ? 'GPS ativo' : 'GPS desligado'}
            </span>
          </div>
        </div>
      </div>

      {/* MATCHING ACTIVE BANNER (IF CONFIGURED) */}
      {hasMatching && matchingProfile && (
        <Card className="bg-[#0057FF]/10 border border-[#0057FF]/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#0057FF] text-white shrink-0 mt-0.5 shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase font-montserrat text-[#0057FF] tracking-wide">
                  Matching Personalizado Ativo
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/20 text-[#22C55E] font-bold text-[10px]">
                  Ranquamento Inteligente 369
                </span>
              </div>
              <p className="text-gray-300 font-inter mt-1">
                Especialidade:{' '}
                <strong className="text-white">
                  {matchingProfile.specialty_needed || 'Todas'}
                </strong>{' '}
                • Objetivo:{' '}
                <strong className="text-white">{matchingProfile.primary_goal || 'Geral'}</strong> •
                Treino:{' '}
                <strong className="text-white">{matchingProfile.training_type || 'Geral'}</strong> •
                Faixa etária:{' '}
                <strong className="text-white">
                  {matchingProfile.age_group || 'Não especificada'}
                </strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMatchingModalOpen(true)}
              className="border-[#0057FF]/50 text-white hover:bg-[#0057FF]/20 text-xs font-bold"
            >
              Ajustar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearMatching}
              disabled={savingMatching}
              className="text-gray-400 hover:text-red-400 text-xs"
              title="Voltar à busca normal"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Desativar
            </Button>
          </div>
        </Card>
      )}

      {/* FILTER BAR & SEARCH CONTROLS */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 sm:p-6 rounded-2xl shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Cidade Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Buscar por Cidade ou Bairro..."
              className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
            />
          </div>

          {/* Especialidade Filter */}
          <div>
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="Todas">Todas Especialidades</option>
              <option value="Educação Física">Educação Física / Personal</option>
              <option value="Nutrição">Nutrição</option>
              <option value="Psicologia">Psicologia</option>
              <option value="Fisioterapia">Fisioterapia</option>
              <option value="Artes Marciais">Artes Marciais</option>
            </select>
          </div>

          {/* Plan Tier Filter */}
          <div>
            <select
              value={selectedPlanBadge}
              onChange={(e) => setSelectedPlanBadge(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="Todos">Todos os Planos</option>
              <option value="Premium">Plano Premium</option>
              <option value="Pro">Plano Pro</option>
              <option value="Basico">Plano Básico</option>
            </select>
          </div>

          {/* Radius Slider */}
          <div className="flex flex-col justify-center">
            <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1.5 font-montserrat">
              <span>Raio Máximo</span>
              <span className="text-[#D4AF37]">
                {radiusKm >= 100 ? 'Sem limite' : `${radiusKm} km`}
              </span>
            </div>
            <Slider
              value={[radiusKm]}
              onValueChange={(val) => setRadiusKm(val[0])}
              min={5}
              max={100}
              step={5}
              className="cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* TIMELINE FEED (Mobile-first vertical stream) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-gray-400 font-montserrat uppercase px-1">
          <span className="flex items-center gap-1.5 text-white">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            Timeline de Especialistas ({processedProfessionals.length})
          </span>
          <span className="text-[#D4AF37]">
            {hasMatching
              ? '★ Ordenado por Afinidade & Matching'
              : geoEnabled
                ? 'Mais próximos primeiro (km)'
                : 'Mais bem avaliados (★)'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 bg-[#181818] border border-[#2A2A2A] rounded-2xl flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
            <span className="text-xs text-gray-400 font-montserrat uppercase font-semibold">
              Carregando feed de profissionais...
            </span>
          </div>
        ) : processedProfessionals.length === 0 ? (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-10 text-center rounded-2xl space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-white font-bold font-montserrat text-sm">
              Nenhum profissional encontrado com os filtros atuais
            </p>
            <p className="text-gray-400 text-xs font-inter max-w-md mx-auto">
              Tente aumentar o raio de busca, mudar a especialidade ou limpar o campo de busca por
              cidade.
            </p>
          </Card>
        ) : (
          /* Vertical Timeline List with continuous scroll */
          <div className="relative border-l-2 border-[#2A2A2A] ml-4 sm:ml-6 pl-4 sm:pl-8 space-y-6">
            {processedProfessionals.map((prof, index) => {
              const hasVideo = Boolean(
                prof.video_enabled && prof.video_url && prof.video_url.trim(),
              )

              return (
                <div key={prof.id} className="relative group">
                  {/* Timeline Dot Marker */}
                  <div className="absolute -left-[23px] sm:-left-[39px] top-6 w-4 h-4 rounded-full bg-[#141414] border-2 border-[#D4AF37] group-hover:bg-[#D4AF37] transition-colors flex items-center justify-center shadow-[0_0_10px_rgba(212,175,55,0.4)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Card item (Clickable to open profile/video) */}
                  <Card
                    onClick={() => setSelectedProf(prof)}
                    className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/80 p-4 sm:p-6 rounded-2xl transition-all hover:shadow-[0_8px_30px_rgba(212,175,55,0.12)] cursor-pointer flex flex-col gap-4 group/card"
                  >
                    {/* Top row: Avatar, Name, Plan, Distance badge, Rating */}
                    <div className="flex items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                          <img
                            src={
                              prof.avatar
                                ? pb.files.getURL(prof, prof.avatar)
                                : `https://img.usecurling.com/ppl/medium?gender=${index % 2 === 0 ? 'male' : 'female'}&seed=${index + 1}`
                            }
                            alt={prof.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-[#D4AF37] group-hover/card:scale-105 transition-transform shadow-md"
                          />
                          {hasVideo && (
                            <span
                              title="Vídeo de Apresentação Disponível"
                              className="absolute -bottom-1 -right-1 p-1 bg-[#D4AF37] text-black rounded-full shadow-md animate-pulse"
                            >
                              <PlayCircle className="w-3.5 h-3.5 fill-black text-[#D4AF37]" />
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold font-montserrat text-white text-base sm:text-lg group-hover/card:text-[#D4AF37] transition-colors">
                              {prof.name}
                            </h3>
                            {prof.plan === 'pro_parceiro' ? (
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#00C853]/20 border border-[#00C853] text-[#00C853] shadow-[0_0_10px_rgba(0,200,83,0.3)]">
                                ★ Parceiro PRO
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                  prof.plan === 'premium'
                                    ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                                    : prof.plan === 'pro'
                                      ? 'bg-[#0057FF]/15 border-[#0057FF] text-[#0057FF]'
                                      : 'bg-gray-800 border-gray-600 text-gray-300'
                                }`}
                              >
                                {prof.plan || 'PRO'}
                              </span>
                            )}
                            <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                          </div>

                          <p className="text-xs text-[#0057FF] font-semibold mt-0.5">
                            {prof.specialties?.length
                              ? prof.specialties.join(' • ')
                              : 'Educação Física'}
                          </p>
                        </div>
                      </div>

                      {/* Distance pill (Highlighted) */}
                      <div className="text-right shrink-0">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0057FF]/15 border border-[#0057FF]/40 text-[#0057FF] text-xs font-bold font-montserrat">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{prof.calculatedDistance.toFixed(1)} km</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 font-mono">
                          {prof.city || 'São Paulo, SP'}
                        </p>
                      </div>
                    </div>

                    {/* Selo / Justificativa de Matching 369 */}
                    {hasMatching && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-[#0057FF] text-white shadow-sm font-montserrat">
                          <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                          Compatível
                        </span>
                        {prof.matchingReasons && prof.matchingReasons.length > 0 ? (
                          prof.matchingReasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]"
                            >
                              ✓ {reason}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] font-medium text-gray-400 italic">
                            Disponível para avaliação no perfil
                          </span>
                        )}
                      </div>
                    )}

                    {/* Short Bio Description */}
                    <p className="text-xs text-gray-300 font-inter leading-relaxed line-clamp-2">
                      {prof.bio ||
                        'Especialista em biomecânica e desenvolvimento atlético 369. Periodização científica e acompanhamento de alta performance.'}
                    </p>

                    {/* Bottom row: Rating stars, CREF, Video Indicator, Actions */}
                    <div className="pt-3 border-t border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 text-gray-300">
                        {/* Rating */}
                        <div className="flex items-center gap-1 text-[#D4AF37] font-bold font-montserrat">
                          <Star className="w-4 h-4 fill-[#D4AF37]" />
                          <span>{(prof.rating_avg || 5.0).toFixed(1)}</span>
                          <span className="text-gray-500 font-normal text-[11px]">(Avaliação)</span>
                        </div>

                        <span className="text-gray-600">•</span>

                        <span className="text-gray-400 font-mono text-[11px]">
                          {prof.cref || 'Registro 369 Ativo'}
                        </span>

                        {hasVideo && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded-md border border-[#D4AF37]/30">
                              <Video className="w-3 h-3" />
                              Vídeo 30s
                            </span>
                          </>
                        )}
                      </div>

                      {/* Interactive Buttons */}
                      <div
                        className="flex items-center gap-2 w-full sm:w-auto flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Botão de Vínculo: apenas para Aluno */}
                        {user?.role === 'aluno' &&
                          (user.linked_professional === prof.id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnlinkProfessional(prof.name)}
                              disabled={unlinking}
                              className="border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 font-bold text-xs flex items-center gap-1.5"
                              title="Clique para desvincular deste profissional"
                            >
                              {unlinking ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              <span>Vinculado</span>
                              <span className="text-[10px] opacity-75">(Desvincular)</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleLinkProfessional(prof)}
                              disabled={linkingProfId === prof.id}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                              title="Treinar com este profissional: mensalidade isenta e pontuação no plano dele"
                            >
                              {linkingProfId === prof.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Treinar com este profissional</span>
                            </Button>
                          ))}

                        <Button
                          size="sm"
                          onClick={() => handleOpenAgenda(prof)}
                          className="flex-1 sm:flex-initial bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          Agendar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedProf(prof)}
                          className="flex-1 sm:flex-initial text-xs border-[#2A2A2A] text-white hover:border-[#D4AF37] flex items-center gap-1"
                        >
                          <span>Ver Perfil</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PROFESSIONAL PROFILE MODAL / DETALHE COM VÍDEO DE APRESENTAÇÃO */}
      <Dialog open={!!selectedProf} onOpenChange={() => setSelectedProf(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-5 sm:p-8 max-h-[90vh] overflow-y-auto">
          {selectedProf && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <img
                    src={
                      selectedProf.avatar
                        ? pb.files.getURL(selectedProf, selectedProf.avatar)
                        : 'https://img.usecurling.com/ppl/large?gender=male&seed=2'
                    }
                    alt={selectedProf.name}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-[#D4AF37] shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="text-xl font-bold font-montserrat text-white">
                        {selectedProf.name}
                      </DialogTitle>
                      {selectedProf.plan === 'pro_parceiro' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black font-montserrat uppercase px-2.5 py-0.5 rounded-full bg-[#00C853]/20 border border-[#00C853] text-[#00C853] shadow-md">
                          ★ Parceiro PRO
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                        Verificado 369
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#0057FF]">
                      {selectedProf.specialties?.length
                        ? selectedProf.specialties.join(' • ')
                        : 'Educação Física & Alta Performance'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-inter mt-1">
                      <span className="flex items-center gap-1 text-[#D4AF37] font-bold">
                        <Star className="w-3.5 h-3.5 fill-[#D4AF37]" />
                        {(selectedProf.rating_avg || 5.0).toFixed(1)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#0057FF]" />
                        {selectedProf.calculatedDistance?.toFixed(1)} km (
                        {selectedProf.city || 'São Paulo'})
                      </span>
                      <span>•</span>
                      <span className="font-mono text-gray-200 bg-[#1f1f1f] px-2 py-0.5 rounded border border-[#333] text-[11px]">
                        CONFEF Res. 542/2024: {selectedProf.cref || '098765-G/SP'}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* VÍDEO DE APRESENTAÇÃO (Exibido apenas se video_enabled = true e houver video_url) */}
              {selectedProf.video_enabled &&
              selectedProf.video_url &&
              selectedProf.video_url.trim() ? (
                <div className="p-4 rounded-2xl bg-[#181818] border border-[#D4AF37]/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-montserrat flex items-center gap-2">
                      <Video className="w-4 h-4 text-[#D4AF37]" />
                      Vídeo de Apresentação (Até 30 segundos)
                    </h4>
                    <span className="text-[10px] font-mono bg-[#D4AF37]/15 text-[#D4AF37] px-2 py-0.5 rounded-full font-bold">
                      30s Pitch
                    </span>
                  </div>

                  <PresentationVideoPlayer
                    url={selectedProf.video_url}
                    profName={selectedProf.name}
                  />
                </div>
              ) : null}

              {/* Biografia & Metodologia Completa */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-montserrat mb-1.5">
                  Biografia & Metodologia
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed font-inter whitespace-pre-line">
                  {selectedProf.bio ||
                    'Profissional de alta performance dedicado ao desenvolvimento físico e mental sustentável, utilizando a metodologia científica e os princípios 369 de evolução.'}
                </p>
              </div>

              {/* Informações de Contato / Localização */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Localização:</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0057FF]" />
                    {selectedProf.address
                      ? `${selectedProf.address}, ${selectedProf.city || ''} - ${selectedProf.state || ''}`
                      : `${selectedProf.city || 'São Paulo'} - ${selectedProf.state || 'SP'}`}
                  </span>
                </div>
                {selectedProf.phone && (
                  <div>
                    <span className="text-gray-400 block mb-0.5">Contato Profissional:</span>
                    <span className="text-white font-semibold flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-[#22C55E]" />
                      {selectedProf.phone}
                    </span>
                  </div>
                )}
              </div>

              {/* Planos & Consultorias */}
              <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A]">
                <h4 className="text-xs font-bold uppercase text-white font-montserrat mb-2">
                  Planos Disponíveis & Consultoria
                </h4>
                <div className="space-y-2 text-xs text-gray-300">
                  <div className="flex justify-between items-center py-1.5 border-b border-[#2A2A2A]">
                    <span>Consultoria Mensal Presencial / Híbrida</span>
                    <span className="font-bold text-[#D4AF37]">R$ 250,00 / mês</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span>Acompanhamento Online + Treinos IA 369</span>
                    <span className="font-bold text-[#D4AF37]">R$ 150,00 / mês</span>
                  </div>
                </div>
              </div>

              {/* CTA Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {user?.role === 'aluno' &&
                  (user.linked_professional === selectedProf.id ? (
                    <Button
                      onClick={() => handleUnlinkProfessional(selectedProf.name)}
                      disabled={unlinking}
                      variant="outline"
                      className="border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 font-bold text-xs h-11"
                    >
                      {unlinking ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
                      )}
                      Vinculado a este profissional (Clique para Desvincular)
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleLinkProfessional(selectedProf)}
                      disabled={linkingProfId === selectedProf.id}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase h-11 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      {linkingProfId === selectedProf.id ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4 mr-1.5" />
                      )}
                      Treinar com este profissional
                    </Button>
                  ))}

                <Button
                  onClick={() => {
                    const p = selectedProf
                    setSelectedProf(null)
                    if (p) handleOpenAgenda(p)
                  }}
                  className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase h-11 shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                >
                  <CalendarIcon className="w-4 h-4 mr-1.5" />
                  Ver Agenda & Agendar Consulta
                </Button>
                <Button
                  onClick={() => {
                    const profId = selectedProf?.id
                    setSelectedProf(null)
                    if (profId) {
                      navigate(`/aluno/chat/${profId}`)
                    } else {
                      navigate('/aluno/chat')
                    }
                  }}
                  variant="outline"
                  className="border-[#0057FF] text-white hover:bg-[#0057FF]/10 text-xs font-bold h-11"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5 text-[#0057FF]" />
                  Falar no Chat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AGENDA SEMANAL DO PROFISSIONAL & CONFIRMAÇÃO DE AGENDAMENTO COM TAXA EXTRA */}
      <Dialog open={agendaModalOpen} onOpenChange={setAgendaModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-5 sm:p-8 max-h-[92vh] overflow-y-auto">
          {selectedProf && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <img
                    src={
                      selectedProf.avatar
                        ? pb.files.getURL(selectedProf, selectedProf.avatar)
                        : 'https://img.usecurling.com/ppl/medium?gender=male&seed=2'
                    }
                    alt={selectedProf.name}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-[#D4AF37]"
                  />
                  <div>
                    <DialogTitle className="text-xl font-bold font-montserrat text-white uppercase">
                      Agenda de {selectedProf.name}
                    </DialogTitle>
                    <p className="text-xs text-gray-400 font-inter mt-0.5">
                      Plano {selectedProf.plan?.toUpperCase() || 'PRO'} • Tarifa do Profissional: R${' '}
                      {getPlanTarifa(selectedProf.plan).toFixed(2)}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Service Type Selection */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 font-montserrat mb-2">
                  1. Escolha a Modalidade de Atendimento:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { id: 'treino', label: 'Treino', price: 150 },
                      { id: 'nutrição', label: 'Nutrição', price: 180 },
                      { id: 'psicologia', label: 'Psicologia', price: 190 },
                      { id: 'fisioterapia', label: 'Fisioterapia', price: 200 },
                      { id: 'artes_marciais', label: 'Artes Marciais', price: 160 },
                    ] as const
                  ).map((serv) => (
                    <button
                      key={serv.id}
                      type="button"
                      onClick={() => setSelectedServiceType(serv.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedServiceType === serv.id
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-lg'
                          : 'bg-[#181818] border-[#2A2A2A] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-bold block font-montserrat uppercase">
                        {serv.label}
                      </span>
                      <span className="text-[11px] font-mono text-[#D4AF37] font-semibold mt-1 block">
                        R$ {serv.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Available Schedules Grid */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold uppercase text-gray-300 font-montserrat">
                    2. Selecione o Horário Disponível:
                  </label>
                  <span className="text-[11px] text-[#22C55E] font-semibold">
                    {profSchedules.length} horários livres encontrados
                  </span>
                </div>

                {loadingAgenda ? (
                  <div className="p-8 flex flex-col items-center justify-center gap-2 bg-[#181818] rounded-xl border border-[#2A2A2A]">
                    <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
                    <span className="text-xs text-gray-400">Consultando horários livres...</span>
                  </div>
                ) : profSchedules.length === 0 ? (
                  <div className="p-6 bg-[#181818] rounded-xl border border-[#2A2A2A] text-center">
                    <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-300 font-montserrat font-bold">
                      Nenhum horário livre cadastrado para os próximos dias.
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Envie uma mensagem pelo chat para solicitar um horário especial com o
                      profissional.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                    {profSchedules.map((sched) => {
                      const isSelected = selectedSchedule?.id === sched.id
                      return (
                        <button
                          key={sched.id}
                          type="button"
                          onClick={() => setSelectedSchedule(sched)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-[#0057FF] border-[#0057FF] text-white shadow-[0_0_15px_rgba(0,87,255,0.4)]'
                              : 'bg-[#181818] border-[#2A2A2A] text-gray-300 hover:border-[#D4AF37]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold font-montserrat mb-1">
                            <span>{sched.dia_da_semana || 'Data'}</span>
                            <span className="text-[10px] opacity-80">{sched.data}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>
                              {sched.hora_inicio}–{sched.hora_fim}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* REGRAS DE TAXA EXTRA & CONFIRMAÇÃO VISUAL */}
              <div className="space-y-3 pt-2 border-t border-[#2A2A2A]">
                {checkingPartnerList ? (
                  <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A] flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />
                    <span className="text-xs text-gray-400">
                      Verificando vínculo com a rede do profissional...
                    </span>
                  </div>
                ) : isPartnerListStudent ? (
                  <div className="p-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-[#22C55E] font-bold font-montserrat uppercase">
                      <CheckCircle2 className="w-4 h-4" />
                      Aluno Vinculado à Rede 369 deste Profissional
                    </div>
                    <p className="text-gray-300 font-inter">
                      Você está cadastrado como indicado/aluno direto deste parceiro. Você paga o{' '}
                      <strong className="text-white">valor normal da consulta</strong> (tarifa do
                      plano do profissional: R$ {getPlanTarifa(selectedProf.plan).toFixed(2)}{' '}
                      inclusa).
                    </p>
                    <div className="pt-2 flex justify-between items-center text-sm font-montserrat border-t border-[#22C55E]/20">
                      <span className="text-gray-300">Total a Pagar:</span>
                      <span className="text-lg font-black text-[#22C55E]">
                        R$ {getBaseServicePrice(selectedServiceType, selectedProf.plan).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 text-xs space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold font-montserrat uppercase">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Aluno Fora da Rede do Parceiro (Taxa Extra de 50%)
                    </div>
                    <p className="text-gray-300 font-inter">
                      Como você ainda não está na lista de parceiro deste profissional, a plataforma
                      369WELLNESS aplica uma{' '}
                      <strong className="text-amber-300">taxa extra de 50%</strong> sobre o valor da
                      consulta para realização do agendamento.
                    </p>

                    <div className="p-3 rounded-lg bg-[#141414] border border-[#2A2A2A] space-y-1.5 font-mono">
                      <div className="flex justify-between items-center text-gray-300">
                        <span>Valor Base da Consulta:</span>
                        <span>
                          R${' '}
                          {getBaseServicePrice(selectedServiceType, selectedProf.plan).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-amber-400 font-semibold">
                        <span>Taxa Extra (50% fora da lista):</span>
                        <span>
                          + R${' '}
                          {(
                            getBaseServicePrice(selectedServiceType, selectedProf.plan) * 0.5
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#2A2A2A] flex justify-between items-center text-base font-bold text-white font-montserrat">
                        <span>Valor Final do Agendamento:</span>
                        <span className="text-[#D4AF37]">
                          R${' '}
                          {(
                            getBaseServicePrice(selectedServiceType, selectedProf.plan) * 1.5
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* RECURSO 3: ADIANTAMENTO DE 30% NA 1ª CONSULTA */}
                {checkingFirstConsultation ? (
                  <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />
                    <span>Verificando histórico de consultas...</span>
                  </div>
                ) : isFirstConsultation ? (
                  <div className="p-4 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/40 text-xs space-y-2.5">
                    <div className="flex items-center gap-2 text-[#0057FF] font-bold font-montserrat uppercase">
                      <Sparkles className="w-4 h-4" />
                      1ª Consulta com este Especialista (Sinal de 30% Requerido)
                    </div>
                    <p className="text-gray-300 font-inter">
                      Para garantir a reserva do horário no seu primeiro atendimento, aplica-se o
                      adiantamento fixo de 30% via PIX. As consultas seguintes têm pagamento livre a
                      critério do profissional.
                    </p>

                    {(() => {
                      const baseP = getBaseServicePrice(selectedServiceType, selectedProf.plan)
                      const extraF = isPartnerListStudent ? 0 : baseP * 0.5
                      const totalP = baseP + extraF
                      const sinal = totalP * 0.3
                      const restante = totalP * 0.7
                      return (
                        <div className="p-3 rounded-lg bg-[#141414] border border-[#0057FF]/30 space-y-1.5 font-mono">
                          <div className="flex justify-between items-center text-gray-300">
                            <span>Valor total da consulta:</span>
                            <span className="font-bold text-white">R$ {totalP.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#D4AF37] font-bold">
                            <span>Sinal (30%):</span>
                            <span>R$ {sinal.toFixed(2)} — pago agora via PIX</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-400 text-[11px]">
                            <span>Restante (70%):</span>
                            <span>R$ {restante.toFixed(2)} — no dia da consulta</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#141414] border border-[#22C55E]/30 text-[11px] text-[#22C55E] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Consulta recorrente (2ª em diante): Pagamento livre sem adiantamento
                      obrigatório.
                    </span>
                  </div>
                )}

                {/* Final Confirm Button */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleConfirmBooking}
                    disabled={!selectedSchedule || confirmingBooking}
                    className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase h-11 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center justify-center gap-2"
                  >
                    {confirmingBooking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-black" />
                        Confirmar Agendamento{' '}
                        {selectedSchedule ? `(${selectedSchedule.hora_inicio})` : ''}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAgendaModalOpen(false)}
                    className="border-[#2A2A2A] text-gray-400 hover:text-white text-xs rounded-xl"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QUESTIONÁRIO INICIAL DE MATCHING (MODAL) */}
      <Dialog open={matchingModalOpen} onOpenChange={setMatchingModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-xl rounded-2xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#0057FF] text-white shadow-lg">
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold font-montserrat uppercase tracking-tight text-white">
                  Questionário de Matching
                </DialogTitle>
                <p className="text-xs text-gray-400 font-inter mt-0.5">
                  Descubra os especialistas 369 mais compatíveis com o seu perfil, objetivo e
                  localização.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveMatching} className="space-y-4 pt-2">
            {/* Especialidade Necessária */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-300 font-montserrat mb-1.5">
                1. Especialidade Principal Necessária *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'Educação Física',
                  'Nutrição',
                  'Fisioterapia',
                  'Artes Marciais',
                  'Psicologia',
                ].map((spec) => (
                  <button
                    type="button"
                    key={spec}
                    onClick={() => setMSpecialtyNeeded(spec)}
                    className={`p-2.5 rounded-xl border text-xs font-bold font-montserrat uppercase text-left transition-all ${
                      mSpecialtyNeeded === spec
                        ? 'bg-[#0057FF] border-[#0057FF] text-white shadow-[0_0_15px_rgba(0,87,255,0.4)]'
                        : 'bg-[#181818] border-[#2A2A2A] text-gray-400 hover:text-white hover:border-[#D4AF37]'
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>

            {/* Objetivo Principal */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-300 font-montserrat mb-1.5">
                2. Qual é o seu Objetivo Principal?
              </label>
              <select
                value={mPrimaryGoal}
                onChange={(e) => setMPrimaryGoal(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
              >
                <option value="">Selecione um objetivo...</option>
                <option value="Emagrecimento e Definição">Emagrecimento e Definição</option>
                <option value="Hipertrofia e Ganho de Massa">Hipertrofia e Ganho de Massa</option>
                <option value="Condicionamento e Saúde">Condicionamento Físico e Saúde</option>
                <option value="Reabilitação de Lesão / Dores">
                  Reabilitação de Lesão / Alívio de Dores
                </option>
                <option value="Performance e Artes Marciais">
                  Performance em Luta / Artes Marciais
                </option>
                <option value="Reeducação Alimentar">
                  Reeducação Alimentar e Nutrição Esportiva
                </option>
                <option value="Controle de Estresse e Mente">Saúde Mental, Ansiedade e Foco</option>
              </select>
            </div>

            {/* Tipo de Treino Preferido */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-300 font-montserrat mb-1.5">
                3. Tipo de Treino Preferido
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  'Musculação',
                  'Treino Funcional',
                  'Artes Marciais / Luta',
                  'Corrida e Cárdio',
                  'Pilates / Postural',
                  'Treino Híbrido 369',
                ].map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setMTrainingType(t)}
                    className={`p-2 rounded-xl border text-[11px] font-bold font-montserrat text-left transition-all ${
                      mTrainingType === t
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-md'
                        : 'bg-[#181818] border-[#2A2A2A] text-gray-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Faixa Etária */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 font-montserrat mb-1.5">
                  4. Faixa Etária
                </label>
                <select
                  value={mAgeGroup}
                  onChange={(e) => setMAgeGroup(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                >
                  <option value="">Prefiro não informar</option>
                  <option value="18 a 29 anos">18 a 29 anos</option>
                  <option value="30 a 39 anos">30 a 39 anos</option>
                  <option value="40 a 49 anos">40 a 49 anos</option>
                  <option value="50 a 59 anos">50 a 59 anos</option>
                  <option value="60+ anos (Melhor Idade)">60+ anos (Melhor Idade)</option>
                </select>
              </div>

              {/* Preferência de Localização */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 font-montserrat mb-1.5">
                  5. Modelo de Atendimento
                </label>
                <select
                  value={mLocationPref}
                  onChange={(e) => setMLocationPref(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                >
                  <option value="Presencial ou Online">Presencial ou Online (Tanto faz)</option>
                  <option value="Presencial Próximo">Presencial perto de mim</option>
                  <option value="Online Remoto">100% Online Remoto</option>
                </select>
              </div>
            </div>

            {/* Disponibilidade de Horário */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-300 font-montserrat mb-1.5">
                6. Disponibilidade de Horário
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Manhã (06h - 12h)', 'Tarde (12h - 18h)', 'Noite (18h - 22h)'].map((slot) => (
                  <button
                    type="button"
                    key={slot}
                    onClick={() => setMAvailability(slot)}
                    className={`p-2 rounded-xl border text-[11px] font-bold font-montserrat text-center transition-all ${
                      mAvailability === slot
                        ? 'bg-[#0057FF] border-[#0057FF] text-white'
                        : 'bg-[#181818] border-[#2A2A2A] text-gray-400 hover:text-white'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer actions */}
            <div className="pt-3 border-t border-[#2A2A2A] flex items-center justify-between gap-3">
              {matchingProfile?.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearMatching}
                  disabled={savingMatching}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs"
                >
                  Limpar / Desativar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMatchingModalOpen(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Pular / Fechar
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMatchingModalOpen(false)}
                  className="border-[#2A2A2A] text-gray-400 hover:text-white text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingMatching}
                  className="bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold text-xs uppercase px-5 rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  {savingMatching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Salvar e Ranquear
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

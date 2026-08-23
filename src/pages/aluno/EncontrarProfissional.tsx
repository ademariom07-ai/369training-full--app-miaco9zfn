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
  const { user } = useAuth()

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
    'treino' | 'nutrição' | 'fisioterapia' | 'artes_marciais'
  >('treino')
  const [isPartnerListStudent, setIsPartnerListStudent] = useState<boolean>(false)
  const [checkingPartnerList, setCheckingPartnerList] = useState<boolean>(false)
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

  // Process and sort professionals
  // 1. If geolocation enabled: calculate distance and sort by proximity (ascending distance)
  // 2. If geolocation unavailable/denied: sort by rating (descending rating_avg)
  const processedProfessionals = professionals
    .map((p) => {
      // Coords default fallback if professional has no exact coords
      const pLat = typeof p.latitude === 'number' && p.latitude !== 0 ? p.latitude : -23.561684
      const pLon = typeof p.longitude === 'number' && p.longitude !== 0 ? p.longitude : -46.655981
      const dist = calculateDistance(userCoords.lat, userCoords.lon, pLat, pLon)
      return { ...p, calculatedDistance: dist }
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
      try {
        const ref = await pb
          .collection('referrals')
          .getFirstListItem(`referrer = "${prof.id}" && referred = "${user.id}"`)
        setIsPartnerListStudent(!!ref)
      } catch (_) {
        setIsPartnerListStudent(false)
      } finally {
        setCheckingPartnerList(false)
      }
    } else {
      setIsPartnerListStudent(false)
      setCheckingPartnerList(false)
    }
  }

  // Base price for service type
  const getBaseServicePrice = (type: string, _plan?: string) => {
    switch (type) {
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

      await pb.collection('appointments').create({
        profissional: selectedProf.id,
        aluno: user.id,
        schedule: selectedSchedule.id,
        servico_tipo: selectedServiceType,
        status: 'confirmado',
        valor: basePrice,
        taxa_extra: extraFee,
      })

      toast.success(
        `Agendamento confirmado com sucesso para ${selectedSchedule.dia_da_semana} (${selectedSchedule.data}) das ${selectedSchedule.hora_inicio} às ${selectedSchedule.hora_fim}!`,
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

        {/* Location badge indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              geoEnabled
                ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                : 'bg-[#181818] border-[#2A2A2A] text-gray-400'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {geoLoading
                ? 'Obtendo GPS...'
                : geoEnabled
                  ? 'GPS ativo • Ordenado por Proximidade'
                  : 'GPS desligado • Ordenado por Avaliação'}
            </span>
          </div>
        </div>
      </div>

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
            {geoEnabled ? 'Mais próximos primeiro (km)' : 'Mais bem avaliados (★)'}
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
                        className="flex items-center gap-2 w-full sm:w-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-bold font-montserrat text-white">
                        {selectedProf.name}
                      </DialogTitle>
                      <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-xs font-semibold text-[#0057FF]">
                      {selectedProf.specialties?.length
                        ? selectedProf.specialties.join(' • ')
                        : 'Educação Física & Alta Performance'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 font-inter">
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
                      <span className="font-mono text-gray-400">
                        {selectedProf.cref || 'Registro Ativo'}
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
                    setSelectedProf(null)
                    navigate('/aluno/chat')
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'treino', label: 'Treino / Personal', price: 150 },
                      { id: 'nutrição', label: 'Nutrição', price: 180 },
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
                      369TRAINING aplica uma{' '}
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
    </div>
  )
}

import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import type { WeeklyScheduleRecord, AppointmentRecord } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

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

  // Filters
  const [radiusKm, setRadiusKm] = useState<number>(30)
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          })
          setGeoEnabled(true)
        },
        () => {
          // Fallback to default coords
          setGeoEnabled(false)
        },
      )
    }
  }, [])

  // Fetch approved professionals
  useEffect(() => {
    setLoading(true)
    pb.collection('users')
      .getList<UserProfile>(1, 50, {
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

  // Filter professionals with distance calculation
  const filteredProfessionals = professionals
    .map((p) => {
      const pLat = p.latitude || -23.561684
      const pLon = p.longitude || -46.655981
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
      if (geoEnabled && p.calculatedDistance > radiusKm) {
        return false
      }
      return true
    })

  // Open Agenda & Check Partner Referral List
  const handleOpenAgenda = async (prof: UserProfile) => {
    setSelectedProf(prof)
    setAgendaModalOpen(true)
    setSelectedSchedule(null)
    setLoadingAgenda(true)
    setCheckingPartnerList(true)

    try {
      // 1. Fetch available schedules for this professional (only for released days: dia_liberado = true, disponivel = true, data >= today)
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

      // Filter out schedules that already have an active appointment (confirmado/pendente)
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

    // 2. Check if student is in professional's referral network
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
  const getBaseServicePrice = (type: string, plan?: string) => {
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
      // Se NÃO está na lista do parceiro -> paga 50% do valor da consulta como taxa extra
      const extraFee = isPartnerListStudent ? 0 : basePrice * 0.5
      const totalAmount = basePrice + extraFee

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
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
          <Navigation className="w-3.5 h-3.5" />
          Geolocalização & Especialistas
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Encontrar Profissional 369
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Busque personais, nutricionistas, fisioterapeutas e mestres certificados mais próximos de
          você.
        </p>
      </div>

      {/* FILTER BAR & RADIUS SLIDER */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cidade/CEP Search */}
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
              <span>Raio de Busca</span>
              <span className="text-[#D4AF37]">{radiusKm} km</span>
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

      {/* MAP & LIST SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MAP CONTAINER (OpenStreetMap Embed with Custom Pins) */}
        <div className="lg:col-span-1 rounded-2xl overflow-hidden border border-[#2A2A2A] h-[380px] lg:h-auto min-h-[350px] relative bg-[#141414] shadow-xl flex flex-col">
          <div className="p-3 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between text-xs font-montserrat">
            <span className="flex items-center gap-1.5 text-white font-bold">
              <MapPin className="w-4 h-4 text-[#0057FF]" />
              Mapa OpenStreetMap
            </span>
            <span className="text-gray-400">
              {geoEnabled ? 'Localização GPS Ativa' : 'São Paulo (Centro)'}
            </span>
          </div>

          <iframe
            title="OpenStreetMap Search"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
              userCoords.lon - 0.08
            }%2C${userCoords.lat - 0.08}%2C${userCoords.lon + 0.08}%2C${
              userCoords.lat + 0.08
            }&layer=mapnik&marker=${userCoords.lat}%2C${userCoords.lon}`}
            className="flex-1 filter grayscale invert contrast-125 opacity-85"
          />
        </div>

        {/* PROFESSIONALS LIST (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 font-montserrat uppercase">
            <span>{filteredProfessionals.length} Especialistas Encontrados</span>
            <span className="text-[#D4AF37]">Ordenados por Proximidade</span>
          </div>

          {filteredProfessionals.length === 0 ? (
            <Card className="bg-[#181818] border border-[#2A2A2A] p-8 text-center rounded-2xl">
              <p className="text-gray-400 text-sm font-inter">
                Nenhum profissional encontrado com os filtros atuais. Aumente o raio de busca ou
                limpe a cidade.
              </p>
            </Card>
          ) : (
            filteredProfessionals.map((prof) => (
              <Card
                key={prof.id}
                className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/70 p-5 rounded-2xl transition-all hover:shadow-[0_8px_25px_rgba(212,175,55,0.15)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-4">
                  {/* Photo */}
                  <img
                    src={
                      prof.avatar
                        ? pb.files.getURL(prof, prof.avatar)
                        : 'https://img.usecurling.com/ppl/medium?gender=male&seed=2'
                    }
                    alt={prof.name}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-[#D4AF37] group-hover:scale-105 transition-transform"
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold font-montserrat text-white text-base group-hover:text-[#D4AF37] transition-colors">
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
                    </div>

                    <p className="text-xs text-[#0057FF] font-semibold mt-0.5">
                      {prof.specialties?.join(' • ') || 'Educação Física'}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-2 font-inter">
                      <span className="flex items-center gap-1 text-[#D4AF37] font-bold">
                        <Star className="w-3.5 h-3.5 fill-[#D4AF37]" />
                        {prof.rating_avg || 5.0}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#0057FF]" />
                        {prof.calculatedDistance.toFixed(1)} km ({prof.city || 'São Paulo'})
                      </span>
                      <span>•</span>
                      <span className="text-xs text-gray-400 font-mono">
                        {prof.cref || 'Registro Ativo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <Button
                    onClick={() => handleOpenAgenda(prof)}
                    className="flex-1 sm:flex-initial bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Ver Agenda & Agendar
                  </Button>
                  <Button
                    onClick={() => setSelectedProf(prof)}
                    variant="outline"
                    className="flex-1 sm:flex-initial text-xs border-[#2A2A2A] text-white hover:border-[#D4AF37]"
                  >
                    Perfil
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* PROFESSIONAL PROFILE DRAWER / MODAL */}
      <Dialog open={!!selectedProf} onOpenChange={() => setSelectedProf(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
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
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-[#D4AF37]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-bold font-montserrat text-white">
                        {selectedProf.name}
                      </DialogTitle>
                      <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-xs font-semibold text-[#0057FF] mt-1">
                      {selectedProf.specialties?.join(' • ')}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedProf.cref}</p>
                  </div>
                </div>
              </DialogHeader>

              {/* Bio & Formação */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-montserrat mb-1.5">
                  Biografia & Metodologia
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed font-inter">
                  {selectedProf.bio ||
                    'Profissional de alta performance dedicado ao desenvolvimento físico e mental sustentável, utilizando a metodologia científica e os princípios 369 de evolução.'}
                </p>
              </div>

              {/* Presentation Video Placeholder */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-montserrat mb-2">
                  Vídeo de Apresentação
                </h4>
                <div className="w-full h-44 rounded-xl bg-[#0B0B0C] border border-[#2A2A2A] flex flex-col items-center justify-center text-gray-400 hover:border-[#D4AF37] transition-all cursor-pointer group">
                  <PlayCircle className="w-12 h-12 text-[#D4AF37] group-hover:scale-110 transition-transform mb-2" />
                  <span className="text-xs font-semibold font-montserrat text-white">
                    Assistir Apresentação (1:45)
                  </span>
                </div>
              </div>

              {/* Planos & Estratégias */}
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

              {/* CTA Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => {
                    const p = selectedProf
                    setSelectedProf(null)
                    if (p) handleOpenAgenda(p)
                  }}
                  className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase"
                >
                  <CalendarIcon className="w-4 h-4 mr-1.5" />
                  Ver Agenda do Profissional
                </Button>
                <Button
                  onClick={() => {
                    setSelectedProf(null)
                    navigate('/aluno/chat')
                  }}
                  variant="outline"
                  className="border-[#0057FF] text-white hover:bg-[#0057FF]/10 text-xs font-bold"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  Falar no Chat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AGENDA SEMANAL DO PROFISSIONAL & CONFIRMAÇÃO DE AGENDAMENTO COM TAXA EXTRA */}
      <Dialog open={agendaModalOpen} onOpenChange={setAgendaModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
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
                  /* ALUNO ESTÁ NA LISTA DO PARCEIRO */
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
                  /* ALUNO NÃO ESTÁ NA LISTA DO PARCEIRO -> TAXA EXTRA 50% */
                  <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 text-xs space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold font-montserrat uppercase">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Aluno Fora da Rede do Parceiro (Taxa Extra de 50%)
                    </div>
                    <p className="text-gray-300 font-inter">
                      Como você ainda não está na lista de parceiro deste profissional, a política
                      da plataforma 369TRAINING aplica uma{' '}
                      <strong className="text-amber-300">taxa extra de 50%</strong> sobre o valor da
                      consulta para realização do agendamento.
                    </p>

                    {/* Breakdown visual */}
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

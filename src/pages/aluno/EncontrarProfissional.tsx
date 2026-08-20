import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import type { UserProfile } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
} from 'lucide-react'
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
                    onClick={() => setSelectedProf(prof)}
                    variant="outline"
                    className="flex-1 sm:flex-initial text-xs border-[#2A2A2A] text-white hover:border-[#D4AF37]"
                  >
                    Ver Perfil Completo
                  </Button>
                  <Button
                    onClick={() => navigate('/aluno/chat')}
                    className="flex-1 sm:flex-initial bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Falar Comigo
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
                    setSelectedProf(null)
                    navigate('/aluno/chat')
                  }}
                  className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold"
                >
                  Falar Comigo no Chat
                </Button>
                <Button
                  onClick={() => {
                    toast.success('Solicitação de plano enviada ao profissional!')
                    setSelectedProf(null)
                  }}
                  variant="outline"
                  className="border-[#0057FF] text-white hover:bg-[#0057FF]/10"
                >
                  Contratar Plano
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

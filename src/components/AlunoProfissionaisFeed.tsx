import React, { useState, useEffect, useRef, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import type { UserProfile } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getVideoInfo } from '@/components/PresentationVideoPlayer'
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  MapPin,
  Star,
  ShieldCheck,
  Calendar as CalendarIcon,
  User,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Phone,
  Video,
} from 'lucide-react'

// Haversine distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
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

interface ProfessionalWithDist extends UserProfile {
  calculatedDist?: number
  hasVerifiedCred?: boolean
}

export function AlunoProfissionaisFeed() {
  const navigate = useNavigate()
  const [professionals, setProfessionals] = useState<ProfessionalWithDist[]>([])
  const [loading, setLoading] = useState(true)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [selectedProfModal, setSelectedProfModal] = useState<ProfessionalWithDist | null>(null)

  // Request browser location
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          })
        },
        () => {
          // Default: fallback sem coords
          setUserCoords(null)
        },
        { timeout: 5000 },
      )
    }
  }, [])

  // Load professionals with video_enabled = true and approved = true
  useEffect(() => {
    async function loadPros() {
      setLoading(true)
      try {
        const [prosRes, credsRes] = await Promise.all([
          pb.collection('users').getList<UserProfile>(1, 50, {
            filter: 'role = "profissional" && approved = true',
            sort: '-rating_avg',
          }),
          pb
            .collection('credential_verifications')
            .getList(1, 100, { filter: 'status = "verificado"' })
            .catch(() => ({ items: [] })),
        ])

        const verifiedSet = new Set(credsRes.items.map((c: any) => c.professional))

        // Filtrar apenas com video_enabled = true e video_url presente
        const videoPros = prosRes.items.filter(
          (p) => p.video_enabled && p.video_url && p.video_url.trim().length > 0,
        )

        const mapped: ProfessionalWithDist[] = videoPros.map((p) => {
          let dist: number | undefined
          if (userCoords && typeof p.latitude === 'number' && p.latitude !== 0) {
            dist = calculateDistance(userCoords.lat, userCoords.lon, p.latitude, p.longitude || 0)
          } else if (typeof p.latitude === 'number' && p.latitude !== 0) {
            // Default SP distance reference if user has no coords
            dist = calculateDistance(-23.55052, -46.633308, p.latitude, p.longitude || 0)
          }
          return {
            ...p,
            calculatedDist: dist,
            hasVerifiedCred: verifiedSet.has(p.id) || p.name?.includes('(Verificado)'),
          }
        })

        // Ordenar: por proximidade quando disponível, senão por rating
        mapped.sort((a, b) => {
          if (a.calculatedDist !== undefined && b.calculatedDist !== undefined) {
            return a.calculatedDist - b.calculatedDist
          }
          return (b.rating_avg || 0) - (a.rating_avg || 0)
        })

        setProfessionals(mapped)
      } catch (err) {
        console.error('Erro ao carregar profissionais do feed:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPros()
  }, [userCoords])

  const feedRef = useRef<HTMLDivElement>(null)

  // Scroll to previous / next video
  const handleScrollTo = (index: number) => {
    if (index < 0 || index >= professionals.length) return
    setCurrentIndex(index)
    const container = feedRef.current
    if (container) {
      const targetCard = container.children[index] as HTMLElement
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }

  // Fallback: se não houver vídeos, cards de profissionais próximos
  if (!loading && professionals.length === 0) {
    return (
      <Card className="bg-white border border-[#E5E3DC] p-6 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#B8962E]" />
            <h2 className="text-lg font-bold font-montserrat uppercase text-[#1A1A1A]">
              Encontre um Profissional
            </h2>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/aluno/profissionais')}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs"
          >
            Ver Todos
          </Button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Nenhum vídeo de apresentação disponível no momento. Conecte-se com especialistas na busca
          completa.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Feed Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B8962E]/10 border border-[#D4AF37]/30 text-[11px] font-bold text-[#B8962E] uppercase font-montserrat mb-1">
            <Video className="w-3.5 h-3.5" />
            Feed de Especialistas 369 • Pitch 30s
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-montserrat text-[#1A1A1A] uppercase">
            Encontre um Profissional
          </h2>
          <p className="text-xs text-gray-500 font-inter">
            Apresentações verticais em vídeo dos especialistas mais próximos de você.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute/Unmute Global Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
            className="rounded-xl border-[#E5E3DC] text-gray-700 hover:text-black bg-white flex items-center gap-1.5 text-xs font-semibold shadow-xs"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#22C55E]" />
            )}
            <span>{isMuted ? 'Mudo' : 'Com Som'}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/aluno/profissionais')}
            className="hidden sm:inline-flex bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl"
          >
            Busca Completa
          </Button>
        </div>
      </div>

      {/* REELS / TIKTOK VERTICAL CONTAINER */}
      <div className="relative w-full max-w-2xl mx-auto">
        {/* Navigation arrow controls (overlay right) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
          <button
            type="button"
            aria-label="Vídeo anterior"
            disabled={currentIndex === 0}
            onClick={() => handleScrollTo(currentIndex - 1)}
            className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-bold font-mono text-center text-white bg-black/60 px-1 py-0.5 rounded-full">
            {currentIndex + 1}/{professionals.length || 1}
          </span>
          <button
            type="button"
            aria-label="Próximo vídeo"
            disabled={currentIndex >= professionals.length - 1}
            onClick={() => handleScrollTo(currentIndex + 1)}
            className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable vertical snap container */}
        <div
          ref={feedRef}
          className="h-[520px] sm:h-[580px] w-full rounded-3xl overflow-y-auto snap-y snap-mandatory bg-black border border-[#E5E3DC] shadow-xl relative"
          style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
        >
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-white gap-3 p-6">
              <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
              <p className="text-xs font-montserrat uppercase font-semibold text-gray-300">
                Carregando feed de vídeos...
              </p>
            </div>
          ) : (
            professionals.map((prof, idx) => (
              <VideoCardItem
                key={prof.id}
                prof={prof}
                isActive={idx === currentIndex}
                isMuted={isMuted}
                onOpenProfile={() => setSelectedProfModal(prof)}
                onAgendar={() => navigate('/aluno/profissionais')}
              />
            ))
          )}
        </div>
      </div>

      {/* DETAIL MODAL FOR "VER PERFIL" */}
      <Dialog open={!!selectedProfModal} onOpenChange={() => setSelectedProfModal(null)}>
        <DialogContent className="bg-white border border-[#E5E3DC] text-[#1A1A1A] max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
          {selectedProfModal && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <img
                    src={
                      selectedProfModal.avatar
                        ? pb.files.getURL(selectedProfModal, selectedProfModal.avatar)
                        : `https://img.usecurling.com/ppl/medium?gender=male&seed=${selectedProfModal.id}`
                    }
                    alt={selectedProfModal.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#D4AF37]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-lg font-bold font-montserrat text-[#1A1A1A]">
                        {selectedProfModal.name}
                      </DialogTitle>
                      {selectedProfModal.hasVerifiedCred && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#15803D]">
                          <ShieldCheck className="w-3 h-3 text-[#15803D]" /> Verificado 369
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#0057FF]">
                      {selectedProfModal.specialties?.join(' • ') || 'Especialista 369'}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                      Registro: {selectedProfModal.cref || 'Ativo'}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Bio & Details */}
              <div className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E5E3DC] space-y-2 text-xs">
                <h4 className="font-bold text-[#B8962E] uppercase font-montserrat text-[11px]">
                  Apresentação Profissional
                </h4>
                <p className="text-gray-700 leading-relaxed font-inter">
                  {selectedProfModal.bio ||
                    'Profissional de alta performance dedicado ao desenvolvimento atlético, prevenção e bem-estar integral.'}
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3 text-gray-600 border-t border-[#E5E3DC] text-[11px]">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                    {(selectedProfModal.rating_avg || 5.0).toFixed(1)} (Avaliação)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0057FF]" />
                    {selectedProfModal.calculatedDist !== undefined
                      ? `${selectedProfModal.calculatedDist.toFixed(1)} km`
                      : 'Próximo'}
                    {selectedProfModal.city ? ` (${selectedProfModal.city})` : ''}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    setSelectedProfModal(null)
                    navigate('/aluno/profissionais')
                  }}
                  className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl"
                >
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  Agendar Consulta
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const id = selectedProfModal.id
                    setSelectedProfModal(null)
                    navigate(`/aluno/chat/${id}`)
                  }}
                  className="border-[#0057FF] text-[#0057FF] hover:bg-[#0057FF]/10 text-xs font-bold rounded-xl"
                >
                  Falar no Chat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Individual Snap Video Card for Reels/TikTok feed
 */
function VideoCardItem({
  prof,
  isActive,
  isMuted,
  onOpenProfile,
  onAgendar,
}: {
  prof: ProfessionalWithDist
  isActive: boolean
  isMuted: boolean
  onOpenProfile: () => void
  onAgendar: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const videoInfo = getVideoInfo(prof.video_url)

  // Autoplay / pause when active / inactive
  useEffect(() => {
    if (!videoRef.current) return

    if (isActive) {
      videoRef.current.currentTime = 0
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Browsers may block unmuted autoplay; ensure muted
            if (videoRef.current) {
              videoRef.current.muted = true
              videoRef.current.play().catch(() => setIsPlaying(false))
            }
          })
      }
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [isActive])

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div className="h-full w-full snap-start relative flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Video element */}
      {videoInfo.type === 'mp4' && videoInfo.directUrl ? (
        <video
          ref={videoRef}
          src={videoInfo.directUrl}
          playsInline
          loop
          muted={isMuted}
          onClick={togglePlay}
          className="w-full h-full object-cover cursor-pointer"
        />
      ) : videoInfo.type === 'youtube' && videoInfo.embedUrl ? (
        <iframe
          src={`${videoInfo.embedUrl}&autoplay=${isActive ? '1' : '0'}&mute=${isMuted ? '1' : '0'}`}
          title={`Pitch de ${prof.name}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="w-full h-full border-0"
        />
      ) : (
        <div className="text-white text-xs">Vídeo indisponível</div>
      )}

      {/* Center play icon overlay when paused */}
      {!isPlaying && videoInfo.type === 'mp4' && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/90 text-black flex items-center justify-center shadow-2xl">
            <Play className="w-8 h-8 fill-black ml-1" />
          </div>
        </div>
      )}

      {/* Bottom gradient overlay with Professional Details (Reels style) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-5 sm:p-6 text-white z-20 pointer-events-auto space-y-3">
        {/* Professional badge & name */}
        <div className="flex items-center gap-3">
          <img
            src={
              prof.avatar
                ? pb.files.getURL(prof, prof.avatar)
                : `https://img.usecurling.com/ppl/medium?gender=male&seed=${prof.id}`
            }
            alt={prof.name}
            className="w-12 h-12 rounded-xl object-cover border-2 border-[#D4AF37] shrink-0"
          />
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-bold font-montserrat text-base sm:text-lg text-white leading-tight reels-overlay-text">
                {prof.name}
              </h3>
              {prof.hasVerifiedCred && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#22C55E]/20 border border-[#22C55E]/50 text-[#4ade80] reels-overlay-text">
                  <ShieldCheck className="w-3 h-3 text-[#4ade80]" /> Verificado 369
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-[#D4AF37] mt-0.5 reels-overlay-text">
              {prof.specialties?.join(' • ') || 'Educação Física & Performance'}
            </p>
          </div>
        </div>

        {/* Metadata row: CREF, Distance, Rating */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-200 reels-overlay-text">
          <span className="bg-black/60 px-2 py-0.5 rounded-md border border-white/20 font-mono text-[10px]">
            {prof.cref || 'CREF Ativo'}
          </span>
          <span className="flex items-center gap-1 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-[#0057FF]" />
            {prof.calculatedDist !== undefined ? `${prof.calculatedDist.toFixed(1)} km` : 'Próximo'}
            {prof.city ? ` • ${prof.city}` : ''}
          </span>
          <span className="flex items-center gap-1 text-[#D4AF37] font-bold">
            <Star className="w-3.5 h-3.5 fill-[#D4AF37]" />
            {(prof.rating_avg || 5.0).toFixed(1)}
          </span>
        </div>

        {/* Action Buttons ("Ver perfil" e "Agendar") */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={onAgendar}
            className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase h-10 rounded-xl shadow-lg flex items-center justify-center gap-1.5"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Agendar
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onOpenProfile}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs font-bold uppercase h-10 rounded-xl backdrop-blur-md"
          >
            <User className="w-3.5 h-3.5 mr-1" />
            Ver Perfil
          </Button>
        </div>
      </div>
    </div>
  )
}

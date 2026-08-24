import React, { useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type VideoType = 'youtube' | 'vimeo' | 'mp4' | 'unknown'

/**
 * Extrai o ID do vídeo do YouTube e sanitiza parâmetros de rastreamento (ex: ?si=, ?is=, &feature=, etc.)
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const cleanUrl = url.trim()

  // Se for apenas o ID de 11 caracteres
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return cleanUrl
  }

  try {
    // Normalizar caso a URL não contenha protocolo
    const normalizedUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`
    const parsed = new URL(normalizedUrl)
    const hostname = parsed.hostname.toLowerCase()

    // youtu.be/ID
    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      const pathname = parsed.pathname.slice(1).split('/')[0]
      if (pathname && /^[a-zA-Z0-9_-]{11}$/.test(pathname)) {
        return pathname
      }
    }

    // youtube.com, m.youtube.com, youtube-nocookie.com, studio.youtube.com
    if (hostname.includes('youtube.com') || hostname.includes('youtube-nocookie.com')) {
      // /watch?v=ID ou /watch?other=1&v=ID
      const vParam = parsed.searchParams.get('v')
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam
      }

      // /embed/ID, /v/ID, /shorts/ID, /live/ID, /video/ID
      const match = parsed.pathname.match(/\/(?:embed|v|shorts|live|video)\/([a-zA-Z0-9_-]{11})/)
      if (match && match[1]) {
        return match[1]
      }
    }
  } catch {
    // Fallback com regex robusto para URLs malformadas
  }

  // Regex fallback abrangente cobrindo studio.youtube.com, youtu.be, youtube.com, shorts, etc.
  const ytRegex =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?(?:.*&)?v=|shorts\/|live\/|video\/))([a-zA-Z0-9_-]{11})/i
  const match = cleanUrl.match(ytRegex)
  if (match && match[1]) {
    return match[1]
  }

  return null
}

export function getVideoInfo(url?: string): {
  type: VideoType
  embedUrl?: string
  directUrl?: string
  videoId?: string
} {
  if (!url || !url.trim()) return { type: 'unknown' }
  const trimmed = url.trim()

  // 1. Verificar YouTube
  const ytId = extractYouTubeId(trimmed)
  if (ytId) {
    return {
      type: 'youtube',
      videoId: ytId,
      // Usamos youtube.com/embed padrão com parâmetros seguros para reprodução
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1`,
    }
  }

  // 2. Verificar Vimeo
  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/i,
  )
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      videoId: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`,
    }
  }

  // 3. Arquivo direto de vídeo (.mp4, .webm, .ogg, .mov) ou links diretos
  if (trimmed.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
    return {
      type: 'mp4',
      directUrl: trimmed,
    }
  }

  // Se começar com http(s) e não foi reconhecido como YouTube/Vimeo, pode ser mp4 / stream
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      type: 'mp4',
      directUrl: trimmed,
    }
  }

  return { type: 'unknown' }
}

export function PresentationVideoPlayer({ url, profName }: { url: string; profName: string }) {
  const videoInfo = getVideoInfo(url)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playbackTime, setPlaybackTime] = useState<number>(0)
  const [reachedLimit, setReachedLimit] = useState<boolean>(false)

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime
      setPlaybackTime(current)
      if (current >= 30) {
        videoRef.current.pause()
        setReachedLimit(true)
      }
    }
  }

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play()
      setReachedLimit(false)
    }
  }

  if (videoInfo.type === 'youtube' || videoInfo.type === 'vimeo') {
    return (
      <div className="space-y-2">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#2A2A2A] shadow-lg">
          <iframe
            src={videoInfo.embedUrl}
            title={`Apresentação de ${profName}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 font-inter">
          <span className="flex items-center gap-1 text-[#D4AF37]">
            <Clock className="w-3.5 h-3.5" />
            Pitch de apresentação (máx. 30s)
          </span>
          <span className="capitalize">{videoInfo.type}</span>
        </div>
      </div>
    )
  }

  if (videoInfo.type === 'mp4' && videoInfo.directUrl) {
    return (
      <div className="space-y-2">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#2A2A2A] shadow-lg flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoInfo.directUrl}
            controls
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-contain"
          />
          {reachedLimit && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10 backdrop-blur-xs">
              <Clock className="w-8 h-8 text-[#D4AF37] mb-2" />
              <p className="text-xs font-bold text-white font-montserrat uppercase">
                Apresentação concluída (Limite de 30s)
              </p>
              <p className="text-[11px] text-gray-400 mt-1 mb-3">
                Agende uma consulta para conhecer o profissional em detalhes.
              </p>
              <Button
                size="sm"
                onClick={handleRestart}
                variant="outline"
                className="text-xs border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Assistir Novamente
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 font-inter">
          <span className="flex items-center gap-1 text-[#D4AF37]">
            <Clock className="w-3.5 h-3.5" />
            Vídeo direto (limitado em até 30 segundos: {Math.min(30, Math.floor(playbackTime))}s /
            30s)
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A] text-center text-xs text-gray-400">
      Não foi possível carregar o vídeo com a URL fornecida.
    </div>
  )
}

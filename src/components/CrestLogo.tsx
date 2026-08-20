import React from 'react'
import officialLogo from '@/assets/logo-4e295.png'

export interface CrestLogoProps {
  size?: number | string
  className?: string
  avatarUrl?: string | null
  showText?: boolean
  subText?: boolean
  alt?: string
}

export const CrestLogo: React.FC<CrestLogoProps> = ({
  size = 70,
  className = '',
  avatarUrl = null,
  showText = false,
  subText = false,
  alt = '369 TRAINING - Foco • Legado • Estratégia',
}) => {
  const baseSize = typeof size === 'number' ? size : parseInt(size as string, 10) || 70
  // Scale factor to increase default size by ~25%
  const scaledSize = Math.round(baseSize * 1.25)

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className="relative flex items-center justify-center select-none shrink-0 bg-transparent border-0 outline-none p-0"
        style={{ width: scaledSize, height: scaledSize }}
      >
        {/* Official 369 Training Crest - sem bordas pretas / outline / moldura */}
        <img
          src={officialLogo}
          alt={alt}
          className="w-full h-full object-contain bg-transparent border-0 outline-none ring-0 shadow-none filter drop-shadow-[0_2px_12px_rgba(212,175,55,0.35)] transition-transform duration-300 hover:scale-105"
          loading="eager"
        />

        {/* When an avatar is provided (e.g., student/coach profile badge mode), overlay it in the shield center */}
        {avatarUrl && (
          <div
            className="absolute rounded-full overflow-hidden border-2 border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.7)] bg-transparent"
            style={{
              width: `${Math.round(scaledSize * 0.36)}px`,
              height: `${Math.round(scaledSize * 0.36)}px`,
              top: `${Math.round(scaledSize * 0.14)}px`,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <img src={avatarUrl} alt="Avatar do Usuário" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span className="font-extrabold tracking-wider text-lg gold-gradient-text uppercase font-montserrat leading-tight">
            369 TRAINING
          </span>
          {subText && (
            <span className="text-[10px] tracking-widest text-[#D4AF37]/80 font-bold uppercase font-montserrat">
              FOCO • LEGADO • ESTRATÉGIA
            </span>
          )}
        </div>
      )}
    </div>
  )
}

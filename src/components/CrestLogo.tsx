import React from 'react'

interface CrestLogoProps {
  size?: number | string
  className?: string
  avatarUrl?: string | null
  showText?: boolean
  subText?: boolean
}

export const CrestLogo: React.FC<CrestLogoProps> = ({
  size = 48,
  className = '',
  avatarUrl = null,
  showText = false,
  subText = false,
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(size as string, 10) || 48

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className="relative flex items-center justify-center select-none"
        style={{ width: numericSize, height: numericSize }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="crestGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F4D77A" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#99771C" />
            </linearGradient>
            <linearGradient id="shieldFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1C1A14" />
              <stop offset="100%" stopColor="#0B0B0C" />
            </linearGradient>
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <clipPath id="shieldClip">
              <circle cx="50" cy="52" r="28" />
            </clipPath>
          </defs>

          {/* Downward Medieval Sword Behind */}
          {/* Pommel */}
          <circle
            cx="50"
            cy="6"
            r="3.5"
            fill="url(#crestGold)"
            stroke="#684D0E"
            strokeWidth="0.8"
          />
          {/* Grip */}
          <rect
            x="48.5"
            y="9.5"
            width="3"
            height="11"
            rx="0.5"
            fill="#3D3012"
            stroke="url(#crestGold)"
            strokeWidth="0.6"
          />
          {/* Crossguard */}
          <path d="M36 20.5 Q50 18 64 20.5 L65 23 Q50 21 35 23 Z" fill="url(#crestGold)" />
          {/* Sword Blade Pointing Down (visible at bottom) */}
          <path
            d="M48.5 80 L51.5 80 L50 96 Z"
            fill="url(#crestGold)"
            stroke="#D4AF37"
            strokeWidth="0.5"
          />
          <line x1="50" y1="80" x2="50" y2="94" stroke="#FFF" strokeWidth="0.5" opacity="0.8" />

          {/* Round Golden Outer Shield Ring */}
          <circle
            cx="50"
            cy="52"
            r="38"
            fill="url(#shieldFill)"
            stroke="url(#crestGold)"
            strokeWidth="3.5"
          />
          <circle
            cx="50"
            cy="52"
            r="34"
            stroke="url(#crestGold)"
            strokeWidth="0.8"
            strokeDasharray="2,2"
            opacity="0.7"
          />

          {/* Inner Shield / Center Motif */}
          {avatarUrl ? (
            <g clipPath="url(#shieldClip)">
              <image
                href={avatarUrl}
                x="22"
                y="24"
                width="56"
                height="56"
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
          ) : (
            /* Engraved Compass Rose in Gold */
            <g transform="translate(50, 52)">
              {/* Compass Petals */}
              <polygon
                points="0,-24 4,-6 0,0 -4,-6"
                fill="url(#crestGold)"
                filter="url(#goldGlow)"
              />
              <polygon points="0,24 4,6 0,0 -4,6" fill="url(#crestGold)" />
              <polygon points="-24,0 -6,-4 0,0 -6,4" fill="url(#crestGold)" />
              <polygon points="24,0 6,-4 0,0 6,4" fill="url(#crestGold)" />

              {/* Diagonal Sub-points */}
              <polygon points="-14,-14 -3,-4 0,0 -4,-3" fill="#B8962E" opacity="0.9" />
              <polygon points="14,-14 3,-4 0,0 4,-3" fill="#B8962E" opacity="0.9" />
              <polygon points="-14,14 -3,4 0,0 -4,3" fill="#B8962E" opacity="0.9" />
              <polygon points="14,14 3,4 0,0 4,3" fill="#B8962E" opacity="0.9" />

              {/* Central Core Emblem (3-6-9) */}
              <circle
                cx="0"
                cy="0"
                r="5"
                fill="#141414"
                stroke="url(#crestGold)"
                strokeWidth="1.2"
              />
              <circle cx="0" cy="0" r="2" fill="url(#crestGold)" />
            </g>
          )}

          {/* Helm Above Shield */}
          <g transform="translate(50, 25)">
            {/* Visor & Helmet Silhouette */}
            <path
              d="M-12,-4 C-12,-12 12,-12 12,-4 C12,4 6,7 0,8 C-6,7 -12,4 -12,-4 Z"
              fill="#181818"
              stroke="url(#crestGold)"
              strokeWidth="1.6"
            />
            {/* Visor Slits */}
            <line x1="-7" y1="-2" x2="7" y2="-2" stroke="url(#crestGold)" strokeWidth="1" />
            <line x1="-5" y1="1" x2="5" y2="1" stroke="url(#crestGold)" strokeWidth="1" />
            {/* Crown/Plume Crest */}
            <path d="M-3,-12 Q0,-18 3,-12 Z" fill="url(#crestGold)" />
          </g>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span className="font-extrabold tracking-wider text-lg gold-gradient-text uppercase font-montserrat">
            369TRAINING
          </span>
          {subText && (
            <span className="text-[10px] tracking-widest text-[#9CA3AF] uppercase font-inter -mt-1">
              Força • Foco • Evolução
            </span>
          )}
        </div>
      )}
    </div>
  )
}

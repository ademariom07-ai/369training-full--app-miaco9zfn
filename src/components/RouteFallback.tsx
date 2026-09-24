import React from 'react'

export default function RouteFallback() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FAFAF7]"
      role="status"
      aria-label="Carregando..."
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle gold ring with spinner */}
        <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
      </div>
      <span className="sr-only">Carregando conteúdo...</span>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Type, Bold, RotateCcw } from 'lucide-react'
import { useAccessibility } from '@/contexts/AccessibilityContext'

export function AccessibilityControls() {
  const { fontSize, isBold, setFontSize, toggleBold, resetAccessibility } = useAccessibility()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const isCustomized = fontSize !== 'normal' || isBold

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`p-2 rounded-xl border transition-all shadow-xs flex items-center justify-center ${
          isCustomized
            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
            : 'bg-white border-[#E5E3DC] text-gray-700 hover:text-[#B8962E] hover:border-[#D4AF37]'
        }`}
        title="Acessibilidade: Tamanho da Fonte e Negrito"
        aria-label="Opções de Acessibilidade (Fonte e Negrito)"
      >
        <Type className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#181818] border border-[#2A2A2A] p-3 shadow-2xl z-50 text-white font-inter animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-[#2A2A2A] mb-2.5">
            <span className="text-xs font-bold font-montserrat text-[#D4AF37] flex items-center gap-1.5 uppercase">
              <Type className="w-3.5 h-3.5" /> Acessibilidade
            </span>
            {isCustomized && (
              <button
                type="button"
                onClick={resetAccessibility}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
                title="Redefinir para padrão"
              >
                <RotateCcw className="w-3 h-3" /> Padrão
              </button>
            )}
          </div>

          {/* Opção Tamanho da Fonte */}
          <div className="space-y-1.5 mb-3">
            <label className="text-[11px] font-bold text-gray-300 block">Tamanho da Fonte</label>
            <div className="grid grid-cols-3 gap-1 bg-[#202020] p-1 rounded-xl border border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => setFontSize('normal')}
                className={`py-1.5 text-xs font-montserrat font-bold rounded-lg transition-all ${
                  fontSize === 'normal'
                    ? 'bg-[#D4AF37] text-black shadow-xs'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                A <span className="text-[10px] block opacity-80 font-normal">Normal</span>
              </button>
              <button
                type="button"
                onClick={() => setFontSize('large')}
                className={`py-1.5 text-xs font-montserrat font-bold rounded-lg transition-all ${
                  fontSize === 'large'
                    ? 'bg-[#D4AF37] text-black shadow-xs'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                A+ <span className="text-[10px] block opacity-80 font-normal">+15%</span>
              </button>
              <button
                type="button"
                onClick={() => setFontSize('xlarge')}
                className={`py-1.5 text-xs font-montserrat font-bold rounded-lg transition-all ${
                  fontSize === 'xlarge'
                    ? 'bg-[#D4AF37] text-black shadow-xs'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                A++ <span className="text-[10px] block opacity-80 font-normal">+30%</span>
              </button>
            </div>
          </div>

          {/* Opção Negrito */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-300 block">Destaque de Texto</label>
            <button
              type="button"
              onClick={toggleBold}
              className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-montserrat font-bold transition-all ${
                isBold
                  ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                  : 'bg-[#202020] border-[#2A2A2A] text-gray-300 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <Bold className="w-4 h-4" />
                Texto em Negrito
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  isBold ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-gray-400'
                }`}
              >
                {isBold ? 'ATIVADO' : 'DESLIGADO'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

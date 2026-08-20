import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Swords,
  Award,
  CheckCircle2,
  Calendar,
  Trophy,
  Flame,
  PlayCircle,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

export default function ArtesMarciais() {
  const [modality, setModality] = useState('Muay Thai')
  const [checkedIn, setCheckedIn] = useState(false)

  // Belt Ladder State (Branca -> Amarela -> Azul -> Vermelha -> Preta)
  const beltLevels = [
    { name: 'Faixa Branca', color: 'bg-white text-black', earned: true },
    { name: 'Faixa Amarela', color: 'bg-yellow-400 text-black', earned: true },
    { name: 'Faixa Azul', color: 'bg-blue-600 text-white', earned: true },
    { name: 'Faixa Vermelha', color: 'bg-red-600 text-white', earned: false },
    {
      name: 'Faixa Preta',
      color: 'bg-black text-[#D4AF37] border border-[#D4AF37]',
      earned: false,
    },
  ]

  const handleCheckIn = () => {
    setCheckedIn(true)
    toast.success('Presença confirmada no dojo! +50 pontos no ranking da turma.')
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6A00FF]/15 border border-[#6A00FF]/40 text-xs font-bold text-[#9D52FF] uppercase font-montserrat mb-2">
            <Swords className="w-3.5 h-3.5" />
            Dojo & Combate 369
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Artes Marciais & Graduação
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Acompanhe sua graduação de faixas, check-in de treinos, técnicas da aula e ranking da
            turma.
          </p>
        </div>

        {/* Modalidade Selector */}
        <div className="flex bg-[#141414] p-1 rounded-xl border border-[#2A2A2A]">
          {['Muay Thai', 'Jiu-Jitsu', 'Judô', 'Karatê', 'Boxe'].map((m) => (
            <button
              key={m}
              onClick={() => setModality(m)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                modality === m
                  ? 'bg-[#6A00FF] text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* BELT GRADUATION LADDER & CHECK-IN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Belt Ladder (2 Cols) */}
        <Card className="lg:col-span-2 bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="text-xs font-bold text-[#9D52FF] uppercase font-montserrat">
                Evolução Técnica
              </span>
              <h2 className="text-lg font-bold font-montserrat text-white">
                Escada de Graduação ({modality})
              </h2>
            </div>
            <span className="text-xs font-mono text-[#D4AF37] font-bold px-2.5 py-1 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30">
              Faixa Atual: Azul (3º Grau)
            </span>
          </div>

          <div className="space-y-3">
            {beltLevels.map((belt, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                  belt.earned
                    ? 'bg-[#141414] border-[#D4AF37]/40'
                    : 'bg-[#101010] border-[#2A2A2A] opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-4 rounded-sm shadow-sm ${belt.color}`} />
                  <span className="text-xs font-bold font-montserrat text-white">{belt.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {belt.earned ? (
                    <span className="text-[11px] font-bold text-[#22C55E] flex items-center gap-1 font-montserrat">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Conquistada
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-gray-500 font-montserrat">
                      Próximo Desafio
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Check-in de Presença */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-[#6A00FF]/15 border border-[#6A00FF]/40 text-[#9D52FF] flex items-center justify-center mx-auto mb-4">
              <Flame className="w-8 h-8 text-[#FF7A00]" />
            </div>
            <h3 className="text-base font-bold font-montserrat text-white">
              Check-in da Aula de Hoje
            </h3>
            <p className="text-xs text-gray-400 font-inter mt-1.5">
              Valide sua presença no dojo para computar frequência e garantir pontos para sua
              graduação.
            </p>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleCheckIn}
              disabled={checkedIn}
              className={`w-full py-6 font-bold uppercase text-xs rounded-xl transition-all ${
                checkedIn
                  ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]'
                  : 'bg-[#D4AF37] text-black hover:bg-[#E6C65C] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
              }`}
            >
              {checkedIn ? '✓ Presença Confirmada Hoje' : 'Fazer Check-in Agora'}
            </Button>
          </div>
        </Card>
      </div>

      {/* AULA DO DIA WITH TECHNIQUES & RANKING DA TURMA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Técnicas da Aula */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-[#D4AF37]" />
            Técnicas da Semana ({modality})
          </h3>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white font-montserrat">
                  1. Entrada de Clinch e Joelhada Frontal
                </p>
                <p className="text-[10px] text-gray-400 font-inter">
                  Biomecânica e controle de cabeça
                </p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-[#D4AF37]">
                Assistir
              </Button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white font-montserrat">
                  2. Esquiva Lateral e Contra-golpe de Direto
                </p>
                <p className="text-[10px] text-gray-400 font-inter">
                  Tempo de reação e transferência de peso
                </p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-[#D4AF37]">
                Assistir
              </Button>
            </div>
          </div>
        </Card>

        {/* Ranking da Turma Leaderboard */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#D4AF37]" />
            Leaderboard da Turma
          </h3>

          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4AF37] text-black font-extrabold text-xs flex items-center justify-center font-montserrat">
                  1
                </span>
                <span className="text-xs font-bold text-white">Lucas Ferreira (Você)</span>
              </div>
              <span className="text-xs font-bold text-[#D4AF37] font-mono">1.450 pts</span>
            </div>

            <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-600 text-white font-extrabold text-xs flex items-center justify-center font-montserrat">
                  2
                </span>
                <span className="text-xs font-medium text-gray-300">Renato Oliveira</span>
              </div>
              <span className="text-xs font-mono text-gray-400">1.320 pts</span>
            </div>

            <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-800 text-white font-extrabold text-xs flex items-center justify-center font-montserrat">
                  3
                </span>
                <span className="text-xs font-medium text-gray-300">Beatriz Lima</span>
              </div>
              <span className="text-xs font-mono text-gray-400">1.180 pts</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

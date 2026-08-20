import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Activity,
  AlertCircle,
  PlayCircle,
  CheckCircle2,
  FileText,
  Calendar,
  MessageSquare,
  Shield,
  TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function Fisioterapia() {
  // Pain Scale State (0-10)
  const [painLevel, setPainLevel] = useState<number>(2)

  // Mobility Checklist
  const [mobilityTests, setMobilityTests] = useState([
    { id: 'm1', name: 'Flexão do Quadril em Decúbito Dorsal (> 90°)', done: true },
    { id: 'm2', name: 'Rotação Externa e Interna de Ombro com Bastão', done: true },
    { id: 'm3', name: 'Dorsiflexão de Tornozelo (Teste Joelho-Parede > 10cm)', done: false },
    { id: 'm4', name: 'Mobilidade Torácica em Quatro Apoios (Gato-Camelo)', done: false },
  ])

  const toggleMobility = (id: string) => {
    setMobilityTests(mobilityTests.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  const handleSavePainLog = () => {
    toast.success(`Nível de dor ${painLevel}/10 registrado no prontuário do Fisioterapeuta!`)
  }

  // Color gradient for pain level
  const getPainColor = (val: number) => {
    if (val <= 3) return 'text-[#22C55E]'
    if (val <= 6) return 'text-[#F59E0B]'
    return 'text-[#EF4444]'
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <Activity className="w-3.5 h-3.5" />
            Reabilitação & Biomecânica
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Fisioterapia & Recuperação
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Monitoramento de dor em escala visual, testes de mobilidade articular e protocolos de
            alívio muscular.
          </p>
        </div>

        <Link to="/aluno/chat">
          <Button className="bg-[#0057FF] hover:bg-[#1e69ff] text-white font-bold text-xs flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat com Fisioterapeuta
          </Button>
        </Link>
      </div>

      {/* PAIN SCALE MONITORING (0-10) */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-bold font-montserrat text-white uppercase">
              Escala Analógica Visual de Dor (EVA)
            </h2>
          </div>
          <span className={`text-2xl font-black font-montserrat ${getPainColor(painLevel)}`}>
            {painLevel} / 10
          </span>
        </div>

        {/* Visual Color Scale Bar */}
        <div className="w-full h-3 rounded-full bg-gradient-to-r from-[#22C55E] via-[#F59E0B] to-[#EF4444] p-0.5" />

        <Slider
          value={[painLevel]}
          onValueChange={(v) => setPainLevel(v[0])}
          min={0}
          max={10}
          step={1}
          className="cursor-pointer"
        />

        <div className="flex justify-between text-[11px] text-gray-400 font-montserrat uppercase font-semibold">
          <span className="text-[#22C55E]">0 - Sem Dor</span>
          <span className="text-[#F59E0B]">5 - Dor Moderada</span>
          <span className="text-[#EF4444]">10 - Dor Severa</span>
        </div>

        <Button
          onClick={handleSavePainLog}
          className="w-full sm:w-auto bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-6"
        >
          Registrar Dor de Hoje
        </Button>
      </Card>

      {/* MOBILITY TESTS CHECKLIST */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#0057FF]" />
          Testes Guiados de Mobilidade & Flexibilidade
        </h3>

        <div className="space-y-3">
          {mobilityTests.map((t) => (
            <div
              key={t.id}
              onClick={() => toggleMobility(t.id)}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                t.done
                  ? 'bg-[#141414] border-[#22C55E]/40 text-gray-200'
                  : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={t.done}
                  onCheckedChange={() => toggleMobility(t.id)}
                  className="data-[state=checked]:bg-[#22C55E] data-[state=checked]:text-black border-gray-600"
                />
                <span
                  className={`text-xs font-semibold ${t.done ? 'text-white' : 'text-gray-400'}`}
                >
                  {t.name}
                </span>
              </div>
              <span className="text-[11px] text-[#0057FF] font-montserrat uppercase font-bold">
                {t.done ? 'Aprovado' : 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* THERAPEUTIC EXERCISES WITH DEMO PLACEHOLDERS */}
      <div>
        <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-[#D4AF37]" />
          Protocolos Terapêuticos Prescritos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-center text-[#D4AF37] shrink-0">
              <PlayCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-bold font-montserrat text-white">
                Descompressão Lombar em Bola Suíça
              </h4>
              <p className="text-xs text-gray-400 mt-1 font-inter">
                3 séries de 45 segundos com respiração diafragmática profunda.
              </p>
              <span className="inline-block mt-2 text-[10px] font-bold text-[#22C55E] uppercase">
                Alívio Imediato
              </span>
            </div>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-center text-[#0057FF] shrink-0">
              <PlayCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-bold font-montserrat text-white">
                Liberação Miofascial de Panturrilha com Rolo
              </h4>
              <p className="text-xs text-gray-400 mt-1 font-inter">
                2 minutos por perna com foco nos pontos de maior tensão (trigger points).
              </p>
              <span className="inline-block mt-2 text-[10px] font-bold text-[#0057FF] uppercase">
                Pré-Treino
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

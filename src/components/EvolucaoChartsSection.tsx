import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Activity, Target } from 'lucide-react'

export interface LoadEvolutionItem {
  data: string
  pesoMaximo: number
  pesoMedio: number
  series: number
  maxReps: number
}

export interface RpeEvolutionItem {
  data: string
  rpeMedio: number
  totalSeries: number
}

export interface WeeklyVolumeItem {
  semana: string
  volumeKg: number
  frequenciaDias: number
  totalSeries: number
}

interface EvolucaoChartsSectionProps {
  activeExerciseName: string
  loadEvolutionData: LoadEvolutionItem[]
  rpeEvolutionData: RpeEvolutionItem[]
  weeklyVolumeData: WeeklyVolumeItem[]
}

export default function EvolucaoChartsSection({
  activeExerciseName,
  loadEvolutionData,
  rpeEvolutionData,
  weeklyVolumeData,
}: EvolucaoChartsSectionProps) {
  return (
    <div className="space-y-6 sm:space-y-8 w-full min-w-0">
      {/* GRÁFICO 1: EVOLUÇÃO DE CARGA POR EXERCÍCIO AO LONGO DO TEMPO */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-3.5 sm:p-6 rounded-2xl shadow-lg space-y-3 sm:space-y-4 w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#2A2A2A] pb-3 sm:pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-[#0057FF]/15 text-[#0057FF] shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#0057FF]" />
              </div>
              <h2 className="text-sm sm:text-lg font-bold font-montserrat text-white uppercase truncate">
                Evolução de Carga • {activeExerciseName || 'Selecione um exercício'}
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 font-inter">
              Peso máximo e médio por sessão (kg)
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-montserrat flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#D4AF37] shrink-0" />
              <span className="text-gray-300 font-semibold">Carga Máxima (kg)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#0057FF] shrink-0" />
              <span className="text-gray-300 font-semibold">Carga Média (kg)</span>
            </div>
          </div>
        </div>

        {loadEvolutionData.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-500 font-inter">
            Nenhuma série registrada para &quot;{activeExerciseName}&quot; no período selecionado.
          </div>
        ) : (
          <div className="w-full min-w-0 pt-1 sm:pt-2">
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="99%" height={280}>
                <LineChart
                  data={loadEvolutionData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis
                    dataKey="data"
                    stroke="#525252"
                    interval="preserveStartEnd"
                    minTickGap={20}
                    tick={{ fill: '#A3A3A3', fontSize: 10, fontFamily: 'Montserrat' }}
                  />
                  <YAxis
                    stroke="#525252"
                    unit="kg"
                    width={38}
                    tick={{ fill: '#A3A3A3', fontSize: 10, fontFamily: 'Montserrat' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const maxVal = payload.find((p) => p.dataKey === 'pesoMaximo')?.value
                      const avgVal = payload.find((p) => p.dataKey === 'pesoMedio')?.value
                      const series = (payload[0]?.payload as LoadEvolutionItem)?.series || 1
                      return (
                        <div className="bg-[#141414]/95 backdrop-blur border border-[#D4AF37]/50 p-2.5 sm:p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[150px]">
                          <p className="font-bold text-white font-montserrat border-b border-[#2A2A2A] pb-1 text-[11px] sm:text-xs">
                            Sessão: {label}
                          </p>
                          <div className="flex justify-between items-center text-[#D4AF37] gap-3">
                            <span className="text-[11px]">Máxima:</span>
                            <span className="font-bold font-mono text-xs">{maxVal} kg</span>
                          </div>
                          <div className="flex justify-between items-center text-[#0057FF] gap-3">
                            <span className="text-[11px]">Média:</span>
                            <span className="font-bold font-mono text-xs">{avgVal} kg</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-400 text-[10px] pt-1 border-t border-[#2A2A2A] gap-3">
                            <span>Séries Feitas:</span>
                            <span className="font-bold text-white">{series}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pesoMaximo"
                    name="Peso Máximo"
                    stroke="#D4AF37"
                    strokeWidth={2.5}
                    dot={{ fill: '#D4AF37', r: 3.5, strokeWidth: 1.5, stroke: '#141414' }}
                    activeDot={{ r: 5.5, fill: '#D4AF37' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pesoMedio"
                    name="Peso Médio"
                    stroke="#0057FF"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ fill: '#0057FF', r: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* GRÁFICO 2: ESFORÇO MÉDIO (RPE 1-10) COM FAIXA IDEAL DE ESTÍMULO DESTACADA */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-3.5 sm:p-6 rounded-2xl shadow-lg space-y-3 sm:space-y-4 w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#2A2A2A] pb-3 sm:pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] shrink-0">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF37]" />
              </div>
              <h2 className="text-sm sm:text-lg font-bold font-montserrat text-white uppercase truncate">
                Esforço Médio por Sessão (RPE 1–10)
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 font-inter">
              Percepção subjetiva de esforço • Zona ideal destacada (RPE 6 a 8)
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] sm:text-[11px] font-mono px-2 py-0.5">
              Zona Ótima: RPE 6 - 8
            </Badge>
          </div>
        </div>

        {rpeEvolutionData.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-500 font-inter">
            Nenhum registro de esforço perceptível no período selecionado.
          </div>
        ) : (
          <div className="w-full min-w-0 pt-1 sm:pt-2">
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="99%" height={260}>
                <LineChart
                  data={rpeEvolutionData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis
                    dataKey="data"
                    stroke="#525252"
                    interval="preserveStartEnd"
                    minTickGap={20}
                    tick={{ fill: '#A3A3A3', fontSize: 10, fontFamily: 'Montserrat' }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    stroke="#525252"
                    width={32}
                    tick={{ fill: '#A3A3A3', fontSize: 10, fontFamily: 'Montserrat' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const rpeVal = Number(payload[0]?.value) || 0
                      const series = (payload[0]?.payload as RpeEvolutionItem)?.totalSeries || 1
                      let zoneDesc = 'Leve / Aquecimento'
                      let zoneColor = 'text-blue-400'
                      if (rpeVal >= 6 && rpeVal <= 8) {
                        zoneDesc = 'Faixa Ideal de Hipertrofia (Ótimo)'
                        zoneColor = 'text-emerald-400'
                      } else if (rpeVal > 8) {
                        zoneDesc = 'Pico / Próximo da Falha'
                        zoneColor = 'text-amber-400'
                      }
                      return (
                        <div className="bg-[#141414]/95 backdrop-blur border border-[#2A2A2A] p-2.5 sm:p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[160px]">
                          <p className="font-bold text-white font-montserrat border-b border-[#2A2A2A] pb-1 text-[11px] sm:text-xs">
                            Sessão: {label}
                          </p>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-gray-300 text-[11px]">RPE Médio:</span>
                            <span className="font-bold text-sm font-mono text-[#D4AF37]">
                              {rpeVal} / 10
                            </span>
                          </div>
                          <p className={`text-[10px] sm:text-[11px] font-semibold ${zoneColor}`}>
                            {zoneDesc}
                          </p>
                          <p className="text-[10px] text-gray-500 border-t border-[#2A2A2A] pt-1">
                            Calculado sobre {series} séries
                          </p>
                        </div>
                      )
                    }}
                  />
                  <ReferenceArea
                    y1={6}
                    y2={8}
                    fill="#22C55E"
                    fillOpacity={0.12}
                    strokeOpacity={0.3}
                    stroke="#22C55E"
                  />
                  <ReferenceLine y={6} stroke="#22C55E" strokeDasharray="3 3" opacity={0.6} />
                  <ReferenceLine y={8} stroke="#22C55E" strokeDasharray="3 3" opacity={0.6} />
                  <Line
                    type="monotone"
                    dataKey="rpeMedio"
                    name="RPE Médio"
                    stroke="#0057FF"
                    strokeWidth={2.5}
                    dot={{ fill: '#0057FF', r: 3.5, stroke: '#141414', strokeWidth: 1.5 }}
                    activeDot={{ r: 5.5, fill: '#D4AF37' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* GRÁFICO 3: VOLUME SEMANAL (SÉRIES × REPS × CARGA) */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-3.5 sm:p-6 rounded-2xl shadow-lg space-y-3 sm:space-y-4 w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3 sm:pb-4 gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] shrink-0">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF37]" />
              </div>
              <h2 className="text-sm sm:text-lg font-bold font-montserrat text-white uppercase truncate">
                Volume Semanal (kg)
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 font-inter">
              Tonagem semanal agregada (Séries × Reps × Carga)
            </p>
          </div>
          <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 text-[10px] sm:text-xs font-mono shrink-0 px-2 py-0.5">
            {weeklyVolumeData.length} sem.
          </Badge>
        </div>

        {weeklyVolumeData.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-500 font-inter">
            Sem dados semanais de volume no período selecionado.
          </div>
        ) : (
          <div className="w-full min-w-0 pt-1 sm:pt-2">
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="99%" height={260}>
                <BarChart
                  data={weeklyVolumeData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis
                    dataKey="semana"
                    stroke="#525252"
                    interval="preserveStartEnd"
                    minTickGap={16}
                    tick={{ fill: '#A3A3A3', fontSize: 10, fontFamily: 'Montserrat' }}
                  />
                  <YAxis
                    stroke="#525252"
                    unit="kg"
                    width={40}
                    tick={{ fill: '#A3A3A3', fontSize: 10, fontFamily: 'Montserrat' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const vol = Number(payload[0]?.value) || 0
                      const dias = (payload[0]?.payload as WeeklyVolumeItem)?.frequenciaDias || 0
                      const series = (payload[0]?.payload as WeeklyVolumeItem)?.totalSeries || 0
                      return (
                        <div className="bg-[#141414]/95 backdrop-blur border border-[#2A2A2A] p-2.5 sm:p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[150px]">
                          <p className="font-bold text-white font-montserrat border-b border-[#2A2A2A] pb-1 text-[11px] sm:text-xs">
                            {label}
                          </p>
                          <div className="flex justify-between items-center text-[#D4AF37] gap-3">
                            <span className="text-[11px]">Volume:</span>
                            <span className="font-bold font-mono text-xs">
                              {vol.toLocaleString('pt-BR')} kg
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-gray-300 gap-3">
                            <span className="text-[11px]">Frequência:</span>
                            <span className="font-bold text-white text-xs">{dias} dias</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-400 text-[10px] pt-1 border-t border-[#2A2A2A] gap-3">
                            <span>Séries:</span>
                            <span className="font-bold text-white">{series}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="volumeKg"
                    fill="#0057FF"
                    radius={[4, 4, 0, 0]}
                    className="hover:opacity-90 transition-opacity"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

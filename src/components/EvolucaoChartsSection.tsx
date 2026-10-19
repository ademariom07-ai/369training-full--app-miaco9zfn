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
    <div className="space-y-8 w-full min-w-0">
      {/* GRÁFICO 1: EVOLUÇÃO DE CARGA POR EXERCÍCIO AO LONGO DO TEMPO */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 sm:p-6 rounded-2xl shadow-lg space-y-4 w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#0057FF] shrink-0" />
                <span className="truncate">
                  Evolução de Carga • {activeExerciseName || 'Selecione um exercício'}
                </span>
              </h2>
            </div>
            <p className="text-xs text-gray-400 font-inter">
              Peso máximo e peso médio registrado em cada sessão (kg)
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-montserrat flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#D4AF37] shrink-0" />
              <span className="text-gray-300">Carga Máxima (kg)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#0057FF] shrink-0" />
              <span className="text-gray-300">Carga Média (kg)</span>
            </div>
          </div>
        </div>

        {loadEvolutionData.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 font-inter">
            Nenhuma série registrada para &quot;{activeExerciseName}&quot; no período selecionado.
          </div>
        ) : (
          <div className="w-full min-w-0 pt-2">
            <div className="w-full min-w-[280px] h-[280px] sm:h-[320px]">
              <ResponsiveContainer width="99%" height={280}>
                <LineChart
                  data={loadEvolutionData}
                  margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                  <XAxis
                    dataKey="data"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Montserrat' }}
                  />
                  <YAxis
                    stroke="#6B7280"
                    unit=" kg"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Montserrat' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const maxVal = payload.find((p) => p.dataKey === 'pesoMaximo')?.value
                      const avgVal = payload.find((p) => p.dataKey === 'pesoMedio')?.value
                      const series = (payload[0]?.payload as LoadEvolutionItem)?.series || 1
                      return (
                        <div className="bg-[#141414] border border-[#D4AF37]/40 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[160px]">
                          <p className="font-bold text-white font-montserrat border-b border-[#2A2A2A] pb-1">
                            Sessão: {label}
                          </p>
                          <div className="flex justify-between items-center text-[#D4AF37]">
                            <span>Peso Máximo:</span>
                            <span className="font-bold font-mono">{maxVal} kg</span>
                          </div>
                          <div className="flex justify-between items-center text-[#0057FF]">
                            <span>Peso Médio:</span>
                            <span className="font-bold font-mono">{avgVal} kg</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-400 text-[11px] pt-1 border-t border-[#2A2A2A]">
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
                    strokeWidth={3}
                    dot={{ fill: '#D4AF37', r: 4, strokeWidth: 2, stroke: '#141414' }}
                    activeDot={{ r: 6, fill: '#D4AF37' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pesoMedio"
                    name="Peso Médio"
                    stroke="#0057FF"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ fill: '#0057FF', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* GRÁFICO 2: ESFORÇO MÉDIO (RPE 1-10) COM FAIXA IDEAL DE ESTÍMULO DESTACADA */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 sm:p-6 rounded-2xl shadow-lg space-y-4 w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#D4AF37] shrink-0" />
                <span>Esforço Médio por Sessão (Escala RPE 1–10)</span>
              </h2>
            </div>
            <p className="text-xs text-gray-400 font-inter">
              Percepção subjetiva de esforço. Faixa ideal de hipertrofia destacada (RPE 6 a 8).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px] font-mono">
              Zona Ótima: RPE 6 - 8
            </Badge>
          </div>
        </div>

        {rpeEvolutionData.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 font-inter">
            Nenhum registro de esforço perceptível no período selecionado.
          </div>
        ) : (
          <div className="w-full min-w-0 pt-2">
            <div className="w-full min-w-[280px] h-[260px] sm:h-[300px]">
              <ResponsiveContainer width="99%" height={260}>
                <LineChart
                  data={rpeEvolutionData}
                  margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                  <XAxis
                    dataKey="data"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Montserrat' }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Montserrat' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const rpeVal = Number(payload[0]?.value) || 0
                      const series = (payload[0]?.payload as RpeEvolutionItem)?.totalSeries || 1
                      let zoneDesc = 'Leve / Aquecimento'
                      let zoneColor = 'text-blue-400'
                      if (rpeVal >= 6 && rpeVal <= 8) {
                        zoneDesc = 'Faixa Ideal de Hipertrofia (Estímulo Ótimo)'
                        zoneColor = 'text-emerald-400'
                      } else if (rpeVal > 8) {
                        zoneDesc = 'Pico de Intensidade / Próximo da Falha'
                        zoneColor = 'text-amber-400'
                      }
                      return (
                        <div className="bg-[#141414] border border-[#2A2A2A] p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[180px]">
                          <p className="font-bold text-white font-montserrat border-b border-[#2A2A2A] pb-1">
                            Sessão: {label}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">RPE Médio:</span>
                            <span className="font-bold text-base font-mono text-[#D4AF37]">
                              {rpeVal} / 10
                            </span>
                          </div>
                          <p className={`text-[11px] font-semibold ${zoneColor}`}>{zoneDesc}</p>
                          <p className="text-[10px] text-gray-500 border-t border-[#2A2A2A] pt-1">
                            Calculado sobre {series} séries na sessão
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
                    strokeWidth={3}
                    dot={{ fill: '#0057FF', r: 4, stroke: '#141414', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#D4AF37' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* GRÁFICO 3: VOLUME SEMANAL (SÉRIES × REPS × CARGA) */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 sm:p-6 rounded-2xl shadow-lg space-y-4 w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Target className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <span>Volume Semanal de Treino (kg)</span>
            </h2>
            <p className="text-xs text-gray-400 font-inter">
              Tonagem agregada por semana (Séries × Repetições × Carga)
            </p>
          </div>
          <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 text-xs font-mono">
            {weeklyVolumeData.length} semanas
          </Badge>
        </div>

        {weeklyVolumeData.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 font-inter">
            Sem dados semanais de volume no período selecionado.
          </div>
        ) : (
          <div className="w-full min-w-0 pt-2">
            <div className="w-full min-w-[280px] h-[260px] sm:h-[300px]">
              <ResponsiveContainer width="99%" height={260}>
                <BarChart
                  data={weeklyVolumeData}
                  margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                  <XAxis
                    dataKey="semana"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Montserrat' }}
                  />
                  <YAxis
                    stroke="#6B7280"
                    unit=" kg"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Montserrat' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const vol = Number(payload[0]?.value) || 0
                      const dias = (payload[0]?.payload as WeeklyVolumeItem)?.frequenciaDias || 0
                      const series = (payload[0]?.payload as WeeklyVolumeItem)?.totalSeries || 0
                      return (
                        <div className="bg-[#141414] border border-[#2A2A2A] p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[160px]">
                          <p className="font-bold text-white font-montserrat border-b border-[#2A2A2A] pb-1">
                            {label}
                          </p>
                          <div className="flex justify-between items-center text-[#D4AF37]">
                            <span>Volume Semanal:</span>
                            <span className="font-bold font-mono">
                              {vol.toLocaleString('pt-BR')} kg
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-gray-300">
                            <span>Frequência:</span>
                            <span className="font-bold text-white">{dias} dias</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-400 text-[11px] pt-1 border-t border-[#2A2A2A]">
                            <span>Total de Séries:</span>
                            <span className="font-bold text-white">{series}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="volumeKg"
                    fill="#0057FF"
                    radius={[6, 6, 0, 0]}
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

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import {
  TrendingUp,
  Dumbbell,
  Activity,
  Calendar,
  Flame,
  Award,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Zap,
  Target,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WorkoutLogRecord } from '@/services/workoutExecution'

export default function Evolucao() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<WorkoutLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string>('todos')
  const [periodo, setPeriodo] = useState<'30dias' | '90dias' | 'todos'>('90dias')

  const fetchLogs = async () => {
    if (!user) return
    try {
      const res = await pb.collection('workout_logs').getFullList<WorkoutLogRecord>({
        filter: `student = "${user.id}"`,
        sort: 'completed_at',
      })
      setLogs(res)
    } catch (err) {
      console.error('Erro ao carregar workout_logs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [user])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchLogs()
  }

  // Lista única de exercícios com contagem de séries
  const exerciseOptions = useMemo(() => {
    const map = new Map<string, number>()
    logs.forEach((log) => {
      const name = (log.exercise_name || 'Exercício sem nome').trim()
      map.set(name, (map.get(name) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [logs])

  // Filtragem de logs por período
  const filteredByPeriodLogs = useMemo(() => {
    if (periodo === 'todos') return logs
    const now = Date.now()
    const days = periodo === '30dias' ? 30 : 90
    const limit = now - days * 24 * 60 * 60 * 1000
    return logs.filter((log) => {
      const time = new Date(log.completed_at || log.created).getTime()
      return time >= limit
    })
  }, [logs, periodo])

  // Exercício atualmente selecionado para gráfico de carga
  const activeExerciseName = useMemo(() => {
    if (selectedExercise !== 'todos') return selectedExercise
    return exerciseOptions[0]?.name || ''
  }, [selectedExercise, exerciseOptions])

  // 1. DADOS: Evolução de Carga por Sessão para o exercício selecionado
  const loadEvolutionData = useMemo(() => {
    if (!activeExerciseName) return []

    const exerciseLogs = filteredByPeriodLogs.filter(
      (log) => (log.exercise_name || '').trim().toLowerCase() === activeExerciseName.toLowerCase(),
    )

    // Agrupar por data da sessão (YYYY-MM-DD)
    const sessionMap = new Map<
      string,
      {
        dateLabel: string
        rawDate: string
        weights: number[]
        reps: number[]
        setsCount: number
      }
    >()

    exerciseLogs.forEach((l) => {
      const d = new Date(l.completed_at || l.created)
      const dayKey = d.toISOString().slice(0, 10)
      const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const w = Number(l.weight_used) || 0
      const r = Number(l.reps_done) || 0

      if (!sessionMap.has(dayKey)) {
        sessionMap.set(dayKey, {
          dateLabel,
          rawDate: dayKey,
          weights: [],
          reps: [],
          setsCount: 0,
        })
      }
      const entry = sessionMap.get(dayKey)!
      entry.weights.push(w)
      entry.reps.push(r)
      entry.setsCount += 1
    })

    return Array.from(sessionMap.values())
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .map((item) => {
        const maxWeight = item.weights.length > 0 ? Math.max(...item.weights) : 0
        const sumWeight = item.weights.reduce((acc, v) => acc + v, 0)
        const avgWeight =
          item.weights.length > 0 ? Math.round((sumWeight / item.weights.length) * 10) / 10 : 0
        const maxReps = item.reps.length > 0 ? Math.max(...item.reps) : 0

        return {
          data: item.dateLabel,
          pesoMaximo: maxWeight,
          pesoMedio: avgWeight,
          series: item.setsCount,
          maxReps,
        }
      })
  }, [filteredByPeriodLogs, activeExerciseName])

  // 2. DADOS: Esforço Médio (RPE 1-10) por Sessão de Treino
  const rpeEvolutionData = useMemo(() => {
    // Agrupar todas as séries da data em uma sessão
    const sessionMap = new Map<
      string,
      {
        dateLabel: string
        rawDate: string
        rpeList: number[]
      }
    >()

    filteredByPeriodLogs.forEach((l) => {
      const d = new Date(l.completed_at || l.created)
      const dayKey = d.toISOString().slice(0, 10)
      const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const rpe = Number(l.rpe_difficulty) || 5

      if (!sessionMap.has(dayKey)) {
        sessionMap.set(dayKey, {
          dateLabel,
          rawDate: dayKey,
          rpeList: [],
        })
      }
      sessionMap.get(dayKey)!.rpeList.push(rpe)
    })

    return Array.from(sessionMap.values())
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .map((item) => {
        const sum = item.rpeList.reduce((acc, v) => acc + v, 0)
        const avgRpe =
          item.rpeList.length > 0 ? Math.round((sum / item.rpeList.length) * 10) / 10 : 0
        return {
          data: item.dateLabel,
          rpeMedio: avgRpe,
          totalSeries: item.rpeList.length,
        }
      })
  }, [filteredByPeriodLogs])

  // 3. DADOS: Volume Semanal (séries × reps × carga) e Frequência de Treinos
  const weeklyVolumeData = useMemo(() => {
    // Agrupar por semana do ano (ano-semana)
    const getWeekKey = (d: Date) => {
      const year = d.getFullYear()
      const firstDayOfYear = new Date(year, 0, 1)
      const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
      return {
        key: `${year}-W${String(weekNumber).padStart(2, '0')}`,
        label: `Sem ${weekNumber}`,
      }
    }

    const weekMap = new Map<
      string,
      {
        weekLabel: string
        weekKey: string
        totalVolume: number
        daysSet: Set<string>
        setsCount: number
      }
    >()

    filteredByPeriodLogs.forEach((l) => {
      const d = new Date(l.completed_at || l.created)
      const dayKey = d.toISOString().slice(0, 10)
      const { key, label } = getWeekKey(d)
      const reps = Number(l.reps_done) || 0
      const weight = Number(l.weight_used) || 0
      const seriesVolume = reps * weight

      if (!weekMap.has(key)) {
        weekMap.set(key, {
          weekKey: key,
          weekLabel: label,
          totalVolume: 0,
          daysSet: new Set(),
          setsCount: 0,
        })
      }
      const entry = weekMap.get(key)!
      entry.totalVolume += seriesVolume
      entry.daysSet.add(dayKey)
      entry.setsCount += 1
    })

    return Array.from(weekMap.values())
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .map((w) => ({
        semana: w.weekLabel,
        volumeKg: Math.round(w.totalVolume),
        frequenciaDias: w.daysSet.size,
        totalSeries: w.setsCount,
      }))
  }, [filteredByPeriodLogs])

  // 4. RESUMO DE CONQUISTAS (Maior Carga, Sequência de Treinos, Progressão %)
  const achievementsSummary = useMemo(() => {
    if (logs.length === 0) {
      return {
        maiorCarga: { peso: 0, exercicio: 'Nenhum' },
        maiorSequenciaDias: 0,
        progressaoPct: 0,
        totalTreinosRealizados: 0,
        totalVolumeHistorico: 0,
      }
    }

    // (a) Maior Carga
    let maxWeight = 0
    let maxEx = 'Nenhum'
    let totalVol = 0

    logs.forEach((l) => {
      const w = Number(l.weight_used) || 0
      const r = Number(l.reps_done) || 0
      totalVol += w * r
      if (w > maxWeight) {
        maxWeight = w
        maxEx = l.exercise_name || 'Exercício'
      }
    })

    // (b) Dias distintos de treino & Maior Sequência (dias consecutivos)
    const distinctDays = Array.from(
      new Set(logs.map((l) => new Date(l.completed_at || l.created).toISOString().slice(0, 10))),
    ).sort()

    let maxStreak = 0
    let currentStreak = 0
    let lastDate: Date | null = null

    distinctDays.forEach((dStr) => {
      const currentDate = new Date(dStr + 'T00:00:00')
      if (!lastDate) {
        currentStreak = 1
      } else {
        const diffDays = Math.round(
          (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
        )
        if (diffDays === 1) {
          currentStreak += 1
        } else if (diffDays > 1) {
          currentStreak = 1
        }
      }
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak
      }
      lastDate = currentDate
    })

    // (c) Progressão % média no exercício ativo ou geral
    let progressaoPct = 0
    if (loadEvolutionData.length >= 2) {
      const firstLoad = loadEvolutionData[0].pesoMaximo
      const lastLoad = loadEvolutionData[loadEvolutionData.length - 1].pesoMaximo
      if (firstLoad > 0) {
        progressaoPct = Math.round(((lastLoad - firstLoad) / firstLoad) * 100)
      }
    }

    return {
      maiorCarga: { peso: maxWeight, exercicio: maxEx },
      maiorSequenciaDias: maxStreak,
      progressaoPct,
      totalTreinosRealizados: distinctDays.length,
      totalVolumeHistorico: Math.round(totalVol),
    }
  }, [logs, loadEvolutionData])

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* HEADER DA SEÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-[#141414] border border-[#2A2A2A] shadow-xl relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#0057FF]/20 via-[#D4AF37]/15 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Link
              to="/aluno/historico"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D4AF37] font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Meu Histórico
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat">
            <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" />
            Métricas de Desempenho Físico
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            Gráfico de Evolução • 369WELLNESS
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-inter max-w-2xl leading-relaxed">
            Acompanhe sua sobrecarga progressiva, controle de esforço perceptível (RPE), volume
            semanal de treino e conquistas consolidadas.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            variant="outline"
            className="border-[#2A2A2A] bg-[#181818] hover:bg-[#202020] text-gray-300 hover:text-white text-xs font-bold uppercase rounded-xl flex items-center gap-2"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#D4AF37]' : ''}`}
            />
            Atualizar
          </Button>

          <Link to="/aluno/treino/execucao">
            <Button className="bg-[#0057FF] hover:bg-[#1e69ff] text-white font-extrabold text-xs uppercase px-4 py-2 rounded-xl shadow-md flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#D4AF37]" /> Registrar Treino
            </Button>
          </Link>
        </div>
      </div>

      {/* CONTROLE DE FILTROS */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-montserrat text-gray-400 uppercase">
              Período:
            </span>
            <div className="flex bg-[#141414] p-1 rounded-xl border border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => setPeriodo('30dias')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                  periodo === '30dias'
                    ? 'bg-[#0057FF] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                30 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('90dias')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                  periodo === '90dias'
                    ? 'bg-[#0057FF] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                90 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('todos')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase ${
                  periodo === 'todos'
                    ? 'bg-[#0057FF] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Tudo
              </button>
            </div>
          </div>

          {exerciseOptions.length > 0 && (
            <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
              <span className="text-xs font-bold font-montserrat text-[#D4AF37] uppercase whitespace-nowrap">
                Exercício:
              </span>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="w-full sm:w-auto flex-1 h-9 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
              >
                {exerciseOptions.map((opt) => (
                  <option key={opt.name} value={opt.name}>
                    {opt.name} ({opt.count} séries)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* ESTADO VAZIO */}
      {!loading && logs.length === 0 ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/30 flex items-center justify-center mx-auto text-[#0057FF]">
            <Dumbbell className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-bold font-montserrat text-white uppercase">
              Nenhum treino registrado ainda
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 font-inter leading-relaxed">
              Inicie seu primeiro treino na tela de execução para alimentar automaticamente os
              gráficos de carga, repetições e esforço (RPE).
            </p>
          </div>
          <div className="pt-2">
            <Link to="/aluno/treino/execucao">
              <Button className="bg-[#0057FF] hover:bg-[#1e69ff] text-white font-extrabold text-xs uppercase px-6 py-2.5 rounded-xl shadow-lg shadow-[#0057FF]/25">
                Iniciar Primeiro Treino
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* CARDS DE RESUMO DE CONQUISTAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Maior Carga */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold font-montserrat uppercase text-gray-400">
                  Maior Carga Levantada
                </span>
                <div className="p-2 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37]">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black font-montserrat text-white">
                  {achievementsSummary.maiorCarga.peso}{' '}
                  <span className="text-sm font-semibold text-[#D4AF37]">kg</span>
                </div>
                <p
                  className="text-xs text-gray-400 font-inter line-clamp-1"
                  title={achievementsSummary.maiorCarga.exercicio}
                >
                  {achievementsSummary.maiorCarga.exercicio}
                </p>
              </div>
            </Card>

            {/* Card 2: Sequência de Treinos */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden group hover:border-[#0057FF]/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold font-montserrat uppercase text-gray-400">
                  Maior Sequência
                </span>
                <div className="p-2 rounded-lg bg-[#0057FF]/15 text-[#0057FF]">
                  <Flame className="w-4 h-4 text-[#D4AF37]" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black font-montserrat text-white">
                  {achievementsSummary.maiorSequenciaDias}{' '}
                  <span className="text-sm font-semibold text-[#0057FF]">dias seguidos</span>
                </div>
                <p className="text-xs text-gray-400 font-inter">
                  Consistência nos treinos registrados
                </p>
              </div>
            </Card>

            {/* Card 3: Progressão % */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold font-montserrat uppercase text-gray-400">
                  Progressão no Exercício
                </span>
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black font-montserrat text-white">
                  {achievementsSummary.progressaoPct >= 0 ? '+' : ''}
                  {achievementsSummary.progressaoPct}
                  <span className="text-sm font-semibold text-emerald-400">%</span>
                </div>
                <p className="text-xs text-gray-400 font-inter line-clamp-1">
                  {activeExerciseName || 'Sobrecarga de força'}
                </p>
              </div>
            </Card>

            {/* Card 4: Volume Total */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold font-montserrat uppercase text-gray-400">
                  Volume Total Levantado
                </span>
                <div className="p-2 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37]">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black font-montserrat text-white">
                  {(achievementsSummary.totalVolumeHistorico / 1000).toFixed(1)}{' '}
                  <span className="text-sm font-semibold text-[#D4AF37]">toneladas</span>
                </div>
                <p className="text-xs text-gray-400 font-inter">
                  {achievementsSummary.totalTreinosRealizados} sessões computadas
                </p>
              </div>
            </Card>
          </div>

          {/* GRÁFICO 1: EVOLUÇÃO DE CARGA POR EXERCÍCIO AO LONGO DO TEMPO */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 sm:p-6 rounded-2xl shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A2A2A] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#0057FF]" />
                    Evolução de Carga • {activeExerciseName || 'Selecione um exercício'}
                  </h2>
                </div>
                <p className="text-xs text-gray-400 font-inter">
                  Peso máximo e peso médio registrado em cada sessão (kg)
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-montserrat">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#D4AF37]" />
                  <span className="text-gray-300">Carga Máxima (kg)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#0057FF]" />
                  <span className="text-gray-300">Carga Média (kg)</span>
                </div>
              </div>
            </div>

            {loadEvolutionData.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 font-inter">
                Nenhuma série registrada para &quot;{activeExerciseName}&quot; no período
                selecionado.
              </div>
            ) : (
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={loadEvolutionData}
                    margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
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
                        const series = (payload[0]?.payload as any)?.series || 1
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
            )}
          </Card>

          {/* GRÁFICO 2: ESFORÇO MÉDIO (RPE 1-10) COM FAIXA IDEAL DE ESTÍMULO DESTACADA */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 sm:p-6 rounded-2xl shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A2A2A] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#D4AF37]" />
                    Esforço Médio por Sessão (Escala RPE 1–10)
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
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={rpeEvolutionData}
                    margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
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
                        const series = (payload[0]?.payload as any)?.totalSeries || 1
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
                    {/* Faixa ideal de estímulo RPE 6 a 8 */}
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
            )}
          </Card>

          {/* GRÁFICO 3: VOLUME SEMANAL (SÉRIES × REPS × CARGA) E FREQUÊNCIA DE TREINOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-8 bg-[#181818] border border-[#2A2A2A] p-5 sm:p-6 rounded-2xl shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-4">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#D4AF37]" />
                    Volume Semanal de Treino (kg)
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
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weeklyVolumeData}
                      margin={{ top: 10, right: 20, left: -5, bottom: 0 }}
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
                          const dias = (payload[0]?.payload as any)?.frequenciaDias || 0
                          const series = (payload[0]?.payload as any)?.totalSeries || 0
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
              )}
            </Card>

            <Card className="lg:col-span-4 bg-[#181818] border border-[#2A2A2A] p-5 sm:p-6 rounded-2xl shadow-lg space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
                  <h3 className="text-sm font-bold font-montserrat text-white uppercase flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0057FF]" /> Frequência de Treino
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">Dias / Semana</span>
                </div>
                <p className="text-xs text-gray-400 font-inter leading-relaxed">
                  A regularidade semanal é o principal pilar para adaptação neuromuscular e
                  hipertrofia sustentável.
                </p>

                <div className="space-y-2 pt-2">
                  {weeklyVolumeData.slice(-4).map((w, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between text-xs"
                    >
                      <span className="font-bold font-montserrat text-gray-300">{w.semana}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-2.5 h-2.5 rounded-sm ${
                                i < w.frequenciaDias ? 'bg-[#D4AF37]' : 'bg-[#2A2A2A]'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-mono font-bold text-white text-[11px] ml-1">
                          {w.frequenciaDias}d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 space-y-1">
                <p className="text-xs font-bold text-[#D4AF37] uppercase font-montserrat flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Metodologia 369
                </p>
                <p className="text-[11px] text-gray-300 font-inter">
                  Mantenha 3 a 5 sessões semanais para atingir supercompensação sem sobrecarga
                  articular.
                </p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Suspense, lazy } from 'react'
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
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { WorkoutLogRecord } from '@/services/workoutExecution'

// Lazy loading do componente pesado com os gráficos Recharts
const EvolucaoChartsSection = lazy(() => import('@/components/EvolucaoChartsSection'))

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
    <div className="space-y-6 sm:space-y-8 pb-16 max-w-7xl mx-auto w-full min-w-0">
      {/* HEADER DA SEÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-8 rounded-2xl bg-[#141414] border border-[#2A2A2A] shadow-xl relative overflow-hidden">
        {/* Fundo decorativo sutil sem blur pesado no mobile */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#0057FF]/10 via-[#D4AF37]/10 to-transparent rounded-full hidden sm:block pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Link
              to="/aluno/historico"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D4AF37] font-semibold transition-colors py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Meu Histórico
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/30 text-[11px] sm:text-xs font-bold text-[#0057FF] uppercase font-montserrat">
            <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" />
            Métricas de Desempenho Físico
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            Gráfico de Evolução • 369WELLNESS
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-inter max-w-2xl leading-relaxed">
            Acompanhe sua sobrecarga progressiva, controle de esforço perceptível (RPE), volume
            semanal de treino e conquistas consolidadas.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full md:w-auto">
          <Button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            variant="outline"
            className="w-full border-[#2A2A2A] bg-[#181818] hover:bg-[#202020] text-gray-300 hover:text-white text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 h-11 px-4"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin text-[#D4AF37]' : ''}`}
            />
            <span>Atualizar</span>
          </Button>

          <Link to="/aluno/treino/execucao" className="w-full">
            <Button className="w-full bg-[#0057FF] hover:bg-[#1e69ff] text-white font-extrabold text-xs uppercase h-11 px-4 rounded-xl shadow-md flex items-center justify-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Registrar Treino</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* CONTROLE DE FILTROS */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs font-bold font-montserrat text-gray-400 uppercase">
              Período:
            </span>
            <div className="grid grid-cols-3 bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] gap-1">
              <button
                type="button"
                onClick={() => setPeriodo('30dias')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase text-center ${
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase text-center ${
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-montserrat uppercase text-center ${
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 max-w-md justify-end">
              <span className="text-xs font-bold font-montserrat text-[#D4AF37] uppercase whitespace-nowrap">
                Exercício:
              </span>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="w-full sm:w-auto flex-1 h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
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

          {/* Seção Lazy-Loaded de Gráficos Recharts (Renderizada somente após os dados carregarem) */}
          <Suspense
            fallback={
              <div className="p-8 text-center text-xs text-gray-400 font-inter bg-[#181818] border border-[#2A2A2A] rounded-2xl animate-pulse">
                Carregando gráficos de evolução...
              </div>
            }
          >
            <EvolucaoChartsSection
              activeExerciseName={activeExerciseName}
              loadEvolutionData={loadEvolutionData}
              rpeEvolutionData={rpeEvolutionData}
              weeklyVolumeData={weeklyVolumeData}
            />
          </Suspense>

          {/* CARD DE FREQUÊNCIA DE TREINOS E METODOLOGIA 369 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#181818] border border-[#2A2A2A] p-5 sm:p-6 rounded-2xl shadow-lg space-y-4">
              <div className="space-y-2">
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
              </div>

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
            </Card>

            <Card className="bg-[#181818] border border-[#2A2A2A] p-5 sm:p-6 rounded-2xl shadow-lg space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-3">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold font-montserrat text-white uppercase">
                    Metodologia 369 • Princípios de Sobrecarga
                  </h3>
                </div>
                <p className="text-xs text-gray-400 font-inter leading-relaxed">
                  Para resultados progressivos sem estagnação:
                </p>
                <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside font-inter">
                  <li>Priorize a técnica e cadência antes de aumentar o peso.</li>
                  <li>Trabalhe dentro da zona de hipertrofia perceptível (RPE 6 a 8).</li>
                  <li>
                    Mantenha de 3 a 5 sessões semanais para atingir supercompensação neuromuscular.
                  </li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 space-y-1 mt-4">
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

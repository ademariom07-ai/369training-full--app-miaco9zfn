import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { CrestLogo } from '@/components/CrestLogo'
import { getAvatarUrl } from '@/components/UserAvatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HidratacaoSection } from '@/components/HidratacaoSection'
import { DesafiosAlunoSection } from '@/components/DesafiosAlunoSection'
import { AlunoProfissionaisFeed } from '@/components/AlunoProfissionaisFeed'
import { Agente369Section } from '@/components/Agente369Section'
import { MinhasAulasColetivasAluno } from '@/components/MinhasAulasColetivasAluno'
import { ProximaSessaoCard } from '@/components/ProximaSessaoCard'
import {
  Dumbbell,
  Utensils,
  Activity,
  Swords,
  MessageSquare,
  Trophy,
  Flame,
  Award,
  ChevronRight,
  History,
  Users,
  Sparkles,
  BarChart3,
} from 'lucide-react'
import type { AchievementRecord, WorkoutRecord } from '@/services/api'

/** Início da semana corrente (segunda-feira, 00:00) */
function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().replace('T', ' ') + ':00'
}

export default function AlunoHome() {
  const { user } = useAuth()
  const [achievements, setAchievements] = useState<AchievementRecord[]>([])
  const [activeWorkout, setActiveWorkout] = useState<WorkoutRecord | null>(null)
  const [loadingHome, setLoadingHome] = useState(true)
  const [completedCount, setCompletedCount] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const finish = () => {
      if (!cancelled) setLoadingHome(false)
    }

    // Treino ativo de hoje
    const workoutPromise = pb
      .collection('workouts')
      .getList<WorkoutRecord>(1, 1, {
        filter: `student = "${user.id}" && status = "ativo"`,
        sort: '-created',
      })
      .then((res) => {
        if (!cancelled) setActiveWorkout(res.items.length > 0 ? res.items[0] : null)
      })
      .catch(() => {})

    // Conquistas
    const achievementsPromise = pb
      .collection('achievements')
      .getList<AchievementRecord>(1, 10, {
        filter: `user = "${user.id}"`,
        sort: '-created',
      })
      .then((res) => {
        if (!cancelled) setAchievements(res.items)
      })
      .catch(() => {})

    // Treinos concluídos na semana (dias distintos com registro de execução)
    const logsPromise = pb
      .collection('workout_logs')
      .getFullList<{ created: string }>({
        filter: `student = "${user.id}" && created >= "${getWeekStart()}"`,
        fields: 'created',
      })
      .then((logs) => {
        if (cancelled) return
        const uniqueDays = new Set(logs.map((l) => (l.created || '').slice(0, 10)))
        setCompletedCount(uniqueDays.size)
      })
      .catch(() => {})

    Promise.all([workoutPromise, achievementsPromise, logsPromise]).finally(finish)

    return () => {
      cancelled = true
    }
  }, [user])

  const weeklyTarget = 5
  const weeklyProgress = Math.min(100, Math.round((completedCount / weeklyTarget) * 100))
  const hasWorkout = !!activeWorkout

  return (
    <div className="space-y-8 pb-12">
      {/* Top Greeting & Student Crest Photo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-white border border-[#E5E3DC] shadow-xs">
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Crest with student photo inside */}
          <div className="relative group shrink-0">
            <CrestLogo size={72} avatarUrl={getAvatarUrl(user)} />
          </div>
          <div className="min-w-0">
            {user?.plan && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#B8962E] uppercase tracking-widest font-montserrat">
                  Plano {user.plan.toUpperCase()}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-[#1A1A1A] mt-0.5 break-words">
              Olá, {user?.name?.split(' ')[0] || 'Atleta'}!
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-inter mt-1">
              Foco no objetivo:{' '}
              <span className="text-[#B8962E] font-semibold">
                {user?.objective || 'Evolução Contínua'}
              </span>
            </p>
          </div>
        </div>

        {/* Actions Button */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Link to="/aluno/historico" className="flex-1 sm:flex-none">
            <Button
              variant="outline"
              className="w-full border-[#D4AF37]/50 text-[#B8962E] hover:bg-[#D4AF37]/10 font-bold shadow-xs flex items-center justify-center gap-2 min-h-[44px]"
            >
              <History className="w-4 h-4" />
              Meu Histórico
            </Button>
          </Link>
          <Link to="/aluno/chat" className="flex-1 sm:flex-none">
            <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold shadow-xs flex items-center justify-center gap-2 min-h-[44px] active:scale-[0.98] transition-transform">
              <MessageSquare className="w-4 h-4" />
              Falar com meu Profissional
            </Button>
          </Link>
        </div>
      </div>

      {/* ===== TREINO DE HOJE — DESTAQUE PRINCIPAL NO TOPO ===== */}
      <section aria-label="Treino de hoje">
        {loadingHome ? (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2A2A2A]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-[#2A2A2A]" />
                <div className="h-5 w-3/4 rounded bg-[#2A2A2A]" />
                <div className="h-3 w-1/2 rounded bg-[#2A2A2A]" />
              </div>
            </div>
            <div className="mt-5 h-11 w-full sm:w-56 rounded-xl bg-[#2A2A2A]" />
          </Card>
        ) : hasWorkout ? (
          <Card className="bg-gradient-to-br from-[#181818] via-[#141414] to-[#181818] border-2 border-[#D4AF37]/60 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(212,175,55,0.12)] relative overflow-hidden">
            <div className="hidden sm:block absolute top-0 right-0 w-56 h-56 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-widest font-montserrat">
                    Treino de hoje {activeWorkout?.day ? `• ${activeWorkout.day}` : ''}
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold font-montserrat text-white mt-0.5 leading-snug break-words">
                    {activeWorkout?.title || 'Sua ficha de treino'}
                  </h2>
                  <p className="text-xs text-gray-400 font-inter mt-1">
                    {activeWorkout?.exercises?.length
                      ? `${activeWorkout.exercises.length} exercícios prescritos com controle de carga e vídeo.`
                      : 'Ficha pronta para executar com registro de séries e cargas.'}
                  </p>
                </div>
              </div>
              <Link to="/aluno/treino" className="w-full sm:w-auto shrink-0">
                <Button className="w-full sm:w-auto bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold uppercase text-xs tracking-wider rounded-xl min-h-[44px] px-6 flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform">
                  Iniciar Treino ▶
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          /* Estado vazio acolhedor para aluno recém-cadastrado */
          <Card className="bg-[#181818] border border-dashed border-[#D4AF37]/50 rounded-2xl p-6 sm:p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="mt-4 text-lg sm:text-xl font-extrabold font-montserrat text-white">
              Bem-vindo(a) à sua jornada 369WELLNESS!
            </h2>
            <p className="mt-1.5 text-sm text-gray-400 font-inter max-w-md mx-auto leading-relaxed">
              Você ainda não tem um treino ativo. Monte seu primeiro treino em minutos ou encontre
              um profissional credenciado para acompanhar sua evolução.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/aluno/treino" className="w-full sm:w-auto">
                <Button className="w-full bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold uppercase text-xs tracking-wider rounded-xl min-h-[44px] px-6 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                  <Dumbbell className="w-4 h-4" /> Montar meu treino
                </Button>
              </Link>
              <a href="#encontrar-profissional" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full border-[#0057FF]/60 text-[#5B8CFF] hover:bg-[#0057FF]/10 font-bold rounded-xl min-h-[44px] px-6 flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" /> Encontrar profissional
                </Button>
              </a>
            </div>
          </Card>
        )}
      </section>

      {/* ITEM 1: CARD PRÓXIMA SESSÃO DO ALUNO */}
      {user && <ProximaSessaoCard studentId={user.id} />}

      {/* Weekly Progress Bar (Blue to Gold with Shimmer) — progresso real da semana */}
      <Card className="bg-white border border-[#E5E3DC] p-5 sm:p-6 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#FF7A00] shrink-0" />
            <span className="font-bold font-montserrat text-[#1A1A1A] text-sm uppercase">
              Progresso Semanal de Treinos
            </span>
          </div>
          {loadingHome ? (
            <div className="h-4 w-44 rounded bg-[#E5E3DC] animate-pulse" />
          ) : (
            <span className="text-sm font-extrabold font-montserrat text-[#B8962E]">
              {completedCount} de {weeklyTarget} dias ativos ({weeklyProgress}%)
            </span>
          )}
        </div>

        <div className="w-full h-4 bg-[#f7f6f3] rounded-full overflow-hidden border border-[#E5E3DC] p-0.5">
          {loadingHome ? (
            <div className="h-full w-1/3 rounded-full bg-[#E5E3DC] animate-pulse" />
          ) : (
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0057FF] via-[#8A67FF] to-[#D4AF37] relative animate-shimmer transition-all duration-500"
              style={{ width: `${weeklyProgress}%` }}
            />
          )}
        </div>
        {!loadingHome && completedCount === 0 && (
          <p className="text-xs text-gray-500 font-inter mt-2">
            Nenhum treino registrado nesta semana. O primeiro é o mais importante — comece hoje! 💪
          </p>
        )}
      </Card>

      {/* 7.2 SEÇÃO ENCONTRE UM PROFISSIONAL (FEED) */}
      <div id="encontrar-profissional">
        <AlunoProfissionaisFeed />
      </div>

      {/* AULAS COLETIVAS MULTI-ALUNO E CONFIRMAÇÃO DE PRESENÇA (SELFIE COLETIVA) */}
      {user && (
        <div id="aulas-coletivas">
          <MinhasAulasColetivasAluno currentUserId={user.id} />
        </div>
      )}

      {/* AGENTE 369 DO ALUNO (BENEFÍCIO DO PLANO, MOTOR DETERMINÍSTICO E FRANQUIAS) */}
      <Agente369Section />

      {/* RECURSO 6: SEÇÃO DE CRONÔMETRO DE HIDRATAÇÃO ACSM */}
      <HidratacaoSection />

      {/* RECURSO SMARTWATCH CAMINHO A */}
      <Card className="bg-gradient-to-r from-[#181818] via-[#151c28] to-[#181818] border border-[#0057FF]/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0057FF]/15 border border-[#0057FF]/40 flex items-center justify-center text-[#0057FF] shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase text-[#0057FF] font-montserrat">
                Sincronização de Saúde
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] bg-[#D4AF37]/15 text-[#D4AF37] font-bold">
                Caminho A (Terra/Spike API)
              </span>
            </div>
            <h3 className="text-sm font-bold text-white font-montserrat">
              Conecte seu Smartwatch (Apple, Garmin, Xiaomi, Fitbit, Samsung, Polar)
            </h3>
            <p className="text-[11px] text-gray-400 font-inter">
              Acompanhe batimentos cardíacos, queima calórica, passos e qualidade do sono em tempo
              real.
            </p>
          </div>
        </div>
        <Link to="/smartwatch" className="shrink-0 w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-[#0057FF] hover:bg-[#0046d1] text-white text-xs font-bold font-montserrat uppercase px-4 min-h-[44px] rounded-xl active:scale-[0.98] transition-transform">
            Acessar Smartwatch
          </Button>
        </Link>
      </Card>

      {/* RECURSO 7: SEÇÃO DE DESAFIOS E GAMIFICAÇÃO */}
      <DesafiosAlunoSection />

      {/* 2x2 CARD GRID */}
      <div>
        <h2 className="text-lg font-bold font-montserrat uppercase gold-gradient-text mb-4">
          Módulos de Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* 1. Evolução & Histórico (treino de hoje já está em destaque no topo) */}
          <Link to="/aluno/historico" className="group">
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl hover:border-[#D4AF37] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(212,175,55,0.15)] relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#D4AF37] uppercase bg-[#D4AF37]/10 px-2.5 py-1 rounded-full border border-[#D4AF37]/30">
                  Evolução
                </span>
              </div>
              <h3 className="text-lg font-bold font-montserrat text-white group-hover:text-[#D4AF37] transition-colors">
                Evolução & Histórico
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1.5 line-clamp-2">
                Progressão de carga, RPE por sessão, gráficos de volume semanal e histórico
                completo.
              </p>
              <div className="flex items-center text-xs font-semibold text-[#D4AF37] mt-4 group-hover:translate-x-1 transition-transform">
                Ver Evolução <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </Card>
          </Link>

          {/* 2. Plano Alimentar */}
          <Link to="/aluno/nutricao" className="group">
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl hover:border-[#22C55E] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(34,197,94,0.15)]">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E] group-hover:scale-110 transition-transform">
                  <Utensils className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#22C55E] uppercase bg-[#22C55E]/10 px-2.5 py-1 rounded-full border border-[#22C55E]/30">
                  Nutrição
                </span>
              </div>
              <h3 className="text-lg font-bold font-montserrat text-white group-hover:text-[#22C55E] transition-colors">
                Plano Alimentar & Substituições
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1.5 line-clamp-2">
                Cardápio balanceado, fotos de refeições, lista de compras e troca inteligente de
                alimentos com IA.
              </p>
              <div className="flex items-center text-xs font-semibold text-[#22C55E] mt-4 group-hover:translate-x-1 transition-transform">
                Ver Dieta <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </Card>
          </Link>

          {/* 3. Fisioterapia / Reabilitação */}
          <Link to="/aluno/fisioterapia" className="group">
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl hover:border-[#0057FF] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,87,255,0.15)]">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 flex items-center justify-center text-[#0057FF] group-hover:scale-110 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#0057FF] uppercase bg-[#0057FF]/10 px-2.5 py-1 rounded-full border border-[#0057FF]/30">
                  Prevenção
                </span>
              </div>
              <h3 className="text-lg font-bold font-montserrat text-white group-hover:text-[#0057FF] transition-colors">
                Fisioterapia & Reabilitação
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1.5 line-clamp-2">
                Escala analógica de dor (0-10), testes de mobilidade articular guiados e protocolos
                pós-treino.
              </p>
              <div className="flex items-center text-xs font-semibold text-[#0057FF] mt-4 group-hover:translate-x-1 transition-transform">
                Monitorar Recuperação <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </Card>
          </Link>

          {/* 4. Artes Marciais */}
          <Link to="/aluno/artes-marciais" className="group">
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl hover:border-[#6A00FF] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(106,0,255,0.15)]">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#6A00FF]/10 border border-[#6A00FF]/30 flex items-center justify-center text-[#9D52FF] group-hover:scale-110 transition-transform">
                  <Swords className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#9D52FF] uppercase bg-[#6A00FF]/10 px-2.5 py-1 rounded-full border border-[#6A00FF]/30">
                  Combate
                </span>
              </div>
              <h3 className="text-lg font-bold font-montserrat text-white group-hover:text-[#9D52FF] transition-colors">
                Artes Marciais & Graduação
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1.5 line-clamp-2">
                Escada de faixas, check-in de presença, técnicas em vídeo e leaderboard de
                disciplina da turma.
              </p>
              <div className="flex items-center text-xs font-semibold text-[#9D52FF] mt-4 group-hover:translate-x-1 transition-transform">
                Acessar Dojo <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* MEDALHAS / CONQUISTAS ROW */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-bold font-montserrat text-white text-sm uppercase">
              Medalhas & Conquistas Desbloqueadas
            </h3>
          </div>
          <Link
            to="/aluno/perfil"
            className="text-xs text-[#D4AF37] hover:underline font-semibold min-h-[32px] flex items-center"
          >
            Ver todas
          </Link>
        </div>

        {loadingHome ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[62px] rounded-xl bg-[#141414] border border-[#2A2A2A]" />
            ))}
          </div>
        ) : achievements.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center gap-3"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    ach.tier === 'ouro'
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]'
                      : ach.tier === 'prata'
                        ? 'bg-gray-400/20 text-gray-200 border border-gray-400'
                        : 'bg-amber-800/20 text-amber-500 border border-amber-800'
                  }`}
                >
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate font-montserrat">
                    {ach.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate font-inter">
                    {ach.description || 'Conquista 369'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Estado vazio acolhedor (sem medalhas fake) */
          <div className="p-5 rounded-xl bg-[#141414] border border-dashed border-[#2A2A2A] text-center">
            <Trophy className="w-8 h-8 mx-auto text-[#D4AF37]/70" />
            <p className="mt-2 text-sm font-bold text-white font-montserrat">
              Sua primeira medalha está a um treino de distância
            </p>
            <p className="text-xs text-gray-400 font-inter mt-1">
              Complete treinos, aulas coletivas e desafios para desbloquear conquistas.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

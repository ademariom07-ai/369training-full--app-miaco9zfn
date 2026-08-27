import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HidratacaoSection } from '@/components/HidratacaoSection'
import { DesafiosAlunoSection } from '@/components/DesafiosAlunoSection'
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
  Sparkles,
} from 'lucide-react'
import type { AchievementRecord, WorkoutRecord, NotificationRecord } from '@/services/api'

export default function AlunoHome() {
  const { user } = useAuth()
  const [achievements, setAchievements] = useState<AchievementRecord[]>([])
  const [activeWorkout, setActiveWorkout] = useState<WorkoutRecord | null>(null)
  const [completedCount, setCompletedCount] = useState(2)
  const [totalCount] = useState(5)

  useEffect(() => {
    if (!user) return

    // Load achievements
    pb.collection('achievements')
      .getList<AchievementRecord>(1, 10, {
        filter: `user = "${user.id}"`,
        sort: '-created',
      })
      .then((res) => {
        setAchievements(res.items)
      })
      .catch(() => {})

    // Load today's active workout
    pb.collection('workouts')
      .getList<WorkoutRecord>(1, 1, {
        filter: `student = "${user.id}" && status = "ativo"`,
        sort: '-created',
      })
      .then((res) => {
        if (res.items.length > 0) {
          setActiveWorkout(res.items[0])
        }
      })
      .catch(() => {})
  }, [user])

  const weeklyProgress = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="space-y-8 pb-12">
      {/* Top Greeting & Student Crest Photo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#181818] border border-[#2A2A2A] shadow-xl">
        <div className="flex items-center gap-5">
          {/* Crest with student photo inside */}
          <div className="relative group">
            <CrestLogo
              size={76}
              avatarUrl={
                user?.avatar
                  ? pb.files.getURL(user, user.avatar)
                  : 'https://img.usecurling.com/ppl/medium?gender=male&seed=1'
              }
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest font-montserrat">
                Plano {user?.plan?.toUpperCase() || 'PRO'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white mt-0.5">
              Olá, {user?.name?.split(' ')[0] || 'Atleta'}!
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-inter mt-1">
              Foco no objetivo:{' '}
              <span className="text-[#D4AF37] font-semibold">
                {user?.objective || 'Evolução Contínua'}
              </span>
            </p>
          </div>
        </div>

        {/* Falar com Profissional Button */}
        <Link to="/aluno/chat">
          <Button className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Falar com meu Profissional
          </Button>
        </Link>
      </div>

      {/* Weekly Progress Bar (Blue to Gold with Shimmer) */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#FF7A00]" />
            <span className="font-bold font-montserrat text-white text-sm uppercase">
              Progresso Semanal de Treinos
            </span>
          </div>
          <span className="text-sm font-extrabold font-montserrat text-[#D4AF37]">
            {completedCount} de {totalCount} concluídos ({weeklyProgress}%)
          </span>
        </div>

        <div className="w-full h-4 bg-[#121212] rounded-full overflow-hidden border border-[#2A2A2A] p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0057FF] via-[#8A67FF] to-[#D4AF37] relative animate-shimmer transition-all duration-500"
            style={{ width: `${weeklyProgress}%` }}
          />
        </div>
      </Card>

      {/* RECURSO 6: SEÇÃO DE CRONÔMETRO DE HIDRATAÇÃO ACSM */}
      <HidratacaoSection />

      {/* RECURSO 7: SEÇÃO DE DESAFIOS E GAMIFICAÇÃO */}
      <DesafiosAlunoSection />

      {/* 2x2 CARD GRID */}
      <div>
        <h2 className="text-lg font-bold font-montserrat uppercase gold-gradient-text mb-4">
          Módulos de Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* 1. Treino do Dia */}
          <Link to="/aluno/treino" className="group">
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl hover:border-[#D4AF37] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(212,175,55,0.15)] relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-[#D4AF37] uppercase bg-[#D4AF37]/10 px-2.5 py-1 rounded-full border border-[#D4AF37]/30">
                  {activeWorkout?.day || 'Hoje'}
                </span>
              </div>
              <h3 className="text-lg font-bold font-montserrat text-white group-hover:text-[#D4AF37] transition-colors">
                {activeWorkout?.title || 'Monte Seu Treino do Dia'}
              </h3>
              <p className="text-xs text-gray-400 font-inter mt-1.5 line-clamp-2">
                {activeWorkout?.exercises
                  ? `${activeWorkout.exercises.length} exercícios prescritos com controle de carga e vídeo.`
                  : 'Gere treinos estruturados com IA ou consulte a ficha do seu Personal.'}
              </p>
              <div className="flex items-center text-xs font-semibold text-[#D4AF37] mt-4 group-hover:translate-x-1 transition-transform">
                Acessar Treino <ChevronRight className="w-4 h-4 ml-1" />
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
          <Link to="/aluno/perfil" className="text-xs text-[#D4AF37] hover:underline font-semibold">
            Ver todas
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {achievements.length > 0 ? (
            achievements.map((ach) => (
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
            ))
          ) : (
            <>
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37] flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white font-montserrat">Primeiro Treino</p>
                  <p className="text-[10px] text-gray-400 font-inter">Início da jornada</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-400/20 text-gray-200 border border-gray-400 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white font-montserrat">Consistência</p>
                  <p className="text-[10px] text-gray-400 font-inter">3 treinos seguidos</p>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

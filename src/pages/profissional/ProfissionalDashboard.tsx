import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AIExpertsRail } from '@/components/AIExpertsRail'
import { PlanChangeSection } from '@/components/PlanChangeSection'
import { GestaoDesafiosProfissional } from '@/components/GestaoDesafiosProfissional'
import {
  Users,
  Dumbbell,
  Utensils,
  Activity,
  Swords,
  Plus,
  TrendingUp,
  DollarSign,
  UserCheck,
  Award,
  ChevronRight,
  Flame,
  Bot,
} from 'lucide-react'
import type { UserProfile } from '@/contexts/AuthContext'
import type { ServiceRecord } from '@/services/api'

export default function ProfissionalDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [students, setStudents] = useState<UserProfile[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [railOpen, setRailOpen] = useState(true)

  // Load students and services
  useEffect(() => {
    // Fetch active students
    pb.collection('users')
      .getList<UserProfile>(1, 10, {
        filter: 'role = "aluno"',
      })
      .then((res) => {
        setStudents(res.items)
      })
      .catch(() => {})

    // Fetch professional services
    if (user) {
      pb.collection('services')
        .getList<ServiceRecord>(1, 10, {
          filter: `professional = "${user.id}"`,
          sort: '-created',
        })
        .then((res) => {
          setServices(res.items)
        })
        .catch(() => {})
    }
  }, [user])

  return (
    <div className="flex gap-6 relative">
      {/* Main Content Area */}
      <div className="flex-1 space-y-8 pb-12 overflow-x-hidden">
        {/* Header Profile Info & Action Pills */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#181818] border border-[#2A2A2A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xl">
          <div className="flex items-center gap-4">
            <img
              src={
                user?.avatar
                  ? pb.files.getURL(user, user.avatar)
                  : 'https://img.usecurling.com/ppl/medium?gender=male&seed=2'
              }
              alt={user?.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#D4AF37]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border font-montserrat ${
                    user?.plan === 'premium'
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                      : user?.plan === 'pro'
                        ? 'bg-[#0057FF]/15 border-[#0057FF] text-[#0057FF]'
                        : 'bg-gray-800 border-gray-700 text-gray-300'
                  }`}
                >
                  Plano {user?.plan?.toUpperCase() || 'BASICO'}
                </span>
                <span className="text-xs text-[#22C55E] font-bold">✓ Verificado</span>
              </div>

              <h1 className="text-2xl font-extrabold font-montserrat text-white mt-1">
                {user?.name || 'Prof. Carlos Silva'}
              </h1>
              <p className="text-xs text-gray-400 font-inter">
                {user?.specialties?.join(' • ') || 'Educação Física & Nutrição'} •{' '}
                {user?.cref || 'CREF 098765-G/SP'}
              </p>
            </div>
          </div>

          <Link to="/profissional/perfil">
            <Button
              variant="outline"
              className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-bold text-xs"
            >
              Editar Perfil Público
            </Button>
          </Link>
        </div>

        {/* FLOATING / QUICK ACTION BUTTONS */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-montserrat mb-3">
            Ações Rápidas de Prescrição
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link to="/profissional/treinos/novo">
              <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs py-5 rounded-xl shadow-md flex items-center justify-center gap-2">
                <Dumbbell className="w-4 h-4" /> Criar Treino
              </Button>
            </Link>
            <Link to="/profissional/dietas/nova">
              <Button className="w-full bg-[#22C55E] text-black hover:bg-[#1fb354] font-bold text-xs py-5 rounded-xl shadow-md flex items-center justify-center gap-2">
                <Utensils className="w-4 h-4" /> Criar Dieta
              </Button>
            </Link>
            <Link to="/profissional/agenda">
              <Button className="w-full bg-[#0057FF] text-white hover:bg-[#1e69ff] font-bold text-xs py-5 rounded-xl shadow-md flex items-center justify-center gap-2">
                <Activity className="w-4 h-4" /> Atendimento
              </Button>
            </Link>
            <Link to="/profissional/alunos">
              <Button
                variant="outline"
                className="w-full border-[#2A2A2A] text-gray-300 hover:text-white font-bold text-xs py-5 rounded-xl flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" /> Ver Alunos
              </Button>
            </Link>
          </div>
        </div>

        {/* OVERVIEW CHARTS / KPIS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-montserrat uppercase">Alunos Ativos</span>
              <Users className="w-4 h-4 text-[#0057FF]" />
            </div>
            <p className="text-2xl font-extrabold text-white font-montserrat">18 Alunos</p>
            <span className="text-[10px] text-[#22C55E] font-semibold mt-1 inline-block">
              +3 novos este mês
            </span>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-montserrat uppercase">
                Taxa de Retenção
              </span>
              <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <p className="text-2xl font-extrabold text-[#D4AF37] font-montserrat">94.2%</p>
            <span className="text-[10px] text-gray-400 font-inter mt-1 inline-block">
              Média superior do ecossistema
            </span>
          </Card>

          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-montserrat uppercase">
                Receita Bruta Estimada
              </span>
              <DollarSign className="w-4 h-4 text-[#22C55E]" />
            </div>
            <p className="text-2xl font-extrabold text-[#22C55E] font-montserrat">R$ 4.500,00</p>
            <span className="text-[10px] text-gray-400 font-inter mt-1 inline-block">
              Ciclo atual (30 dias)
            </span>
          </Card>
        </div>

        {/* RECURSO 7: GESTÃO DE DESAFIOS PELO PROFISSIONAL */}
        <GestaoDesafiosProfissional />

        {/* LISTA DE ALUNOS COMO CARDS */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold font-montserrat uppercase text-white">
              Seus Alunos & Status Biomecânico
            </h2>
            <Link
              to="/profissional/alunos"
              className="text-xs text-[#D4AF37] hover:underline font-bold"
            >
              Gerenciar Todos
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {students.map((student) => (
              <Card
                key={student.id}
                className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/60 p-5 rounded-2xl transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://img.usecurling.com/ppl/medium?gender=male&seed=1"
                      alt={student.name}
                      className="w-12 h-12 rounded-xl object-cover border border-[#2A2A2A]"
                    />
                    <div>
                      <h3 className="font-bold font-montserrat text-white text-sm">
                        {student.name}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-inter">
                        Objetivo:{' '}
                        <span className="text-[#D4AF37]">{student.objective || 'Hipertrofia'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Chips */}
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase pt-2 border-t border-[#2A2A2A]">
                  <span className="px-2 py-0.5 rounded bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/30">
                    Treino: Em Dia
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30">
                    Dieta: 90%
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30">
                    Dor: EVA 2/10
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                    Freq: 4x/sem
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* TROCA DE PLANO SECTION */}
        <PlanChangeSection />
      </div>
      {/* AI EXPERTS SIDE RAIL */}{' '}
      <AIExpertsRail
        planTier={user?.plan || 'premium'}
        isOpen={railOpen}
        onToggle={() => setRailOpen(!railOpen)}
      />
    </div>
  )
}

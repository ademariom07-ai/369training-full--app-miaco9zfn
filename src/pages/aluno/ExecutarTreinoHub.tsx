import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Dumbbell,
  Apple,
  Activity,
  Brain,
  Shield,
  Play,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react'

// Tipagens
interface HubItem {
  id: string
  collectionName: 'workouts' | 'diets' | 'protocols' | 'clinical_records' | 'martial_arts_sessions'
  specialty: 'educacao_fisica' | 'nutricao' | 'fisioterapia' | 'psicologia' | 'artes_marciais'
  specialtyLabel: string
  title: string
  description?: string
  professionalName: string
  periodization: string
  imageUrl: string
  actionType: 'executar' | 'abrir_plano'
  targetUrl?: string
  status?: string
  created: string
  rawRecord: any
}

// Imagens temáticas via Curling CDN conforme regras de imagem do projeto
const SPECIALTY_IMAGES: Record<string, string> = {
  educacao_fisica: 'https://img.usecurling.com/p/640/360?q=fitness%20workout%20gym',
  nutricao: 'https://img.usecurling.com/p/640/360?q=healthy%20nutrition%20food',
  fisioterapia: 'https://img.usecurling.com/p/640/360?q=physiotherapy%20rehab',
  psicologia: 'https://img.usecurling.com/p/640/360?q=mental%20health%20peace',
  artes_marciais: 'https://img.usecurling.com/p/640/360?q=martial%20arts%20tatame',
}

export default function ExecutarTreinoHub() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<HubItem[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlanItem, setSelectedPlanItem] = useState<HubItem | null>(null)

  const loadAllHubItems = async () => {
    if (!user) return
    setLoading(true)
    try {
      // 1. Treinos de Educação Física (workouts ai_generated=false ou ai_generated=true enviados por profissional ou IA)
      const workoutsPromise = pb
        .collection('workouts')
        .getFullList({
          filter: `student = "${user.id}"`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [])

      // 2. Dietas / Protocolos de Nutrição (diets)
      const dietsPromise = pb
        .collection('diets')
        .getFullList({
          filter: `student = "${user.id}"`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [])

      // 3. Fisioterapia & Reabilitação (protocols)
      const protocolsPromise = pb
        .collection('protocols')
        .getFullList({
          filter: `student = "${user.id}"`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [])

      // 4. Psicologia (clinical_session_logs com categoria psicologia)
      const psychPromise = pb
        .collection('clinical_session_logs')
        .getFullList({
          filter: `student = "${user.id}" && category = "psicologia"`,
          sort: '-session_date,-created',
          expand: 'professional',
        })
        .catch(() => [])

      // 5. Artes Marciais (martial_arts_sessions)
      const martialPromise = pb
        .collection('martial_arts_sessions')
        .getFullList({
          filter: `student = "${user.id}"`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [])

      const [workouts, diets, protocols, psychSessions, martialSessions] = await Promise.all([
        workoutsPromise,
        dietsPromise,
        protocolsPromise,
        psychPromise,
        martialPromise,
      ])

      const hubList: HubItem[] = []

      // Normalizar Workouts
      for (const w of workouts) {
        const prof = (w as any).expand?.professional
        const profName =
          prof?.name || (w.ai_generated ? 'Inteligência Artificial 369' : 'Treinador Credenciado')
        const exercisesCount = Array.isArray(w.exercises) ? w.exercises.length : 0
        const periodization = w.week_number
          ? `Semana ${w.week_number} • Ciclo Ativo`
          : 'Periodização Personalizada'

        hubList.push({
          id: w.id,
          collectionName: 'workouts',
          specialty: 'educacao_fisica',
          specialtyLabel: 'Educação Física & Musculação',
          title: w.title || 'Rotina de Musculação & Biomecânica',
          description: `${exercisesCount} exercícios prescritos • Objetivo: ${w.objective || 'Hipertrofia/Condicionamento'}`,
          professionalName: profName,
          periodization,
          imageUrl: SPECIALTY_IMAGES.educacao_fisica,
          actionType: 'executar',
          targetUrl: `/aluno/treino/execucao/${w.id}`,
          status: w.status || 'ativo',
          created: w.created,
          rawRecord: w,
        })
      }

      // Normalizar Dietas (Nutrição)
      for (const d of diets) {
        const prof = (d as any).expand?.professional
        const profName = prof?.name || 'Nutricionista Credenciado'
        const mealsCount = Array.isArray(d.meals) ? d.meals.length : 0
        const periodization = d.valid_until
          ? `Vigência até ${new Date(d.valid_until).toLocaleDateString('pt-BR')}`
          : 'Plano Nutricional Vigente'

        hubList.push({
          id: d.id,
          collectionName: 'diets',
          specialty: 'nutricao',
          specialtyLabel: 'Nutrição & Dietética',
          title: d.title || 'Protocolo Alimentar & Macronutrientes',
          description: `${mealsCount} refeições estruturadas • Calorias estimadas: ${d.calories ? `${d.calories} kcal` : 'Personalizado'}`,
          professionalName: profName,
          periodization,
          imageUrl: SPECIALTY_IMAGES.nutricao,
          actionType: 'abrir_plano',
          status: 'ativo',
          created: d.created,
          rawRecord: d,
        })
      }

      // Normalizar Fisioterapia (protocols)
      for (const p of protocols) {
        const prof = (p as any).expand?.professional
        const profName = prof?.name || 'Fisioterapeuta Credenciado'
        const stepsCount = Array.isArray(p.steps) ? p.steps.length : 0
        const periodization = `Protocolo Reabilitativo • Nível de Dor: ${p.pain_level || 0}/10`

        hubList.push({
          id: p.id,
          collectionName: 'protocols',
          specialty: 'fisioterapia',
          specialtyLabel: 'Fisioterapia & Reabilitação',
          title: p.title || 'Protocolo Funcional & Biomecânico',
          description: `${stepsCount} passos de mobilidade e fortalecimento terapêutico`,
          professionalName: profName,
          periodization,
          imageUrl: SPECIALTY_IMAGES.fisioterapia,
          actionType: 'abrir_plano',
          status: 'ativo',
          created: p.created,
          rawRecord: p,
        })
      }

      // Normalizar Psicologia
      for (const ps of psychSessions) {
        const prof = (ps as any).expand?.professional
        const profName = prof?.name || 'Psicólogo Credenciado'
        const sessionDate = ps.session_date
          ? new Date(ps.session_date).toLocaleDateString('pt-BR')
          : new Date(ps.created).toLocaleDateString('pt-BR')

        hubList.push({
          id: ps.id,
          collectionName: 'clinical_records',
          specialty: 'psicologia',
          specialtyLabel: 'Psicologia & Mindset',
          title: `Acompanhamento Comportamental (${sessionDate})`,
          description: `Sessão e plano de desenvolvimento esportivo. Status: ${ps.public_status || 'Realizada'}`,
          professionalName: profName,
          periodization: `Atendimento em ${sessionDate} • Sigilo Ético Resguardado`,
          imageUrl: SPECIALTY_IMAGES.psicologia,
          actionType: 'abrir_plano',
          status: ps.public_status || 'concluido',
          created: ps.created,
          rawRecord: ps,
        })
      }

      // Normalizar Artes Marciais
      for (const m of martialSessions) {
        const prof = (m as any).expand?.professional
        const profName = prof?.name || 'Mestre Credenciado'
        const periodization = m.belt_level
          ? `Graduação: ${m.belt_level}`
          : 'Periodização Técnica de Combate'

        hubList.push({
          id: m.id,
          collectionName: 'martial_arts_sessions',
          specialty: 'artes_marciais',
          specialtyLabel: 'Artes Marciais & Lutas',
          title: `Treino de ${m.modality || 'Artes Marciais'}`,
          description:
            m.notes || 'Fundamentos técnicos, postura, sparrings e condicionamento físico.',
          professionalName: profName,
          periodization,
          imageUrl: SPECIALTY_IMAGES.artes_marciais,
          actionType: 'executar',
          status: 'ativo',
          created: m.created,
          rawRecord: m,
        })
      }

      setItems(hubList)
    } catch (err) {
      console.error('Erro ao carregar hub de execução de treinos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllHubItems()
  }, [user])

  // Filtragem
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedSpecialty !== 'todos' && item.specialty !== selectedSpecialty) {
        return false
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const text =
          `${item.title} ${item.professionalName} ${item.description} ${item.periodization}`.toLowerCase()
        if (!text.includes(query)) return false
      }
      return true
    })
  }, [items, selectedSpecialty, searchTerm])

  const countsBySpecialty = useMemo(() => {
    return {
      todos: items.length,
      educacao_fisica: items.filter((i) => i.specialty === 'educacao_fisica').length,
      nutricao: items.filter((i) => i.specialty === 'nutricao').length,
      fisioterapia: items.filter((i) => i.specialty === 'fisioterapia').length,
      psicologia: items.filter((i) => i.specialty === 'psicologia').length,
      artes_marciais: items.filter((i) => i.specialty === 'artes_marciais').length,
    }
  }, [items])

  return (
    <div className="space-y-6">
      {/* HEADER HERO */}
      <Card className="bg-gradient-to-r from-[#181818] via-[#151922] to-[#181818] border border-[#2A2A2A] p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold font-montserrat uppercase bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/30 flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5" /> Central de Execução 369
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold font-montserrat uppercase bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                5 Especialidades
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-montserrat text-white tracking-tight">
              Executar <span className="text-[#D4AF37]">Treino & Protocolos</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 font-inter">
              Concentrador oficial de fichas e protocolos prescritos pelos seus profissionais de
              Educação Física, Nutrição, Fisioterapia, Psicologia e Artes Marciais.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={loadAllHubItems}
              variant="outline"
              size="sm"
              disabled={loading}
              className="border-[#2A2A2A] hover:bg-[#202020] text-gray-300 text-xs rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Link to="/aluno/treino">
              <Button className="bg-[#D4AF37] hover:bg-[#c5a030] text-black font-bold font-montserrat uppercase text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md">
                <Sparkles className="w-3.5 h-3.5" /> Monte Seu Treino (IA)
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* BARRA DE FILTROS & BUSCA */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl shadow-lg space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por profissional, objetivo, modalidade ou ficha..."
            className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white placeholder:text-gray-500 focus:border-[#D4AF37]"
          />
        </div>

        {/* Botoes de Categoria / 5 Especialidades */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2A2A2A]">
          <button
            type="button"
            onClick={() => setSelectedSpecialty('todos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              selectedSpecialty === 'todos'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/30">
              {countsBySpecialty.todos}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSpecialty('educacao_fisica')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              selectedSpecialty === 'educacao_fisica'
                ? 'bg-[#0057FF] text-white shadow-md'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Educação Física</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/30">
              {countsBySpecialty.educacao_fisica}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSpecialty('nutricao')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              selectedSpecialty === 'nutricao'
                ? 'bg-[#22C55E] text-black shadow-md'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>Nutrição</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/30">
              {countsBySpecialty.nutricao}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSpecialty('fisioterapia')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              selectedSpecialty === 'fisioterapia'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Fisioterapia</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/30">
              {countsBySpecialty.fisioterapia}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSpecialty('psicologia')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              selectedSpecialty === 'psicologia'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Psicologia</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/30">
              {countsBySpecialty.psicologia}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSpecialty('artes_marciais')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              selectedSpecialty === 'artes_marciais'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Artes Marciais</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/30">
              {countsBySpecialty.artes_marciais}
            </span>
          </button>
        </div>
      </Card>

      {/* LISTAGEM DOS CARDS NO ESTILO VISUAL DE TREINO IA */}
      {loading ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-16 rounded-2xl flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <p className="text-xs font-bold uppercase font-montserrat text-gray-300">
            Carregando seus treinos e protocolos das 5 especialidades...
          </p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl space-y-3">
          <Dumbbell className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-base font-bold font-montserrat text-white">
            Nenhuma ficha encontrada
          </h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Você ainda não possui treinos ou planos ativos com os filtros selecionados. Conecte-se a
            um profissional ou gere um treino com inteligência artificial.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link to="/aluno/profissionais">
              <Button
                variant="outline"
                className="border-[#2A2A2A] text-xs font-bold uppercase rounded-xl"
              >
                Encontrar Profissional
              </Button>
            </Link>
            <Link to="/aluno/treino">
              <Button className="bg-[#D4AF37] hover:bg-[#c5a030] text-black text-xs font-bold uppercase rounded-xl">
                Monte Seu Treino
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const isPhysical = item.actionType === 'executar'

            return (
              <Card
                key={`${item.collectionName}-${item.id}`}
                className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/70 rounded-2xl overflow-hidden flex flex-col justify-between transition-all hover:shadow-[0_8px_30px_rgba(212,175,55,0.12)] group"
              >
                {/* Imagem de Capa do Treino/Plano */}
                <div className="relative h-44 w-full overflow-hidden bg-black/60">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-black/40" />

                  {/* Badge de Especialidade */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-montserrat uppercase bg-black/80 backdrop-blur-md text-[#D4AF37] border border-[#D4AF37]/50 flex items-center gap-1.5 shadow-md">
                      {item.specialty === 'educacao_fisica' && (
                        <Dumbbell className="w-3 h-3 text-[#0057FF]" />
                      )}
                      {item.specialty === 'nutricao' && (
                        <Apple className="w-3 h-3 text-[#22C55E]" />
                      )}
                      {item.specialty === 'fisioterapia' && (
                        <Activity className="w-3 h-3 text-amber-400" />
                      )}
                      {item.specialty === 'psicologia' && (
                        <Brain className="w-3 h-3 text-purple-400" />
                      )}
                      {item.specialty === 'artes_marciais' && (
                        <Shield className="w-3 h-3 text-red-400" />
                      )}
                      {item.specialtyLabel}
                    </span>
                  </div>

                  {/* Periodização Tag */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-montserrat font-semibold text-white drop-shadow">
                    <span className="truncate max-w-[200px]">{item.periodization}</span>
                    <span className="text-gray-300 font-mono text-[10px]">
                      {new Date(item.created).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-inter">
                      <span>Profissional:</span>
                      <strong className="text-white font-montserrat truncate">
                        {item.professionalName}
                      </strong>
                    </div>

                    <h3 className="font-bold font-montserrat text-white text-base group-hover:text-[#D4AF37] transition-colors line-clamp-1">
                      {item.title}
                    </h3>

                    <p className="text-xs text-gray-400 font-inter line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-3 border-t border-[#2A2A2A] flex items-center gap-2">
                    {isPhysical ? (
                      <div className="w-full flex items-center gap-2">
                        <Button
                          onClick={() => {
                            if (item.targetUrl) {
                              navigate(item.targetUrl)
                            } else {
                              setSelectedPlanItem(item)
                            }
                          }}
                          className="flex-1 bg-[#0057FF] hover:bg-[#1a66ff] text-white font-extrabold font-montserrat uppercase text-xs h-10 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Play className="w-4 h-4 fill-white" /> Iniciar Execução
                        </Button>
                        <Button
                          onClick={() => setSelectedPlanItem(item)}
                          variant="outline"
                          className="border-[#2A2A2A] hover:bg-[#202020] text-gray-300 text-xs font-bold uppercase h-10 px-3 rounded-xl shrink-0"
                          title="Ver Ficha / Detalhes"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setSelectedPlanItem(item)}
                        className="w-full bg-[#D4AF37] hover:bg-[#c5a030] text-black font-extrabold font-montserrat uppercase text-xs h-10 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                      >
                        <FileText className="w-4 h-4" /> Abrir Plano
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL PARA DETALHES DE DIETAS / PROTOCOLOS / SESSÕES */}
      <Dialog open={!!selectedPlanItem} onOpenChange={() => setSelectedPlanItem(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
          {selectedPlanItem && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 uppercase text-[10px]">
                    {selectedPlanItem.specialtyLabel}
                  </Badge>
                  <span className="text-xs text-gray-400 font-mono">
                    {selectedPlanItem.periodization}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold font-montserrat text-white mt-1">
                  {selectedPlanItem.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  Prescrito por:{' '}
                  <strong className="text-gray-200">{selectedPlanItem.professionalName}</strong>
                </DialogDescription>
              </DialogHeader>

              {/* Corpo de Acordo com a Especialidade */}
              {selectedPlanItem.collectionName === 'workouts' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase font-montserrat text-gray-300">
                    Exercícios Prescritos
                  </h4>
                  {Array.isArray(selectedPlanItem.rawRecord.exercises) &&
                  selectedPlanItem.rawRecord.exercises.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedPlanItem.rawRecord.exercises.map((ex: any, idx: number) => (
                        <div
                          key={`hub-ex-${idx}`}
                          className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <strong className="text-white font-montserrat">
                              #{idx + 1} {ex.name || 'Exercício'}
                            </strong>
                            {ex.muscle_group && (
                              <span className="text-[10px] text-gray-400 uppercase bg-[#141414] px-2 py-0.5 rounded border border-[#2A2A2A]">
                                {ex.muscle_group}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-gray-300">
                            {ex.sets && (
                              <span>
                                <strong>Séries:</strong> {ex.sets}
                              </span>
                            )}
                            {ex.reps && (
                              <span>
                                • <strong>Reps:</strong> {ex.reps}
                              </span>
                            )}
                            {ex.load && (
                              <span className="text-[#D4AF37]">
                                • <strong>Carga:</strong> {ex.load}
                              </span>
                            )}
                            {ex.rest && (
                              <span>
                                • <strong>Descanso:</strong> {ex.rest}
                              </span>
                            )}
                          </div>
                          {ex.tips && (
                            <p className="text-[11px] text-gray-400 font-inter italic">
                              💡 {ex.tips}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Nenhum exercício listado nesta ficha.</p>
                  )}
                  {selectedPlanItem.targetUrl && (
                    <Button
                      onClick={() => {
                        navigate(selectedPlanItem.targetUrl!)
                      }}
                      className="w-full bg-[#0057FF] hover:bg-[#1a66ff] text-white font-bold text-xs uppercase h-10 rounded-xl flex items-center justify-center gap-2 mt-2"
                    >
                      <Play className="w-4 h-4 fill-white" /> Iniciar Modo de Execução Guiada
                    </Button>
                  )}
                </div>
              )}

              {selectedPlanItem.collectionName === 'diets' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase font-montserrat text-gray-300">
                    Refeições e Prescrição Nutricional
                  </h4>
                  {Array.isArray(selectedPlanItem.rawRecord.meals) &&
                  selectedPlanItem.rawRecord.meals.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedPlanItem.rawRecord.meals.map((meal: any, idx: number) => (
                        <div
                          key={`meal-${idx}`}
                          className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <strong className="text-white font-montserrat">
                              {meal.name || `Refeição #${idx + 1}`}
                            </strong>
                            <span className="text-[#22C55E] font-mono">{meal.time || ''}</span>
                          </div>
                          <p className="text-gray-300">
                            {meal.foods || meal.description || JSON.stringify(meal)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Plano alimentar estruturado pelo profissional. Consulte seu nutricionista no
                      chat para orientações diárias.
                    </p>
                  )}
                </div>
              )}

              {selectedPlanItem.collectionName === 'protocols' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase font-montserrat text-gray-300">
                    Passos de Reabilitação & Mobilidade
                  </h4>
                  {Array.isArray(selectedPlanItem.rawRecord.steps) &&
                  selectedPlanItem.rawRecord.steps.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedPlanItem.rawRecord.steps.map((st: any, idx: number) => (
                        <div
                          key={`step-${idx}`}
                          className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1 text-xs"
                        >
                          <strong className="text-amber-400 font-montserrat block">
                            Passo {idx + 1}: {st.name || st.title || 'Exercício/Movimento'}
                          </strong>
                          <p className="text-gray-300">
                            {st.description || st.detail || JSON.stringify(st)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Protocolo em vigor. Siga os exercícios de estabilização prescritos pelo seu
                      fisioterapeuta.
                    </p>
                  )}
                </div>
              )}

              {selectedPlanItem.collectionName === 'clinical_records' && (
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold font-montserrat uppercase">
                    <Brain className="w-4 h-4 text-purple-400" /> Atendimento sob Sigilo Ético
                  </div>
                  <p>
                    Conforme o Código de Ética Profissional do Psicólogo (CFP), detalhes clínicos e
                    anotações de sessão são estritamente confidenciais. Seu acompanhamento e
                    presença estão registrados no histórico da plataforma.
                  </p>
                </div>
              )}

              {selectedPlanItem.collectionName === 'martial_arts_sessions' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1">
                    <strong className="text-red-400 font-montserrat block">
                      Notas do Instrutor:
                    </strong>
                    <p className="text-gray-300">
                      {selectedPlanItem.rawRecord.notes || 'Execução técnica padrão da modalidade.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#2A2A2A] flex justify-end gap-2">
                <Button
                  onClick={() => setSelectedPlanItem(null)}
                  variant="outline"
                  className="border-[#2A2A2A] text-xs font-bold uppercase rounded-xl"
                >
                  Fechar
                </Button>
                <Link to="/aluno/chat">
                  <Button className="bg-[#D4AF37] hover:bg-[#c5a030] text-black text-xs font-bold uppercase rounded-xl">
                    Tirar Dúvida no Chat
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

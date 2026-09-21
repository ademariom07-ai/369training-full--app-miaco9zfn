import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  History,
  Sparkles,
  Dumbbell,
  Users,
  FileText,
  ShoppingBag,
  Filter,
  Calendar,
  Lock,
  Eye,
  CheckCircle2,
  Clock,
  ChevronRight,
  ExternalLink,
  Download,
  AlertCircle,
  ShieldCheck,
  Search,
  BookOpen,
  Video,
  Table,
  RefreshCw,
  Activity,
  Award,
} from 'lucide-react'
import type {
  WorkoutRecord,
  ServiceRecord,
  ClinicalRecordModel,
  ClinicalSessionLogRecord,
  MartialArtsProgressRecord,
  ProtocolRecord,
} from '@/services/api'
import type { ContentItem } from '@/pages/profissional/ProfissionalConteudos'

interface ContentPurchaseWithExpand {
  id: string
  created: string
  updated: string
  price_paid: number
  platform_fee?: number
  professional_revenue?: number
  user: string
  content: string
  expand?: {
    content?: ContentItem & {
      expand?: {
        professional_id?: {
          id: string
          name: string
          avatar?: string
        }
      }
    }
  }
}

interface ProfessionalOption {
  id: string
  name: string
}

export default function MeuHistorico() {
  const { user } = useAuth()

  // Tabs de navegação interna do Meu Histórico
  const [activeTab, setActiveTab] = useState<
    'todos' | 'ia' | 'profissionais' | 'fichas' | 'compras'
  >('todos')

  // Loading state
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Dados das 4 categorias
  const [iaWorkouts, setIaWorkouts] = useState<WorkoutRecord[]>([])
  const [profWorkouts, setProfWorkouts] = useState<WorkoutRecord[]>([])
  const [profServices, setProfServices] = useState<ServiceRecord[]>([])
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecordModel[]>([])
  const [sessionLogs, setSessionLogs] = useState<ClinicalSessionLogRecord[]>([])
  const [martialArtsProgress, setMartialArtsProgress] = useState<MartialArtsProgressRecord[]>([])
  const [protocols, setProtocols] = useState<ProtocolRecord[]>([])
  const [purchases, setPurchases] = useState<ContentPurchaseWithExpand[]>([])

  // Filtros
  const [selectedProfId, setSelectedProfId] = useState<string>('todos')
  const [periodoFilter, setPeriodoFilter] = useState<'todos' | '30dias' | '90dias' | 'este_ano'>(
    'todos',
  )
  const [searchTerm, setSearchTerm] = useState('')

  // Modal para detalhe de treino ou ficha
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutRecord | null>(null)
  const [selectedMartialArts, setSelectedMartialArts] = useState<MartialArtsProgressRecord | null>(
    null,
  )
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolRecord | null>(null)
  const [selectedClinicalRecord, setSelectedClinicalRecord] = useState<ClinicalRecordModel | null>(
    null,
  )
  const [selectedSessionLog, setSelectedSessionLog] = useState<ClinicalSessionLogRecord | null>(
    null,
  )

  const loadAllHistoryData = async () => {
    if (!user) return
    try {
      // 1. Treinos gerados por IA (ai_generated = true && student = user.id)
      const iaWorkoutsPromise = pb
        .collection('workouts')
        .getFullList<WorkoutRecord>({
          filter: `student = "${user.id}" && ai_generated = true`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [] as WorkoutRecord[])

      // 2a. Treinos de profissionais (ai_generated = false && student = user.id)
      const profWorkoutsPromise = pb
        .collection('workouts')
        .getFullList<WorkoutRecord>({
          filter: `student = "${user.id}" && ai_generated = false`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [] as WorkoutRecord[])

      // 2b. Serviços concluídos do aluno (coleção services)
      const profServicesPromise = pb
        .collection('services')
        .getFullList<ServiceRecord>({
          filter: `student = "${user.id}" && status = "concluido"`,
          sort: '-completed_at,-created',
          expand: 'professional',
        })
        .catch(() => [] as ServiceRecord[])

      // 3. Fichas de acompanhamento:
      // 3a. clinical_records (as regras do banco protegem psi/fisio — aluno só recebe se cat != psi e cat != fisio)
      const clinicalPromise = pb
        .collection('clinical_records')
        .getFullList<ClinicalRecordModel>({
          filter: `student = "${user.id}"`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [] as ClinicalRecordModel[])

      // 3b. clinical_session_logs (aluno tem listRule: apenas data, public_status e profissional)
      const sessionLogsPromise = pb
        .collection('clinical_session_logs')
        .getFullList<ClinicalSessionLogRecord>({
          filter: `student = "${user.id}"`,
          sort: '-session_date,-created',
          expand: 'professional',
        })
        .catch(() => [] as ClinicalSessionLogRecord[])

      // 3c. martial_arts_progress (artes marciais visíveis em detalhe)
      const martialArtsPromise = pb
        .collection('martial_arts_progress')
        .getFullList<MartialArtsProgressRecord>({
          filter: `student = "${user.id}"`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [] as MartialArtsProgressRecord[])

      // 3d. protocols do aluno
      const protocolsPromise = pb
        .collection('protocols')
        .getFullList<ProtocolRecord>({
          filter: `student = "${user.id}"`,
          sort: '-created',
          expand: 'professional',
        })
        .catch(() => [] as ProtocolRecord[])

      // 4. Conteúdos comprados (content_purchases com expand content e professional)
      const purchasesPromise = pb
        .collection('content_purchases')
        .getFullList<ContentPurchaseWithExpand>({
          filter: `user = "${user.id}"`,
          sort: '-created',
          expand: 'content,content.professional_id',
        })
        .catch(() => [] as ContentPurchaseWithExpand[])

      const [
        resIaWorkouts,
        resProfWorkouts,
        resProfServices,
        resClinical,
        resSessionLogs,
        resMartialArts,
        resProtocols,
        resPurchases,
      ] = await Promise.all([
        iaWorkoutsPromise,
        profWorkoutsPromise,
        profServicesPromise,
        clinicalPromise,
        sessionLogsPromise,
        martialArtsPromise,
        protocolsPromise,
        purchasesPromise,
      ])

      setIaWorkouts(resIaWorkouts)
      setProfWorkouts(resProfWorkouts)
      setProfServices(resProfServices)
      setClinicalRecords(resClinical)
      setSessionLogs(resSessionLogs)
      setMartialArtsProgress(resMartialArts)
      setProtocols(resProtocols)
      setPurchases(resPurchases)
    } catch (err) {
      console.error('Erro ao carregar Meu Histórico do aluno:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAllHistoryData()
  }, [user])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAllHistoryData()
  }

  // Lista única de profissionais presentes nos dados para alimentar o filtro
  const availableProfessionals = useMemo(() => {
    const map = new Map<string, string>()

    const checkAndAdd = (id?: string, name?: string) => {
      if (id && id.trim() && !map.has(id)) {
        map.set(id, name?.trim() || `Profissional #${id.slice(0, 5)}`)
      }
    }

    profWorkouts.forEach((w) => checkAndAdd(w.professional, w.expand?.professional?.name))
    profServices.forEach((s) => checkAndAdd(s.professional, s.expand?.professional?.name))
    clinicalRecords.forEach((c) =>
      checkAndAdd(c.professional, (c.expand?.professional as any)?.name),
    )
    sessionLogs.forEach((s) => checkAndAdd(s.professional, (s.expand?.professional as any)?.name))
    martialArtsProgress.forEach((m) =>
      checkAndAdd(m.professional, (m.expand?.professional as any)?.name),
    )
    protocols.forEach((p) => checkAndAdd(p.professional, p.expand?.professional?.name))
    purchases.forEach((p) => {
      const prof = p.expand?.content?.expand?.professional_id
      if (prof?.id) {
        checkAndAdd(prof.id, prof.name)
      }
    })

    const list: ProfessionalOption[] = []
    map.forEach((name, id) => {
      list.push({ id, name })
    })
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [
    profWorkouts,
    profServices,
    clinicalRecords,
    sessionLogs,
    martialArtsProgress,
    protocols,
    purchases,
  ])

  // Helper de filtro de período
  const matchesPeriod = (dateStr?: string) => {
    if (!dateStr || periodoFilter === 'todos') return true
    const itemDate = new Date(dateStr).getTime()
    const now = Date.now()
    if (periodoFilter === '30dias') {
      return now - itemDate <= 30 * 24 * 60 * 60 * 1000
    }
    if (periodoFilter === '90dias') {
      return now - itemDate <= 90 * 24 * 60 * 60 * 1000
    }
    if (periodoFilter === 'este_ano') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime()
      return itemDate >= startOfYear
    }
    return true
  }

  // Helper de busca textual
  const matchesSearch = (text: string) => {
    if (!searchTerm.trim()) return true
    return text.toLowerCase().includes(searchTerm.toLowerCase().trim())
  }

  // 1. Filtragem Treinos IA
  const filteredIaWorkouts = useMemo(() => {
    return iaWorkouts.filter((w) => {
      if (!matchesPeriod(w.created)) return false
      // IA não tem profissional, portanto se o filtro de profissional estiver ativo em um prof específico, não exibe
      if (selectedProfId !== 'todos') return false
      const textToSearch = `${w.title || ''} ${w.objective || ''} ${JSON.stringify(w.exercises || '')}`
      return matchesSearch(textToSearch)
    })
  }, [iaWorkouts, selectedProfId, periodoFilter, searchTerm])

  // 2. Filtragem Treinos & Serviços Ministrados por Profissionais (agrupados por profissional)
  const filteredProfServices = useMemo(() => {
    return profServices.filter((s) => {
      const dateToCheck = s.completed_at || s.created
      if (!matchesPeriod(dateToCheck)) return false
      if (selectedProfId !== 'todos' && s.professional !== selectedProfId) return false
      const profName = s.expand?.professional?.name || ''
      const textToSearch = `${s.title || ''} ${s.type || ''} ${s.notes || ''} ${profName}`
      return matchesSearch(textToSearch)
    })
  }, [profServices, selectedProfId, periodoFilter, searchTerm])

  const filteredProfWorkouts = useMemo(() => {
    return profWorkouts.filter((w) => {
      if (!matchesPeriod(w.created)) return false
      if (selectedProfId !== 'todos' && w.professional !== selectedProfId) return false
      const profName = w.expand?.professional?.name || ''
      const textToSearch = `${w.title || ''} ${w.objective || ''} ${profName}`
      return matchesSearch(textToSearch)
    })
  }, [profWorkouts, selectedProfId, periodoFilter, searchTerm])

  // Agrupamento dos itens de profissionais por profissional
  const groupedProfessionalActivities = useMemo(() => {
    const groups: Record<
      string,
      {
        profId: string
        profName: string
        workouts: WorkoutRecord[]
        services: ServiceRecord[]
      }
    > = {}

    filteredProfWorkouts.forEach((w) => {
      const pid = w.professional || 'sem_id'
      const pname = w.expand?.professional?.name || 'Profissional Credenciado'
      if (!groups[pid]) {
        groups[pid] = { profId: pid, profName: pname, workouts: [], services: [] }
      }
      groups[pid].workouts.push(w)
    })

    filteredProfServices.forEach((s) => {
      const pid = s.professional || 'sem_id'
      const pname = s.expand?.professional?.name || 'Profissional Credenciado'
      if (!groups[pid]) {
        groups[pid] = { profId: pid, profName: pname, workouts: [], services: [] }
      }
      groups[pid].services.push(s)
    })

    return Object.values(groups)
  }, [filteredProfWorkouts, filteredProfServices])

  // 3. Filtragem Fichas de Acompanhamento (respeitando sigilo estrito)
  // - clinical_session_logs para Psicologia e Fisioterapia (exibição apenas: "Sessão realizada em {data} com {profissional}")
  // - clinicalRecords para Educacao Fisica e Geral (com detalhes)
  // - martialArtsProgress (com detalhes de graduação e técnicas)
  // - protocols (com detalhes de reabilitação/passos)
  const filteredSessionLogs = useMemo(() => {
    return sessionLogs.filter((l) => {
      const date = l.session_date || l.created
      if (!matchesPeriod(date)) return false
      if (selectedProfId !== 'todos' && l.professional !== selectedProfId) return false
      const profName = (l.expand?.professional as any)?.name || ''
      const text = `${l.category} ${l.public_status || ''} ${profName}`
      return matchesSearch(text)
    })
  }, [sessionLogs, selectedProfId, periodoFilter, searchTerm])

  const filteredClinicalRecords = useMemo(() => {
    return clinicalRecords.filter((c) => {
      // Dupla garantia no client para reforçar o sigilo caso algo vazasse
      if (c.category === 'psicologia' || c.category === 'fisioterapia') {
        return false
      }
      if (!matchesPeriod(c.created)) return false
      if (selectedProfId !== 'todos' && c.professional !== selectedProfId) return false
      const profName = (c.expand?.professional as any)?.name || ''
      const text = `${c.title} ${c.category} ${c.summary || ''} ${profName}`
      return matchesSearch(text)
    })
  }, [clinicalRecords, selectedProfId, periodoFilter, searchTerm])

  const filteredMartialArts = useMemo(() => {
    return martialArtsProgress.filter((m) => {
      if (!matchesPeriod(m.created)) return false
      if (selectedProfId !== 'todos' && m.professional !== selectedProfId) return false
      const profName = (m.expand?.professional as any)?.name || ''
      const text = `${m.modality} ${m.current_belt} ${m.next_belt || ''} ${profName}`
      return matchesSearch(text)
    })
  }, [martialArtsProgress, selectedProfId, periodoFilter, searchTerm])

  const filteredProtocols = useMemo(() => {
    return protocols.filter((p) => {
      if (!matchesPeriod(p.created)) return false
      if (selectedProfId !== 'todos' && p.professional !== selectedProfId) return false
      const profName = p.expand?.professional?.name || ''
      const text = `${p.title} ${profName}`
      return matchesSearch(text)
    })
  }, [protocols, selectedProfId, periodoFilter, searchTerm])

  // 4. Filtragem Conteúdos Comprados
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (!matchesPeriod(p.created)) return false
      const content = p.expand?.content
      const profId = content?.professional_id
      if (selectedProfId !== 'todos' && profId !== selectedProfId) return false
      const profName = content?.expand?.professional_id?.name || ''
      const text = `${content?.title || ''} ${content?.description || ''} ${profName}`
      return matchesSearch(text)
    })
  }, [purchases, selectedProfId, periodoFilter, searchTerm])

  // Contadores para os badges das abas
  const totalIa = filteredIaWorkouts.length
  const totalProfAtiv = filteredProfWorkouts.length + filteredProfServices.length
  const totalFichas =
    filteredSessionLogs.length +
    filteredClinicalRecords.length +
    filteredMartialArts.length +
    filteredProtocols.length
  const totalCompras = filteredPurchases.length
  const totalGeral = totalIa + totalProfAtiv + totalFichas + totalCompras

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* HEADER DA SEÇÃO: Dossiê Agregador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-[#141414] border border-[#2A2A2A] shadow-xl relative overflow-hidden">
        {/* Glow dourado decorativo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#D4AF37]/10 via-[#B8962E]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat">
            <History className="w-3.5 h-3.5" />
            Dossiê Integrado do Atleta
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            Meu Histórico • 369TRAINING
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-inter max-w-2xl leading-relaxed">
            Consulte sua evolução esportiva agregada em tempo real: treinos gerados pela IA,
            atendimentos com profissionais credenciados, fichas clínicas protegidas e biblioteca de
            materiais adquiridos.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <Button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            variant="outline"
            className="border-[#2A2A2A] bg-[#181818] hover:bg-[#202020] text-gray-300 hover:text-white text-xs font-bold uppercase rounded-xl flex items-center gap-2"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#D4AF37]' : ''}`}
            />
            Atualizar Dados
          </Button>
          <Link to="/aluno/treino">
            <Button className="bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold text-xs uppercase px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.25)] flex items-center gap-2">
              <Dumbbell className="w-4 h-4" /> Novo Treino
            </Button>
          </Link>
        </div>
      </div>

      {/* PAINEL DE CONTROLE DE FILTROS & BUSCA */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
          {/* Busca por texto */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, exercício, especialista ou modalidade..."
              className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white placeholder:text-gray-500 focus:border-[#D4AF37]"
            />
          </div>

          {/* Filtro por Profissional */}
          <div className="md:col-span-4">
            <select
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="todos">
                Todos os Profissionais ({availableProfessionals.length})
              </option>
              {availableProfessionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Período */}
          <div className="md:col-span-3">
            <select
              value={periodoFilter}
              onChange={(e) => setPeriodoFilter(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="todos">Todo o Período</option>
              <option value="30dias">Últimos 30 dias</option>
              <option value="90dias">Últimos 90 dias</option>
              <option value="este_ano">Ano Atual</option>
            </select>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS COM BADGES */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2A2A2A]">
          <button
            type="button"
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              activeTab === 'todos'
                ? 'bg-[#D4AF37] text-black shadow-md shadow-[#D4AF37]/20'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <span>Visão Geral</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'todos' ? 'bg-black text-[#D4AF37]' : 'bg-[#2A2A2A] text-gray-300'}`}
            >
              {totalGeral}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ia')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              activeTab === 'ia'
                ? 'bg-[#D4AF37] text-black shadow-md shadow-[#D4AF37]/20'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Treinos IA</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'ia' ? 'bg-black text-[#D4AF37]' : 'bg-[#2A2A2A] text-gray-300'}`}
            >
              {totalIa}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profissionais')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              activeTab === 'profissionais'
                ? 'bg-[#D4AF37] text-black shadow-md shadow-[#D4AF37]/20'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Com Profissionais</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'profissionais' ? 'bg-black text-[#D4AF37]' : 'bg-[#2A2A2A] text-gray-300'}`}
            >
              {totalProfAtiv}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fichas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              activeTab === 'fichas'
                ? 'bg-[#D4AF37] text-black shadow-md shadow-[#D4AF37]/20'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Fichas & Avaliações</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'fichas' ? 'bg-black text-[#D4AF37]' : 'bg-[#2A2A2A] text-gray-300'}`}
            >
              {totalFichas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compras')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-montserrat uppercase transition-all flex items-center gap-2 ${
              activeTab === 'compras'
                ? 'bg-[#D4AF37] text-black shadow-md shadow-[#D4AF37]/20'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Materiais Comprados</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'compras' ? 'bg-black text-[#D4AF37]' : 'bg-[#2A2A2A] text-gray-300'}`}
            >
              {totalCompras}
            </span>
          </button>
        </div>
      </Card>

      {/* ESTADO DE CARREGAMENTO */}
      {loading ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-16 rounded-2xl flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <p className="text-xs font-bold uppercase font-montserrat text-gray-300">
            Carregando histórico unificado do atleta...
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          {/* ==============================================================
              SEÇÃO 1: TREINOS GERADOS POR IA
             ============================================================== */}
          {(activeTab === 'todos' || activeTab === 'ia') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-montserrat text-white uppercase">
                      1. Treinos Gerados por IA
                    </h2>
                    <p className="text-xs text-gray-400 font-inter">
                      Rotinas montadas pelo Agente 369 • Objetivos, exercícios e progressão
                      biomecânica
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-[#D4AF37]/40 text-[#D4AF37] bg-[#D4AF37]/10 font-mono text-xs"
                >
                  {filteredIaWorkouts.length} rotinas
                </Badge>
              </div>

              {filteredIaWorkouts.length === 0 ? (
                <Card className="bg-[#181818] border border-[#2A2A2A] p-8 text-center rounded-2xl">
                  <p className="text-xs text-gray-400 font-inter">
                    Nenhum treino de IA encontrado com os filtros aplicados.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredIaWorkouts.map((workout) => {
                    const exerciseCount = Array.isArray(workout.exercises)
                      ? workout.exercises.length
                      : 0
                    const isConcluido = workout.status === 'concluido'
                    return (
                      <Card
                        key={workout.id}
                        className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/60 p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-all hover:shadow-[0_8px_25px_rgba(212,175,55,0.08)] group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> IA 369
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(workout.created).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-bold font-montserrat text-white text-base group-hover:text-[#D4AF37] transition-colors line-clamp-1">
                              {workout.title}
                            </h3>
                            <p className="text-xs text-gray-400 font-inter mt-1 line-clamp-2">
                              <strong>Objetivo:</strong>{' '}
                              {workout.objective || 'Hipertrofia / Condicionamento'}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between text-xs">
                            <span className="text-gray-400 font-inter">Exercícios prescritos:</span>
                            <span className="font-mono font-bold text-white">
                              {exerciseCount} exercícios
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#2A2A2A]">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              isConcluido
                                ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                                : 'bg-gray-800 text-gray-300 border border-gray-700'
                            }`}
                          >
                            {isConcluido ? 'Concluído' : workout.status || 'Ativo'}
                          </span>

                          <Button
                            onClick={() => setSelectedWorkout(workout)}
                            size="sm"
                            variant="outline"
                            className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs font-bold uppercase rounded-xl h-8 px-3 flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Ficha
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              SEÇÃO 2: TREINOS & SERVIÇOS MINISTRADOS POR PROFISSIONAIS
             ============================================================== */}
          {(activeTab === 'todos' || activeTab === 'profissionais') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-montserrat text-white uppercase">
                      2. Treinos & Atendimentos com Profissionais
                    </h2>
                    <p className="text-xs text-gray-400 font-inter">
                      Atendimentos concluídos, serviços validados e treinos prescritos por
                      treinadores
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10 font-mono text-xs"
                >
                  {totalProfAtiv} registros
                </Badge>
              </div>

              {groupedProfessionalActivities.length === 0 ? (
                <Card className="bg-[#181818] border border-[#2A2A2A] p-8 text-center rounded-2xl">
                  <p className="text-xs text-gray-400 font-inter">
                    Nenhum serviço ou treino com profissional encontrado para os filtros
                    selecionados.
                  </p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {groupedProfessionalActivities.map((group) => (
                    <Card
                      key={group.profId}
                      className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl space-y-4"
                    >
                      {/* Cabeçalho do Grupo do Profissional */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#2A2A2A]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#D4AF37]/50 flex items-center justify-center font-bold text-sm text-[#D4AF37]">
                            {group.profName[0] || 'P'}
                          </div>
                          <div>
                            <h3 className="font-bold font-montserrat text-white text-base">
                              {group.profName}
                            </h3>
                            <p className="text-xs text-gray-400 font-inter">
                              Especialista 369 • {group.workouts.length} treino(s) •{' '}
                              {group.services.length} serviço(s) concluído(s)
                            </p>
                          </div>
                        </div>

                        <Link to={`/aluno/chat`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37]/10 uppercase rounded-xl"
                          >
                            Falar no Chat
                          </Button>
                        </Link>
                      </div>

                      {/* Lista de Serviços Concluídos com este Profissional */}
                      {group.services.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold font-montserrat uppercase text-gray-400 tracking-wider">
                            Serviços Concluídos (Pontuam no Ranking)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.services.map((svc) => (
                              <div
                                key={svc.id}
                                className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex flex-col justify-between gap-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-bold text-white font-montserrat">
                                      {svc.title || 'Atendimento de Treino'}
                                    </p>
                                    <p className="text-[11px] text-gray-400 font-inter mt-0.5">
                                      Tipo:{' '}
                                      <strong className="text-gray-300 font-mono">
                                        {svc.type}
                                      </strong>
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 shrink-0">
                                    Concluído ✓
                                  </span>
                                </div>

                                {svc.notes && (
                                  <p className="text-[11px] text-gray-400 font-inter italic line-clamp-1">
                                    &ldquo;{svc.notes}&rdquo;
                                  </p>
                                )}

                                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-[#222]">
                                  <span>
                                    Realizado em:{' '}
                                    {svc.completed_at
                                      ? new Date(svc.completed_at).toLocaleDateString('pt-BR')
                                      : new Date(svc.created).toLocaleDateString('pt-BR')}
                                  </span>
                                  <span className="text-[#22C55E] font-bold">
                                    +1 Serviço Ranking
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lista de Fichas de Treino Prescritas por este Profissional */}
                      {group.workouts.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <h4 className="text-xs font-bold font-montserrat uppercase text-gray-400 tracking-wider">
                            Fichas de Treino Prescritas
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.workouts.map((w) => (
                              <div
                                key={w.id}
                                className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between gap-2"
                              >
                                <div>
                                  <p className="text-xs font-bold text-white font-montserrat">
                                    {w.title}
                                  </p>
                                  <p className="text-[11px] text-gray-400 font-inter">
                                    {Array.isArray(w.exercises) ? w.exercises.length : 0} exercícios
                                    • Prescrito em {new Date(w.created).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => setSelectedWorkout(w)}
                                  size="sm"
                                  variant="outline"
                                  className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs font-bold uppercase rounded-xl h-8 px-3 shrink-0"
                                >
                                  Ver Treino
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              SEÇÃO 3: FICHAS DE ACOMPANHAMENTO (SIGILO ESTRITO)
             ============================================================== */}
          {(activeTab === 'todos' || activeTab === 'fichas') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#0057FF]/15 border border-[#0057FF]/30 text-[#0057FF]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-montserrat text-white uppercase">
                      3. Fichas de Acompanhamento & Saúde
                    </h2>
                    <p className="text-xs text-gray-400 font-inter">
                      Sigilo ético integral (CFP/COFFITO): psicologia e fisioterapia exibem apenas
                      presença; artes marciais e biomecânica exibem detalhes
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-[#0057FF]/40 text-[#0057FF] bg-[#0057FF]/10 font-mono text-xs"
                >
                  {totalFichas} registros
                </Badge>
              </div>

              {/* Box explicativo do sigilo ético */}
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-3 text-xs text-blue-200">
                <Lock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-white font-montserrat uppercase block mb-0.5">
                    Sigilo Profissional Resguardado por Lei
                  </strong>
                  Conforme as diretrizes dos Conselhos Federais de Psicologia e Fisioterapia, notas
                  clínicas confidenciais, diagnósticos e testes de reabilitação detalhados são
                  restritos ao profissional assistente. O aluno visualiza a confirmação pública do
                  atendimento realizado.
                </div>
              </div>

              {totalFichas === 0 ? (
                <Card className="bg-[#181818] border border-[#2A2A2A] p-8 text-center rounded-2xl">
                  <p className="text-xs text-gray-400 font-inter">
                    Nenhuma ficha de acompanhamento registrada até o momento.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 3.1 Registros de Sessões com Sigilo (Psicologia e Fisioterapia) */}
                  {filteredSessionLogs.map((log) => {
                    const profName = (log.expand?.professional as any)?.name || 'Profissional'
                    const dateFormatted = log.session_date
                      ? new Date(log.session_date).toLocaleDateString('pt-BR')
                      : new Date(log.created).toLocaleDateString('pt-BR')

                    const isPsiOrFisio =
                      log.category === 'psicologia' || log.category === 'fisioterapia'

                    return (
                      <Card
                        key={log.id}
                        className="bg-[#181818] border border-[#2A2A2A] hover:border-blue-500/50 p-5 rounded-2xl flex flex-col justify-between space-y-3 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              {log.category.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {dateFormatted}
                            </span>
                          </div>

                          <h4 className="font-bold font-montserrat text-white text-sm">
                            {isPsiOrFisio
                              ? `Sessão realizada em ${dateFormatted} com ${profName}`
                              : `Sessão de ${log.category} com ${profName}`}
                          </h4>

                          <p className="text-xs text-gray-400 font-inter leading-relaxed">
                            {isPsiOrFisio
                              ? 'Atendimento sob sigilo clínico. Presença e cumprimento de protocolo confirmados pelo especialista.'
                              : log.public_status || 'Sessão concluída com êxito.'}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#2A2A2A] flex items-center justify-between text-[11px] text-gray-400">
                          <span className="text-blue-400 font-semibold font-montserrat">
                            Status: {log.public_status || 'Realizada'}
                          </span>
                          <Button
                            onClick={() => setSelectedSessionLog(log)}
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white text-xs h-7 px-2"
                          >
                            Info
                          </Button>
                        </div>
                      </Card>
                    )
                  })}

                  {/* 3.2 Fichas Clínicas de Educação Física / Geral (Visíveis em detalhe) */}
                  {filteredClinicalRecords.map((record) => {
                    const profName =
                      (record.expand?.professional as any)?.name || 'Personal Trainer'
                    return (
                      <Card
                        key={record.id}
                        className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/50 p-5 rounded-2xl flex flex-col justify-between space-y-3 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37]">
                              {record.category.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(record.created).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <h4 className="font-bold font-montserrat text-white text-sm line-clamp-1">
                            {record.title}
                          </h4>

                          <p className="text-xs text-gray-400 font-inter line-clamp-2">
                            {record.summary ||
                              record.functional_goals ||
                              'Avaliação física estruturada.'}
                          </p>

                          <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
                            {record.weight_kg ? (
                              <span className="text-gray-300 bg-[#141414] px-2 py-0.5 rounded border border-[#2A2A2A]">
                                Peso: {record.weight_kg}kg
                              </span>
                            ) : null}
                            {record.body_fat_pct ? (
                              <span className="text-gray-300 bg-[#141414] px-2 py-0.5 rounded border border-[#2A2A2A]">
                                BF: {record.body_fat_pct}%
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#2A2A2A] flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-inter">
                            Por {profName}
                          </span>
                          <Button
                            onClick={() => setSelectedClinicalRecord(record)}
                            size="sm"
                            variant="outline"
                            className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs font-bold uppercase rounded-xl h-8 px-3"
                          >
                            Ver Avaliação
                          </Button>
                        </div>
                      </Card>
                    )
                  })}

                  {/* 3.3 Progresso em Artes Marciais (Visível em detalhe) */}
                  {filteredMartialArts.map((art) => {
                    const profName = (art.expand?.professional as any)?.name || 'Mestre / Instrutor'
                    const techCount = Array.isArray(art.mastered_techniques)
                      ? art.mastered_techniques.length
                      : 0
                    return (
                      <Card
                        key={art.id}
                        className="bg-[#181818] border border-[#2A2A2A] hover:border-[#6A00FF]/50 p-5 rounded-2xl flex flex-col justify-between space-y-3 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-[#6A00FF]/15 border border-[#6A00FF]/30 text-[#9D52FF]">
                              {art.modality || 'Artes Marciais'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(art.created).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold font-montserrat text-white text-base">
                              {art.current_belt} {art.degrees ? `• ${art.degrees}º Grau` : ''}
                            </h4>
                            <p className="text-xs text-gray-400 font-inter mt-0.5">
                              Próxima meta:{' '}
                              <strong className="text-gray-300">
                                {art.next_belt || 'Em avaliação'}
                              </strong>
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs flex justify-between">
                            <span className="text-gray-400">Técnicas dominadas:</span>
                            <span className="font-mono font-bold text-white">
                              {techCount} técnicas
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#2A2A2A] flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-inter">
                            Mestre: {profName}
                          </span>
                          <Button
                            onClick={() => setSelectedMartialArts(art)}
                            size="sm"
                            variant="outline"
                            className="border-[#6A00FF]/40 text-[#9D52FF] hover:bg-[#6A00FF]/10 text-xs font-bold uppercase rounded-xl h-8 px-3"
                          >
                            Ver Graduação
                          </Button>
                        </div>
                      </Card>
                    )
                  })}

                  {/* 3.4 Protocolos de Treino e Reabilitação */}
                  {filteredProtocols.map((proto) => {
                    const profName =
                      proto.expand?.professional?.name || 'Fisioterapeuta / Treinador'
                    const stepsCount = Array.isArray(proto.steps) ? proto.steps.length : 0
                    return (
                      <Card
                        key={proto.id}
                        className="bg-[#181818] border border-[#2A2A2A] hover:border-amber-500/50 p-5 rounded-2xl flex flex-col justify-between space-y-3 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              Protocolo
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(proto.created).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <h4 className="font-bold font-montserrat text-white text-sm line-clamp-1">
                            {proto.title}
                          </h4>

                          <div className="p-2.5 rounded-xl bg-[#141414] border border-[#2A2A2A] text-xs flex justify-between">
                            <span className="text-gray-400">Etapas do protocolo:</span>
                            <span className="font-mono font-bold text-white">
                              {stepsCount} passos
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#2A2A2A] flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-inter">
                            Por {profName}
                          </span>
                          <Button
                            onClick={() => setSelectedProtocol(proto)}
                            size="sm"
                            variant="outline"
                            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs font-bold uppercase rounded-xl h-8 px-3"
                          >
                            Ver Passos
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              SEÇÃO 4: CONTEÚDOS COMPRADOS & MATERIAL DIDÁTICO
             ============================================================== */}
          {(activeTab === 'todos' || activeTab === 'compras') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-montserrat text-white uppercase">
                      4. Conteúdos & Materiais Adquiridos
                    </h2>
                    <p className="text-xs text-gray-400 font-inter">
                      Biblioteca pessoal de e-books, planilhas, calculadoras e aulas didáticas
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-[#D4AF37]/40 text-[#D4AF37] bg-[#D4AF37]/10 font-mono text-xs"
                >
                  {filteredPurchases.length} materiais
                </Badge>
              </div>

              {filteredPurchases.length === 0 ? (
                <Card className="bg-[#181818] border border-[#2A2A2A] p-8 text-center rounded-2xl space-y-3">
                  <ShoppingBag className="w-10 h-10 text-gray-600 mx-auto" />
                  <p className="text-xs text-gray-400 font-inter">
                    Você ainda não adquiriu nenhum material didático ou e-book premium.
                  </p>
                  <Link to="/conteudos">
                    <Button className="bg-[#D4AF37] hover:bg-[#E6C65C] text-black text-xs font-bold uppercase rounded-xl">
                      Explorar Biblioteca de Conteúdos
                    </Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPurchases.map((purchase) => {
                    const content = purchase.expand?.content
                    const prof = content?.expand?.professional_id
                    const downloadUrl = content?.file
                      ? pb.files.getURL(content, content.file)
                      : content?.file_url

                    return (
                      <Card
                        key={purchase.id}
                        className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/60 p-5 rounded-2xl flex flex-col justify-between space-y-3 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold font-montserrat uppercase px-2 py-0.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Adquirido
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              Comprado em {new Date(purchase.created).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <h4 className="font-bold font-montserrat text-white text-base line-clamp-1">
                            {content?.title || 'Material Didático 369'}
                          </h4>

                          <p className="text-xs text-gray-400 font-inter line-clamp-2">
                            {content?.description ||
                              'Conteúdo exclusivo para suporte de treinos e dieta.'}
                          </p>

                          <div className="text-[11px] text-gray-400 font-inter pt-1">
                            Autor:{' '}
                            <strong className="text-white">
                              {prof?.name || 'Especialista 369'}
                            </strong>{' '}
                            • Valor pago: R$ {purchase.price_paid.toFixed(2)}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#2A2A2A]">
                          {downloadUrl ? (
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2.5 px-4 bg-[#D4AF37] hover:bg-[#E6C65C] text-black font-extrabold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                            >
                              <Download className="w-3.5 h-3.5" /> Acessar / Baixar Material
                            </a>
                          ) : (
                            <Link to="/conteudos">
                              <Button
                                variant="outline"
                                className="w-full border-[#2A2A2A] text-gray-300 text-xs font-bold uppercase rounded-xl"
                              >
                                Ver na Biblioteca
                              </Button>
                            </Link>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==============================================================
          MODAIS DE DETALHE DE FICHAS & TREINOS
         ============================================================== */}

      {/* Modal 1: Detalhe do Treino (IA ou Profissional) */}
      <Dialog open={!!selectedWorkout} onOpenChange={() => setSelectedWorkout(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
          {selectedWorkout && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                    {selectedWorkout.ai_generated
                      ? 'Treino Gerado por IA'
                      : 'Treino com Profissional'}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(selectedWorkout.created).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold font-montserrat text-white mt-1">
                  {selectedWorkout.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 font-inter">
                  Objetivo:{' '}
                  <strong className="text-gray-200">{selectedWorkout.objective || 'Geral'}</strong>
                </DialogDescription>
              </DialogHeader>

              {/* Lista de Exercícios */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold font-montserrat uppercase text-gray-300">
                  Exercícios Prescritos
                </h4>

                {Array.isArray(selectedWorkout.exercises) &&
                selectedWorkout.exercises.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedWorkout.exercises.map((ex: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-montserrat text-white">
                            #{idx + 1} {ex.name || 'Exercício'}
                          </span>
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 2: Detalhe de Graduação em Artes Marciais */}
      <Dialog open={!!selectedMartialArts} onOpenChange={() => setSelectedMartialArts(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          {selectedMartialArts && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#9D52FF]" />
                  {selectedMartialArts.modality} • {selectedMartialArts.current_belt}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  Graduação registrada pelo Mestre{' '}
                  <strong className="text-gray-200">
                    {(selectedMartialArts.expand?.professional as any)?.name || 'Responsável'}
                  </strong>
                </DialogDescription>
              </DialogHeader>

              <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Graus conquistados:</span>
                  <span className="font-bold text-white">
                    {selectedMartialArts.degrees || 0}º Grau
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Próxima faixa almejada:</span>
                  <span className="font-bold text-[#9D52FF]">
                    {selectedMartialArts.next_belt || 'Em avaliação'}
                  </span>
                </div>
                {selectedMartialArts.performance_score ? (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Score de performance:</span>
                    <span className="font-bold text-[#22C55E]">
                      {selectedMartialArts.performance_score}/100
                    </span>
                  </div>
                ) : null}
              </div>

              {Array.isArray(selectedMartialArts.mastered_techniques) &&
                selectedMartialArts.mastered_techniques.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold font-montserrat uppercase text-gray-300">
                      Técnicas Aprovadas pelo Mestre
                    </h5>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedMartialArts.mastered_techniques.map((t: any, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-[#181818] border border-[#2A2A2A] text-xs flex items-center justify-between"
                        >
                          <span className="text-white font-medium">
                            {t.name || `Técnica #${i + 1}`}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Validada ✓'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 3: Detalhe de Protocolo */}
      <Dialog open={!!selectedProtocol} onOpenChange={() => setSelectedProtocol(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          {selectedProtocol && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold font-montserrat text-white uppercase">
                  {selectedProtocol.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  Protocolo prescrito em{' '}
                  {new Date(selectedProtocol.created).toLocaleDateString('pt-BR')}
                </DialogDescription>
              </DialogHeader>

              {Array.isArray(selectedProtocol.steps) && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold font-montserrat uppercase text-gray-300">
                    Etapas:
                  </h5>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedProtocol.steps.map((st: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs space-y-1"
                      >
                        <strong className="text-[#D4AF37] block font-montserrat">
                          Passo {i + 1}: {st.name || st.title || 'Fase'}
                        </strong>
                        <p className="text-gray-300">
                          {st.description || st.detail || JSON.stringify(st)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 4: Detalhe de Avaliação Física Aberta */}
      <Dialog open={!!selectedClinicalRecord} onOpenChange={() => setSelectedClinicalRecord(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          {selectedClinicalRecord && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold font-montserrat text-white uppercase">
                  {selectedClinicalRecord.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  Categoria:{' '}
                  <strong className="text-gray-200">
                    {selectedClinicalRecord.category.toUpperCase()}
                  </strong>{' '}
                  • {new Date(selectedClinicalRecord.created).toLocaleDateString('pt-BR')}
                </DialogDescription>
              </DialogHeader>

              <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-2 text-xs">
                {selectedClinicalRecord.summary && (
                  <p className="text-gray-300">
                    <strong>Resumo:</strong> {selectedClinicalRecord.summary}
                  </p>
                )}
                {selectedClinicalRecord.functional_goals && (
                  <p className="text-gray-300">
                    <strong>Metas Funcionais:</strong> {selectedClinicalRecord.functional_goals}
                  </p>
                )}
                <div className="flex gap-4 pt-2 font-mono">
                  {selectedClinicalRecord.weight_kg ? (
                    <span>Peso: {selectedClinicalRecord.weight_kg} kg</span>
                  ) : null}
                  {selectedClinicalRecord.body_fat_pct ? (
                    <span>Gordura: {selectedClinicalRecord.body_fat_pct} %</span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 5: Informação de Sessão Confidencial */}
      <Dialog open={!!selectedSessionLog} onOpenChange={() => setSelectedSessionLog(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          {selectedSessionLog && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-500/30 text-xs font-bold text-blue-400 font-montserrat w-fit">
                  <Lock className="w-3.5 h-3.5" /> Sessão de{' '}
                  {selectedSessionLog.category.toUpperCase()}
                </div>
                <DialogTitle className="text-lg font-bold font-montserrat text-white mt-1">
                  Confirmação de Presença
                </DialogTitle>
              </DialogHeader>

              <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-2 text-xs text-gray-300">
                <p>
                  <strong>Profissional:</strong>{' '}
                  {(selectedSessionLog.expand?.professional as any)?.name ||
                    'Especialista Credenciado'}
                </p>
                <p>
                  <strong>Data da Sessão:</strong>{' '}
                  {selectedSessionLog.session_date
                    ? new Date(selectedSessionLog.session_date).toLocaleDateString('pt-BR')
                    : new Date(selectedSessionLog.created).toLocaleDateString('pt-BR')}
                </p>
                <p>
                  <strong>Status Público:</strong>{' '}
                  {selectedSessionLog.public_status || 'Sessão concluída'}
                </p>
                <div className="pt-2 border-t border-[#2A2A2A] text-[11px] text-gray-400">
                  🔒 Notas e anotações técnicas permanecem sob sigilo ético confidencial do
                  especialista.
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

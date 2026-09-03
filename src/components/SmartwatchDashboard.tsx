import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { api, WearableConnectionRecord, WearableMetricRecord } from '@/services/api'
import pb from '@/lib/pocketbase/client'
import {
  Watch,
  Heart,
  Moon,
  Flame,
  Activity,
  Footprints,
  Sparkles,
  AlertTriangle,
  Lock,
  RefreshCw,
  Clock,
  Compass,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

interface SmartwatchDashboardProps {
  userRole: 'aluno' | 'profissional'
  userPlan: string
}

export const SmartwatchDashboard: React.FC<SmartwatchDashboardProps> = ({ userRole, userPlan }) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [apiStatus, setApiStatus] = useState<{
    is_configured: boolean
    aggregator: string
    supported_devices: Array<{ id: string; name: string; icon: string }>
    metrics_included: string[]
    message: string
  } | null>(null)

  const [activeConnection, setActiveConnection] = useState<WearableConnectionRecord | null>(null)
  const [latestMetric, setLatestMetric] = useState<WearableMetricRecord | null>(null)

  // Regra de Gate de Plano confirmada:
  // Alunos/clientes: todos os planos (Grátis, Básico, Pro, Premium)
  // Profissionais/parceiros: Pro e Premium (NÃO disponível para Básico ou Grátis)
  const normalizedPlan = (userPlan || 'gratis').toLowerCase()
  const hasPlanAccess =
    userRole === 'aluno' ||
    (userRole === 'profissional' && (normalizedPlan === 'pro' || normalizedPlan === 'premium'))

  const isProfessionalLocked = userRole === 'profissional' && !hasPlanAccess

  useEffect(() => {
    loadSmartwatchData()
  }, [user])

  const loadSmartwatchData = async () => {
    setLoading(true)
    try {
      // 1. Obter status do backend sobre a API agregadora
      try {
        const statusRes = await api.getWearablesStatus()
        setApiStatus(statusRes)
      } catch (err) {
        setApiStatus({
          is_configured: false,
          aggregator: 'terra',
          supported_devices: [
            { id: 'apple_watch', name: 'Apple Watch', icon: 'watch' },
            { id: 'garmin', name: 'Garmin', icon: 'watch' },
            { id: 'fitbit', name: 'Fitbit', icon: 'watch' },
            { id: 'xiaomi', name: 'Xiaomi / Mi Band', icon: 'watch' },
            { id: 'samsung', name: 'Samsung Galaxy Watch', icon: 'watch' },
            { id: 'polar', name: 'Polar', icon: 'watch' },
            { id: 'whoop', name: 'Whoop', icon: 'watch' },
            { id: 'suunto', name: 'Suunto', icon: 'watch' },
            { id: 'strava', name: 'Strava', icon: 'watch' },
          ],
          metrics_included: ['passos', 'batimentos', 'sono', 'calorias', 'treinos'],
          message: 'Integração em homologação',
        })
      }

      // 2. Buscar conexões existentes e métricas
      if (user?.id) {
        try {
          const conns = await pb
            .collection('wearable_connections')
            .getList<WearableConnectionRecord>(1, 1, {
              filter: `user = "${user.id}" && status = "connected"`,
              sort: '-updated',
            })
          if (conns.items.length > 0) {
            setActiveConnection(conns.items[0])
          }
        } catch {
          /* intentionally ignored */
        }

        try {
          const metrics = await pb
            .collection('wearable_metrics')
            .getList<WearableMetricRecord>(1, 1, {
              filter: `user = "${user.id}"`,
              sort: '-date',
            })
          if (metrics.items.length > 0) {
            setLatestMetric(metrics.items[0])
          }
        } catch {
          /* intentionally ignored */
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (providerId: string) => {
    if (isProfessionalLocked) {
      toast.error(
        'Sincronização com smartwatch disponível apenas para profissionais nos planos Pro e Premium.',
      )
      return
    }

    setConnecting(true)
    try {
      const res = await api.createWearableConnectSession({
        success_url: window.location.href,
      })

      if (res.upgrade_required) {
        toast.error(res.error || 'Upgrade de plano necessário para sincronizar com smartwatch.')
        return
      }

      // Se a chave real estiver configurada e retornar URL do widget
      if (res.url) {
        window.location.href = res.url
        return
      }

      // Se estiver no estado PREPARADO MAS INATIVO (sem chave real ainda)
      toast.info(
        'Integração preparada! A sincronização em tempo real será ativada automaticamente assim que as credenciais da API agregadora forem adicionadas no backend.',
        { duration: 6000 },
      )
    } catch (err: any) {
      toast.info(
        'A estrutura do Smartwatch está pronta no sistema. Aguardando ativação da chave da API agregadora (Terra/Spike).',
      )
    } finally {
      setConnecting(false)
    }
  }

  // Lista de relógios suportados conforme decisão 5 do usuário
  const devices = [
    {
      id: 'apple_watch',
      name: 'Apple Watch',
      brand: 'Apple',
      desc: 'WatchOS, batimentos, passos e treinos',
      icon: Watch,
      color: 'from-zinc-500 to-zinc-700',
    },
    {
      id: 'garmin',
      name: 'Garmin',
      brand: 'Garmin Connect',
      desc: 'Treinos avançados, VO2, sono e batimentos',
      icon: Compass,
      color: 'from-blue-600 to-blue-800',
    },
    {
      id: 'fitbit',
      name: 'Fitbit',
      brand: 'Google Fitbit',
      desc: 'Passos, sono detalhado e calorias',
      icon: Activity,
      color: 'from-emerald-600 to-teal-800',
    },
    {
      id: 'xiaomi',
      name: 'Xiaomi / Mi Band',
      brand: 'Mi Fitness / Zepp',
      desc: 'Batimentos, passos diários e sono',
      icon: Watch,
      color: 'from-orange-500 to-amber-600',
    },
    {
      id: 'samsung',
      name: 'Samsung Galaxy Watch',
      brand: 'Samsung Health',
      desc: 'Wear OS, composição corporal e treinos',
      icon: Watch,
      color: 'from-indigo-600 to-indigo-800',
    },
    {
      id: 'polar',
      name: 'Polar',
      brand: 'Polar Flow',
      desc: 'Cintas cardíacas, Vantage, Grit X e Pacer',
      icon: Heart,
      color: 'from-red-600 to-rose-700',
    },
    {
      id: 'whoop',
      name: 'Whoop',
      brand: 'Whoop 4.0',
      desc: 'Strain, recuperação, sono e HRV',
      icon: Zap,
      color: 'from-neutral-800 to-black',
    },
    {
      id: 'suunto',
      name: 'Suunto',
      brand: 'Suunto App',
      desc: 'Corrida em trilha, natação e endurance',
      icon: Compass,
      color: 'from-amber-600 to-red-600',
    },
    {
      id: 'strava',
      name: 'Strava',
      brand: 'Strava Community',
      desc: 'Sincronização de pedal, corrida e atividades',
      icon: Flame,
      color: 'from-orange-600 to-orange-700',
    },
  ]

  // Se o profissional não tiver o plano Pro/Premium: GATE DE PLANO
  if (isProfessionalLocked) {
    return (
      <Card className="bg-[#181818] border-2 border-amber-500/30 p-8 rounded-3xl text-center space-y-5 max-w-2xl mx-auto my-6 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-montserrat uppercase">
            Disponibilidade por Plano
          </Badge>
          <h2 className="text-xl sm:text-2xl font-bold font-montserrat text-white">
            Smartwatch Exclusivo para Parceiros Pro e Premium
          </h2>
          <p className="text-sm text-gray-300 font-inter max-w-lg mx-auto">
            A sincronização automática de dados fisiológicos (Apple Watch, Garmin, Fitbit, Xiaomi,
            Samsung, Polar e outros) está disponível para parceiros a partir do{' '}
            <strong>Plano Pro</strong>.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#141414] border border-[#2A2A2A] text-left text-xs text-gray-400 space-y-1">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Watch className="w-4 h-4 text-[#D4AF37]" /> Recursos inclusos no Pro/Premium:
          </div>
          <p>• Monitoramento de batimentos, sono, calorias ativas e passos</p>
          <p>• Sincronização direta de treinos realizados pelos seus alunos</p>
          <p>• Acesso à API agregadora multi-dispositivo</p>
        </div>

        <Link to="/profissional/perfil">
          <Button className="bg-[#D4AF37] hover:bg-[#c5a030] text-black font-bold font-montserrat uppercase px-6 py-2 rounded-xl">
            Fazer Upgrade para Plano Pro
          </Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER DA INTEGRAÇÃO SMARTWATCH */}
      <Card className="bg-gradient-to-r from-[#181818] via-[#151922] to-[#181818] border border-[#2A2A2A] p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold font-montserrat uppercase bg-[#0057FF]/15 text-[#0057FF] border border-[#0057FF]/30 flex items-center gap-1.5">
                <Watch className="w-3.5 h-3.5" /> Caminho A — API Agregadora
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold font-montserrat uppercase bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                v0.0.52
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-montserrat text-white tracking-tight">
              Sincronização com <span className="text-[#D4AF37]">Smartwatch</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 font-inter">
              Conecte seu relógio inteligente para monitorar batimentos cardíacos, sono, passos,
              treinos e queima calórica diretamente no seu ecossistema 369TRAINING.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={loadSmartwatchData}
              variant="outline"
              size="sm"
              disabled={loading}
              className="border-[#2A2A2A] hover:bg-[#202020] text-gray-300 text-xs rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </Button>
          </div>
        </div>
      </Card>

      {/* ESTADO ELEGANTE "EM BREVE" / STATUS DA API AGREGADORA */}
      {!apiStatus?.is_configured && (
        <Card className="bg-gradient-to-br from-[#1b1914] to-[#141414] border-2 border-[#D4AF37]/40 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <Watch className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 text-[10px] font-montserrat uppercase font-bold">
                    Integração Preparada — Em Breve Ativação Oficial
                  </Badge>
                </div>
                <h3 className="text-lg font-bold font-montserrat text-white">
                  Estrutura Pronta para Sincronização em Tempo Real
                </h3>
                <p className="text-xs text-gray-300 font-inter max-w-2xl leading-relaxed">
                  Toda a arquitetura de conexão, processamento de métricas (passos, batimentos,
                  sono, calorias e treinos) e webhooks está finalizada. A ativação dos relógios
                  entrará em vigor instantaneamente assim que as credenciais do agregador (Terra ou
                  Spike API) forem registradas no painel.
                </p>
              </div>
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <div className="p-3 rounded-2xl bg-[#111111] border border-[#2A2A2A] text-left text-[11px] font-mono space-y-1">
                <div className="text-gray-400 font-bold uppercase text-[10px]">
                  Configuração Backend:
                </div>
                <div className="text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Segredo: <code className="text-[#D4AF37]">TERRA_API_KEY</code>
                </div>
                <div className="text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Webhook: <code className="text-[#0057FF]">/backend/v1/wearables/webhook</code>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* DASHBOARD DE MÉTRICAS (PASSOS, BATIMENTOS, SONO, CALORIAS, TREINOS) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Passos */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              Passos Diários
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#0057FF]/10 text-[#0057FF] flex items-center justify-center">
              <Footprints className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {latestMetric?.steps !== undefined ? latestMetric.steps.toLocaleString('pt-BR') : '—'}
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            {latestMetric?.date ? `Data: ${latestMetric.date}` : 'Meta diária: 10.000'}
          </span>
        </Card>

        {/* Batimentos */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              Freq. Cardíaca
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {latestMetric?.heart_rate_avg ? `${latestMetric.heart_rate_avg} bpm` : '—'}
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            {latestMetric?.heart_rate_min && latestMetric?.heart_rate_max
              ? `Min ${latestMetric.heart_rate_min} / Max ${latestMetric.heart_rate_max}`
              : 'Média de repouso'}
          </span>
        </Card>

        {/* Sono */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              Sono
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-300">
            {latestMetric?.sleep_duration_seconds
              ? `${Math.floor(latestMetric.sleep_duration_seconds / 3600)}h ${Math.floor(
                  (latestMetric.sleep_duration_seconds % 3600) / 60,
                )}m`
              : '—'}
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            {latestMetric?.sleep_score
              ? `Score: ${latestMetric.sleep_score}/100`
              : 'Monitoramento contínuo'}
          </span>
        </Card>

        {/* Calorias */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              Calorias Ativas
            </span>
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-orange-400">
            {latestMetric?.calories_active !== undefined
              ? `${latestMetric.calories_active} kcal`
              : '—'}
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            {latestMetric?.calories_total
              ? `Total: ${latestMetric.calories_total} kcal`
              : 'Gasto metabólico'}
          </span>
        </Card>

        {/* Treinos */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 font-montserrat uppercase font-bold">
              Treinos Hoje
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#22C55E]/10 text-[#22C55E] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-[#22C55E]">
            {latestMetric?.workouts_count !== undefined ? latestMetric.workouts_count : '—'}
          </div>
          <span className="text-[10px] text-gray-500 font-inter">
            {latestMetric?.distance_meters
              ? `${(latestMetric.distance_meters / 1000).toFixed(1)} km rodados`
              : 'Sessões registradas'}
          </span>
        </Card>
      </div>

      {/* DISPOSITIVOS SUPORTADOS (DECISÃO 5 DO USUÁRIO) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
            <Watch className="w-5 h-5 text-[#D4AF37]" /> Relógios e Dispositivos Suportados
          </h2>
          <p className="text-xs text-gray-400 font-inter">
            Suporte universal aos principais fabricantes do mercado através da API agregadora
            homologada.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
            const Icon = device.icon
            const isConnected =
              activeConnection?.provider === device.id && activeConnection.status === 'connected'

            return (
              <Card
                key={device.id}
                className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/50 p-5 rounded-2xl transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${device.color} flex items-center justify-center text-white shadow-md`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white font-montserrat">
                        {device.name}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-mono block">
                        {device.brand}
                      </span>
                    </div>
                  </div>

                  {isConnected ? (
                    <Badge className="bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 text-[10px]">
                      Conectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-[#2A2A2A] text-gray-400 text-[10px]">
                      Pronto
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-gray-400 font-inter leading-relaxed">{device.desc}</p>

                <div className="pt-2 border-t border-[#2A2A2A]">
                  <Button
                    onClick={() => handleConnect(device.id)}
                    disabled={connecting}
                    size="sm"
                    className={`w-full text-xs font-bold font-montserrat uppercase rounded-xl transition-all ${
                      isConnected
                        ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 hover:bg-[#22C55E]/30'
                        : 'bg-[#1e1e1e] hover:bg-[#D4AF37] hover:text-black text-white border border-[#333]'
                    }`}
                  >
                    {isConnected ? 'Sincronizado' : 'Conectar Relógio'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

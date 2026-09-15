import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  BrainCircuit,
  Moon,
  Flame,
  UserX,
  CheckCircle,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

export interface AdherenceAlert {
  id: string
  studentId: string
  studentName: string
  type: 'stopped_training' | 'poor_sleep' | 'reported_pain'
  severity: 'high' | 'medium' | 'low'
  message: string
  detectedAt: string
  metricValue: string
  suggestedAction: string
}

const MOCK_ALERTS: AdherenceAlert[] = [
  {
    id: 'alt-1',
    studentId: 'st-01',
    studentName: 'Lucas Ferreira',
    type: 'stopped_training',
    severity: 'high',
    message:
      '[TESTE] Aluno não registra treinos há 6 dias consecutivos (frequência usual: 4x/semana).',
    detectedAt: 'Hoje, 08:30',
    metricValue: 'Ausente há 6d',
    suggestedAction:
      'Enviar mensagem de reengajamento e checar possíveis lesões ou rotina profissional intensa.',
  },
  {
    id: 'alt-2',
    studentId: 'st-02',
    studentName: 'Mariana Costa',
    type: 'poor_sleep',
    severity: 'medium',
    message:
      '[TESTE] Sono ruim recorrente detectado pelo smartwatch: 3 noites com < 5h de sono e baixa variabilidade da FC (VFC).',
    detectedAt: 'Ontem, 21:15',
    metricValue: 'Média 4h42m',
    suggestedAction:
      'Adequar volume de treino do ciclo para evitar overtraining e reforçar higiene do sono.',
  },
  {
    id: 'alt-3',
    studentId: 'st-03',
    studentName: 'Rodrigo Alves',
    type: 'reported_pain',
    severity: 'high',
    message:
      '[TESTE] Dor reportada no joelho direito (Escala Visual Analógica EVA 6/10) após treino de agachamento pesado.',
    detectedAt: 'Hoje, 10:12',
    metricValue: 'EVA 6/10',
    suggestedAction:
      'Substituir exercícios de cadeia cinética fechada com flexão profunda e solicitar avaliação fisioterápica.',
  },
]

export function PainelCarteiraIA() {
  const [alerts, setAlerts] = useState<AdherenceAlert[]>(MOCK_ALERTS)
  const [resolvedIds, setResolvedIds] = useState<string[]>([])

  const handleResolve = (id: string, name: string) => {
    setResolvedIds((prev) => [...prev, id])
    toast.success(`Alerta de ${name} marcado como tratado com sucesso!`)
  }

  const activeAlerts = alerts.filter((a) => !resolvedIds.includes(a.id))

  return (
    <Card className="bg-[#181818] border border-[#D4AF37]/40 p-6 rounded-2xl shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2A2A2A]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] uppercase tracking-wider font-montserrat">
              <BrainCircuit className="w-4 h-4 text-[#D4AF37]" /> Painel de Carteira com IA •
              Alertas Preditivos
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
              Aderência & Prevenção
            </span>
          </div>
          <h2 className="text-xl font-black font-montserrat text-white uppercase">
            Radar de Aderência da Carteira
          </h2>
          <p className="text-xs text-gray-400 font-inter mt-0.5">
            Monitoramento de alunos que pararam de treinar, sono ruim recorrente ou dores reportadas
            em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-bold font-montserrat flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            {activeAlerts.length} Atenção Prioritária
          </span>
        </div>
      </div>

      {/* Grid de Alertas */}
      {activeAlerts.length === 0 ? (
        <div className="p-8 text-center bg-black/20 rounded-xl border border-white/5 space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="text-sm font-bold text-white font-montserrat">
            Todos os alunos da carteira estão com aderência excelente!
          </p>
          <p className="text-xs text-gray-400 font-inter">
            Nenhum padrão de abandono, dor articular ou privação crônica de sono detectado nas
            últimas 24h.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map((alt) => {
            const isPain = alt.type === 'reported_pain'
            const isSleep = alt.type === 'poor_sleep'
            const isStopped = alt.type === 'stopped_training'

            return (
              <div
                key={alt.id}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isPain
                    ? 'bg-red-950/20 border-red-500/40'
                    : isSleep
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-purple-950/20 border-purple-500/40'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                      isPain
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : isSleep
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                    }`}
                  >
                    {isPain ? (
                      <Flame className="w-5 h-5" />
                    ) : isSleep ? (
                      <Moon className="w-5 h-5" />
                    ) : (
                      <UserX className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold font-montserrat text-white">
                        {alt.studentName}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-gray-300 border border-white/10 font-bold">
                        {alt.metricValue}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">{alt.detectedAt}</span>
                    </div>

                    <p className="text-xs text-gray-200 font-inter leading-relaxed">
                      {alt.message}
                    </p>

                    <p className="text-[11px] text-[#D4AF37] font-inter pt-1">
                      <strong>Recomendação IA:</strong> {alt.suggestedAction}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                  <Link to="/profissional/alunos" className="flex-1 md:flex-initial">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/10 text-xs font-bold font-montserrat"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1" /> Contatar
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => handleResolve(alt.id, alt.studentName)}
                    className="flex-1 md:flex-initial bg-[#22C55E] text-black hover:bg-[#1eb354] text-xs font-bold font-montserrat"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Marcar Tratado
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

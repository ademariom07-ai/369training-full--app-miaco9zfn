import React, { useState, useEffect, useRef } from 'react'
import {
  Brain,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Flame,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  CheckCircle2,
  Lock,
  ChevronDown,
  Apple,
  Activity,
  Swords,
  Dumbbell,
  Clock,
  User,
  ShieldCheck,
  FileText,
  HelpCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/UserAvatar'
import type { UserProfile } from '@/contexts/AuthContext'
import {
  analisarAlunoComIa,
  registrarImportacaoCsv,
  parseCsvFileContent,
  fetchHistoricoInsights,
  type StudentAnalysisMetrics,
  type AiInsightRecord,
  type ParsedCsvSummary,
} from '@/services/analistaEvolucao'

interface PainelInsightsIAProps {
  students: UserProfile[]
  currentProfId: string
}

export function PainelInsightsIA({ students, currentProfId }: PainelInsightsIAProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [analyzedContent, setAnalyzedContent] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<StudentAnalysisMetrics | null>(null)
  const [insightsHistory, setInsightsHistory] = useState<AiInsightRecord[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvSummary, setCsvSummary] = useState<ParsedCsvSummary | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Selecionar primeiro aluno por padrão
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id)
    }
  }, [students, selectedStudentId])

  // Carregar histórico de análises quando troca de aluno (não bloqueante)
  useEffect(() => {
    if (selectedStudentId) {
      fetchHistoricoInsights(selectedStudentId)
        .then((items) => {
          setInsightsHistory(items)
          if (items.length > 0 && !analyzedContent) {
            setAnalyzedContent(items[0].content)
            if (items[0].metrics_snapshot) {
              setMetrics(items[0].metrics_snapshot)
            }
          }
        })
        .catch((err) => {
          console.warn('Aviso: falha silenciosa ao carregar histórico de insights:', err)
        })
    }
  }, [selectedStudentId])

  const selectedStudent = students.find((s) => s.id === selectedStudentId)

  // Handler para processar arquivo CSV no client-side
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    setCsvSuccessMsg(null)
    setErrorMsg(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (!text) return
      try {
        const parsed = parseCsvFileContent(text)
        setCsvSummary(parsed)
      } catch (err: unknown) {
        setErrorMsg(
          'Erro ao ler formato CSV: ' + (err instanceof Error ? err.message : String(err)),
        )
      }
    }
    reader.readAsText(file)
  }

  // Executar a análise com o agente nativo "analista-evolucao"
  const handleGerarAnalise = async () => {
    if (!selectedStudentId) {
      setErrorMsg('Selecione um aluno para analisar.')
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setCsvSuccessMsg(null)

    try {
      let csvImportId: string | undefined

      // Se houver CSV carregado, registrar primeiro
      if (csvFile && csvSummary) {
        setCsvUploading(true)
        try {
          const csvRes = await registrarImportacaoCsv({
            studentId: selectedStudentId,
            fileName: csvFile.name,
            rowCount: csvSummary.rowCount,
            columnsDetected: csvSummary.headers,
            parsedSummary: {
              preview: csvSummary.previewRows,
              summary: csvSummary.summaryText,
            },
          })
          csvImportId = csvRes.csv_import_id
          setCsvSuccessMsg(`✓ Planilha "${csvFile.name}" incorporada à análise com sucesso!`)
        } catch (csvErr: unknown) {
          console.warn('Aviso: falha ao salvar log do CSV:', csvErr)
        } finally {
          setCsvUploading(false)
        }
      }

      const res = await analisarAlunoComIa({
        studentId: selectedStudentId,
        csvContext: csvSummary?.summaryText,
        csvImportId,
      })

      setAnalyzedContent(res.content)
      setMetrics(res.metrics)

      // Atualizar histórico
      const updatedHistory = await fetchHistoricoInsights(selectedStudentId)
      setInsightsHistory(updatedHistory)
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Falha ao conectar com o Analista de Evolução. Tente novamente.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-gradient-to-br from-[#181818] via-[#141414] to-[#181818] border-2 border-[#0057FF]/40 p-5 sm:p-7 rounded-2xl shadow-2xl relative overflow-hidden">
      {/* Glow decorativo sutil (reduzido no mobile para desempenho de renderização) */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#0057FF]/15 via-[#D4AF37]/10 to-transparent rounded-full pointer-events-none sm:blur-2xl opacity-60 sm:opacity-100" />

      {/* HEADER DO PAINEL */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#2A2A2A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0057FF]/20 border border-[#0057FF]/50 text-[11px] font-bold text-[#0057FF] uppercase font-montserrat">
              <Brain className="w-3.5 h-3.5 text-[#D4AF37]" />
              Agente Nativo • Analista de Evolução
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[10px] font-bold text-[#22C55E] uppercase font-montserrat">
              <ShieldCheck className="w-3 h-3" />
              LGPD Estrita
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold font-montserrat text-white uppercase tracking-tight flex items-center gap-2">
            <span>Insights da IA</span>
            <span className="text-[#D4AF37]">•</span>
            <span className="text-gray-300 font-medium text-base normal-case">
              Evolução Individual
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 font-inter mt-1 max-w-2xl leading-relaxed">
            O agente de IA analisa sobrecarga progressiva, RPE, volume, constância e faltas do seu
            aluno e produz recomendações escritas (ajuste de treino, alerta de platô, risco de
            overtraining) e oportunidades de novos serviços (nutrição, fisioterapia, artes
            marciais).
          </p>
        </div>

        {/* SELETOR DE ALUNOS DO PROFISSIONAL (LGPD: APENAS OS SEUS ALUNOS) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div className="relative">
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value)
                setAnalyzedContent(null)
                setMetrics(null)
                setCsvFile(null)
                setCsvSummary(null)
                setCsvSuccessMsg(null)
                setErrorMsg(null)
              }}
              className="w-full sm:w-64 bg-[#202020] border border-[#2A2A2A] hover:border-[#D4AF37] text-white font-montserrat text-xs font-bold rounded-xl px-3.5 py-2.5 pr-8 appearance-none focus:outline-none focus:border-[#0057FF] transition-all cursor-pointer shadow-md"
            >
              {students.length === 0 ? (
                <option value="">Nenhum aluno vinculado</option>
              ) : (
                students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name || 'Aluno sem nome'}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button
            onClick={handleGerarAnalise}
            disabled={loading || !selectedStudentId}
            className="bg-[#0057FF] hover:bg-[#1e69ff] text-white font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 min-w-[150px] transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                <span>Analisando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Gerar Análise IA</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ERROS E FEEDBACK */}
      {errorMsg && (
        <div className="relative z-10 mt-4 p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs font-inter flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CARD DO ALUNO SELECIONADO & ENRIQUECIMENTO COM CSV */}
      <div className="relative z-10 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* COLUNA 1: IDENTIFICAÇÃO E ENRIQUECIMENTO CSV */}
        <div className="space-y-4">
          <Card className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-gray-400 font-montserrat tracking-wider">
              Aluno Selecionado
            </span>
            <div className="flex items-center gap-3 mt-3">
              <UserAvatar
                user={selectedStudent}
                className="w-12 h-12 rounded-xl border border-[#2A2A2A]"
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold font-montserrat text-white truncate">
                  {selectedStudent?.name || 'Selecione um aluno'}
                </h4>
                <p className="text-[11px] text-gray-400 truncate">
                  {selectedStudent?.email || '—'}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 text-[9px] font-bold uppercase py-0 px-1.5">
                    {selectedStudent?.objective || 'Hipertrofia'}
                  </Badge>
                  <span className="text-[9px] text-gray-400 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-[#22C55E]" /> Seus dados
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* IMPORTAÇÃO DE PLANILHA CSV DO PROFISSIONAL */}
          <Card className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#22C55E]" />
                <span className="text-xs font-bold uppercase text-white font-montserrat">
                  Enriquecer com Planilha CSV
                </span>
              </div>
              <span
                title="Importe planilhas de testes ou treinos anteriores para cruzamento com os dados da plataforma."
                className="inline-flex cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
              </span>
            </div>

            <p className="text-[11px] text-gray-400 font-inter leading-relaxed">
              Anexe uma planilha de treinos, histórico de cargas ou avaliações passadas do aluno
              para enriquecer a análise preditiva da IA.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv,application/csv,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed border-[#2A2A2A] hover:border-[#D4AF37] bg-[#181818] text-gray-300 hover:text-white font-montserrat text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{csvFile ? `Arquivo: ${csvFile.name}` : 'Selecionar Arquivo .CSV'}</span>
            </Button>

            {csvSummary && (
              <div className="p-3 rounded-lg bg-[#202020] border border-[#2A2A2A] space-y-1.5 text-[11px] font-inter">
                <div className="flex items-center justify-between text-gray-300 font-bold font-montserrat">
                  <span>{csvSummary.rowCount} Linhas detectadas</span>
                  <span className="text-[#22C55E] text-[10px]">✓ Pronto para anexar</span>
                </div>
                <p className="text-gray-400 text-[10px] truncate">
                  Colunas: {csvSummary.headers.join(', ')}
                </p>
              </div>
            )}

            {csvSuccessMsg && (
              <p className="text-[11px] text-[#22C55E] font-medium font-inter flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{csvSuccessMsg}</span>
              </p>
            )}
          </Card>

          {/* HISTÓRICO RECENTE DE INSIGHTS DESTE ALUNO */}
          {insightsHistory.length > 0 && (
            <Card className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-xl space-y-2.5">
              <span className="text-[10px] font-bold uppercase text-gray-400 font-montserrat tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#D4AF37]" /> Histórico de Análises
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {insightsHistory.slice(0, 5).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setAnalyzedContent(h.content)
                      if (h.metrics_snapshot) setMetrics(h.metrics_snapshot)
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[#181818] hover:bg-[#202020] border border-[#2A2A2A] hover:border-[#0057FF]/40 transition-colors text-xs font-inter flex items-center justify-between"
                  >
                    <span className="text-gray-300 truncate max-w-[150px]">
                      {new Date(h.created).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-[10px] text-[#D4AF37] font-bold font-montserrat uppercase">
                      Ver Análise
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* COLUNA 2 e 3: RESULTADOS DA ANÁLISE IA E DASHBOARD DE MÉTRICAS */}
        <div className="lg:col-span-2 space-y-4">
          {/* CARDS DE RESUMO DE MÉTRICAS PROCESSADAS */}
          {metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-[#141414] border border-[#2A2A2A] p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-gray-400 font-montserrat block">
                  Volume Total
                </span>
                <span className="text-base sm:text-lg font-extrabold text-[#D4AF37] font-montserrat">
                  {metrics.totalVolumeKg.toLocaleString('pt-BR')} kg
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  {metrics.totalLogs} séries
                </span>
              </div>

              <div className="bg-[#141414] border border-[#2A2A2A] p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-gray-400 font-montserrat block">
                  RPE Médio
                </span>
                <span className="text-base sm:text-lg font-extrabold text-white font-montserrat">
                  {metrics.avgRpe} / 10
                </span>
                <span
                  className={`text-[10px] font-bold block mt-0.5 ${
                    metrics.avgRpe >= 8
                      ? 'text-red-400'
                      : metrics.avgRpe <= 5
                        ? 'text-yellow-400'
                        : 'text-emerald-400'
                  }`}
                >
                  {metrics.avgRpe >= 8
                    ? 'Alerta Fadiga'
                    : metrics.avgRpe <= 5
                      ? 'Subcarga'
                      : 'Zona Ótima'}
                </span>
              </div>

              <div className="bg-[#141414] border border-[#2A2A2A] p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-gray-400 font-montserrat block">
                  Constância
                </span>
                <span className="text-base sm:text-lg font-extrabold text-[#0057FF] font-montserrat">
                  {metrics.distinctDays} Dias
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Sessões distintas</span>
              </div>

              <div className="bg-[#141414] border border-[#2A2A2A] p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-gray-400 font-montserrat block">
                  Faltas
                </span>
                <span
                  className={`text-base sm:text-lg font-extrabold font-montserrat ${
                    (metrics.appointments?.absenceRatePct || 0) > 20
                      ? 'text-red-400'
                      : 'text-[#22C55E]'
                  }`}
                >
                  {metrics.appointments?.absenceRatePct || 0}%
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  {metrics.appointments?.canceled || 0} cancelamentos
                </span>
              </div>
            </div>
          )}

          {/* PAINEL PRINCIPAL DE RECOMENDAÇÕES DA IA */}
          <Card className="bg-[#141414] border border-[#2A2A2A] p-5 sm:p-6 rounded-xl relative min-h-[340px] flex flex-col justify-between">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-3 border-[#0057FF]/30 border-t-[#0057FF] animate-spin" />
                  <Brain className="w-5 h-5 text-[#D4AF37] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-montserrat text-white uppercase flex items-center justify-center gap-2">
                    <span>Analisando…</span>
                  </h4>
                  <p className="text-xs text-gray-400 font-inter mt-1 max-w-md">
                    O Analista de Evolução está compilando workout_logs, cargas e constância sob
                    regras LGPD (timeout 10s).
                  </p>
                </div>
              </div>
            ) : analyzedContent ? (
              <div className="space-y-4 font-inter text-sm leading-relaxed text-gray-200">
                <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2A]">
                  <span className="text-xs font-bold uppercase text-[#D4AF37] font-montserrat flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Relatório Técnico Gerado pela IA
                  </span>
                  <Badge className="bg-[#0057FF]/15 text-[#0057FF] border-[#0057FF]/30 text-[10px] font-bold uppercase">
                    Analista de Evolução 369
                  </Badge>
                </div>

                <div className="whitespace-pre-line text-xs sm:text-sm text-gray-300 space-y-2 leading-relaxed">
                  {analyzedContent}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#0057FF]/10 border border-[#0057FF]/30 flex items-center justify-center text-[#0057FF]">
                  <Brain className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h4 className="text-base font-bold font-montserrat text-white uppercase">
                    Nenhuma análise gerada para este aluno
                  </h4>
                  <p className="text-xs text-gray-400 font-inter leading-relaxed">
                    Clique no botão{' '}
                    <strong className="text-white">&ldquo;Gerar Análise IA&rdquo;</strong> para
                    processar a evolução completa de carga, RPE, volume, constância e faltas do
                    aluno selecionado.
                  </p>
                </div>
                <Button
                  onClick={handleGerarAnalise}
                  disabled={!selectedStudentId}
                  className="bg-[#0057FF] hover:bg-[#1e69ff] text-white font-bold text-xs uppercase px-5 py-2.5 rounded-xl shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2 text-[#D4AF37]" /> Iniciar Análise do Aluno
                </Button>
              </div>
            )}

            {/* ATALHOS RÁPIDOS DE SERVIÇOS DO ECOSSISTEMA */}
            <div className="mt-6 pt-4 border-t border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-[11px] font-bold text-gray-400 font-montserrat uppercase flex items-center gap-1">
                Serviços do Ecossistema Sugeridos:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[10px] font-bold text-[#22C55E] uppercase">
                  <Apple className="w-3 h-3" /> Nutrição
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0057FF]/10 border border-[#0057FF]/30 text-[10px] font-bold text-[#0057FF] uppercase">
                  <Activity className="w-3 h-3" /> Fisioterapia
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[10px] font-bold text-[#D4AF37] uppercase">
                  <Swords className="w-3 h-3" /> Artes Marciais
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  )
}

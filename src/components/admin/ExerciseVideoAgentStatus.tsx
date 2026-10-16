import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { searchExerciseVideo, exerciseVideoErrorMessage } from '@/lib/exerciseVideoSearch'

interface AgentStatus {
  keyConfigured: boolean
  aiRuntimeAvailable: boolean
  routeRateLimitConfigured: boolean
  configurationReady: boolean
}
export function ExerciseVideoAgentStatus() {
  const [status, setStatus] = useState<AgentStatus>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const refresh = async () => {
    setLoading(true)
    setError('')
    setStatus(undefined)
    setTestResult('')
    try {
      setStatus(
        await pb.send<AgentStatus>('/backend/v1/admin/exercise-videos/status', { method: 'GET' }),
      )
    } catch {
      setError(
        'Não foi possível verificar o agente. Confirme se a atualização foi instalada no servidor e se sua sessão de administrador está ativa.',
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [])
  const testSearch = async () => {
    setTesting(true)
    setTestResult('')
    try {
      // Deliberately bypass the browser cache: an operator requested an actual server check.
      const result = await pb.send<Awaited<ReturnType<typeof searchExerciseVideo>>>(
        '/backend/v1/exercises/video-search',
        {
          method: 'POST',
          body: { exercise: 'Agachamento com halteres', verifyLive: true },
        },
      )
      setTestResult(
        result.video
          ? 'Busca concluída: demonstração encontrada. Revise o conteúdo no cartão do exercício.'
          : result.message,
      )
    } catch (error: unknown) {
      setTestResult(exerciseVideoErrorMessage(error))
    } finally {
      setTesting(false)
    }
  }
  return (
    <section
      className="rounded-xl border border-sky-200 bg-sky-50 p-5 space-y-3"
      aria-label="Agente de vídeos de exercícios"
    >
      <h2 className="font-bold text-slate-900">Agente IA • Vídeos de exercícios</h2>
      <p className="text-sm text-slate-700">
        Verifique a conexão antes de liberar a busca automática para os alunos.
      </p>
      <div className="text-sm space-y-1" aria-live="polite">
        {loading && <p>Verificando configuração…</p>}
        {error && <p>{error}</p>}
        {status && (
          <>
            <p>
              YouTube:{' '}
              {status.keyConfigured ? 'chave configurada' : 'aguardando configuração no servidor'}
            </p>
            <p>
              IA:{' '}
              {status.aiRuntimeAvailable
                ? 'recurso disponível no servidor'
                : 'recurso indisponível'}
            </p>
            <p>
              Limite de buscas:{' '}
              {status.routeRateLimitConfigured ? 'regra configurada' : 'configuração pendente'}
            </p>
            <p className="font-semibold">
              {status.configurationReady
                ? 'Configuração pronta para teste de conexão.'
                : 'Existem configurações pendentes.'}
            </p>
            <p>
              A presença da configuração não confirma a validade da chave nem a disponibilidade dos
              provedores.
            </p>
          </>
        )}
        {testResult && <p>{testResult}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || testing}
          onClick={() => void refresh()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Verificar configuração
        </button>
        <button
          type="button"
          disabled={loading || testing || !status?.configurationReady}
          onClick={() => void testSearch()}
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {testing ? 'Testando…' : 'Testar busca no YouTube'}
        </button>
      </div>
      <p className="text-xs text-slate-600">
        O teste usa uma busca real e consome quota dos provedores. A chave é cadastrada
        exclusivamente no ambiente do servidor.
      </p>
    </section>
  )
}

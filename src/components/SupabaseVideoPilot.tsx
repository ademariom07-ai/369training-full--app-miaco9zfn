import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { runVideoPilot, type PilotResult } from '@/lib/supabase/videoPilot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export default function SupabaseVideoPilot({
  owner,
  disabled,
}: {
  owner: string
  disabled: boolean
}) {
  const [exercise, setExercise] = useState('Agachamento com halteres'),
    [result, setResult] = useState<PilotResult | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [play, setPlay] = useState(false)
  const generation = useRef(0),
    locked = useRef(false)
  useEffect(() => {
    let alive = true
    const { data } = getSupabaseClient().auth.onAuthStateChange(() => {
      generation.current++
      locked.current = false
      if (alive) {
        setResult(null)
        setPlay(false)
        setBusy(false)
        setError('')
      }
    })
    return () => {
      alive = false
      generation.current++
      data.subscription.unsubscribe()
    }
  }, [owner])
  async function submit() {
    if (locked.current || disabled) return
    locked.current = true
    const ticket = ++generation.current
    setBusy(true)
    setResult(null)
    setPlay(false)
    setError('')
    try {
      const next = await runVideoPilot(getSupabaseClient(), owner, exercise)
      if (ticket === generation.current) setResult(next)
    } catch (err) {
      if (ticket === generation.current)
        setError(err instanceof Error ? err.message : 'Busca indisponível.')
    } finally {
      if (ticket === generation.current) {
        locked.current = false
        setBusy(false)
      }
    }
  }
  return (
    <section className="my-6 space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Piloto real · vídeos YouTube + OpenAI</h2>
      <p>
        Restrito ao administrador Supabase. Cada busca pode consumir quota dos dois provedores. Não
        cria ou altera treinos.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <label className="block">
          Exercício e equipamento
          <Input
            value={exercise}
            maxLength={160}
            required
            disabled={busy || disabled}
            onChange={(e) => {
              setExercise(e.target.value)
              setResult(null)
              setPlay(false)
              setError('')
            }}
          />
        </label>
        <Button type="submit" disabled={busy || disabled}>
          {busy ? 'Consultando provedores…' : 'Executar busca real'}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="space-y-3">
          <p role="status">{result.message}</p>
          {result.video && (
            <>
              <h3>{result.video.title}</h3>
              <p>{result.video.channel}</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setPlay(!play)}>
                  {play ? 'Fechar vídeo' : 'Assistir aqui'}
                </Button>
                <a href={result.video.url} target="_blank" rel="noopener noreferrer">
                  Abrir no YouTube
                </a>
              </div>
              {play && (
                <iframe
                  title={result.video.title}
                  className="aspect-video w-full rounded-lg"
                  src={'https://www.youtube-nocookie.com/embed/' + result.video.id}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
            </>
          )}
        </div>
      )}
      <p className="text-sm text-slate-600">
        Os metadados não certificam segurança clínica. O limite atual do piloto é por instância;
        ainda não há quota global distribuída.
      </p>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import { ExerciseYouTubePlayer } from '@/components/ExerciseYouTubePlayer'
import {
  searchExerciseVideo,
  exerciseVideoErrorMessage,
  type ExerciseVideoResult,
} from '@/lib/exerciseVideoSearch'

export function ExerciseVideoSuggestion({ exercise }: { exercise: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    exercise: string
    result?: ExerciseVideoResult
    error?: string
  }>()
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || !exercise.trim()) return
    let active = true
    setState(undefined)
    const timer = setTimeout(() => {
      searchExerciseVideo(exercise)
        .then((result) => {
          if (active) setState({ exercise, result })
        })
        .catch((error: unknown) => {
          if (active)
            setState({
              exercise,
              error: exerciseVideoErrorMessage(error),
            })
        })
    }, 700)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [exercise, visible, attempt])
  const current = state?.exercise === exercise ? state : undefined
  const video = current?.result?.video
  return (
    <div ref={root} className="mt-2 space-y-1 text-xs text-gray-400" aria-live="polite">
      <p className="font-semibold text-gray-200">Vídeo do exercício • Agente IA</p>
      {!exercise.trim() ? (
        <p>Informe o exercício e sua variação para buscar uma demonstração.</p>
      ) : !current ? (
        <p>Buscando demonstração pública no YouTube…</p>
      ) : current.error ? (
        <>
          <p>{current.error}</p>
          <button
            type="button"
            className="underline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </>
      ) : video ? (
        <>
          <p className="font-semibold text-gray-200">{video.title}</p>
          <p>Canal: {video.channel} • YouTube</p>
          <ExerciseYouTubePlayer key={video.url} url={video.url} title={video.title} />
          <p>
            Sugestão automática por título e descrição. Técnica e adequação individual não
            verificadas.
          </p>
        </>
      ) : (
        <p>{current.result?.message}</p>
      )}
    </div>
  )
}

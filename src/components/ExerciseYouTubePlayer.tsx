import { useId, useState } from 'react'
import { normalizeExerciseVideo } from '@/lib/exerciseVideo'

/** Mount the third-party player only after the viewer chooses to open it. */
export function ExerciseYouTubePlayer({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false)
  const playerId = useId()
  const canonical = normalizeExerciseVideo(url)
  if (!canonical) return null
  const videoId = new URL(canonical).searchParams.get('v')!
  return (
    <div className="space-y-2 py-1">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={playerId}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-sky-500/50 px-3 py-2 text-sky-400 font-semibold"
        >
          {open ? 'Fechar vídeo' : '▶ Assistir aqui'}
        </button>
        <a
          href={canonical}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 underline"
        >
          Abrir no YouTube
        </a>
      </div>
      <div id={playerId}>
        {open && (
          <>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`}
              title={`Demonstração do exercício: ${title}`}
              className="w-full max-w-xl aspect-video min-h-[200px] rounded-xl border-0 bg-black"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <p className="mt-1">
              Se o vídeo estiver indisponível no player, use “Abrir no YouTube”.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

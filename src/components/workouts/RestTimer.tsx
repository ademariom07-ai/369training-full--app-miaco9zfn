import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseWorkoutRest } from '@/lib/workoutRest'

export function RestTimer({ exercise, prescribedRest }: { exercise: string; prescribedRest: string }) {
  const initial = parseWorkoutRest(prescribedRest)
  const [seconds, setSeconds] = useState(initial === null ? '' : String(initial))
  const [remainingMs, setRemainingMs] = useState((initial ?? 0) * 1000)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const deadline = useRef(0)
  const duration = /^\d+$/.test(seconds) ? Number(seconds) : 0
  const valid = Number.isSafeInteger(duration) && duration >= 1 && duration <= 3600

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const left = Math.max(0, Math.min(duration * 1000, deadline.current - Date.now()))
      setRemainingMs(left)
      if (left === 0) { setRunning(false); setFinished(true) }
    }
    tick()
    const interval = window.setInterval(tick, 250)
    // Reconcile elapsed time immediately after returning from a background tab.
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick) }
  }, [running, duration])

  const start = () => {
    if (!valid || running) return
    const left = remainingMs > 0 ? remainingMs : duration * 1000
    deadline.current = Date.now() + left
    setRemainingMs(left); setFinished(false); setRunning(true)
  }
  const pause = () => {
    const left = Math.max(0, Math.min(duration * 1000, deadline.current - Date.now()))
    setRemainingMs(left); setRunning(false); setFinished(left === 0)
  }
  const reset = () => { setRunning(false); setFinished(false); setRemainingMs(valid ? duration * 1000 : 0) }
  const wholeSeconds = Math.ceil(remainingMs / 1000)
  const display = `${String(Math.floor(wholeSeconds / 60)).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`
  return (
    <section aria-label={`Descanso: ${exercise}`} className="rounded-xl border border-sky-400/40 bg-[#181818] p-4 space-y-3 text-gray-200">
      <h3 className="font-semibold">Descanso · {exercise}</h3>
      <p className="text-xs">Prescrito: {prescribedRest || 'não informado'}. O cronômetro não modifica o treino.</p>
      {initial === null && <p className="text-xs text-amber-200">Não foi possível identificar um tempo único. Informe os segundos conforme a orientação profissional.</p>}
      <label className="block text-sm">Duração em segundos (1 a 3600)
        <Input type="number" min={1} max={3600} step={1} value={seconds} disabled={running} onChange={e => {
          setSeconds(e.target.value); setFinished(false)
          const next = Number(e.target.value)
          setRemainingMs(Number.isInteger(next) && next >= 1 && next <= 3600 ? next * 1000 : 0)
        }} className="max-w-40" />
      </label>
      <p role="timer" aria-label="Tempo restante" className="text-3xl font-mono tabular-nums">{display}</p>
      <div className="flex gap-2 flex-wrap">
        <Button type="button" onClick={running ? pause : start} disabled={!valid}>{running ? 'Pausar' : finished ? 'Iniciar novamente' : 'Iniciar / continuar'}</Button>
        <Button type="button" variant="outline" onClick={reset} disabled={!valid}>Reiniciar</Button>
      </div>
      <p role="status" className="text-sm text-sky-200">{finished ? 'Intervalo encerrado. Nenhum exercício foi marcado como concluído.' : running ? 'Cronômetro em andamento.' : 'Cronômetro parado.'}</p>
      <p className="text-xs text-gray-400">Aviso visual nesta tela. Ao trocar de exercício ou sair do treino, a contagem é descartada.</p>
    </section>
  )
}

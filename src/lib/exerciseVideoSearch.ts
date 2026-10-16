import pb from '@/lib/pocketbase/client'
import { normalizeExerciseVideo } from './exerciseVideo'

export interface ExerciseVideoResult {
  video: { id: string; title: string; channel: string; url: string; checkedAt: string } | null
  message: string
}

// Deduplicate cards and serialize searches to avoid a burst for a whole workout.
let queue: Promise<unknown> = Promise.resolve()
const requests = new Map<string, { expires: number; promise: Promise<ExerciseVideoResult> }>()
export function searchExerciseVideo(exercise: string): Promise<ExerciseVideoResult> {
  const label = exercise.trim().replace(/\s+/g, ' ')
  if (!label || label.length > 160)
    return Promise.reject(Error('Informe o nome e a variação do exercício.'))
  const userId = pb.authStore.record?.id
  if (!userId) return Promise.reject(Error('Entre novamente para buscar vídeos.'))
  const key = JSON.stringify([userId, label.toLowerCase()])
  const existing = requests.get(key)
  if (existing && existing.expires > Date.now()) return existing.promise
  const promise = queue
    .catch(() => {})
    .then(async () => {
      if (pb.authStore.record?.id !== userId) throw Error('Sessão alterada. Entre novamente.')
      const result = await pb.send<ExerciseVideoResult>('/backend/v1/exercises/video-search', {
        method: 'POST',
        body: { exercise: label },
      })
      if (
        result.video &&
        (normalizeExerciseVideo(result.video.url) !== result.video.url ||
          !/^[A-Za-z0-9_-]{11}$/.test(result.video.id) ||
          !result.video.url.endsWith('=' + result.video.id))
      ) {
        throw Error('Resposta de vídeo inválida.')
      }
      return result
    })
  queue = promise
  if (requests.size >= 256) requests.delete(requests.keys().next().value!)
  requests.set(key, { expires: Date.now() + 5 * 60 * 1000, promise })
  promise.catch(() => {
    if (requests.get(key)?.promise === promise) requests.delete(key)
  })
  return promise
}

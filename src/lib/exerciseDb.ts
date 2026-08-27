// ExerciseDB integration with in-memory caching and fallback

interface ExerciseDBItem {
  id: string
  name: string
  gifUrl?: string
  bodyPart?: string
  equipment?: string
  target?: string
  secondaryMuscles?: string[]
  instructions?: string[]
}

const gifCache = new Map<string, string | null>()

// Standard fallback map for common exercises in Portuguese/English
const KNOWN_EXERCISE_GIFS: Record<string, string> = {
  agachamento: 'https://img.usecurling.com/p/320/240?q=squat%20gym%20exercise',
  supino: 'https://img.usecurling.com/p/320/240?q=bench%20press%20gym',
  puxada: 'https://img.usecurling.com/p/320/240?q=lat%20pulldown%20gym',
  remada: 'https://img.usecurling.com/p/320/240?q=barbell%20row%20gym',
  prancha: 'https://img.usecurling.com/p/320/240?q=plank%20abs%20fitness',
  leg: 'https://img.usecurling.com/p/320/240?q=leg%20press%20fitness',
  rosca: 'https://img.usecurling.com/p/320/240?q=bicep%20curl%20gym',
  triceps: 'https://img.usecurling.com/p/320/240?q=triceps%20pushdown%20gym',
  elevacao: 'https://img.usecurling.com/p/320/240?q=lateral%20raise%20fitness',
  stiff: 'https://img.usecurling.com/p/320/240?q=deadlift%20stiff%20fitness',
  panturrilha: 'https://img.usecurling.com/p/320/240?q=calf%20raise%20fitness',
  desenvolvimento: 'https://img.usecurling.com/p/320/240?q=shoulder%20press%20fitness',
  afundo: 'https://img.usecurling.com/p/320/240?q=lunge%20exercise%20gym',
  abdominal: 'https://img.usecurling.com/p/320/240?q=crunches%20abs%20gym',
}

export async function fetchExerciseGif(exerciseName: string): Promise<string | null> {
  const cleanName = exerciseName.trim().toLowerCase()
  if (!cleanName) return null

  if (gifCache.has(cleanName)) {
    return gifCache.get(cleanName) || null
  }

  // 1. Try ExerciseDB open API
  try {
    // Attempt simplified name search (first two words or transliterated)
    const query = encodeURIComponent(cleanName.replace(/[()\d+]/g, '').trim())
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    const res = await fetch(`https://exercisedb-api.vercel.app/api/v1/exercises/name/${query}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].gifUrl) {
        gifCache.set(cleanName, data[0].gifUrl)
        return data[0].gifUrl
      }
      if (data?.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].gifUrl) {
        gifCache.set(cleanName, data.data[0].gifUrl)
        return data.data[0].gifUrl
      }
    }
  } catch (_) {
    // Network error or timeout - proceed to fallback
  }

  // 2. Local fuzzy match from known database
  for (const [keyword, url] of Object.entries(KNOWN_EXERCISE_GIFS)) {
    if (cleanName.includes(keyword)) {
      gifCache.set(cleanName, url)
      return url
    }
  }

  // 3. Fallback placeholder
  const placeholder = `https://img.usecurling.com/p/320/240?q=${encodeURIComponent(cleanName.split(' ')[0] || 'fitness')}`
  gifCache.set(cleanName, placeholder)
  return placeholder
}

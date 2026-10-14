import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface WorkoutLogRecord extends RecordModel {
  workout: string
  student: string
  professional?: string
  exercise_id: string
  exercise_name: string
  set_index: number
  reps_done?: number
  weight_used?: number
  rpe_difficulty?: number
  duration_seconds?: number
  week_number?: number
  completed_at?: string
  notes?: string
  suggested_progression?: string
  professional_feedback?: string
  created: string
  updated: string
  expand?: {
    workout?: RecordModel
    student?: RecordModel
    professional?: RecordModel
  }
}

// Configuração padrão da periodização semanal (Treino da Semana)
export interface WeekCycleConfig {
  weekNumber: number // 1 a 4
  name: string // ex: "Semana 1 - Base & Adaptação"
  focus: string // "Adaptação Anatômica" | "Progressão de Carga" | "Pico de Intensidade" | "Deload & Recuperação"
  description: string
  repRangeAdjustment?: string
  loadModifierPct: number // ex: 0%, +5%, +10%, -20% (deload)
}

export const STANDARD_WEEK_CYCLES: WeekCycleConfig[] = [
  {
    weekNumber: 1,
    name: 'Semana 1 - Base & Adaptação',
    focus: 'Adaptação Anatômica',
    description:
      'Foco na cadência, amplitude e conexão mente-músculo. Ajuste as cargas confortavelmente.',
    loadModifierPct: 0,
    repRangeAdjustment: 'Repetições prescritas normais com 2 a 3 reps de reserva.',
  },
  {
    weekNumber: 2,
    name: 'Semana 2 - Sobrecarga Progressiva',
    focus: 'Progressão de Carga & Volume',
    description:
      'Aumente ligeiramente a carga (+2,5 kg) ou busque 1 a 2 repetições adicionais mantendo a postura.',
    loadModifierPct: 5,
    repRangeAdjustment: '+1 a 2 reps ou +2,5 kg por exercício.',
  },
  {
    weekNumber: 3,
    name: 'Semana 3 - Pico de Intensidade',
    focus: 'Pico de Força & Esforço',
    description:
      'Semana de maior exigência neuromuscular (RPE 8-9). Séries próximas do esforço máximo.',
    loadModifierPct: 10,
    repRangeAdjustment: 'Carga máxima com técnica perfeita.',
  },
  {
    weekNumber: 4,
    name: 'Semana 4 - Recuperação & Deload',
    focus: 'Deload & Regeneração Ativa',
    description:
      'Redução estratégica de carga (-20% a -30%) para recuperação articular e supercompensação física.',
    loadModifierPct: -20,
    repRangeAdjustment: '-20% da carga habitual. Movimentos fluidos e descanso ampliado.',
  },
]

/**
 * Calcula a sugestão automática de progressão de carga/repetição (mesma regra da IA 369)
 * Quando o aluno completa todas as repetições com facilidade ou moderado (RPE <= 6),
 * sugere automaticamente incremento de +2,5 kg na próxima sessão.
 */
export function calculateAutomaticProgression(params: {
  exerciseName: string
  repsTarget: string | number
  repsDone: number
  weightUsed: number
  difficultyRpe?: number // 0 a 10
  weekNumber?: number
}): {
  recommendation: string
  suggestedLoad: string
  action: 'increase' | 'maintain' | 'decrease'
  rationale: string
} {
  const { weightUsed, repsDone, repsTarget, difficultyRpe = 5, weekNumber = 1 } = params

  // Se for semana 4 (Deload)
  if (weekNumber === 4) {
    const deloadWeight = Math.max(1, Math.round(weightUsed * 0.8 * 2) / 2)
    return {
      recommendation: `Semana de Recuperação (Deload): Mantenha ${deloadWeight} kg.`,
      suggestedLoad: `${deloadWeight} kg`,
      action: 'decrease',
      rationale:
        'Deload programado para proteger articulações e consolidar os ganhos das semanas anteriores.',
    }
  }

  // Se dificuldade informada for baixa (0 a 4) ou reps completadas >= alvo
  const targetNum =
    typeof repsTarget === 'number'
      ? repsTarget
      : parseInt(String(repsTarget).split('-').pop() || '10', 10) || 10

  if (difficultyRpe <= 4 || (difficultyRpe <= 6 && repsDone >= targetNum)) {
    const nextWeight = weightUsed > 0 ? weightUsed + 2.5 : 5
    return {
      recommendation: `Incrível! Sugerimos +2,5 kg na próxima sessão (${nextWeight} kg).`,
      suggestedLoad: `${nextWeight} kg`,
      action: 'increase',
      rationale: `Você completou as repetições com ótima reserva de esforço (RPE ${difficultyRpe}/10). A sobrecarga progressiva estimula novas fibras musculares.`,
    }
  }

  if (difficultyRpe >= 8) {
    return {
      recommendation: `Mantenha ${weightUsed} kg na próxima sessão e refine a técnica.`,
      suggestedLoad: `${weightUsed} kg`,
      action: 'maintain',
      rationale: `Esforço elevado (RPE ${difficultyRpe}/10). Consolidar a cadência e controle na descida evita lesões e maximiza a hipertrofia.`,
    }
  }

  // Intermediário (RPE 5 a 7)
  const nextWeight = weightUsed > 0 ? weightUsed + 1 : 3
  return {
    recommendation: `Faixa ideal de estímulo! Mantenha a carga ou tente +1 kg (${nextWeight} kg).`,
    suggestedLoad: `${nextWeight} kg`,
    action: 'maintain',
    rationale: `Zona ótima de hipertrofia. Tente adicionar 1 repetição a mais antes de subir a carga bruta.`,
  }
}

/**
 * Parsers de tempo para suporte a cronômetro em exercícios por tempo (ex: "30s", "10 min", "45 seg")
 */
export function parseExerciseTimeInSeconds(text?: string): number | null {
  if (!text) return null
  const clean = text.toLowerCase().trim()

  // Minutos: "10 min", "5 mins", "2m", "10min"
  const minMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:minutos?|mins?|m\b)/)
  if (minMatch) {
    const val = parseFloat(minMatch[1].replace(',', '.'))
    return Math.round(val * 60)
  }

  // Segundos: "30s", "45 seg", "60 segundos"
  const secMatch = clean.match(/(\d+)\s*(?:segundos?|segs?|s\b)/)
  if (secMatch) {
    return parseInt(secMatch[1], 10)
  }

  return null
}

/**
 * Toca um bip sonoro amigável no término de cronômetro via Web Audio API (nativo, sem dependência externa)
 */
export function playChimeBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // Tom 1
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now) // D5
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.3)

    // Tom 2 (harmonioso)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.15) // A5
    gain2.gain.setValueAtTime(0.35, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.55)

    // Vibração se suportado no celular (público 60+ / mobile)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 300])
    }
  } catch {
    // Silencioso em caso de restrição do navegador
  }
}

/**
 * Salva uma série realizada no banco de dados PocketBase
 */
export async function recordWorkoutSetLog(data: {
  workoutId: string
  studentId: string
  professionalId?: string
  exerciseId: string
  exerciseName: string
  setIndex: number
  repsDone: number
  weightUsed: number
  rpeDifficulty?: number
  durationSeconds?: number
  weekNumber?: number
  notes?: string
  suggestedProgression?: string
}): Promise<WorkoutLogRecord> {
  return pb.collection('workout_logs').create<WorkoutLogRecord>({
    workout: data.workoutId,
    student: data.studentId,
    professional: data.professionalId || null,
    exercise_id: data.exerciseId,
    exercise_name: data.exerciseName,
    set_index: data.setIndex,
    reps_done: data.repsDone,
    weight_used: data.weightUsed,
    rpe_difficulty: data.rpeDifficulty || 5,
    duration_seconds: data.durationSeconds || 0,
    week_number: data.weekNumber || 1,
    completed_at: new Date().toISOString(),
    notes: data.notes || '',
    suggested_progression: data.suggestedProgression || '',
  })
}

/**
 * Busca o histórico de séries salvas de um determinado treino
 */
export async function getWorkoutLogs(workoutId: string): Promise<WorkoutLogRecord[]> {
  try {
    const res = await pb.collection('workout_logs').getList<WorkoutLogRecord>(1, 200, {
      filter: `workout = "${workoutId}"`,
      sort: 'created',
    })
    return res.items
  } catch {
    return []
  }
}

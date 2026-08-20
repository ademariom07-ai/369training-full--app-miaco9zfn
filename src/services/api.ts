import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface ServiceRecord extends RecordModel {
  professional: string
  student: string
  type: string
  title: string
  value: number
  status: 'pendente' | 'concluido' | 'cancelado'
  scheduled_at?: string
  completed_at?: string
  notes?: string
  expand?: {
    professional?: RecordModel
    student?: RecordModel
  }
}

export interface WorkoutRecord extends RecordModel {
  professional?: string
  student: string
  title: string
  objective?: string
  exercises?: Array<{
    id: string
    name: string
    muscle_group?: string
    sets: string
    reps: string
    load: string
    rest: string
    video?: string
    tips?: string
    completed?: boolean
  }>
  day?: string
  valid_until?: string
  status?: 'ativo' | 'concluido' | 'arquivado'
  ai_generated?: boolean
}

export interface DietRecord extends RecordModel {
  professional?: string
  student: string
  title: string
  meals?: Array<{
    name: string
    calories?: number
    items: string[]
  }>
  calories?: number
  macros?: {
    protein: number
    carbs: number
    fat: number
  }
  valid_until?: string
}

export interface ProtocolRecord extends RecordModel {
  professional?: string
  student: string
  title: string
  steps?: Array<{
    id: string
    name: string
    duration?: string
    video?: string
    description: string
  }>
  pain_level?: number
  mobility_tests?: Array<{
    test: string
    result: string
    passed: boolean
  }>
}

export interface MartialArtsSessionRecord extends RecordModel {
  professional?: string
  student: string
  modality: string
  technique_videos?: Array<{
    title: string
    url: string
    duration: string
  }>
  attendance?: boolean
  belt_level?: string
  notes?: string
}

export interface WalletTransactionRecord extends RecordModel {
  user: string
  type: 'deposito' | 'saque' | 'cashback' | 'tarifa' | 'servico'
  amount: number
  status: 'pendente' | 'concluido' | 'rejeitado'
  comprovante?: string
  pix_code?: string
  reference_type?: string
  reference_id?: string
  description?: string
}

export interface RankEntryRecord extends RecordModel {
  user: string
  cycle: string
  points: number
  services_count?: number
  referrals_count?: number
  stars?: number
  ranking_position?: number
  tie_break_details?: Record<string, unknown>
  expand?: {
    user?: RecordModel
  }
}

export interface MessageRecord extends RecordModel {
  sender: string
  receiver: string
  content: string
  read?: boolean
  expand?: {
    sender?: RecordModel
    receiver?: RecordModel
  }
}

export interface NotificationRecord extends RecordModel {
  user: string
  type: string
  title: string
  body: string
  read: boolean
  action_url?: string
}

export interface CommunityPostRecord extends RecordModel {
  user: string
  content: string
  images?: string[]
  likes?: number
  category?: string
  expand?: {
    user?: RecordModel
  }
}

export interface AchievementRecord extends RecordModel {
  user: string
  type: string
  name: string
  description?: string
  icon?: string
  tier?: 'ouro' | 'prata' | 'bronze'
  awarded_at?: string
}

// Service helper methods
export const api = {
  // AI generators via backend hooks
  generateWorkout: async (params: {
    objective: string
    experience: string
    daysAvailable: number
    restrictions: string
    notes?: string
  }) => {
    return pb.send<{
      title: string
      objective: string
      frequency: string
      exercises: WorkoutRecord['exercises']
      disclaimer: string
    }>('/backend/v1/generate/workout', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  generateDiet: async (params: {
    goal: string
    calories: number
    mealCount: number
    dietaryRestrictions: string
  }) => {
    return pb.send<{
      title: string
      calories: number
      macros: { protein: number; carbs: number; fat: number }
      meals: DietRecord['meals']
      smart_tips: string[]
    }>('/backend/v1/generate/diet', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  smartSwap: async (params: { mealItem: string; reason?: string }) => {
    return pb.send<{
      original: string
      suggestion: string
      benefits: string
      portion: string
    }>('/backend/v1/generate/smart_swap', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  expertChat: async (params: {
    expert_slug: string
    message: string
    conversation_id?: string | null
  }) => {
    return pb.send<{
      content: string
      conversation_id: string
      message_id: string
      citations: Array<{ excerpt: string; source_id: string }>
      remaining_quota: number
      max_quota: number
      plan_tier: string
    }>('/backend/v1/experts/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },
}

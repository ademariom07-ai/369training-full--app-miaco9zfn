import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface WeeklyScheduleRecord extends RecordModel {
  profissional: string
  dia_da_semana: string
  data: string
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  dia_liberado?: boolean
  expand?: {
    profissional?: RecordModel
  }
}

export interface AppointmentRecord extends RecordModel {
  profissional: string
  aluno: string
  schedule?: string
  servico_tipo: 'treino' | 'nutrição' | 'fisioterapia' | 'artes_marciais'
  status: 'pendente' | 'confirmado' | 'concluído' | 'cancelado'
  valor: number
  taxa_extra?: number
  expand?: {
    profissional?: RecordModel
    aluno?: RecordModel
    schedule?: WeeklyScheduleRecord
  }
}

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

export interface BinaryTreeParamRecord extends RecordModel {
  position: number
  level: number
  segment?: string
  coefficient?: number
  people_count?: number
  level_percentage?: number
  level_share_pct?: number
  modifier?: number
  divisor?: number
  cashback_weight?: number
  esg_bonus_pct?: number
  esg_economic_pct?: number
  esg_social_pct?: number
  esg_ecological_pct?: number
  trigger_rules?: Record<string, unknown>
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

export interface ChallengeRecord extends RecordModel {
  title: string
  description?: string
  professional_id?: string
  regras?: string
  dias_total: number
  reward_badge?: string
  expand?: {
    professional_id?: RecordModel
  }
}

export interface ChallengeParticipantRecord extends RecordModel {
  challenge_id: string
  aluno_id: string
  dias_concluidos?: string[]
  completed?: boolean
  expand?: {
    challenge_id?: ChallengeRecord
    aluno_id?: RecordModel
  }
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

  loadFeedback: async (params: {
    exerciseName: string
    weightUsed: number
    difficulty: number
    objective?: string
    reps?: string
    sets?: string
  }) => {
    return pb.send<{
      recommendation: string
      suggestedLoad: string
      suggestedReps: string
      rationale: string
      action: 'increase' | 'maintain' | 'decrease'
    }>('/backend/v1/generate/load-feedback', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  getWearablesStatus: async () => {
    return pb.send<{
      status: string
      is_configured: boolean
      aggregator: string
      supported_devices: Array<{ id: string; name: string; icon: string }>
      metrics_included: string[]
      gate_rules: {
        aluno: string
        profissional: string
      }
      message: string
    }>('/backend/v1/wearables/status', {
      method: 'GET',
    })
  },

  createWearableConnectSession: async (params?: { success_url?: string; failure_url?: string }) => {
    return pb.send<{
      status?: string
      url?: string
      session_id?: string
      aggregator?: string
      is_mock_ready?: boolean
      is_configured?: boolean
      error?: string
      upgrade_required?: boolean
      message?: string
    }>('/backend/v1/wearables/connect_session', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    })
  },

  validateGroupSessionAttendance: async (params: {
    participant_id: string
    action?: 'confirm' | 'mark_absent'
    notes?: string
  }) => {
    return pb.send<{
      success: boolean
      participant_id: string
      attendance_status: string
      is_registered_user: boolean
      fee_charged: boolean
      points_awarded: boolean
      service_id?: string
      message: string
    }>('/backend/v1/group-sessions/validate-attendance', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },
}

export type GroupSessionSpecialty =
  | 'educacao_fisica'
  | 'nutricao'
  | 'fisioterapia'
  | 'artes_marciais'
  | 'psicologia'

export interface GroupSessionRecord extends RecordModel {
  professional: string
  title: string
  specialty: GroupSessionSpecialty
  date: string
  start_time: string
  end_time?: string
  location?: string
  max_capacity?: number
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'
  group_selfie?: string
  selfie_uploaded_at?: string
  validation_window_hours?: number
  price_per_participant?: number
  notes?: string
  expand?: {
    professional?: RecordModel
    group_session_participants_via_session?: GroupSessionParticipantRecord[]
  }
}

export interface GroupSessionParticipantRecord extends RecordModel {
  session: string
  student?: string
  guest_name?: string
  guest_email?: string
  attendance_status: 'pendente' | 'confirmado' | 'ausente' | 'marcado_presente'
  confirmed_at?: string
  confirmation_method?: 'self_app' | 'professional_manual'
  is_registered_user?: boolean
  fee_charged?: boolean
  points_awarded?: boolean
  service_record?: string
  notes?: string
  expand?: {
    student?: RecordModel
    session?: GroupSessionRecord
  }
}

export interface WearableConnectionRecord {
  id: string
  user: string
  provider: string
  aggregator: string
  aggregator_user_id?: string
  reference_id?: string
  status: 'pending' | 'connected' | 'disconnected' | 'error'
  last_sync_at?: string
  metadata?: any
  created: string
  updated: string
}

export interface WearableMetricRecord {
  id: string
  user: string
  provider?: string
  date: string
  steps?: number
  heart_rate_avg?: number
  heart_rate_min?: number
  heart_rate_max?: number
  calories_active?: number
  calories_total?: number
  sleep_duration_seconds?: number
  sleep_score?: number
  workouts_count?: number
  workouts_summary?: any
  distance_meters?: number
  synced_at?: string
  created: string
  updated: string
}

export interface LegalDocumentRecord {
  id: string
  slug: string
  title: string
  body: string
  version: number
  status: 'rascunho' | 'publicado' | 'arquivado'
  audience: 'aluno' | 'profissional' | 'todos'
  published_at?: string
  updated_by?: string
  version_history?: Array<{
    version: number
    title: string
    body: string
    published_at: string
    published_by?: string
  }>
  created: string
  updated: string
}

export interface LegalAcceptanceRecord {
  id: string
  user: string
  document: string
  document_slug?: string
  version: number
  accepted_at: string
  ip?: string
  user_agent?: string
  consent_type?: string
  created: string
  updated: string
}

export interface CredentialVerificationRecord {
  id: string
  professional: string
  council: 'CREF' | 'CRN' | 'CREFITO' | 'CRP' | 'FEDERACAO'
  registration_number: string
  document_file?: string
  document_url_fallback?: string
  status: 'pendente' | 'verificado' | 'reprovado'
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  expires_at?: string
  created: string
  updated: string
  expand?: {
    professional?: {
      id: string
      name: string
      email: string
      avatar?: string
      specialties?: string[]
      cref?: string
      approved?: boolean
    }
  }
}

export interface AgentUsageRecord {
  id: string
  user: string
  month: string
  workouts_generated?: number
  chat_messages?: number
  created: string
  updated: string
}

export interface MenstrualCycleLogRecord {
  id: string
  user: string
  date: string
  flow?: 'nenhum' | 'leve' | 'moderado' | 'intenso'
  energy_level?: number
  symptoms?: string[]
  perceived_recovery?: number
  notes?: string
  created: string
  updated: string
}

export interface WorkoutTemplateRecord {
  id: string
  code: string
  title: string
  target_age_group: '40-59' | '60+'
  modality: string
  approved_by_cref?: string
  exercises_structure: Array<{
    block: string
    exercises: Array<{
      name: string
      sets: string
      reps: string
      load: string
      rest: string
    }>
  }>
  guidelines?: string
  is_active?: boolean
  created: string
  updated: string
}

export interface ParqOnboardingRecord {
  id: string
  user: string
  has_heart_condition?: boolean
  has_chest_pain_activity?: boolean
  has_chest_pain_rest?: boolean
  has_dizziness_loss_consciousness?: boolean
  has_bone_joint_problem?: boolean
  has_prescription_blood_pressure_heart?: boolean
  has_other_reason_preventing_activity?: boolean
  passed_clean?: boolean
  medical_clearance_required?: boolean
  medical_clearance_notes?: string
  completed_at: string
  created: string
  updated: string
}

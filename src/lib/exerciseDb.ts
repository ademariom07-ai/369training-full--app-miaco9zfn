// Serviço de correspondência de exercícios com referências fotográficas reais
// Base de dados open-source: free-exercise-db (yuhonas/free-exercise-db - Domínio Público / Unlicense)
// Imagens reais de biomecânica/execução hospedadas publicamente via GitHub Raw / jsDelivr CDN

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

export interface ExerciseReferenceInfo {
  name: string
  imageUrl: string
  fallbackImages?: string[]
  muscleGroup?: string
  equipment?: string
  exerciseDbId?: string
}

// Mapa curado e verificado de exercícios em Português (pt-BR) -> IDs exatos do free-exercise-db
// NUNCA usa fotos aleatórias geradas por palavras-chave genéricas.
export const KNOWN_EXERCISE_MAPPING: Record<
  string,
  {
    id: string
    nameEn: string
    muscle: string
    equipment: string
  }
> = {
  // --- PEITORAL / CHEST ---
  'crucifixo com halteres no banco plano': {
    id: 'Dumbbell_Flyes',
    nameEn: 'Dumbbell Flyes',
    muscle: 'Peitoral',
    equipment: 'Halteres',
  },
  'crucifixo reto': {
    id: 'Dumbbell_Flyes',
    nameEn: 'Dumbbell Flyes',
    muscle: 'Peitoral',
    equipment: 'Halteres',
  },
  'crucifixo inclinado': {
    id: 'Incline_Dumbbell_Flyes',
    nameEn: 'Incline Dumbbell Flyes',
    muscle: 'Peitoral Superior',
    equipment: 'Halteres',
  },
  'crucifixo declinado': {
    id: 'Decline_Dumbbell_Flyes',
    nameEn: 'Decline Dumbbell Flyes',
    muscle: 'Peitoral Inferior',
    equipment: 'Halteres',
  },
  crucifixo: {
    id: 'Dumbbell_Flyes',
    nameEn: 'Dumbbell Flyes',
    muscle: 'Peitoral',
    equipment: 'Halteres',
  },
  crossover: {
    id: 'Cable_Crossover',
    nameEn: 'Cable Crossover',
    muscle: 'Peitoral',
    equipment: 'Polia',
  },
  'crossover na polia': {
    id: 'Cable_Crossover',
    nameEn: 'Cable Crossover',
    muscle: 'Peitoral',
    equipment: 'Polia',
  },
  'supino reto com barra': {
    id: 'Barbell_Bench_Press_-_Medium_Grip',
    nameEn: 'Barbell Bench Press',
    muscle: 'Peitoral',
    equipment: 'Barra',
  },
  'supino reto': {
    id: 'Barbell_Bench_Press_-_Medium_Grip',
    nameEn: 'Barbell Bench Press',
    muscle: 'Peitoral',
    equipment: 'Barra',
  },
  'supino reto com halteres': {
    id: 'Dumbbell_Bench_Press',
    nameEn: 'Dumbbell Bench Press',
    muscle: 'Peitoral',
    equipment: 'Halteres',
  },
  'supino inclinado com barra': {
    id: 'Barbell_Incline_Bench_Press',
    nameEn: 'Barbell Incline Bench Press',
    muscle: 'Peitoral Superior',
    equipment: 'Barra',
  },
  'supino inclinado com halteres': {
    id: 'Incline_Dumbbell_Press',
    nameEn: 'Incline Dumbbell Press',
    muscle: 'Peitoral Superior',
    equipment: 'Halteres',
  },
  'supino inclinado': {
    id: 'Incline_Dumbbell_Press',
    nameEn: 'Incline Dumbbell Press',
    muscle: 'Peitoral Superior',
    equipment: 'Halteres',
  },
  'supino declinado com barra': {
    id: 'Decline_Barbell_Bench_Press',
    nameEn: 'Decline Barbell Bench Press',
    muscle: 'Peitoral Inferior',
    equipment: 'Barra',
  },
  'supino declinado': {
    id: 'Decline_Dumbbell_Flyes',
    nameEn: 'Decline Dumbbell Press',
    muscle: 'Peitoral Inferior',
    equipment: 'Halteres',
  },
  'flexao de braco': {
    id: 'Pushups',
    nameEn: 'Pushups',
    muscle: 'Peitoral',
    equipment: 'Peso Corporal',
  },
  flexoes: {
    id: 'Pushups',
    nameEn: 'Pushups',
    muscle: 'Peitoral',
    equipment: 'Peso Corporal',
  },
  paralelas: {
    id: 'Dips_-_Chest_Version',
    nameEn: 'Dips - Chest Version',
    muscle: 'Peitoral / Tríceps',
    equipment: 'Barras Paralelas',
  },
  'peck deck': {
    id: 'Butterfly',
    nameEn: 'Butterfly / Peck Deck',
    muscle: 'Peitoral',
    equipment: 'Máquina',
  },
  voador: {
    id: 'Butterfly',
    nameEn: 'Butterfly / Peck Deck',
    muscle: 'Peitoral',
    equipment: 'Máquina',
  },

  // --- DORSAL / COSTAS / BACK ---
  'puxada frontal na polia': {
    id: 'V-Bar_Pulldown',
    nameEn: 'Pulldown',
    muscle: 'Dorsal',
    equipment: 'Polia',
  },
  'puxada frontal': {
    id: 'Wide-Grip_Lat_Pulldown',
    nameEn: 'Wide-Grip Lat Pulldown',
    muscle: 'Dorsal',
    equipment: 'Polia',
  },
  'puxada alta': {
    id: 'Wide-Grip_Lat_Pulldown',
    nameEn: 'Wide-Grip Lat Pulldown',
    muscle: 'Dorsal',
    equipment: 'Polia',
  },
  'barra fixa': {
    id: 'Pullups',
    nameEn: 'Pullups',
    muscle: 'Dorsal',
    equipment: 'Barra Fixa',
  },
  'barra fixa pronada': {
    id: 'Pullups',
    nameEn: 'Pullups',
    muscle: 'Dorsal',
    equipment: 'Barra Fixa',
  },
  'barra fixa supinada': {
    id: 'Chin-Up',
    nameEn: 'Chin-Up',
    muscle: 'Dorsal / Bíceps',
    equipment: 'Barra Fixa',
  },
  'remada curvada com barra': {
    id: 'Bent_Over_Barbell_Row',
    nameEn: 'Bent Over Barbell Row',
    muscle: 'Costas',
    equipment: 'Barra',
  },
  'remada curvada': {
    id: 'Bent_Over_Barbell_Row',
    nameEn: 'Bent Over Barbell Row',
    muscle: 'Costas',
    equipment: 'Barra',
  },
  'remada unilateral com halter': {
    id: 'One-Arm_Dumbbell_Row',
    nameEn: 'One-Arm Dumbbell Row',
    muscle: 'Costas',
    equipment: 'Halter',
  },
  'remada serrote': {
    id: 'One-Arm_Dumbbell_Row',
    nameEn: 'One-Arm Dumbbell Row',
    muscle: 'Costas',
    equipment: 'Halter',
  },
  'remada baixa': {
    id: 'Seated_Cable_Rows',
    nameEn: 'Seated Cable Rows',
    muscle: 'Costas',
    equipment: 'Polia',
  },
  'remada sentada': {
    id: 'Seated_Cable_Rows',
    nameEn: 'Seated Cable Rows',
    muscle: 'Costas',
    equipment: 'Polia',
  },
  'remada cavalinho': {
    id: 'T-Bar_Row_with_Handle',
    nameEn: 'T-Bar Row with Handle',
    muscle: 'Costas',
    equipment: 'Barra T',
  },
  pulldown: {
    id: 'Wide-Grip_Lat_Pulldown',
    nameEn: 'Lat Pulldown',
    muscle: 'Dorsal',
    equipment: 'Polia',
  },
  'levantamento terra': {
    id: 'Barbell_Deadlift',
    nameEn: 'Barbell Deadlift',
    muscle: 'Cadeia Posterior',
    equipment: 'Barra',
  },
  terra: {
    id: 'Barbell_Deadlift',
    nameEn: 'Barbell Deadlift',
    muscle: 'Cadeia Posterior',
    equipment: 'Barra',
  },

  // --- PERNAS / LEGS & GLÚTEOS ---
  'agachamento livre com barra': {
    id: 'Barbell_Squat',
    nameEn: 'Barbell Squat',
    muscle: 'Quadríceps / Glúteos',
    equipment: 'Barra',
  },
  'agachamento livre': {
    id: 'Barbell_Squat',
    nameEn: 'Barbell Squat',
    muscle: 'Quadríceps / Glúteos',
    equipment: 'Barra',
  },
  agachamento: {
    id: 'Barbell_Squat',
    nameEn: 'Barbell Squat',
    muscle: 'Quadríceps / Glúteos',
    equipment: 'Barra',
  },
  'agachamento frontal': {
    id: 'Front_Barbell_Squat',
    nameEn: 'Front Barbell Squat',
    muscle: 'Quadríceps',
    equipment: 'Barra',
  },
  'agachamento sumô': {
    id: 'Plie_Dumbbell_Squat',
    nameEn: 'Plie Dumbbell Squat / Sumo Squat',
    muscle: 'Quadríceps / Adutores',
    equipment: 'Halter',
  },
  'agachamento bulgaro': {
    id: 'Single_Leg_Squat',
    nameEn: 'Bulgarian Split Squat',
    muscle: 'Quadríceps / Glúteos',
    equipment: 'Halteres / Peso Corporal',
  },
  'leg press 45': {
    id: 'Leg_Press',
    nameEn: 'Leg Press',
    muscle: 'Quadríceps',
    equipment: 'Máquina Leg Press',
  },
  'leg press': {
    id: 'Leg_Press',
    nameEn: 'Leg Press',
    muscle: 'Quadríceps',
    equipment: 'Máquina Leg Press',
  },
  'cadeira extensora': {
    id: 'Leg_Extensions',
    nameEn: 'Leg Extensions',
    muscle: 'Quadríceps',
    equipment: 'Máquina',
  },
  extensora: {
    id: 'Leg_Extensions',
    nameEn: 'Leg Extensions',
    muscle: 'Quadríceps',
    equipment: 'Máquina',
  },
  'mesa flexora': {
    id: 'Lying_Leg_Curls',
    nameEn: 'Lying Leg Curls',
    muscle: 'Isquiotibiais',
    equipment: 'Máquina',
  },
  'cadeira flexora': {
    id: 'Seated_Leg_Curl',
    nameEn: 'Seated Leg Curl',
    muscle: 'Isquiotibiais',
    equipment: 'Máquina',
  },
  'stiff com barra': {
    id: 'Stiff-Legged_Barbell_Deadlift',
    nameEn: 'Stiff-Legged Barbell Deadlift',
    muscle: 'Isquiotibiais / Glúteos',
    equipment: 'Barra',
  },
  'stiff com halteres': {
    id: 'Stiff-Legged_Dumbbell_Deadlift',
    nameEn: 'Stiff-Legged Dumbbell Deadlift',
    muscle: 'Isquiotibiais / Glúteos',
    equipment: 'Halteres',
  },
  stiff: {
    id: 'Stiff-Legged_Barbell_Deadlift',
    nameEn: 'Stiff-Legged Barbell Deadlift',
    muscle: 'Isquiotibiais / Glúteos',
    equipment: 'Barra',
  },
  'afundo com halteres': {
    id: 'Dumbbell_Lunges',
    nameEn: 'Dumbbell Lunges',
    muscle: 'Pernas / Glúteos',
    equipment: 'Halteres',
  },
  afundo: {
    id: 'Dumbbell_Lunges',
    nameEn: 'Dumbbell Lunges',
    muscle: 'Pernas / Glúteos',
    equipment: 'Halteres',
  },
  avanco: {
    id: 'Barbell_Lunge',
    nameEn: 'Barbell Lunge',
    muscle: 'Pernas / Glúteos',
    equipment: 'Barra',
  },
  'elevacao pelvica': {
    id: 'Barbell_Hip_Thrust',
    nameEn: 'Barbell Hip Thrust',
    muscle: 'Glúteos',
    equipment: 'Barra',
  },
  'hip thrust': {
    id: 'Barbell_Hip_Thrust',
    nameEn: 'Barbell Hip Thrust',
    muscle: 'Glúteos',
    equipment: 'Barra',
  },
  'panturrilha em pe': {
    id: 'Standing_Calf_Raises',
    nameEn: 'Standing Calf Raises',
    muscle: 'Panturrilha',
    equipment: 'Máquina / Degrau',
  },
  'panturrilha sentada': {
    id: 'Seated_Calf_Raise',
    nameEn: 'Seated Calf Raise',
    muscle: 'Panturrilha (Sóleo)',
    equipment: 'Máquina',
  },
  panturrilha: {
    id: 'Standing_Calf_Raises',
    nameEn: 'Standing Calf Raises',
    muscle: 'Panturrilha',
    equipment: 'Máquina',
  },

  // --- OMBROS / SHOULDERS ---
  'desenvolvimento com halteres': {
    id: 'Dumbbell_Shoulder_Press',
    nameEn: 'Dumbbell Shoulder Press',
    muscle: 'Ombros',
    equipment: 'Halteres',
  },
  'desenvolvimento militar': {
    id: 'Standing_Military_Press',
    nameEn: 'Standing Military Press',
    muscle: 'Ombros',
    equipment: 'Barra',
  },
  'desenvolvimento com barra': {
    id: 'Standing_Military_Press',
    nameEn: 'Standing Military Press',
    muscle: 'Ombros',
    equipment: 'Barra',
  },
  desenvolvimento: {
    id: 'Dumbbell_Shoulder_Press',
    nameEn: 'Dumbbell Shoulder Press',
    muscle: 'Ombros',
    equipment: 'Halteres',
  },
  'elevacao lateral com halteres': {
    id: 'Side_Lateral_Raise',
    nameEn: 'Side Lateral Raise',
    muscle: 'Deltoide Lateral',
    equipment: 'Halteres',
  },
  'elevacao lateral': {
    id: 'Side_Lateral_Raise',
    nameEn: 'Side Lateral Raise',
    muscle: 'Deltoide Lateral',
    equipment: 'Halteres',
  },
  'elevacao frontal': {
    id: 'Front_Dumbbell_Raise',
    nameEn: 'Front Dumbbell Raise',
    muscle: 'Deltoide Anterior',
    equipment: 'Halteres',
  },
  'crucifixo invertido': {
    id: 'Reverse_Flyes',
    nameEn: 'Reverse Flyes',
    muscle: 'Deltoide Posterior',
    equipment: 'Halteres',
  },
  'face pull': {
    id: 'Face_Pull',
    nameEn: 'Face Pull',
    muscle: 'Deltoide Posterior / Trapézio',
    equipment: 'Polia',
  },
  'encolhimento de ombros': {
    id: 'Barbell_Shrug',
    nameEn: 'Barbell Shrug',
    muscle: 'Trapézio',
    equipment: 'Barra',
  },
  'encolhimento com halteres': {
    id: 'Dumbbell_Shrug',
    nameEn: 'Dumbbell Shrug',
    muscle: 'Trapézio',
    equipment: 'Halteres',
  },

  // --- BÍCEPS ---
  'rosca direta com barra': {
    id: 'Barbell_Curl',
    nameEn: 'Barbell Curl',
    muscle: 'Bíceps',
    equipment: 'Barra',
  },
  'rosca direta': {
    id: 'Barbell_Curl',
    nameEn: 'Barbell Curl',
    muscle: 'Bíceps',
    equipment: 'Barra',
  },
  'rosca alternada com halteres': {
    id: 'Alternate_Hammer_Curl',
    nameEn: 'Alternate Dumbbell Curl',
    muscle: 'Bíceps',
    equipment: 'Halteres',
  },
  'rosca alternada': {
    id: 'Alternate_Incline_Dumbbell_Curl',
    nameEn: 'Alternate Incline Dumbbell Curl',
    muscle: 'Bíceps',
    equipment: 'Halteres',
  },
  'rosca martelo': {
    id: 'Hammer_Curls',
    nameEn: 'Hammer Curls',
    muscle: 'Bíceps / Braquial',
    equipment: 'Halteres',
  },
  'rosca scott': {
    id: 'Preacher_Curl',
    nameEn: 'Preacher Curl',
    muscle: 'Bíceps',
    equipment: 'Banco Scott',
  },
  'rosca concentrada': {
    id: 'Concentration_Curls',
    nameEn: 'Concentration Curls',
    muscle: 'Bíceps',
    equipment: 'Halter',
  },
  'rosca no cabo': {
    id: 'Cable_Curl',
    nameEn: 'Cable Curl',
    muscle: 'Bíceps',
    equipment: 'Polia',
  },

  // --- TRÍCEPS ---
  'triceps pulley': {
    id: 'Triceps_Pushdown',
    nameEn: 'Triceps Pushdown',
    muscle: 'Tríceps',
    equipment: 'Polia',
  },
  'triceps corda': {
    id: 'Triceps_Pushdown_-_Rope_Attachment',
    nameEn: 'Triceps Pushdown - Rope Attachment',
    muscle: 'Tríceps',
    equipment: 'Polia / Corda',
  },
  'triceps testa': {
    id: 'Lying_Triceps_Press',
    nameEn: 'Lying Triceps Press / Skull Crusher',
    muscle: 'Tríceps',
    equipment: 'Barra W / Halteres',
  },
  'triceps frances': {
    id: 'Seated_Triceps_Press',
    nameEn: 'Seated Triceps Press',
    muscle: 'Tríceps',
    equipment: 'Halter',
  },
  'triceps banco': {
    id: 'Bench_Dips',
    nameEn: 'Bench Dips',
    muscle: 'Tríceps',
    equipment: 'Banco',
  },
  'triceps coice': {
    id: 'Tricep_Dumbbell_Kickback',
    nameEn: 'Tricep Dumbbell Kickback',
    muscle: 'Tríceps',
    equipment: 'Halter',
  },

  // --- ABDÔMEN & CORE ---
  'prancha abdominal isometrica': {
    id: 'Plank',
    nameEn: 'Plank',
    muscle: 'Core / Abdômen',
    equipment: 'Peso Corporal',
  },
  prancha: {
    id: 'Plank',
    nameEn: 'Plank',
    muscle: 'Core / Abdômen',
    equipment: 'Peso Corporal',
  },
  'prancha lateral': {
    id: 'Side_Plank',
    nameEn: 'Side Plank',
    muscle: 'Oblíquos',
    equipment: 'Peso Corporal',
  },
  'abdominal supra': {
    id: 'Crunches',
    nameEn: 'Crunches',
    muscle: 'Abdômen',
    equipment: 'Solo',
  },
  'abdominal crunch': {
    id: 'Crunches',
    nameEn: 'Crunches',
    muscle: 'Abdômen',
    equipment: 'Solo',
  },
  'abdominal infra': {
    id: 'Reverse_Crunch',
    nameEn: 'Reverse Crunch / Leg Raise',
    muscle: 'Abdômen Inferior',
    equipment: 'Solo',
  },
  'elevacao de pernas': {
    id: 'Hanging_Leg_Raise',
    nameEn: 'Hanging Leg Raise',
    muscle: 'Abdômen Inferior',
    equipment: 'Barra Fixa',
  },
  abdominal: {
    id: 'Crunches',
    nameEn: 'Crunches',
    muscle: 'Abdômen',
    equipment: 'Solo',
  },
  'aquecimento e mobilidade articular': {
    id: 'Dynamic_Chest_Stretch',
    nameEn: 'Warm-up / Mobility',
    muscle: 'Aquecimento Geral',
    equipment: 'Peso Corporal',
  },
  aquecimento: {
    id: 'Dynamic_Chest_Stretch',
    nameEn: 'Warm-up',
    muscle: 'Aquecimento Geral',
    equipment: 'Peso Corporal',
  },
}

// Normalizador de texto para busca sem acentos ou caracteres especiais
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s]/gi, ' ') // remove pontuação
    .replace(/\s+/g, ' ')
    .trim()
}

// Cache em memória para evitar reprocessamento
const cacheByCleanName = new Map<string, ExerciseReferenceInfo | null>()

/**
 * Busca a imagem real e metadados de execução para um exercício pelo nome em pt-BR ou en-US.
 * Retorna null se não houver referência confiável (para que a UI renderize o fallback limpo de biomecânica).
 */
export async function fetchExerciseReference(
  exerciseName?: string | null,
): Promise<ExerciseReferenceInfo | null> {
  if (!exerciseName || typeof exerciseName !== 'string') return null
  const clean = normalizeText(exerciseName)
  if (!clean) return null

  if (cacheByCleanName.has(clean)) {
    return cacheByCleanName.get(clean) || null
  }

  // 1. Tentar correspondência exata no mapa curado
  if (KNOWN_EXERCISE_MAPPING[clean]) {
    const item = KNOWN_EXERCISE_MAPPING[clean]
    const info: ExerciseReferenceInfo = {
      name: item.nameEn,
      imageUrl: `${GITHUB_RAW_BASE}/${item.id}/0.jpg`,
      fallbackImages: [`${GITHUB_RAW_BASE}/${item.id}/1.jpg`],
      muscleGroup: item.muscle,
      equipment: item.equipment,
      exerciseDbId: item.id,
    }
    cacheByCleanName.set(clean, info)
    return info
  }

  // 2. Tentar correspondência por subfrase / palavra-chave mais longa no mapa curado
  // Ordena por comprimento decrescente para priorizar "supino inclinado com halteres" sobre "supino"
  const keys = Object.keys(KNOWN_EXERCISE_MAPPING).sort((a, b) => b.length - a.length)

  for (const key of keys) {
    if (clean.includes(key) || key.includes(clean)) {
      const item = KNOWN_EXERCISE_MAPPING[key]
      const info: ExerciseReferenceInfo = {
        name: item.nameEn,
        imageUrl: `${GITHUB_RAW_BASE}/${item.id}/0.jpg`,
        fallbackImages: [`${GITHUB_RAW_BASE}/${item.id}/1.jpg`],
        muscleGroup: item.muscle,
        equipment: item.equipment,
        exerciseDbId: item.id,
      }
      cacheByCleanName.set(clean, info)
      return info
    }
  }

  // 3. Heurística de palavras-chave biomecânicas específicas (evita falsos positivos como "crucifixo religioso")
  const heuristicRules: Array<{
    keywords: string[]
    id: string
    nameEn: string
    muscle: string
    equipment: string
  }> = [
    {
      keywords: ['crucifixo', 'crucifix'],
      id: 'Dumbbell_Flyes',
      nameEn: 'Dumbbell Flyes',
      muscle: 'Peitoral',
      equipment: 'Halteres',
    },
    {
      keywords: ['supino'],
      id: 'Barbell_Bench_Press_-_Medium_Grip',
      nameEn: 'Bench Press',
      muscle: 'Peitoral',
      equipment: 'Barra',
    },
    {
      keywords: ['agachamento', 'squat'],
      id: 'Barbell_Squat',
      nameEn: 'Squat',
      muscle: 'Quadríceps',
      equipment: 'Barra',
    },
    {
      keywords: ['leg press', 'leg 45'],
      id: 'Leg_Press',
      nameEn: 'Leg Press',
      muscle: 'Pernas',
      equipment: 'Máquina',
    },
    {
      keywords: ['extensora', 'extensao de perna'],
      id: 'Leg_Extensions',
      nameEn: 'Leg Extension',
      muscle: 'Quadríceps',
      equipment: 'Máquina',
    },
    {
      keywords: ['flexora'],
      id: 'Lying_Leg_Curls',
      nameEn: 'Leg Curl',
      muscle: 'Posterior de Coxa',
      equipment: 'Máquina',
    },
    {
      keywords: ['puxada', 'pulldown'],
      id: 'Wide-Grip_Lat_Pulldown',
      nameEn: 'Lat Pulldown',
      muscle: 'Dorsal',
      equipment: 'Polia',
    },
    {
      keywords: ['remada', 'row'],
      id: 'Bent_Over_Barbell_Row',
      nameEn: 'Row',
      muscle: 'Costas',
      equipment: 'Barra',
    },
    {
      keywords: ['stiff'],
      id: 'Stiff-Legged_Barbell_Deadlift',
      nameEn: 'Stiff Leg Deadlift',
      muscle: 'Posterior',
      equipment: 'Barra',
    },
    {
      keywords: ['terra', 'deadlift'],
      id: 'Barbell_Deadlift',
      nameEn: 'Deadlift',
      muscle: 'Costas / Pernas',
      equipment: 'Barra',
    },
    {
      keywords: ['desenvolvimento', 'shoulder press', 'militar'],
      id: 'Dumbbell_Shoulder_Press',
      nameEn: 'Shoulder Press',
      muscle: 'Ombros',
      equipment: 'Halteres',
    },
    {
      keywords: ['elevacao lateral', 'lateral raise'],
      id: 'Side_Lateral_Raise',
      nameEn: 'Lateral Raise',
      muscle: 'Ombros',
      equipment: 'Halteres',
    },
    {
      keywords: ['rosca', 'biceps curl'],
      id: 'Barbell_Curl',
      nameEn: 'Bicep Curl',
      muscle: 'Bíceps',
      equipment: 'Barra',
    },
    {
      keywords: ['triceps'],
      id: 'Triceps_Pushdown',
      nameEn: 'Triceps Pushdown',
      muscle: 'Tríceps',
      equipment: 'Polia',
    },
    {
      keywords: ['prancha', 'plank'],
      id: 'Plank',
      nameEn: 'Plank',
      muscle: 'Core',
      equipment: 'Peso Corporal',
    },
    {
      keywords: ['abdominal', 'crunch'],
      id: 'Crunches',
      nameEn: 'Crunches',
      muscle: 'Abdômen',
      equipment: 'Solo',
    },
    {
      keywords: ['afundo', 'avanco', 'lunge'],
      id: 'Dumbbell_Lunges',
      nameEn: 'Lunges',
      muscle: 'Pernas',
      equipment: 'Halteres',
    },
    {
      keywords: ['panturrilha', 'gemeos', 'calf'],
      id: 'Standing_Calf_Raises',
      nameEn: 'Calf Raise',
      muscle: 'Panturrilha',
      equipment: 'Máquina',
    },
  ]

  for (const rule of heuristicRules) {
    if (rule.keywords.some((kw) => clean.includes(kw))) {
      const info: ExerciseReferenceInfo = {
        name: rule.nameEn,
        imageUrl: `${GITHUB_RAW_BASE}/${rule.id}/0.jpg`,
        fallbackImages: [`${GITHUB_RAW_BASE}/${rule.id}/1.jpg`],
        muscleGroup: rule.muscle,
        equipment: rule.equipment,
        exerciseDbId: rule.id,
      }
      cacheByCleanName.set(clean, info)
      return info
    }
  }

  // Se não encontrar correspondência CONFIÁVEL, retorna null.
  // Regra do usuário: NUNCA retornar imagem genérica/errada.
  cacheByCleanName.set(clean, null)
  return null
}

/**
 * Função de retrocompatibilidade com a assinatura anterior: retorna apenas a URL da imagem/GIF ou null.
 */
export async function fetchExerciseGif(exerciseName?: string | null): Promise<string | null> {
  const ref = await fetchExerciseReference(exerciseName)
  return ref ? ref.imageUrl : null
}

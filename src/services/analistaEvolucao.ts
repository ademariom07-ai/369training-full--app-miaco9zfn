import pb from '@/lib/pocketbase/client'

export interface TopExerciseProgression {
  name: string
  firstWeight: number
  lastWeight: number
  maxWeight: number
  deltaKg: number
  progressionPct: number
  setsCount: number
}

export interface StudentAnalysisMetrics {
  totalLogs: number
  distinctDays: number
  totalVolumeKg: number
  avgRpe: number
  topExercises: TopExerciseProgression[]
  appointments?: {
    total: number
    concluded: number
    canceled: number
    pending: number
    absenceRatePct: number
  }
  clinical?: {
    maxPainLevel: number
    categories: string[]
  }
  reviews?: {
    count: number
    avgRating: number
  }
}

export interface AiInsightRecord {
  id: string
  professional: string
  student: string
  insight_type: 'evolucao_aluno' | 'resumo_aluno' | 'csv_import'
  content: string
  metrics_snapshot?: StudentAnalysisMetrics
  csv_import?: string
  generated_by?: string
  model?: string
  created: string
  updated: string
  expand?: {
    student?: {
      id: string
      name: string
      email: string
      avatar?: string
    }
    professional?: {
      id: string
      name: string
    }
  }
}

export interface AnalisarAlunoResponse {
  success: boolean
  insight_id: string
  student_id: string
  student_name: string
  metrics: StudentAnalysisMetrics
  content: string
  model: string
}

export interface ResumoAlunoResponse {
  success: boolean
  points: string[]
  raw_content?: string
  metrics?: StudentAnalysisMetrics
  has_data: boolean
}

export interface CsvImportResult {
  success: boolean
  csv_import_id: string
  file_name: string
  row_count: number
  message: string
}

export interface ParsedCsvSummary {
  rowCount: number
  headers: string[]
  previewRows: Array<Record<string, string>>
  summaryText: string
}

/**
 * Faz a chamada ao endpoint do backend do Analista de Evolução para o profissional
 */
export async function analisarAlunoComIa(params: {
  studentId: string
  csvContext?: string
  csvImportId?: string
}): Promise<AnalisarAlunoResponse> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(`${baseUrl}/backend/v1/ai/analista/analisar-aluno`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        student_id: params.studentId,
        csv_context: params.csvContext || '',
        csv_import_id: params.csvImportId || null,
      }),
      signal: controller.signal,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Erro ao processar análise do aluno com IA')
    }

    return data
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('A análise demorou mais que 10s para responder. Tente novamente mais tarde.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Busca o resumo de 3 a 5 pontos para a tela /aluno/evolucao
 */
export async function fetchResumoAlunoIa(): Promise<ResumoAlunoResponse> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(`${baseUrl}/backend/v1/ai/analista/resumo-aluno`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Erro ao carregar resumo da IA')
    }

    return data
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('O resumo da IA demorou mais que 10s para responder.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Registra uma planilha CSV importada pelo profissional
 */
export async function registrarImportacaoCsv(params: {
  studentId: string
  fileName: string
  rowCount: number
  columnsDetected: string[]
  parsedSummary: Record<string, unknown>
}): Promise<CsvImportResult> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  const res = await fetch(`${baseUrl}/backend/v1/ai/analista/import-csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      student_id: params.studentId,
      file_name: params.fileName,
      row_count: params.rowCount,
      columns_detected: params.columnsDetected,
      parsed_summary: params.parsedSummary,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao registrar planilha CSV')
  }

  return data
}

/**
 * Busca o histórico de insights de um aluno
 */
export async function fetchHistoricoInsights(
  studentId: string,
  limit = 10,
): Promise<AiInsightRecord[]> {
  try {
    const list = await pb.collection('ai_insights').getList<AiInsightRecord>(1, limit, {
      filter: `student = "${studentId}" && insight_type = "evolucao_aluno"`,
      sort: '-created',
      expand: 'student,professional',
    })
    return list.items
  } catch {
    return []
  }
}

/**
 * Parser de arquivo CSV no frontend (suporta delimitadores ',' e ';')
 */
export function parseCsvFileContent(rawText: string): ParsedCsvSummary {
  const clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return {
      rowCount: 0,
      headers: [],
      previewRows: [],
      summaryText: 'Arquivo vazio.',
    }
  }

  // Detectar delimitador (vírgula ou ponto e vírgula)
  const firstLine = lines[0]
  const semiCount = (firstLine.match(/;/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  const delimiter = semiCount > commaCount ? ';' : ','

  const splitLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  }

  const rawHeaders = splitLine(firstLine).map((h) => h.replace(/^["']|["']$/g, '').trim())
  const headers = rawHeaders.filter((h) => h.length > 0)

  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i])
    if (values.length === 0 || (values.length === 1 && !values[0])) continue

    const rowObj: Record<string, string> = {}
    headers.forEach((header, idx) => {
      rowObj[header] = (values[idx] || '').replace(/^["']|["']$/g, '').trim()
    })
    rows.push(rowObj)
  }

  // Montar resumo textual para enriquecer o prompt da IA
  const preview = rows.slice(0, 10)
  const summaryParts: string[] = [
    `Planilha com ${rows.length} registros e colunas: ${headers.join(', ')}.`,
  ]

  // Tentar encontrar colunas conhecidas (exercício, carga/peso, reps, data)
  const exerciseCol = headers.find((h) => /exerc|treino|atividade/i.test(h))
  const weightCol = headers.find((h) => /peso|carga|kg|weight/i.test(h))
  const repsCol = headers.find((h) => /rep|repet/i.test(h))
  const dateCol = headers.find((h) => /data|date|dia/i.test(h))

  if (exerciseCol || weightCol) {
    summaryParts.push('Amostra de registros extraídos da planilha do profissional:')
    preview.forEach((r, idx) => {
      const parts = [`Registro #${idx + 1}:`]
      if (dateCol && r[dateCol]) parts.push(`Data: ${r[dateCol]}`)
      if (exerciseCol && r[exerciseCol]) parts.push(`Exercício: ${r[exerciseCol]}`)
      if (weightCol && r[weightCol]) parts.push(`Carga: ${r[weightCol]} kg`)
      if (repsCol && r[repsCol]) parts.push(`Reps: ${r[repsCol]}`)
      summaryParts.push(`  - ${parts.join(' | ')}`)
    })
  }

  return {
    rowCount: rows.length,
    headers,
    previewRows: preview,
    summaryText: summaryParts.join('\n'),
  }
}

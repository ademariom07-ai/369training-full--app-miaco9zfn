import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * Traduz códigos e mensagens de erro do PocketBase para português amigável.
 */
function translatePocketBaseMessage(field: string, code?: string, rawMessage?: string): string {
  const normalizedCode = (code || '').toLowerCase()
  const normalizedMsg = (rawMessage || '').toLowerCase()

  // Erros de unicidade (validation_not_unique ou mensagens com "unique" / "already exists")
  if (
    normalizedCode === 'validation_not_unique' ||
    normalizedMsg.includes('must be unique') ||
    normalizedMsg.includes('already in use') ||
    normalizedMsg.includes('already exists')
  ) {
    if (field === 'email') {
      return 'Este e-mail já está cadastrado. Use outro e-mail ou faça login.'
    }
    if (field === 'username') {
      return 'Este nome de usuário já está em uso.'
    }
    if (field === 'referral_code') {
      return 'Código de indicação já existente.'
    }
    return `O valor informado para o campo "${field}" já está em uso.`
  }

  // Erro de campo obrigatório (validation_required ou "missing_required_value")
  if (
    normalizedCode === 'validation_required' ||
    normalizedCode === 'validation_missing_required' ||
    normalizedMsg.includes('required') ||
    normalizedMsg.includes('cannot be blank')
  ) {
    if (field === 'email') return 'O e-mail é obrigatório.'
    if (field === 'password' || field === 'passwordConfirm') return 'A senha é obrigatória.'
    if (field === 'name') return 'O nome é obrigatório.'
    if (field === 'phone') return 'O telefone é obrigatório.'
    if (field === 'cref') return 'O número de registro (CREF/CRN/CREFITO) é obrigatório.'
    return `O campo "${field}" é obrigatório.`
  }

  // Erro de tamanho / comprimento fora da faixa permitida
  if (
    normalizedCode === 'validation_length_out_of_range' ||
    normalizedCode === 'validation_min_length' ||
    normalizedCode === 'validation_max_length' ||
    normalizedMsg.includes('length must be between') ||
    normalizedMsg.includes('out of range')
  ) {
    if (field === 'password' || field === 'passwordConfirm') {
      return 'A senha deve ter entre 8 e 72 caracteres.'
    }
    if (field === 'phone') {
      return 'Telefone inválido ou com tamanho incorreto.'
    }
    return `O campo "${field}" possui um tamanho de texto inválido.`
  }

  // Erro de formato de e-mail
  if (
    normalizedCode === 'validation_is_email' ||
    normalizedMsg.includes('valid email') ||
    (field === 'email' && normalizedCode.includes('invalid'))
  ) {
    return 'Por favor, informe um endereço de e-mail válido.'
  }

  // Senhas não conferem (password mismatch)
  if (
    normalizedCode === 'validation_match' ||
    normalizedCode === 'validation_values_mismatch' ||
    normalizedMsg.includes('match') ||
    normalizedMsg.includes('confirm')
  ) {
    return 'A confirmação de senha não confere com a senha digitada.'
  }

  // Se veio mensagem legível original (não em inglês técnico padrão), retorna ou faz fallback
  if (rawMessage && !rawMessage.startsWith('validation_')) {
    // Mapeamento de mensagens genéricas comuns do PocketBase
    if (
      normalizedMsg === 'failed to create record.' ||
      normalizedMsg === 'failed to create record'
    ) {
      return 'Falha ao criar conta. Verifique os dados inseridos.'
    }
    if (normalizedMsg === 'failed to authenticate.' || normalizedMsg === 'failed to authenticate') {
      return 'E-mail ou senha incorretos.'
    }
    if (normalizedMsg.includes('something went wrong')) {
      return 'Ocorreu um erro no servidor. Tente novamente mais tarde.'
    }
    return rawMessage
  }

  return 'Dados inválidos. Verifique as informações fornecidas.'
}

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (detail && typeof detail === 'object') {
      const code =
        'code' in detail && typeof (detail as { code: unknown }).code === 'string'
          ? (detail as { code: string }).code
          : undefined
      const rawMsg =
        'message' in detail && typeof (detail as { message: unknown }).message === 'string'
          ? (detail as { message: string }).message
          : undefined

      errors[field] = translatePocketBaseMessage(field, code, rawMsg)
    } else if (typeof detail === 'string') {
      errors[field] = translatePocketBaseMessage(field, undefined, detail)
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return 'Falha na conexão com o servidor. Verifique sua internet e tente novamente.'
      }
      return error.message
    }
    return 'Ocorreu um erro inesperado.'
  }

  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) {
    return msgs.join(' ')
  }

  // Fallback para mensagens de status ou top-level do PocketBase
  const status = error.status
  const rawMsg = error.message || ''
  const normalizedMsg = rawMsg.toLowerCase()

  if (status === 400) {
    if (normalizedMsg.includes('failed to create record')) {
      return 'Falha ao realizar cadastro. Verifique os dados inseridos.'
    }
    if (normalizedMsg.includes('failed to authenticate')) {
      return 'E-mail ou senha incorretos.'
    }
    return rawMsg || 'Dados inválidos. Verifique os campos informados.'
  }

  if (status === 401 || status === 403) {
    return 'Acesso não autorizado. Verifique suas credenciais.'
  }

  if (status === 404) {
    return 'Registro ou recurso não encontrado.'
  }

  if (status >= 500) {
    return 'Erro interno no servidor. Tente novamente mais tarde.'
  }

  return rawMsg || 'Ocorreu um erro inesperado.'
}

import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

// Tradução das mensagens padrão do PocketBase (inglês) para português,
// para que o usuário nunca veja um erro técnico em inglês.
const PT_BR_MESSAGES: Record<string, string> = {
  'Failed to authenticate.': 'E-mail ou senha incorretos. Verifique seus dados de acesso.',
  'Failed to create record.': 'Não foi possível salvar o registro. Verifique os dados informados.',
  'Failed to update record.':
    'Não foi possível atualizar o registro. Verifique os dados informados.',
  'Failed to delete record.': 'Não foi possível excluir o registro. Tente novamente.',
  'Missing or invalid authorization token.':
    'Sua sessão expirou. Faça login novamente para continuar.',
  'The request requires valid authentication token to be set.':
    'Sua sessão expirou. Faça login novamente para continuar.',
  'Insufficient permissions to create the resource.':
    'Você não tem permissão para realizar esta ação.',
  'Insufficient permissions to update the resource.':
    'Você não tem permissão para realizar esta ação.',
  'Insufficient permissions to delete the resource.':
    'Você não tem permissão para realizar esta ação.',
}

function translate(raw: string): string {
  const trimmed = raw.trim()
  if (PT_BR_MESSAGES[trimmed]) return PT_BR_MESSAGES[trimmed]
  return trimmed
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'
  }

  // Bloqueio por e-mail não confirmado (backend 369WELLNESS): mensagem clara e acolhedora.
  const resp = error.response as { code?: number; message?: string } | undefined
  const rawMessage = resp?.message || error.message || ''
  if (rawMessage.includes('Confirme seu e-mail') || rawMessage.includes('EMAIL_NOT_VERIFIED')) {
    return 'Confirme seu e-mail para continuar. Enviamos um link de confirmação para a sua caixa de entrada.'
  }

  const msgs = Object.values(extractFieldErrors(error)).map(translate)
  if (msgs.length > 0) return msgs.join(' ')
  return translate(rawMessage) || 'Ocorreu um erro inesperado. Tente novamente.'
}

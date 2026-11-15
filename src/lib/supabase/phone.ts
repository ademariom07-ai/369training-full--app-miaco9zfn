// Mesmo critério de wellness_private.normalize_signup_phone (migração 20261115120000):
// celular brasileiro com DDD (9 + 8 dígitos) ou fixo (2–5 + 7 dígitos), com ou sem +55.
// Retorna o formato internacional (+55DDDNUMERO) ou null se inválido.
export function normalizeBrazilPhone(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > 40) return null
  let digits = raw.replace(/[\s()+.-]/g, '')
  if (!/^[0-9]+$/.test(digits)) return null
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits
  if (!/^55[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$/.test(digits)) return null
  return '+' + digits
}

// Nome completo: ao menos nome e sobrenome, espaços normalizados, até 160 caracteres.
export function normalizeFullName(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 3 || name.length > 160 || name.split(' ').length < 2) return null
  return name
}

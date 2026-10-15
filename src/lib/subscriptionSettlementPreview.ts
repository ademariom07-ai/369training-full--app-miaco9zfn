import type { WellnessPlan } from './wellnessCommercialRules'

export interface MonthlyInvoice {
  invoiceId: string
  payerId: string
  payerType: 'student' | 'partner'
  plan: WellnessPlan
  period: string
  amountCents: number
  linkedStudentAtBilling: boolean
}
export interface SubscriptionReceipt {
  paymentId: string
  invoiceId: string
  payerId: string
  currency: string
  amountCents: number
  status: 'pending' | 'settled' | 'void'
  refundedCents: number
  disputed: boolean
}
/** Pure reconciliation proposal, never payment evidence. The future server adapter
 * must authenticate provider events, lock the invoice and enforce unique payment
 * and invoice settlement keys atomically before activating any subscription.
 * Link/plan snapshots belong to the invoice, not to the current mutable profile.
 */
export function previewSubscriptionSettlement(invoice: MonthlyInvoice, receipt: SubscriptionReceipt, existing: { invoiceId: string; paymentId: string }[] = []) {
  const identifier = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 200 && v.trim() === v
  if (!invoice || !receipt || ![invoice.invoiceId, invoice.payerId, receipt.paymentId, receipt.invoiceId, receipt.payerId].every(identifier) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(invoice.period) || typeof invoice.linkedStudentAtBilling !== 'boolean' ||
    typeof receipt.disputed !== 'boolean' || !['pending', 'settled', 'void'].includes(receipt.status) || receipt.currency !== 'BRL') throw Error('Dados de mensalidade inválidos.')
  for (const amount of [invoice.amountCents, receipt.amountCents, receipt.refundedCents]) if (!Number.isSafeInteger(amount) || amount < 0) throw Error('Use centavos inteiros não negativos.')
  let expected: number
  if (invoice.payerType === 'student') {
    if (invoice.linkedStudentAtBilling) throw Error('Aluno vinculado não gera nova mensalidade. Concilie a cobrança antes de prosseguir.')
    const fees = { basic: 1000, pro: 2000, premium: 3000 }
    if (!Object.hasOwn(fees, invoice.plan)) throw Error('Este plano de aluno não gera mensalidade paga.')
    expected = fees[invoice.plan as keyof typeof fees]
  } else if (invoice.payerType === 'partner' && invoice.plan === 'pro_partner' && !invoice.linkedStudentAtBilling) {
    expected = 14900
  } else throw Error('Parceiro básico, pro e premium paga por serviço validado, não por mensalidade.')
  if (invoice.amountCents !== expected || receipt.amountCents !== expected || receipt.invoiceId !== invoice.invoiceId || receipt.payerId !== invoice.payerId) throw Error('Pagamento diverge da fatura, pagador ou tarifa contratada.')
  if (receipt.disputed || receipt.refundedCents > 0) throw Error('Disputa ou estorno exige conciliação; não ativar automaticamente.')
  if (!Array.isArray(existing) || existing.some(row => !row || !identifier(row.invoiceId) || !identifier(row.paymentId))) throw Error('Histórico de liquidações inválido.')
  const matches = existing.filter(row => row.invoiceId === invoice.invoiceId || row.paymentId === receipt.paymentId)
  const base = { simulationOnly: true as const, paymentAuthorized: false as const, activationAuthorized: false as const, tariffToPostCents: 0 }
  if (matches.length) {
    if (matches.length === 1 && matches[0].invoiceId === invoice.invoiceId && matches[0].paymentId === receipt.paymentId && receipt.status === 'settled') return { ...base, status: 'already_settled' as const }
    throw Error('Fatura ou pagamento já utilizado. Concilie antes de lançar novamente.')
  }
  if (receipt.status === 'void') return { ...base, status: 'payment_void' as const }
  if (receipt.status === 'pending') return { ...base, status: 'pending_payment' as const }
  return { ...base, status: 'ready_for_server_transaction' as const, tariffToPostCents: expected,
    invoiceId: invoice.invoiceId, paymentId: receipt.paymentId, period: invoice.period, requestedPlan: invoice.plan,
    settlementKey: JSON.stringify(['monthly_invoice', invoice.invoiceId]),
    paymentKey: JSON.stringify(['subscription_payment', receipt.paymentId]),
    cashbackSource: 'confirmed_platform_tariff' as const }
}

import { describe, expect, it } from 'vitest'
import { previewSubscriptionSettlement as preview, type MonthlyInvoice, type SubscriptionReceipt } from './subscriptionSettlementPreview'
import { prepareConfirmedFeePool } from './wellnessCommercialRules'
const invoice: MonthlyInvoice = { invoiceId: 'invoice1', payerId: 'student1', payerType: 'student', plan: 'pro', period: '2026-10', amountCents: 2000, linkedStudentAtBilling: false }
const receipt: SubscriptionReceipt = { paymentId: 'payment1', invoiceId: 'invoice1', payerId: 'student1', currency: 'BRL', amountCents: 2000, status: 'settled', refundedCents: 0, disputed: false }
describe('monthly invoice reconciliation', () => {
  it.each([['basic', 1000], ['pro', 2000], ['premium', 3000]] as const)('checks student %s monthly fee without authorizing activation', (plan, amountCents) => {
    expect(preview({ ...invoice, plan, amountCents }, { ...receipt, amountCents })).toMatchObject({ status: 'ready_for_server_transaction', tariffToPostCents: amountCents, activationAuthorized: false, paymentAuthorized: false })
  })
  it('accepts PRO PARCEIRO 149 monthly and supplies 38% to the existing pool boundary', () => {
    const inv = { ...invoice, payerType: 'partner' as const, plan: 'pro_partner' as const, amountCents: 14900 }
    const proposal = preview(inv, { ...receipt, amountCents: 14900 })
    const pool = prepareConfirmedFeePool('2026-10', [{ chargeId: 'charge', payerId: inv.payerId, payerType: 'partner', period: inv.period, amountCents: proposal.tariffToPostCents, refundedCents: 0, status: 'settled', plan: inv.plan, kind: 'monthly', businessId: inv.invoiceId, linkedStudent: false, serviceCompleted: false, clientEvaluated: false, professionalEvaluated: false }], true)
    expect(pool.poolCents).toBe(5662)
  })
  it.each(['basic', 'pro', 'premium'] as const)('rejects partner %s monthly billing', plan => { expect(() => preview({ ...invoice, payerType: 'partner', plan }, receipt)).toThrow() })
  it('rejects linked student monthly fees and free subscriptions', () => {
    expect(() => preview({ ...invoice, linkedStudentAtBilling: true }, receipt)).toThrow()
    expect(() => preview({ ...invoice, plan: 'free', amountCents: 0 }, { ...receipt, amountCents: 0 })).toThrow()
  })
  it.each(['pending', 'void'] as const)('does not post %s payment', status => { expect(preview(invoice, { ...receipt, status })).toMatchObject({ status: status === 'void' ? 'payment_void' : 'pending_payment', tariffToPostCents: 0, activationAuthorized: false }) })
  it.each([{ amountCents: 1000 }, { payerId: 'other' }, { invoiceId: 'other' }, { currency: 'USD' }, { refundedCents: 1 }, { disputed: true }])('blocks mismatched or disputed receipts', change => { expect(() => preview(invoice, { ...receipt, ...change })).toThrow() })
  it('repeated settlement has no additional tariff', () => { expect(preview(invoice, receipt, [{ invoiceId: invoice.invoiceId, paymentId: receipt.paymentId }])).toMatchObject({ status: 'already_settled', tariffToPostCents: 0 }) })
  it('blocks invoice reuse with another payment and payment reuse with another invoice', () => {
    expect(() => preview(invoice, receipt, [{ invoiceId: invoice.invoiceId, paymentId: 'other' }])).toThrow()
    expect(() => preview(invoice, receipt, [{ invoiceId: 'other', paymentId: receipt.paymentId }])).toThrow()
  })
  it('uses the historical invoice snapshot rather than consulting a current user profile', () => {
    const inv = JSON.stringify(invoice), rec = JSON.stringify(receipt)
    preview(invoice, receipt)
    expect(JSON.stringify(invoice)).toBe(inv); expect(JSON.stringify(receipt)).toBe(rec)
  })
})

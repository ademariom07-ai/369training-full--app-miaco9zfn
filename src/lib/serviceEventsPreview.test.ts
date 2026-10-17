import { describe, it, expect } from 'vitest'
import { projectServiceEvents, type ServiceEventSnapshot } from './serviceEventsPreview'
const e: ServiceEventSnapshot = {
  eventId: 'e1',
  serviceId: 's1',
  revision: 1,
  period: '2026-10',
  studentId: 'student',
  partnerId: 'partner',
  state: 'completed',
  payment: 'confirmed',
  studentReviewed: true,
  partnerReviewed: true,
}
describe('service events read-only replay', () => {
  it('counts once for each participant and ignores exact replay', () => {
    const r = projectServiceEvents('2026-10', [e, { ...e }])
    expect(r.participants.map((p) => p.eligibleServices)).toEqual([1, 1])
    expect(r.duplicateEventsIgnored).toBe(1)
    expect(r.pointsWriteAuthorized).toBe(false)
  })
  it.each([
    { payment: 'pending' },
    { studentReviewed: false },
    { partnerReviewed: false },
    { state: 'scheduled' },
  ] as const)('blocks missing requirements %j', (change) => {
    expect(projectServiceEvents('2026-10', [{ ...e, ...change }]).participants).toEqual([])
  })
  it('orders by service revision rather than delivery order', () => {
    const newer = { ...e, eventId: 'e2', revision: 2, payment: 'pending' as const }
    expect(projectServiceEvents('2026-10', [newer, e]).participants).toEqual([])
  })
  it('refunded event requires reconciliation without authorizing a reversal', () => {
    const r = projectServiceEvents('2026-10', [
      e,
      { ...e, eventId: 'e2', revision: 2, payment: 'refunded' },
    ])
    expect(r.services[0].status).toBe('reconciliation_required')
    expect(r.paymentAuthorized).toBe(false)
    expect(r.participants).toEqual([])
  })
  it('rejects identity or version conflicts', () => {
    expect(() => projectServiceEvents('2026-10', [e, { ...e, payment: 'pending' }])).toThrow()
    expect(() => projectServiceEvents('2026-10', [e, { ...e, eventId: 'e2' }])).toThrow()
    expect(() =>
      projectServiceEvents('2026-10', [
        e,
        { ...e, eventId: 'e2', revision: 2, studentId: 'other' },
      ]),
    ).toThrow()
  })
  it('keeps other months out of current counts', () => {
    expect(projectServiceEvents('2026-11', [e]).services).toEqual([])
  })
  it('cancellation removes eligibility only in projection', () => {
    const r = projectServiceEvents('2026-10', [
      e,
      { ...e, eventId: 'e2', revision: 2, state: 'cancelled' },
    ])
    expect(r.services[0].status).toBe('cancelled')
    expect(r.participants).toEqual([])
  })
})

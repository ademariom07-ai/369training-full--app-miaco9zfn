import { describe, it, expect, vi } from 'vitest'
import { runVideoPilot } from './videoPilot'
const session = { user: { id: 'admin' }, access_token: 'token' }
function setup() {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }) },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { video: null, message: 'none' }, error: null }),
    },
  }
}
describe('authenticated video pilot', () => {
  it('rejects a different account without invoking', async () => {
    const c = setup()
    await expect(runVideoPilot(c as any, 'other', 'exercise')).rejects.toThrow()
    expect(c.functions.invoke).not.toHaveBeenCalled()
  })
  it('discards an old session response', async () => {
    const c = setup()
    c.auth.getSession
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: null })
    await expect(runVideoPilot(c as any, 'admin', 'exercise')).rejects.toThrow('sessão mudou')
  })
  it('accepts explicit no-match and bounds message', async () => {
    const c = setup()
    const result = await runVideoPilot(c as any, 'admin', 'exercise')
    expect(result.video).toBeNull()
    expect(result.message).toContain('Nenhuma')
  })
  it('rejects an arbitrary URL', async () => {
    const c = setup()
    c.functions.invoke.mockResolvedValue({
      data: {
        video: {
          id: 'abcdefghijk',
          url: 'https://evil.invalid',
          title: 'x',
          channel: 'y',
          checkedAt: new Date().toISOString(),
        },
        message: 'x',
      },
      error: null,
    })
    await expect(runVideoPilot(c as any, 'admin', 'exercise')).rejects.toThrow('inválida')
  })
  it('does not leak provider failures', async () => {
    const c = setup()
    c.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'secret', context: new Response('secret', { status: 403 }) },
    })
    await expect(runVideoPilot(c as any, 'admin', 'exercise')).rejects.toThrow('administrativo')
  })
})

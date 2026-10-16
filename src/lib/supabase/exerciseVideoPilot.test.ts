import { describe, it, expect, vi } from 'vitest'
import {
  createHandler,
  type Dependencies,
} from '../../../supabase/functions/exercise-video-search/handler'
function setup(role: 'admin' | 'user' | null = 'admin') {
  const deps: Dependencies = {
    authenticate: vi.fn(async () => role),
    apiKey: () => 'test-key',
    select: async (_exercise, candidates) => candidates[0]?.id ?? null,
    fetch: vi.fn(),
    reserve: vi.fn(() => true),
  }
  return { deps, handle: createHandler(deps) }
}
const request = (body: unknown = { exercise: 'Agachamento com halteres' }, token = 'test') =>
  new Request('https://example.com', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  })
describe('Supabase video search administrative pilot', () => {
  it.each([null, 'user'] as const)('rejects unauthorized role %s before provider', async (role) => {
    const { deps, handle } = setup(role)
    expect((await handle(request())).status).toBe(role ? 403 : 401)
    expect(deps.fetch).not.toHaveBeenCalled()
  })
  it('rejects missing authorization', async () => {
    const { deps, handle } = setup()
    expect((await handle(request({}, ''))).status).toBe(401)
    expect(deps.authenticate).not.toHaveBeenCalled()
  })
  it.each(['', 'a\nb', 'a'.repeat(161), null])('rejects invalid label %s', async (exercise) => {
    const { deps, handle } = setup()
    expect((await handle(request({ exercise }))).status).toBe(400)
    expect(deps.fetch).not.toHaveBeenCalled()
  })
  it('caps request body size', async () => {
    const { handle } = setup()
    expect((await handle(request({ exercise: 'x'.repeat(2000) }))).status).toBe(413)
  })
  it('does not consume provider quota when not configured or rate limited', async () => {
    const { deps, handle } = setup()
    deps.apiKey = () => undefined
    expect((await handle(request())).status).toBe(503)
    deps.apiKey = () => 'test'
    deps.reserve = () => false
    expect((await handle(request())).status).toBe(429)
    expect(deps.fetch).not.toHaveBeenCalled()
  })
  it('does not disclose provider errors or secrets', async () => {
    const { deps, handle } = setup()
    vi.mocked(deps.fetch).mockRejectedValue(Error('test-key provider secret'))
    const result = await handle(request())
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('test-key')
  })
  it('filters unsafe candidates and never claims AI selection', async () => {
    const { deps, handle } = setup()
    const valid = {
      id: 'abcdefghijk',
      snippet: { title: 'Agachamento', channelTitle: 'Canal', liveBroadcastContent: 'none' },
      status: { privacyStatus: 'public', embeddable: true, uploadStatus: 'processed' },
      contentDetails: { duration: 'PT2M' },
    }
    vi.mocked(deps.fetch)
      .mockResolvedValueOnce(Response.json({ items: [{ id: { videoId: valid.id } }] }))
      .mockResolvedValueOnce(
        Response.json({
          items: [
            valid,
            { ...valid, status: { ...valid.status, embeddable: false } },
            {
              ...valid,
              contentDetails: { duration: 'PT2M', regionRestriction: { blocked: ['BR'] } },
            },
          ],
        }),
      )
    const result = await (await handle(request())).json()
    expect(result.video.id).toBe('abcdefghijk')
    expect(result.message).toContain('metadados')
    expect(String(vi.mocked(deps.fetch).mock.calls[0][0])).not.toContain('test-key')
  })
})

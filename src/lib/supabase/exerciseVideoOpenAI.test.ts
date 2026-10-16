import { describe, it, expect, vi } from 'vitest'
import { selectVideo } from '../../../supabase/functions/exercise-video-search/openai'
const candidates = [
  {
    id: 'abcdefghijk',
    title: 'Agachamento',
    channel: 'Canal',
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
  },
]
const result = (text: string, status = 'completed') =>
  Response.json({ status, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] })
describe('OpenAI selection', () => {
  it.each(['abcdefghijk', null])('accepts allowed choice %s', async (videoId) => {
    const fetcher = vi.fn().mockResolvedValue(result(JSON.stringify({ videoId })))
    expect(await selectVideo('Agachamento', candidates, 'secret', fetcher)).toBe(videoId)
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.store).toBe(false)
    expect(body.input).not.toContain('secret')
    expect(body.text.format.schema.properties.videoId.enum).toEqual(['abcdefghijk', null])
  })
  it.each(['{"videoId":"invented-id"}', '{}', '{"videoId":null,"extra":1}', 'not json'])(
    'rejects invalid choice %s',
    async (text) => {
      await expect(
        selectVideo('Agachamento', candidates, 'secret', vi.fn().mockResolvedValue(result(text))),
      ).rejects.toThrow()
    },
  )
  it('rejects incomplete and refusal responses', async () => {
    await expect(
      selectVideo(
        'x',
        candidates,
        'secret',
        vi.fn().mockResolvedValue(result('{"videoId":null}', 'incomplete')),
      ),
    ).rejects.toThrow()
    await expect(
      selectVideo(
        'x',
        candidates,
        'secret',
        vi
          .fn()
          .mockResolvedValue(
            Response.json({
              status: 'completed',
              output: [{ type: 'message', content: [{ type: 'refusal' }] }],
            }),
          ),
      ),
    ).rejects.toThrow()
  })
  it('does not call AI for zero candidates', async () => {
    const fetcher = vi.fn()
    expect(await selectVideo('x', [], 'secret', fetcher)).toBe(null)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('never relays provider body', async () => {
    await expect(
      selectVideo(
        'x',
        candidates,
        'secret',
        vi.fn().mockResolvedValue(new Response('secret', { status: 429 })),
      ),
    ).rejects.toThrow('AI unavailable')
  })
})

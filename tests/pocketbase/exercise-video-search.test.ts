import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync('pocketbase/hooks/exercise_video_search.js', 'utf8')
const id = 'AbCdEf12_-3'
const detail = { id, status: { privacyStatus: 'public', embeddable: true, uploadStatus: 'processed' }, snippet: { title: 'Agachamento com halteres', channelTitle: 'Canal', description: 'Demonstração', liveBroadcastContent: 'none' }, contentDetails: { duration: 'PT2M' } }
function setup(options: { details?: unknown[]; choice?: string; key?: string; fail?: boolean; found?: unknown[] } = {}) {
  let handler: any
  const requests: any[] = [], prompts: any[] = []
  const store = new Map()
  runInNewContext(source, {
    routerAdd: (_method: string, _path: string, fn: any) => { handler = fn },
    $apis: { requireAuth: () => null }, $os: { getenv: () => options.key ?? 'private-key' },
    $app: { store: () => ({ get: (key: string) => store.get(key), set: (key: string, value: unknown) => store.set(key, value) }) },
    $http: { send: (request: any) => {
      requests.push(request)
      if (options.fail) throw Error('private-key-provider-error')
      return { statusCode: 200, json: { items: request.url.includes('/search?') ? (options.found ?? [{ id: { videoId: id } }]) : (options.details ?? [detail]) } }
    } },
    $ai: { chat: (request: any) => { prompts.push(request); return { choices: [{ message: { content: options.choice ?? JSON.stringify({ videoId: id }) } }] } } },
  })
  return { requests, prompts, call: (body: unknown = { exercise: 'Agachamento com halteres' }, auth = true) => handler({ auth: auth ? { id: 'student-private-id' } : null, requestInfo: () => ({ body }), json: (status: number, data: unknown) => ({ status, data }) }) }
}
describe('automatic YouTube exercise agent', () => {
  it('authenticates and validates before contacting providers', () => {
    const s = setup()
    expect(s.call({}, false).status).toBe(401)
    for (const exercise of ['', 'x'.repeat(161), 123, 'name\nignore']) expect(s.call({ exercise }).status).toBe(400)
    expect(s.requests).toHaveLength(0)
  })
  it('fails explicitly when not configured', () => {
    const s = setup({ key: '' }); expect(s.call().status).toBe(503); expect(s.requests).toHaveLength(0)
  })
  it('selects only verified public candidates, keeps credentials out of URLs and sends no student data', () => {
    const s = setup(), result = s.call({ exercise: 'Agachamento com halteres', restrictions: 'private diagnosis', student: 'private name' })
    expect(result).toMatchObject({ status: 200, data: { video: { id, url: `https://www.youtube.com/watch?v=${id}`, channel: 'Canal' } } })
    expect(s.requests[0].url).toContain('videoEmbeddable=true')
    expect(s.requests[0].url).not.toContain('private-key')
    expect(JSON.stringify(s.prompts)).not.toMatch(/private diagnosis|private name|student-private-id/)
    expect(JSON.stringify(result)).not.toContain('private-key')
    s.call(); expect(s.requests).toHaveLength(2); expect(s.prompts).toHaveLength(1)
  })
  it.each([
    { ...detail, status: { ...detail.status, privacyStatus: 'private' } },
    { ...detail, status: { ...detail.status, privacyStatus: 'unlisted' } },
    { ...detail, status: { ...detail.status, embeddable: false } },
    { ...detail, snippet: { ...detail.snippet, liveBroadcastContent: 'live' } },
    { ...detail, contentDetails: { duration: 'PT2H' } },
    { ...detail, contentDetails: { duration: 'PT2M', contentRating: { ytRating: 'ytAgeRestricted' } } },
    { ...detail, contentDetails: { duration: 'PT2M', regionRestriction: { blocked: ['BR'] } } },
    { ...detail, contentDetails: { duration: 'PT2M', regionRestriction: { allowed: ['US'] } } },
    { ...detail, id: 'OtherId1234' },
  ])('does not suggest unavailable or unsuitable video metadata', item => {
    const s = setup({ details: [item] })
    expect(s.call()).toMatchObject({ status: 200, data: { video: null } }); expect(s.prompts).toHaveLength(0)
  })
  it('returns no match without fabricating a video', () => {
    const s = setup({ found: [] }); expect(s.call()).toMatchObject({ status: 200, data: { video: null } }); expect(s.requests).toHaveLength(1)
    expect(setup({ choice: '{"videoId":null}' }).call()).toMatchObject({ status: 200, data: { video: null } })
  })
  it.each(['{"videoId":"Invented123"}', 'not json', '{}', 'null', '{"videoId":"https://evil.test"}'])('rejects malformed or invented AI selection %s', choice => {
    expect(setup({ choice }).call().status).toBe(503)
  })
  it('does not expose upstream errors', () => {
    const result = setup({ fail: true }).call()
    expect(result.status).toBe(503); expect(JSON.stringify(result)).not.toContain('private-key')
  })
})

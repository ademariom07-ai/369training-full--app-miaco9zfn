import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync('pocketbase/hooks/exercise_video_status.js', 'utf8')
const rule = { label: '/backend/v1/exercises/video-search', audience: '@auth', duration: 60, maxRequests: 20 }
function call({ role = 'admin', auth = true, key = 'secret-never-return', ai = true, limits = { enabled: true, rules: [rule] } } = {}) {
  let handler: any
  runInNewContext(source, {
    routerAdd: (_m: string, _p: string, fn: any) => { handler = fn }, $apis: { requireAuth: () => null },
    $os: { getenv: () => key }, $ai: ai ? { chat: () => { throw Error('must not call provider') } } : undefined,
    $app: { settings: () => ({ rateLimits: limits }) },
  })
  return handler({ auth: auth ? { id: 'user', getString: () => role } : null, json: (status: number, data: unknown) => ({ status, data }) })
}
it('restricts configuration status to authenticated administrators', () => {
  expect(call({ auth: false }).status).toBe(401)
  expect(call({ role: 'aluno' }).status).toBe(403)
  expect(call({ role: 'profissional' }).status).toBe(403)
})
it('reports configuration presence without claiming a live verification', () => {
  const result = call()
  expect(result).toMatchObject({ status: 200, data: { configurationReady: true, liveSearchVerified: false } })
  expect(JSON.stringify(result)).not.toContain('secret-never-return')
})
it.each([{ key: '' }, { ai: false }, { limits: { enabled: false, rules: [rule] } }, { limits: { enabled: true, rules: [] } }, { limits: { enabled: true, rules: [{ ...rule, audience: '@guest' }] } }, { limits: { enabled: true, rules: [{ ...rule, maxRequests: 0 }] } }])('reports missing readiness requirements %j', options => {
  expect(call(options)).toMatchObject({ status: 200, data: { configurationReady: false } })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync('pocketbase/hooks/ai_generate_workout.js', 'utf8')
const input = { objective: 'Força', experience: 'Iniciante', daysAvailable: 3, restrictions: 'Sem restrições relatadas' }
const exercise = { name: 'Exercício', muscle_group: 'Grupo', sets: '2', reps: '10', load: 'A definir em revisão', rest: '60s', tips: 'Revisar técnica' }
const output = { title: 'Rascunho', exercises: [exercise] }
function call(body: unknown = input, response: unknown = JSON.stringify(output), authenticated = true, failure = false) {
  let handler: any
  let calls = 0
  runInNewContext(source, { routerAdd: (_method: string, _path: string, fn: any) => { handler = fn }, $apis: { requireAuth: () => null }, $ai: { chat: () => { calls++; if (failure) throw Error('private-provider-secret'); return { choices: [{ message: { content: response } }] } } } })
  const result = handler({ auth: authenticated ? { id: 'user' } : null, requestInfo: () => ({ body }), json: (status: number, data: any) => ({ status, data }) })
  return { ...result, calls }
}
describe('workout server contract', () => {
  it('requires authentication before generation', () => { expect(call(input, '', false)).toMatchObject({ status: 401, calls: 0 }) })
  it.each([{}, { ...input, objective: '' }, { ...input, daysAvailable: '3' }, { ...input, daysAvailable: 8 }, { ...input, restrictions: null }, { ...input, notes: 'a'.repeat(4001) }])('rejects invalid inputs without calling AI', body => { expect(call(body)).toMatchObject({ status: 400, calls: 0 }) })
  it.each(['invalid JSON', '{}', 'null', JSON.stringify({ ...output, exercises: [] }), JSON.stringify({ ...output, exercises: [{}] }), 'a'.repeat(60001)])('does not replace malformed output with a generic workout', response => {
    const result = call(input, response)
    expect(result.status).toBe(502)
    expect(result.data.exercises).toBeUndefined()
  })
  it('returns only bounded validated fields and discards provider links and completion flags', () => {
    const result = call(input, JSON.stringify({ ...output, objective: 'Wrong', disclaimer: 'Clinically approved', exercises: [{ ...exercise, id: 'untrusted', completed: true, video: 'https://untrusted.test', secret: 'hidden' }] }))
    expect(result.status).toBe(200)
    expect(result.data.objective).toBe('Força')
    expect(result.data.exercises[0]).toMatchObject({ id: 'ex_1', completed: false, video: '' })
    expect(result.data.exercises[0].secret).toBeUndefined()
    expect(result.data.disclaimer).toContain('revisão profissional')
  })
  it('does not leak provider errors', () => {
    const result = call(input, '', true, true)
    expect(result.status).toBe(503)
    expect(JSON.stringify(result)).not.toContain('private-provider-secret')
  })
})

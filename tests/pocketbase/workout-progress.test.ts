import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
const code = readFileSync('pocketbase/hooks/workout_progress.js', 'utf8')
function setup(options: { owner?: string; status?: string; completed?: boolean; role?: string } = {}) {
  let handler: any
  let saves = 0
  const data: Record<string, any> = { student: options.owner || 'student', status: options.status || 'ativo', exercises: [{ id: 'e1', name: 'Exercício', load: '10kg', reps: '10', completed: options.completed || false }] }
  const workout = { id: 'w1', getString: (key: string) => key === 'exercises' ? JSON.stringify(data[key]) : data[key], set: (key: string, value: any) => { data[key] = value } }
  const app = { findRecordById: (collection: string) => {
    if (collection === 'workouts') return workout
    if (collection === 'users') return { id: 'student', getString: () => options.role || 'aluno' }
    throw Error('Unexpected collection')
  }, save: (record: any) => { expect(record).toBe(workout); saves++ } }
  runInNewContext(code, { routerAdd: (_m: string, _p: string, fn: any) => { handler = fn }, $apis: { requireAuth: () => null }, $app: { runInTransaction: (fn: any) => fn(app) } })
  return { data, saves: () => saves, call: (body: any, authenticated = true) => handler({ auth: authenticated ? { id: 'student' } : null, requestInfo: () => ({ body }), json: (status: number, body: any) => ({ status, body }) }) }
}
const mark = { workoutId: 'w1', action: 'exercise', exerciseId: 'e1', completed: true }
describe('workout progress endpoint', () => {
  it('requires authentication', () => { const s = setup(); expect(s.call(mark, false).status).toBe(401); expect(s.saves()).toBe(0) })
  it.each([{ owner: 'other' }, { role: 'profissional' }])('rejects access outside the student owner', options => { const s = setup(options); expect(s.call(mark).status).toBe(404); expect(s.saves()).toBe(0) })
  it('rejects prescription injection', () => { const s = setup(); expect(s.call({ ...mark, load: '100kg' }).status).toBe(400); expect(s.saves()).toBe(0) })
  it('changes completion only and repeated marking has no further writes', () => {
    const s = setup(); const result = s.call(mark)
    expect(result.status).toBe(200); expect(s.data.exercises[0]).toEqual({ id: 'e1', name: 'Exercício', load: '10kg', reps: '10', completed: true })
    expect(result.body.serviceCreated).toBe(false); expect(result.body.pointsAwarded).toBe(false)
    s.call(mark); expect(s.saves()).toBe(1)
  })
  it('rejects unknown exercise and archived workout', () => {
    expect(setup().call({ ...mark, exerciseId: 'other' }).status).toBe(404)
    expect(setup({ status: 'arquivado' }).call(mark).status).toBe(409)
  })
  it('cannot finish incomplete exercise list', () => { const s = setup(); expect(s.call({ workoutId: 'w1', action: 'complete' }).status).toBe(409); expect(s.saves()).toBe(0) })
  it('finalization is repeatable without additional writes or services', () => {
    const s = setup({ completed: true }); const request = { workoutId: 'w1', action: 'complete' }
    expect(s.call(request).status).toBe(200); expect(s.data.status).toBe('concluido')
    expect(s.call(request).status).toBe(200); expect(s.saves()).toBe(1)
    expect(s.call({ ...mark, completed: false }).status).toBe(409)
  })
  it('rejects ambiguous or empty exercise lists', () => {
    const s = setup(); s.data.exercises.push({ ...s.data.exercises[0] }); expect(s.call(mark).status).toBe(409)
    s.data.exercises = []; expect(s.call({ workoutId: 'w1', action: 'complete' }).status).toBe(409)
  })
})

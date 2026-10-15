import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
// VM contract tests, not execution of PocketBase's rule parser or HTTP authorization.
function migration(down = false) {
  const collection: Record<string, string | null> = {}
  runInNewContext(readFileSync('pocketbase/migrations/0066_scope_workout_access.js', 'utf8'), {
    migrate: (up: any, rollback: any) => (down ? rollback : up)({ findCollectionByNameOrId: (name: string) => { expect(name).toBe('workouts'); return collection }, save: () => {} }),
  })
  return collection
}
function allows(rule: string | null, id: string, role: string, approved = true, body: Record<string, unknown> = {}) {
  if (rule === null) return false
  const expression = rule.replaceAll('@request.body.student:isset', 'hasStudent').replaceAll('@request.body.professional:isset', 'hasProfessional')
    .replaceAll('@request.auth.id', 'id').replaceAll('@request.auth.role', 'role').replaceAll('@request.auth.approved', 'approved')
    .replaceAll('student.role', 'studentRole').replace(/(?<!!)=/g, '===')
  return runInNewContext(expression, { id, role, approved, student: 'student-owner', professional: 'professional-owner', studentRole: 'aluno', hasStudent: 'student' in body, hasProfessional: 'professional' in body })
}
describe('workout ownership migration', () => {
  const rules = migration()
  it.each(['listRule', 'viewRule', 'updateRule'])('%s denies unrelated accounts and anonymous requests', key => {
    for (const [id, role] of [['other', 'aluno'], ['other', 'profissional'], ['', 'admin']]) expect(allows(rules[key], id, role)).toBe(false)
    expect(allows(rules[key], 'student-owner', 'aluno')).toBe(key !== 'updateRule')
    expect(allows(rules[key], 'professional-owner', 'profissional')).toBe(true)
    expect(allows(rules[key], 'administrator', 'admin')).toBe(true)
  })
  it('only allows approved responsible professionals or admins to create', () => {
    expect(allows(rules.createRule, 'student-owner', 'aluno')).toBe(false)
    expect(allows(rules.createRule, 'professional-owner', 'profissional', false)).toBe(false)
    expect(allows(rules.createRule, 'other', 'profissional')).toBe(false)
    expect(allows(rules.createRule, 'professional-owner', 'profissional')).toBe(true)
    expect(allows(rules.createRule, 'administrator', 'admin')).toBe(true)
  })
  it('prevents ownership reassignment even by an ordinary admin update', () => {
    for (const [id, role] of [['student-owner', 'aluno'], ['professional-owner', 'profissional'], ['administrator', 'admin']]) {
      expect(allows(rules.updateRule, id, role, true, { student: 'other' })).toBe(false)
      expect(allows(rules.updateRule, id, role, true, { professional: 'other' })).toBe(false)
    }
  })
  it('does not let students or unrelated professionals delete', () => {
    expect(allows(rules.deleteRule, 'student-owner', 'aluno')).toBe(false)
    expect(allows(rules.deleteRule, 'other', 'profissional')).toBe(false)
    expect(allows(rules.deleteRule, 'professional-owner', 'profissional')).toBe(true)
  })
  it('rollback does not restore public access or ordinary API writes', () => {
    const rollback = migration(true)
    expect(allows(rollback.listRule, 'student-owner', 'aluno')).toBe(false)
    expect(rollback.createRule).toBeNull()
    expect(rollback.updateRule).toBeNull()
    expect(rollback.deleteRule).toBeNull()
  })
  it('exported schema matches the migration', () => {
    const schema = JSON.parse(readFileSync('src/lib/pocketbase/schema.json', 'utf8'))
    const collection = (Array.isArray(schema) ? schema : schema.collections).find((c: any) => c.name === 'workouts')
    for (const action of ['list', 'view', 'create', 'update', 'delete']) expect(collection.apiRules[action]).toBe(rules[action + 'Rule'])
  })
})

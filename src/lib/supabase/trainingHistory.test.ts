import {describe,it,expect} from 'vitest'
import {hasCurrentTrainingLink} from './trainingHistory'
describe('training history actions',()=>{
 const plan={student_id:'student',professional_id:'professional',link_version:1}
 const link={student_id:'student',professional_id:'professional',version:1,state:'active'}
 it('allows the current active relationship',()=>expect(hasCurrentTrainingLink(plan,[link])).toBe(true))
 it.each(['pending','revoked'])('keeps %s relationships read-only',state=>expect(hasCurrentTrainingLink(plan,[{...link,state}])).toBe(false))
 it('keeps renewed relationship history read-only',()=>expect(hasCurrentTrainingLink(plan,[{...link,version:2}])).toBe(false))
 it('does not transfer history to another professional',()=>expect(hasCurrentTrainingLink(plan,[{...link,professional_id:'other'}])).toBe(false))
 it('does not match another student',()=>expect(hasCurrentTrainingLink(plan,[{...link,student_id:'other'}])).toBe(false))
 it('keeps a plan without a relationship read-only',()=>expect(hasCurrentTrainingLink(plan,[])).toBe(false))
})

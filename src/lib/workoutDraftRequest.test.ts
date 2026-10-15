import {it,expect} from 'vitest'
import {buildWorkoutDraftRequest} from './workoutDraftRequest'
const input={objective:'Resistência',experience:'Iniciante',days:'2',age:'45',restrictions:'Limitação informada para avaliação',equipment:'Elásticos',reviewedAnamnesis:true}
it('uses actual input rather than fixed advanced five-day defaults',()=>expect(buildWorkoutDraftRequest(input)).toMatchObject({objective:'Resistência',experience:'Iniciante',daysAvailable:2,restrictions:input.restrictions}))
it('rejects missing anamnesis and empty restrictions',()=>{expect(()=>buildWorkoutDraftRequest({...input,reviewedAnamnesis:false})).toThrow();expect(()=>buildWorkoutDraftRequest({...input,restrictions:''})).toThrow()})
it('rejects invalid frequency and age',()=>{for(const days of ['0','8','2.5',''])expect(()=>buildWorkoutDraftRequest({...input,days})).toThrow();for(const age of ['','-1','121'])expect(()=>buildWorkoutDraftRequest({...input,age})).toThrow()})
it('holds minors until the verified flow exists',()=>expect(()=>buildWorkoutDraftRequest({...input,age:'17'})).toThrow(/menores/))
it('labels proposal for professional review',()=>expect(buildWorkoutDraftRequest(input).notes).toContain('rascunho sujeito à revisão'))

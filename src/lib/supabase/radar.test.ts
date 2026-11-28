import {describe,it,expect} from 'vitest'
import {evidenceLabels,safeUrl} from './radar'
import {roleMenu} from '@/components/RoleHome'
describe('radar 369',()=>{
 it('só links https viram botão; níveis de evidência',()=>{
  expect(safeUrl('https://pubmed.ncbi.nlm.nih.gov/1/')).toBe('https://pubmed.ncbi.nlm.nih.gov/1/');expect(safeUrl('javascript:alert(1)')).toBeNull();expect(safeUrl(null)).toBeNull()
  expect(evidenceLabels.metanalise.strength).toBe('forte');expect(evidenceLabels.ensaio_clinico.strength).toBe('moderada')
 })
 it('menus: parceiro e admin têm o Radar; aluno não',()=>{
  expect(roleMenu({role:'profissional',approved:true}).some(v=>v.id==='radar')).toBe(true)
  expect(roleMenu({role:'admin',approved:true}).some(v=>v.id==='radar-admin')).toBe(true)
  expect(roleMenu({role:'aluno',approved:false}).some(v=>v.id.startsWith('radar'))).toBe(false)
 })
})

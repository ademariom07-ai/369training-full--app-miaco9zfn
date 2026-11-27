import {describe,it,expect} from 'vitest'
import {bmi,bmiLabel,whr,parseMeasure,latestHeight} from './body'
import {roleMenu} from '@/components/RoleHome'
describe('avaliação física',()=>{
 it('IMC, cintura/quadril e leitura de números',()=>{
  expect(bmi(80,175)).toBe(26.1);expect(bmiLabel(26.1)).toBe('Sobrepeso');expect(bmi(null,175)).toBeNull()
  expect(whr(90,100)).toBe(0.9);expect(parseMeasure('82,5')).toBe(82.5);expect(parseMeasure('')).toBeNull();expect(()=>parseMeasure('abc')).toThrow()
  expect(latestHeight([{height_cm:null},{height_cm:170}] as never)).toBe(170)
 })
 it('aluno tem o menu Medidas e fotos',()=>{expect(roleMenu({role:'aluno',approved:false}).some(v=>v.id==='medidas')).toBe(true)})
})

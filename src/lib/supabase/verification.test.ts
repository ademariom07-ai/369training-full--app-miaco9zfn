import {describe,it,expect} from 'vitest'
import {cpfValid,formatCpf} from './verification'
import {roleMenu} from '@/components/RoleHome'
describe('verificação',()=>{
 it('CPF: dígitos verificadores e máscara',()=>{
  expect(cpfValid('529.982.247-25')).toBe(true);expect(cpfValid('11144477735')).toBe(true)
  expect(cpfValid('529.982.247-24')).toBe(false);expect(cpfValid('111.111.111-11')).toBe(false);expect(cpfValid('123')).toBe(false)
  expect(formatCpf('52998224725')).toBe('529.982.247-25');expect(formatCpf('5299')).toBe('529.9');expect(formatCpf('529982247259999')).toBe('529.982.247-25')
 })
 it('admin tem a fila de verificações',()=>{expect(roleMenu({role:'admin',approved:true}).some(v=>v.id==='verificacoes')).toBe(true)})
})

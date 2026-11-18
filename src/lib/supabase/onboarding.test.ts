import {describe,it,expect} from 'vitest'
import {formatBrazilPhone,suggestEmail,saveMyGoal,saveMyPhone} from './onboarding'
import {viewHelp} from '@/components/RoleHome'

describe('primeiro acesso',()=>{
 it('sugere correção de domínios de e-mail digitados errado',()=>{
  expect(suggestEmail('maria@gmial.com')).toBe('maria@gmail.com')
  expect(suggestEmail(' Joao@HOTMIAL.com ')).toBe('joao@hotmail.com')
  expect(suggestEmail('ana@outlok.com')).toBe('ana@outlook.com')
  expect(suggestEmail('maria@gmail.com')).toBeNull()
  expect(suggestEmail('sem-arroba')).toBeNull()
 })
 it('mostra o celular no formato brasileiro',()=>{
  expect(formatBrazilPhone('+5511987654321')).toBe('(11) 98765-4321')
  expect(formatBrazilPhone('+552133334444')).toBe('(21) 3333-4444')
 })
 it('objetivo e celular inválidos não chegam ao servidor',async()=>{
  await expect(saveMyGoal('ficar_rico' as never,{} as never)).rejects.toThrow('objetivo')
  await expect(saveMyPhone('123',{} as never)).rejects.toThrow('celular válido')
 })
 it('cada perfil tem ajuda em linguagem simples para as telas principais',()=>{
  expect(viewHelp('aluno','profissionais')).toContain('pedido de acompanhamento')
  expect(viewHelp('parceiro','agenda')).toContain('horários')
  expect(viewHelp('aluno','agenda')).toContain('reservados')
  expect(viewHelp('admin','feed')).toContain('aprova')
 })
})

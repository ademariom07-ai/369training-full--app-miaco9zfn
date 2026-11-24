import {describe,it,expect} from 'vitest'
import {challengeState,daysLeft,shouldRemind} from './challenges'
import {roleMenu} from '@/components/RoleHome'

describe('desafios e água',()=>{
 it('situação do desafio',()=>{
  const c={starts_on:'2026-11-20',ends_on:'2026-11-26',progress:2,goal_days:5}
  expect(challengeState(c,'2026-11-24')).toBe('em-andamento');expect(challengeState(c,'2026-11-19')).toBe('em-breve');expect(challengeState(c,'2026-11-27')).toBe('encerrado')
  expect(challengeState({...c,progress:5},'2026-11-24')).toBe('concluido');expect(daysLeft('2026-11-26','2026-11-24')).toBe(2)
 })
 it('lembrete de água: só no horário, abaixo da meta e depois do intervalo',()=>{
  const s={remind:true,every_min:60,from_hour:8,to_hour:21,goal_ml:2000}
  const at=(h:number)=>new Date(Date.UTC(2026,10,24,h+3,0))   // horário de São Paulo (UTC-3)
  expect(shouldRemind(s,500,null,at(10))).toBe(true)
  expect(shouldRemind(s,500,null,at(7))).toBe(false);expect(shouldRemind(s,500,null,at(21))).toBe(false)
  expect(shouldRemind(s,2000,null,at(10))).toBe(false);expect(shouldRemind({...s,remind:false},500,null,at(10))).toBe(false)
  expect(shouldRemind(s,500,at(10).getTime()-30*60000,at(10))).toBe(false);expect(shouldRemind(s,500,at(10).getTime()-61*60000,at(10))).toBe(true)
 })
 it('menus',()=>{
  expect(roleMenu({role:'aluno',approved:false}).some(v=>v.id==='desafios')).toBe(true)
  expect(roleMenu({role:'profissional',approved:true}).some(v=>v.id==='desafios-pro')).toBe(true)
  expect(roleMenu({role:'admin',approved:true}).some(v=>v.id==='desafios-admin')).toBe(true)
 })
})

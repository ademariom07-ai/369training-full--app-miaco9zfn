import {describe,it,expect} from 'vitest'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import Nina from './Nina'
import {parseNinaResponse} from '@/lib/supabase/nina'
import {roleMenu} from './RoleHome'

const id='11111111-1111-4111-8111-111111111111'
describe('Nina, assistente do profissional',()=>{
 it('aparece no menu do parceiro aprovado e não no do aluno',()=>{
  expect(roleMenu({role:'profissional',approved:true}).some(v=>v.id==='nina')).toBe(true)
  expect(roleMenu({role:'aluno',approved:false}).some(v=>v.id==='nina')).toBe(false)
 })
 it('lê a resposta da função e descarta o que vier fora do formato',()=>{
  const r=parseNinaResponse({reply:' Pronto, tirei o terra. ',results:[{type:'alterar',student_id:id,student_name:'Célia',plan_id:id,status:'rascunho'},{type:'apagar',student_id:id},{type:'criar',student_id:'x'}]})
  expect(r.reply).toBe('Pronto, tirei o terra.');expect(r.results).toHaveLength(1);expect(r.results[0]).toMatchObject({type:'alterar',student_name:'Célia',status:'rascunho'})
  expect(parseNinaResponse(null)).toEqual({reply:'Pronto.',results:[]})
 })
 it('abre com sugestões usando o nome do primeiro aluno',()=>{
  const html=renderToStaticMarkup(<Nina owner="o" onOpenPlans={()=>{}} links={[{student_id:id,professional_id:id,state:'active',participant_name:'Célia Souza',requested_at:''} as never]}/>)
  expect(html).toContain('Sou a <b>Nina</b>');expect(html).toContain('Cria o treino da semana de Célia')
 })
})

import {describe,it,expect} from 'vitest'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {SessionCard,SessionForm} from './WorkoutLog'

describe('registro de treino: telas',()=>{
 const day={key:'seg' as const,name:'Treino A',items:[{name:'Agachamento goblet com halter',sets:3,reps:'12',rest:'60s',load:'12 kg',video:null,notes:''}]}
 it('formulário começa com os exercícios do dia e pergunta esforço, dor e recado',()=>{
  const html=renderToStaticMarkup(<SessionForm plan="p" day={day} onDone={()=>{}} onCancel={()=>{}}/>)
  expect(html).toContain('Registrar treino · Treino A');expect(html).toContain('Agachamento goblet com halter');expect(html).toContain('value="12 kg"')
  expect(html).toContain('Esforço: 6 de 10');expect(html).toContain('Dor forte');expect(html).toContain('Recado para o profissional')
 })
 it('cartão mostra o que foi feito e destaca a dor',()=>{
  const html=renderToStaticMarkup(<SessionCard showStudent session={{session_id:'s',plan_id:'p',plan_title:'Semana',student_id:'a',student_name:'Dona Célia',day_key:'seg',day_name:'Treino A',done_on:'2026-11-02',effort:8,pain:1,note:'Senti a lombar',updated_at:'',
   entries:[{name:'Agachamento',done:true,sets:3,reps:'12',load:'12 kg'},{name:'Levantamento terra',done:false,sets:null,reps:'',load:''}]}}/>)
  expect(html).toContain('Dona Célia');expect(html).toContain('1 de 2 exercícios');expect(html).toContain('Esforço 8/10 (Pesado)');expect(html).toContain('Dor leve');expect(html).toContain('Senti a lombar');expect(html).toContain('não fez')
 })
})

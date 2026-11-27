import {describe,it,expect} from 'vitest'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import StudentHub from './StudentHub'
describe('ficha do aluno',()=>{
 it('mostra nome, ações e seções',()=>{
  const link={student_id:'11111111-1111-4111-8111-111111111111',professional_id:'p',state:'active',participant_name:'Irenilva Oliveira',accepted_at:'2026-11-26T19:07:04Z',requested_at:'',revoked_at:null,version:1} as never
  const html=renderToStaticMarkup(<StudentHub owner="o" link={link} onBack={()=>{}} onChat={()=>{}} onAi={()=>{}} onRevoke={async()=>{}}/>)
  for(const t of ['Irenilva Oliveira','Mensagem','Treinos e dietas','O que fez e evolução','Medidas e fotos','Encerrar vínculo com Irenilva'])expect(html).toContain(t)
 })
})

import React from 'react'
import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {readFileSync} from 'node:fs'
import AccountNavigation from './AccountNavigation'

const render=(role:'aluno'|'profissional'|'admin',approved=false)=>renderToStaticMarkup(<AccountNavigation profile={{role,approved}}/>)
describe('atalhos por perfil verificado',()=>{
 it('aluno recebe treinos, sem atalhos administrativos ou gestão de agenda',()=>{
  const html=render('aluno');expect(html).toContain('#treinos-vinculos');expect(html).not.toContain('#config-ranking');expect(html).not.toContain('#minha-agenda')
 })
 it('profissional aprovado recebe agenda e treinos sem administração',()=>{
  const html=render('profissional',true);expect(html).toContain('#minha-agenda');expect(html).toContain('#treinos-vinculos');expect(html).not.toContain('#participantes')
 })
 it('profissional pendente não recebe atalhos de funções ainda não autorizadas',()=>{
  const html=render('profissional');expect(html).toContain('#cadastro-profissional');expect(html).not.toContain('#minha-agenda');expect(html).not.toContain('#treinos-vinculos')
 })
 it('admin recebe serviços, vídeos e rascunhos explicitamente identificados',()=>{
  const html=render('admin');for(const id of ['entrada-servicos','piloto-videos','participantes','config-ranking','config-cashback'])expect(html).toContain('#'+id)
  expect(html).toContain('Ranking — rascunhos');expect(html).toContain('Cashback — rascunhos');expect(html).not.toContain('#treinos-vinculos')
 })
 it('todo atalho renderizado possui destino único na página operacional',()=>{
  const source=readFileSync(new URL('../pages/SupabaseAccount.tsx',import.meta.url),'utf8')
  for(const html of [render('aluno'),render('profissional'),render('profissional',true),render('admin')]){
   for(const match of html.matchAll(/href="#([^"]+)"/g))expect(source.split(`id="${match[1]}"`).length-1,match[1]).toBe(1)
  }
 })
})

import React from 'react'
import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {RoleOverview,RoleShell,pickView,roleKind,roleMenu} from './RoleHome'

const ids=(role:'aluno'|'profissional'|'admin',approved=false)=>roleMenu({role,approved}).map(item=>item.id)
describe('home individual por perfil verificado',()=>{
 it('classifica aluno, parceiro aprovado, parceiro pendente e admin',()=>{
  expect(roleKind({role:'aluno',approved:false})).toBe('aluno')
  expect(roleKind({role:'profissional',approved:true})).toBe('parceiro')
  expect(roleKind({role:'profissional',approved:false})).toBe('parceiro_pendente')
  expect(roleKind({role:'admin',approved:false})).toBe('admin')
 })
 it('aluno recebe profissionais e treino, sem administração nem gestão de agenda',()=>{
  const menu=ids('aluno');expect(menu).toEqual(expect.arrayContaining(['inicio','profissionais','treino','agenda','parceiro','perfil']))
  for(const id of ['aprovacoes','participantes','ranking','alunos','treinos'])expect(menu).not.toContain(id)
 })
 it('parceiro aprovado recebe alunos, agenda e treinos sem administração',()=>{
  const menu=ids('profissional',true);expect(menu).toEqual(expect.arrayContaining(['alunos','agenda','treinos','cadastro']))
  for(const id of ['aprovacoes','participantes','financeiro'])expect(menu).not.toContain(id)
 })
 it('parceiro pendente não recebe funções ainda não autorizadas',()=>{
  const menu=ids('profissional');expect(menu).toContain('cadastro')
  for(const id of ['alunos','treinos','aprovacoes'])expect(menu).not.toContain(id)
 })
 it('admin recebe aprovações, participantes, serviços, vídeos e rascunhos',()=>{
  const menu=ids('admin');for(const id of ['aprovacoes','participantes','servicos','videos','financeiro','ranking'])expect(menu).toContain(id)
  for(const id of ['treino','treinos','alunos'])expect(menu).not.toContain(id)
 })
 it('endereço com tela de outro perfil volta para a visão geral',()=>{
  expect(pickView({role:'aluno',approved:false},'aprovacoes')).toBe('inicio')
  expect(pickView({role:'profissional',approved:false},'alunos')).toBe('inicio')
  expect(pickView({role:'admin',approved:false},'ranking')).toBe('ranking')
 })
 it('saudação usa o primeiro nome e a visão geral lista os atalhos do perfil',()=>{
  const shell=renderToStaticMarkup(<RoleShell profile={{role:'aluno',approved:false,display_name:'Maria da Silva'}} view="inicio" onView={()=>{}} busy={false} onRefresh={()=>{}} onLogout={()=>{}}><p>conteúdo</p></RoleShell>)
  expect(shell).toContain('Olá, Maria');expect(shell).toContain('aria-current="page"')
  const overview=renderToStaticMarkup(<RoleOverview profile={{role:'admin',approved:false}} onView={()=>{}}/>)
  expect(overview).toContain('Aprovações');expect(overview).not.toContain('Meu treino')
 })
})

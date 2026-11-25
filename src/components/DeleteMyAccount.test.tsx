import {describe,it,expect} from 'vitest'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import DeleteMyAccount from './DeleteMyAccount'
describe('excluir minha conta',()=>{
 it('aparece para aluno e parceiro, não para admin',()=>{
  expect(renderToStaticMarkup(<DeleteMyAccount role="aluno"/>)).toContain('Quero excluir minha conta')
  expect(renderToStaticMarkup(<DeleteMyAccount role="profissional"/>)).toContain('Lei Geral de Proteção de Dados')
  expect(renderToStaticMarkup(<DeleteMyAccount role="admin"/>)).toBe('')
 })
})

import {describe,it,expect} from 'vitest'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import PushSettings from '@/components/PushSettings'
describe('notificações',()=>{
 it('sem suporte no ambiente de teste, explica o motivo',()=>{expect(renderToStaticMarkup(React.createElement(PushSettings,{role:'aluno'}))).toContain('Notificações')})
})

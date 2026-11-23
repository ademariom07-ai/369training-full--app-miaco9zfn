import {describe,it,expect} from 'vitest'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {ContentCard} from './Contents'
import {fileExtension,formatPrice,parsePrice} from '@/lib/supabase/contents'
import {roleMenu} from './RoleHome'

const base={content_id:'c',owner_id:'o',owner_name:'Paula Personal',kind:'ebook' as const,title:'E-book de receitas',description:'Receitas fit',body:null,youtube_id:null,file_path:null,file_name:'receitas.pdf',file_size:200000,audience:'meus_alunos' as const,published_at:'',for_me:true}
describe('conteúdos e e-books',()=>{
 it('preço: entende reais e centavos e recusa texto',()=>{
  expect(parsePrice('')).toBe(0);expect(parsePrice('Grátis')).toBe(0);expect(parsePrice('29,90')).toBe(2990);expect(parsePrice('R$ 1.000,00')).toBe(100000);expect(parsePrice('15')).toBe(1500)
  expect(()=>parsePrice('abc')).toThrow();expect(()=>parsePrice('1500')).toThrow()
  expect(formatPrice(0)).toBe('Grátis');expect(formatPrice(2990)).toContain('29,90')
 })
 it('aceita só formatos conhecidos de arquivo',()=>{expect(fileExtension('Livro.PDF')).toBe('pdf');expect(fileExtension('x.exe')).toBeNull();expect(fileExtension('semextensao')).toBeNull()})
 it('pago sem acesso mostra preço e não o conteúdo; grátis abre',()=>{
  const locked=renderToStaticMarkup(<ContentCard item={{...base,price_cents:2990,unlocked:false}} onChat={()=>{}}/>)
  expect(locked).toContain('Conteúdo pago');expect(locked).toContain('29,90');expect(locked).toContain('Falar com Paula');expect(locked).not.toContain('Abrir conteúdo')
  const free=renderToStaticMarkup(<ContentCard item={{...base,price_cents:0,unlocked:true}}/>)
  expect(free).toContain('Abrir conteúdo');expect(free).toContain('Grátis')
 })
 it('menus: aluno tem Conteúdos, parceiro tem Meus conteúdos, admin aprova',()=>{
  expect(roleMenu({role:'aluno',approved:false}).some(v=>v.id==='conteudos')).toBe(true)
  expect(roleMenu({role:'profissional',approved:true}).some(v=>v.id==='meus-conteudos')).toBe(true)
  expect(roleMenu({role:'admin',approved:true}).some(v=>v.id==='conteudos-admin')).toBe(true)
 })
})

import {describe,it,expect} from 'vitest'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {RatingLine} from './Reviews'
import {trimmedAverage,formatAverage} from '@/lib/supabase/reviews'
import {roleMenu} from './RoleHome'

describe('avaliações',()=>{
 it('média sem as 3 piores das 100 últimas',()=>{
  expect(trimmedAverage([5,5,5,5,5,5,5,1,1,1])).toBe(5)
  expect(trimmedAverage([4,2,5])).toBeCloseTo(3.67,2)            // 3 ou menos: usa todas
  expect(trimmedAverage([5,4,1,1])).toBe(5)
  expect(trimmedAverage([...Array(100).fill(3),...Array(50).fill(1)])).toBe(3) // só as 100 mais recentes
  expect(trimmedAverage([])).toBeNull();expect(formatAverage(4.75)).toBe('4,8')
 })
 it('linha de estrelas',()=>{
  expect(renderToStaticMarkup(<RatingLine summary={{user_id:'u',average:4.8,counted:20,total:23,dropped:3}} showRule/>)).toContain('4,8')
  expect(renderToStaticMarkup(<RatingLine summary={{user_id:'u',average:4.8,counted:20,total:23,dropped:3}} showRule/>)).toContain('sem as 3 piores')
  expect(renderToStaticMarkup(<RatingLine summary={undefined}/>)).toContain('Sem avaliações')
 })
 it('admin tem a moderação',()=>{expect(roleMenu({role:'admin',approved:true}).some(v=>v.id==='avaliacoes')).toBe(true)})
})

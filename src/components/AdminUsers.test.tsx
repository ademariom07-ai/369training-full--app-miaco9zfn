import {describe,it,expect} from 'vitest'
import {roleMenu} from './RoleHome'
import {deleteOutcomes,filterLabels} from '@/lib/supabase/adminUsers'
describe('admin: usuários',()=>{
 it('menu só para admin',()=>{expect(roleMenu({role:'admin',approved:true}).some(v=>v.id==='usuarios')).toBe(true);expect(roleMenu({role:'profissional',approved:true}).some(v=>v.id==='usuarios')).toBe(false)})
 it('textos de resultado e filtros',()=>{expect(Object.keys(deleteOutcomes)).toEqual(['excluida','anonimizada','anonimizada_sem_bloqueio']);expect(filterLabels.pedido_pendente).toBe('Pedidos de parceiro')})
})

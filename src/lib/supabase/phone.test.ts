import {it,expect} from 'vitest'
import {normalizeBrazilPhone,normalizeFullName} from './phone'
it('accepts Brazilian mobiles and landlines in common formats',()=>{
 expect(normalizeBrazilPhone('(11) 98765-4321')).toBe('+5511987654321')
 expect(normalizeBrazilPhone('11987654321')).toBe('+5511987654321')
 expect(normalizeBrazilPhone('+55 11 98765-4321')).toBe('+5511987654321')
 expect(normalizeBrazilPhone('5521333344444'.slice(0,12))).toBe('+552133334444')
 expect(normalizeBrazilPhone('(21) 3333-4444')).toBe('+552133334444')
})
it('rejects incomplete, foreign-length and non-numeric phones',()=>{
 for(const value of ['','12345','(11) 8765-4321','(01) 98765-4321','11 98765-432a','11 98765-4321; x','+1 202 555 0100','9'.repeat(41)])expect(normalizeBrazilPhone(value)).toBeNull()
})
it('requires first and last name and normalizes spaces',()=>{
 expect(normalizeFullName('  Maria   da Silva ')).toBe('Maria da Silva')
 for(const value of ['','Maria','  ','x'.repeat(161)+' y'])expect(normalizeFullName(value)).toBeNull()
})

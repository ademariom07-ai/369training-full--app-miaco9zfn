import {expect,it} from 'vitest'
import {parseMonthlyCashbackInput as parse,calculateMonthlyEsgPreview as calculate} from './monthlyEsg'
it('parses Brazilian decimal input in exact integer cents including threshold boundaries',()=>{
 for(const [raw,cents] of [['0',0],['0,01',1],['9999,99',999999],['10000,00',1000000],['15000',1500000],['20000,5',2000050]] as const)expect(parse(raw)).toBe(cents)
 expect(calculate(parse('20000,00'),1).payableCents).toBe(1400000)
})
it('rejects ambiguous amounts injection signs exponents excessive precision and unsafe totals',()=>{
 for(const raw of ['', '1.000','1.50','R$ 20000','-1','+1','1e6','1,001',' 1','1 ','Infinity','<script>', '90071992547409,92', '0'.repeat(33)])expect(()=>parse(raw)).toThrow()
 expect(parse('90071992547409,91')).toBe(Number.MAX_SAFE_INTEGER)
})

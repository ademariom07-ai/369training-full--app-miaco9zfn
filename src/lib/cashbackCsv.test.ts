import {it,expect} from 'vitest'
import {cashbackPreviewCsv} from './cashbackCsv'
import {calculateCashbackDistribution} from './cashbackDistribution'
it('export protects spreadsheet formula injection in names codes and reasons',()=>{const row=calculateCashbackDistribution(10,1).participants[0];for(const value of ['=1+1','+SUM(1)','-2+3','@SUM(1)','\t=1+1']){const csv=cashbackPreviewCsv([{...row,name:value,userCode:value,isExcluded:true,exclusionReason:value}]);expect(csv).toContain('"\''+value+'"');expect(csv).toContain('Sem credito financeiro')}})
it('quotes delimiters and newlines remain inside escaped text cells',()=>{const row=calculateCashbackDistribution(10,1).participants[0];expect(cashbackPreviewCsv([{...row,name:'a;"b\nc'}])).toContain('"a;""b\nc"')})

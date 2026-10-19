import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {describe,it,expect} from 'vitest'
const blocks=['cron_recalculate_rank.js','admin_recalculate_rank.js','on_service_completed.js','on_review_created.js'].flatMap(name=>[...readFileSync('pocketbase/hooks/'+name,'utf8').matchAll(/const rawCreated = [\s\S]*?const antiguidade = Math.max\(diffMonths, 1\)/g)].map((m,i)=>({name:name+':'+i,source:m[0]})))
const cases:[string,string,number][]=[
 ['2026-10-19 12:00:00.000','2026-10-19T12:00:00Z',1],
 ['2026-01-31T12:00:00Z','2026-03-30T12:00:00Z',1],
 ['2026-01-31T12:00:00Z','2026-03-31T11:59:59Z',1],
 ['2026-01-31T12:00:00Z','2026-03-31T12:00:00Z',2],
 ['2025-12-31T12:00:00Z','2026-02-28T12:00:00Z',2],
 ['2023-12-31T12:00:00Z','2024-02-29T12:00:00Z',2],
 ['2024-02-29T12:00:00Z','2025-02-28T12:00:00Z',12],
 ['2016-10-19T12:00:00Z','2026-10-19T12:00:00Z',120],
 ['2000-01-01T00:00:00Z','2026-10-19T12:00:00Z',321],
 ['2026-01-31T09:00:00-03:00','2026-03-31T12:00:00Z',2],
]
function calculate(source:string,created:unknown,date:string){return runInNewContext(source+';antiguidade',{Date,now:new Date(date),u:{created,get:()=>created}})}
it('covers every calendar calculation path',()=>expect(blocks).toHaveLength(5))
for(const block of blocks)describe(block.name,()=>{
 it.each(cases)('counts completed UTC calendar months from %s to %s', (created,date,expected)=>expect(calculate(block.source,created,date)).toBe(expected))
 it.each(['bad-date','',null,'2027-01-01T00:00:00Z'])('rejects invalid or future registration %s',created=>expect(()=>calculate(block.source,created,'2026-10-19T12:00:00Z')).toThrow('Data de cadastro inválida'))
})

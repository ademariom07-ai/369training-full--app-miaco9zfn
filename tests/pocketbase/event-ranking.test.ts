import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'
// Execute actual calculation blocks, not full event/fee hooks or PocketBase HTTP.
const blocks=['on_service_completed.js','on_review_created.js'].flatMap(file=>{
 const source=readFileSync('pocketbase/hooks/'+file,'utf8')
 return [...source.matchAll(/    const planMultipliers = [\s\S]*?(?=    const rankCol =)/g)].map((m,index)=>({name:file+':'+index,source:m[0]}))
})
function calculate(source:string,inactive=false){
 const users=[['z-free','profissional','gratis'],['a-free','aluno','gratis'],['paid','aluno','pro'],['cap','profissional','pro_parceiro']].map(([id,role,plan])=>({id,get:(key:string)=>({role,plan,subscription_status:inactive?'cancelada':'ativa',linked_professional:'paid',rating_avg:4,created:'2025-01-01T00:00:00Z'} as Record<string,unknown>)[key]}))
 return runInNewContext(source+'\nscores',{users,now:new Date('2026-10-09T12:00:00Z'),cycle:'2026-10',currentMonthStart:'2026-10-01',
 $app:{findRecordsByFilter:(collection:string)=>{
 if(collection==='services')return Array.from({length:200},(_,i)=>({id:String(i),get:(k:string)=>k==='professional'?'pro':k==='type'?'consulta':null}));
 if(collection==='referrals')return [{id:'ref'}];if(collection==='wallet_transactions')return [];
 if(collection==='monthly_rank_snapshots')return [{get:()=>10}];throw Error('Unexpected read')
 },findRecordById:()=>{throw Error('Do not infer plan from link')}}}) as {user:{id:string};total_points:number;monthly_points:number;multiplier:number;services_count:number}[]
}
it('covers all three event recalculation blocks',()=>expect(blocks).toHaveLength(3))
for(const block of blocks){
 it(`${block.name}: free keeps rating seniority history and deterministic position`,()=>{const rows=calculate(block.source);expect(rows.map(r=>r.user.id)).toEqual(['paid','cap','a-free','z-free']);for(const row of rows.filter(r=>r.user.id.includes('free')))expect(row).toMatchObject({total_points:24,monthly_points:14,multiplier:0});expect(rows.find(r=>r.user.id==='cap')?.services_count).toBe(150);expect(rows.find(r=>r.user.id==='paid')?.services_count).toBe(200)})
 it(`${block.name}: linked inactive student cannot inherit paid multiplier`,()=>{const row=calculate(block.source,true).find(r=>r.user.id==='paid');expect(row).toMatchObject({total_points:24,monthly_points:14,multiplier:0})})
}

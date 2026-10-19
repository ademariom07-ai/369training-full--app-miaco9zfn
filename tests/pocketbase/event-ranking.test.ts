import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'
// Execute actual calculation blocks, not full event/fee hooks or PocketBase HTTP.
const blocks=['on_service_completed.js','on_review_created.js'].flatMap(file=>{
 const source=readFileSync('pocketbase/hooks/'+file,'utf8')
 return [...source.matchAll(/    const planMultipliers = [\s\S]*?(?=    const rankCol =)/g)].map((m,index)=>({name:file+':'+index,source:m[0]}))
})
function calculate(source:string,inactive=false,rating=4,serviceCount=200,created='2025-01-01T00:00:00Z'){
 const users=[['z-free','profissional','gratis'],['a-free','aluno','gratis'],['paid','aluno','pro'],['cap','profissional','pro_parceiro']].map(([id,role,plan])=>({id,get:(key:string)=>({role,plan,subscription_status:inactive?'cancelada':'ativa',linked_professional:'paid',rating_avg:rating,created} as Record<string,unknown>)[key]}))
 return runInNewContext(source+'\nscores',{users,now:new Date('2026-10-09T12:00:00Z'),cycle:'2026-10',currentMonthStart:'2026-10-01',
 $app:{findRecordsByFilter:(collection:string)=>{
 if(collection==='services')return Array.from({length:serviceCount},(_,i)=>({id:String(i),get:(k:string)=>k==='professional'?'pro':k==='type'?'consulta':null}));
 if(collection==='referrals')return [{id:'ref'}];if(collection==='wallet_transactions')return [];
 if(collection==='monthly_rank_snapshots')return [{get:()=>10}];throw Error('Unexpected read')
 },findRecordById:()=>{throw Error('Do not infer plan from link')}}}) as {user:{id:string};total_points:number;monthly_points:number;multiplier:number;services_count:number}[]
}
it('covers all three event recalculation blocks',()=>expect(blocks).toHaveLength(3))
for(const block of blocks){
 it(`${block.name}: free keeps rating seniority history and deterministic position`,()=>{const rows=calculate(block.source);expect(rows.map(r=>r.user.id)).toEqual(['paid','cap','a-free','z-free']);for(const row of rows.filter(r=>r.user.id.includes('free')))expect(row).toMatchObject({total_points:35,monthly_points:25,multiplier:0});expect(rows.find(r=>r.user.id==='cap')?.services_count).toBe(150);expect(rows.find(r=>r.user.id==='paid')?.services_count).toBe(200)})
 it(`${block.name}: linked inactive student cannot inherit paid multiplier`,()=>{const row=calculate(block.source,true).find(r=>r.user.id==='paid');expect(row).toMatchObject({total_points:35,monthly_points:25,multiplier:0})})
}

it('all event ranking blocks preserve zero rating',()=>{for(const block of blocks)expect(calculate(block.source,false,0).find(row=>row.user.id==='a-free')).toMatchObject({monthly_points:21,total_points:31})})
it('review averaging includes zero without replacing it with five',()=>{
 const source=readFileSync('pocketbase/hooks/on_review_created.js','utf8');const block=source.slice(source.indexOf('  // 2. Atualizar'),source.indexOf('  // 3. RECÁLCULO'))
 const values:Record<string,unknown>={};let saved=0;const user={set:(key:string,value:unknown)=>values[key]=value}
 runInNewContext(block,{revieweeId:'student',console,$app:{findRecordsByFilter:()=>[0,4].map(rating=>({get:()=>rating})),findRecordById:()=>user,save:(record:unknown)=>{expect(record).toBe(user);saved++}}})
 expect(values.rating_avg).toBe(2);expect(saved).toBe(1)
})

it('event ranking blocks reject invalid ratings',()=>{for(const block of blocks)for(const rating of [-1,5.01,NaN,Infinity,'4' as unknown as number])expect(()=>calculate(block.source,false,rating)).toThrow('Avaliação fora do intervalo permitido')})

it('event ranking retains decimal averages',()=>{for(const b of blocks)expect(calculate(b.source,false,3.8).find(r=>r.user.id==='a-free')).toMatchObject({monthly_points:24.8,total_points:34.8})})

it('review average includes more than 500 reviews and retains repeating decimals',()=>{
 const source=readFileSync('pocketbase/hooks/on_review_created.js','utf8');const block=source.slice(source.indexOf('  // 2. Atualizar'),source.indexOf('  // 3. RECÁLCULO'))
 const ratings=[...Array(500).fill(5),0,1];const offsets:number[]=[];let average=0
 runInNewContext(block,{revieweeId:'student',console,$app:{findRecordsByFilter:(_c:string,_f:string,_s:string,limit:number,offset:number)=>{offsets.push(offset);return ratings.slice(offset,offset+limit).map(rating=>({get:()=>rating}))},findRecordById:()=>({set:(_k:string,v:number)=>{average=v}}),save:()=>{}}})
 expect(offsets).toEqual([0,500]);expect(average).toBe(2501/502)
})

it('PRO PARCEIRO has weight 2 and 150 fixed scoring services at every real volume',()=>{for(const b of blocks)for(const count of [0,10,200]){const row=calculate(b.source,false,4,count).find(r=>r.user.id==='cap');expect(row).toMatchObject({multiplier:2,services_count:150,monthly_points:325,total_points:335});expect((row as any).services_real_count).toBe(count)}})
it('event seniority is not capped for long memberships',()=>{for(const b of blocks){const row=calculate(b.source,false,5,0,'2010-01-01T00:00:00Z').find(r=>r.user.id==='a-free');const months=201;expect(row?.monthly_points).toBe(5+months);expect(months).toBeGreaterThan(120)}})

import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {createHash} from 'node:crypto'
import {it,expect} from 'vitest'
function run(role:string|null='admin',failure:string|boolean=false){
 const users=[['z-free','profissional','gratis'],['a-free','aluno','gratis'],['p-paid','aluno','pro'],['cap','profissional','pro_parceiro']].map(([id,role,plan])=>({id,role,plan,subscription_status:'ativa',linked_professional:'p-paid',rating_avg:4,created:'2025-01-01T00:00:00Z'}))
 const writes:Record<string,unknown>[]=[],queries:string[]=[];let response:{status:number;body:Record<string,unknown>}|undefined,inTransaction=false,committed=false,attempted=0
 const old={user:'previous',points:99};let persisted:Record<string,unknown>[]=[old]
 class FixedDate extends Date{constructor(value?:string|number){super(value??'2026-10-09T12:00:00Z')}}
 const txApp={db:()=>({newQuery:(sql:string)=>{
  expect(inTransaction).toBe(true);queries.push(sql);let params:Record<string,unknown>={}
  return {bind(p:Record<string,unknown>){params=p;return this},all(target:unknown[]){
   expect(Array.isArray(target)).toBe(true)
   const stage=sql.includes('FROM services')?'services':sql.includes('FROM referrals')?(sql.includes('WHERE')?'monthly-referrals':'all-referrals'):sql.includes('SUM(points)')?'snapshots':sql.includes('FROM users')?'users':'existing'
   if(failure===stage||failure===true&&stage==='services')throw Error('SQL private details should not reach client')
   const values=stage==='services'?users.map(u=>({user_id:u.id,total_svc:200})):stage.includes('referrals')?users.map(u=>({referrer:u.id,total_ref:1})):stage==='snapshots'?users.map(u=>({user:u.id,total_past:10})):stage==='users'?users:[]
   target.push(...values)
  },execute(){
   if(sql.includes('INSERT OR REPLACE')){attempted++;if(failure==='second-write'&&attempted===2)throw Error('write failure');writes.push(params);persisted.push(params)}
   else if(sql.includes('DELETE FROM rank_entries')){if(failure==='delete')throw Error('delete failure');persisted=[]}
   else throw Error('Unexpected mutation')
  }}
 }})}
 runInNewContext(readFileSync('pocketbase/hooks/admin_recalculate_rank.js','utf8'),{
 Date:FixedDate,console,arrayOf:()=>[],DynamicModel:class{constructor(value:unknown){Object.assign(this,value)}},
 $security:{md5:(s:string)=>createHash('md5').update(s).digest('hex')},$apis:{requireAuth:()=>true},
 routerAdd:(_method:string,_path:string,fn:(c:unknown)=>void)=>fn({auth:role===null?null:{getString:()=>role},json:(status:number,body:Record<string,unknown>)=>{expect(inTransaction).toBe(false);response={status,body}}}),
 $app:{db:()=>{throw Error('Must use transaction connection')},runInTransaction:(fn:(app:unknown)=>void)=>{inTransaction=true;const before=[...persisted];try{fn(txApp);if(failure==='commit')throw Error('commit failed');committed=true}catch(e){persisted=before;writes.length=0;throw e}finally{inTransaction=false}}}
 })
 return {writes,queries,response,persisted,committed,attempted}
}
it('manual recalc preserves free rating seniority and previous points without inheriting a plan',()=>{const {writes,response}=run();expect(response?.status).toBe(200);for(const id of ['a-free','z-free']){const row=writes.find(r=>r.user===id)!;expect(row.points).toBe(24);expect(JSON.parse(String(row.tie_break_details))).toMatchObject({plan_multiplier:0,monthly_points:14,closed_past_points:10})}})
it('manual recalc keeps cap150 and stable identity tie breaks',()=>{const {writes}=run();expect(writes.map(r=>r.user)).toEqual(['p-paid','cap','a-free','z-free']);expect(writes.find(r=>r.user==='cap')?.services_count).toBe(150);expect(writes.find(r=>r.user==='p-paid')?.services_count).toBe(200)})
it('manual recalc denies unauthenticated and nonadmin requests before database access',()=>{for(const role of [null,'aluno','profissional']){const r=run(role);expect(r.response?.status).toBe(role===null?401:403);expect(r.queries).toEqual([]);expect(r.writes).toEqual([])}})

it('manual recalc aborts before ranking writes when service aggregation fails',()=>{const r=run('admin',true);expect(r.response?.status).toBe(500);expect(r.writes).toEqual([]);expect(r.queries.some(q=>q.includes('DELETE FROM rank_entries'))).toBe(false)})

it('query failures preserve prior ranking and return no database details',()=>{for(const failure of ['monthly-referrals','all-referrals','snapshots','users','existing']){const r=run('admin',failure);expect(r.response?.status).toBe(500);expect(r.persisted).toEqual([{user:'previous',points:99}]);expect(r.committed).toBe(false);expect(JSON.stringify(r.response)).not.toContain('SQL private')}})
it('delete partial write and commit failures rollback the entire simulated transaction',()=>{for(const failure of ['delete','second-write','commit']){const r=run('admin',failure);expect(r.response?.status).toBe(500);expect(r.persisted).toEqual([{user:'previous',points:99}]);expect(r.writes).toEqual([]);expect(r.committed).toBe(false);if(failure==='second-write')expect(r.attempted).toBe(2)}})
it('successful response is emitted only after transaction commit',()=>{const r=run();expect(r.committed).toBe(true);expect(r.persisted).toHaveLength(4);expect(r.response?.status).toBe(200)})

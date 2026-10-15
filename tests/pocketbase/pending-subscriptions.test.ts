import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {it,expect} from 'vitest'
function run(rows:any[],role:string|null='admin',period='2026-10',fail=false){
 let handler:any;const calls:any[]=[]
 const tx={db:()=>({newQuery:(sql:string)=>{
  expect(sql).toContain("status='pendente'")
  return {bind:(p:any)=>({all:(out:any[])=>{
   calls.push(p);if(fail)throw Error('private detail');out.push(...rows.slice(p.offset,p.offset+500))
  }})}
 }})}
 runInNewContext(readFileSync('pocketbase/hooks/admin_pending_subscriptions.js','utf8'),{
  routerAdd:(_m:any,_p:any,h:any)=>handler=h,$apis:{requireAuth:()=>({})},
  DynamicModel:function(v:any){return v},arrayOf:()=>[],$app:{runInTransaction:(f:any)=>f(tx)}
 })
 return {response:handler({auth:role?{getString:()=>role}:null,requestInfo:()=>({body:{period}}),json:(status:any,body:any)=>({status,body})}),calls}
}

const row={id:'1',user:'u',reference_id:'pro_monthly',amount:20}
it('protects inventory with admin authorization',()=>{for(const role of [null,'aluno','profissional']){const r=run([row],role);expect(r.response.status).toBe(role?403:401);expect(r.calls).toHaveLength(0)}})
it('reports pending amounts without authorizing payments or cashback',()=>{expect(run([row]).response.body).toMatchObject({pendingCount:1,pendingAmountCents:2000,paymentConfirmed:false,activationAllowed:false,cashbackContributionCents:0});expect(JSON.stringify(run([row]).response.body)).not.toContain('pro_monthly')})
it('flags duplicate business references rather than hiding them',()=>expect(run([row,{...row,id:'2'}]).response.body.duplicateReferenceCount).toBe(1))
it('paginates and uses a half-open monthly window',()=>{const r=run(Array.from({length:501},(_,i)=>({...row,id:String(i),user:String(i)})),'admin','2026-12');expect(r.calls).toHaveLength(2);expect(r.calls[0]).toMatchObject({from:'2026-12-01 03:00:00.000Z',to:'2027-01-01 03:00:00.000Z'});expect(r.response.body.pendingCount).toBe(501)})
it('rejects malformed periods values or partial inventory without leaking details',()=>{expect(run([],'admin','2026-13').response.status).toBe(400);for(const amount of [-1,0,1.001,NaN])expect(run([{...row,amount}]).response.status).toBe(409);const r=run([row],'admin','2026-10',true);expect(r.response.status).toBe(409);expect(JSON.stringify(r.response)).not.toContain('private detail')})

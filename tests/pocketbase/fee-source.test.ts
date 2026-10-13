import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'
const item={id:'fee',user:'student',role:'aluno',amount:-100,status:'concluido',reference_id:'service',reference_type:'service'}
function run(input:Record<string,unknown>[]= [item],role:string|null='admin',period='2026-10',fail=false){
 let handler:any;const calls:any[]=[];let transaction=false
 const tx={db:()=>({newQuery:(sql:string)=>({bind:(params:any)=>({all:(out:any[])=>{expect(transaction).toBe(true);expect(sql).toContain("t.type='tarifa'");calls.push(params);if(fail)throw Error('SECRET database detail');out.push(...input.slice(params.offset,params.offset+500))}})})})}
 const app={runInTransaction:(fn:any)=>{transaction=true;fn(tx);transaction=false}}
 runInNewContext(readFileSync('pocketbase/hooks/admin_fee_source.js','utf8'),{routerAdd:(_m:string,path:string,h:any)=>{expect(path).toBe('/backend/v1/admin/fee_source');handler=h},$apis:{requireAuth:()=>({})},$app:app,arrayOf:()=>[],DynamicModel:function(v:any){return v}})
 const response=handler({auth:role===null?null:{getString:()=>role},requestInfo:()=>({body:{period}}),json:(status:number,body:any)=>({status,body})})
 return {response,calls}
}
it('rejects anonymous and non-admin before database reads',()=>{for(const role of [null,'aluno','profissional']){const r=run([item],role);expect(r.response.status).toBe(role===null?401:403);expect(r.calls).toHaveLength(0)}})
it('validates periods and binds an explicit half-open window across year rollover',()=>{for(const p of ['2026-13','2026-1',"2026-01' OR 1=1"]){const r=run([], 'admin',p);expect(r.response.status).toBe(400);expect(r.calls).toHaveLength(0)}expect(run([],'admin','2026-12').calls[0]).toMatchObject({from:'2026-12-01 03:00:00.000Z',to:'2027-01-01 03:00:00.000Z'})})
it('counts student and partner charges separately without marking settlement confirmed',()=>{const r=run([item,{...item,id:'partner-fee',user:'partner',role:'profissional',amount:-400}]).response;expect(r.status).toBe(200);expect(r.body).toMatchObject({studentFeeCents:10000,partnerFeeCents:40000,totalFeeCents:50000,indicativePoolCents:19000,settlementVerified:false,usableForClosing:false,acceptedRecords:2})})
it('reads all pages in a transaction, including the exact page-size boundary',()=>{const rows=Array.from({length:500},(_,i)=>({...item,id:String(i),reference_id:String(i)}));const r=run(rows);expect(r.calls.map(p=>p.offset)).toEqual([0,500]);expect(r.response.body.acceptedRecords).toBe(500)})
it('excludes pending void and reversed entries from indicative totals',()=>{const r=run(['pendente','cancelado','estornado'].map((status,i)=>({...item,id:String(i),status})));expect(r.response.body).toMatchObject({acceptedRecords:0,excludedRecords:3,totalFeeCents:0})})
it('rejects duplicates unknown payers invalid values and query failures without partial totals',()=>{const cases=[[item,item],[item,{...item,id:'other'}],...['role','user','reference_id'].map(k=>[{...item,[k]:''}]),...[-0.001,1,NaN,Infinity].map(amount=>[{...item,amount}]),[{...item,status:'unknown'}]];for(const rows of cases){expect(run(rows).response).toMatchObject({status:409,body:{code:'FEE_SOURCE_NOT_RECONCILED'}});expect(run(rows).response.body.totalFeeCents).toBeUndefined()}const r=run([item],'admin','2026-10',true);expect(r.response.status).toBe(409);expect(JSON.stringify(r.response)).not.toContain('SECRET')})

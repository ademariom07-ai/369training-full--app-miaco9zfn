import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {it,expect} from 'vitest'
function setup(role='aluno',fail=false){
 let handler:any;const rows:any[]=[];let writes=0;const data:any={role,plan:'gratis',approved:true,subscription_status:'ativa',subscription_expires_at:'old',linked_professional:''}
 const user={id:'user1',get:(k:string)=>data[k],getString:(k:string)=>data[k]||'',set:(k:string,v:any)=>data[k]=v}
 function Rec(this:any){this.id='tx1';this.data={};this.set=(k:string,v:any)=>this.data[k]=v;this.get=(k:string)=>this.data[k];this.getString=(k:string)=>this.data[k]||''}
 const tx={findRecordById:()=>user,findRecordsByFilter:()=>rows,findCollectionByNameOrId:()=>({}),save:(r:any)=>{if(fail)throw Error('secret');writes++;if(r!==user)rows.push(r)}}
 runInNewContext(readFileSync('pocketbase/hooks/plans_change.js','utf8'),{routerAdd:(_m:string,_p:string,h:any)=>handler=h,$apis:{requireAuth:()=>({})},$app:{runInTransaction:(fn:any)=>fn(tx)},Record:Rec,Date})
 return {data,rows,writes:()=>writes,request:(body:any,auth:any=user)=>handler({auth,requestInfo:()=>({body}),json:(status:number,body:any)=>({status,body})})}
}
it('paid student request never activates, extends or changes the current plan',()=>{const s=setup();expect(s.request({plan:'premium',payment_confirmed:true}).status).toBe(202);expect(s.data).toMatchObject({plan:'gratis',subscription_status:'ativa',subscription_expires_at:'old'});expect(s.rows[0].data).toMatchObject({status:'pendente',amount:30,type:'mensalidade'})})
it('repeated requests reuse pending charge',()=>{const s=setup();s.request({plan:'pro'});s.request({plan:'pro'});expect(s.rows).toHaveLength(1);expect(s.writes()).toBe(1);expect(s.request({plan:'premium'}).status).toBe(409)})
it('PRO PARCEIRO remains pending at 149',()=>{const s=setup('profissional');expect(s.request({plan:'pro_parceiro'}).status).toBe(202);expect(s.rows[0].data.amount).toBe(149);expect(s.data.plan).toBe('gratis')})
it('professional per-service plans activate without monthly debit or expiry',()=>{for(const plan of ['basico','pro','premium']){const s=setup('profissional');expect(s.request({plan}).status).toBe(200);expect(s.rows).toHaveLength(0);expect(s.data).toMatchObject({plan,subscription_expires_at:''})}})
it('rejects invalid roles plans billing and unauthenticated requests',()=>{const s=setup();expect(s.request({plan:'pro'},null).status).toBe(401);expect(s.request({plan:'pro_parceiro'}).status).toBe(400);expect(s.request({plan:'pro',billing_period:'annual'}).status).toBe(400);expect(s.request({plan:7}).status).toBe(400);const unapproved=setup();unapproved.data.approved=false;expect(unapproved.request({plan:'pro'}).status).toBe(403)})
it('linked students are not charged',()=>{const s=setup();s.data.linked_professional='partner';expect(s.request({plan:'premium'}).status).toBe(409);expect(s.writes()).toBe(0)})
it('failed pending charge does not activate or leak details',()=>{const s=setup('aluno',true),r=s.request({plan:'pro'});expect(r.status).toBe(500);expect(s.data.plan).toBe('gratis');expect(JSON.stringify(r)).not.toContain('secret')})
it('service completion no longer performs fee writes',()=>{const source=readFileSync('pocketbase/hooks/on_service_completed.js','utf8');expect(source).not.toContain('debitServiceFee');expect(source).not.toContain('save(feeTx)')})

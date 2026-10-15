import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {it,expect} from 'vitest'
for(const role of [null,'aluno','profissional','admin'])it('blocks legacy fee backfill without database access: '+role,()=>{
 let handler:any
 runInNewContext(readFileSync('pocketbase/hooks/admin_backfill_tarifas.js','utf8'),{routerAdd:(_m:any,_p:any,h:any)=>handler=h,$apis:{requireAuth:()=>({})},$app:new Proxy({},{get:()=>{throw Error('Unexpected database access')}})})
 const result=handler({auth:role?{getString:()=>role}:null,json:(status:number,body:any)=>({status,body})})
 expect(result.status).toBe(role===null?401:role==='admin'?503:403)
 if(role==='admin')expect(result.body.code).toBe('LEGACY_FEE_BACKFILL_DISABLED')
})

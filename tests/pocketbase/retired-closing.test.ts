import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it,vi} from 'vitest'
type Context={auth:null|{getString:(key:string)=>string};json:(status:number,body:Record<string,unknown>)=>unknown}
function load(endpoint:string){
 let handler:((context:Context)=>unknown)|undefined
 const storage=vi.fn(()=>{throw Error('Retired closing must never access storage')})
 const guard={name:'auth'}
 const context={
  routerAdd:(method:string,path:string,callback:(context:Context)=>unknown,middleware:unknown)=>{expect(method).toBe('POST');expect(path).toBe(`/backend/v1/admin/${endpoint}`);expect(middleware).toBe(guard);expect(handler).toBeUndefined();handler=callback},
  $apis:{requireAuth:()=>guard},
  $app:new Proxy({}, {get:storage}),Record:storage,cronAdd:storage,
 }
 runInNewContext(readFileSync(`pocketbase/hooks/admin_${endpoint}.js`,'utf8'),context)
 expect(handler).toBeTypeOf('function')
 function request(role:string|null){const json=vi.fn((status,body)=>({status,body}));handler!({auth:role===null?null:{getString:key=>key==='role'?role:''},json});expect(json).toHaveBeenCalledTimes(1);expect(storage).not.toHaveBeenCalled();return json.mock.results[0].value}
 return request
}
for(const endpoint of ['close_cycle','fechamento_mensal']){
 it(`${endpoint} requires authentication even when invoked without middleware`,()=>{expect(load(endpoint)(null).status).toBe(401)})
 it(`${endpoint} rejects nonadmin actors before touching any collection`,()=>{const request=load(endpoint);for(const role of ['aluno','profissional','','ADMIN'])expect(request(role).status).toBe(403)})
 it(`${endpoint} returns explicit unavailable status to admin without financial effects`,()=>{expect(load(endpoint)('admin')).toMatchObject({status:503,body:{code:'LINEAR_CLOSING_NOT_READY',rules_version:'global-linear-v1',retryable:false}})})
 it(`${endpoint} repeated requests cannot reset counters or create credits`,()=>{const request=load(endpoint);for(let i=0;i<10;i++)expect(request('admin').status).toBe(503)})
}

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { it, expect } from 'vitest'
const input={exerciseName:'Exercício',weightUsed:0,difficulty:0,objective:'Força',reps:'10',sets:'2',painReported:false,techniqueDifficulty:false}
function call(body:unknown=input,response:unknown=JSON.stringify({recommendation:'Relato para revisão',rationale:'Revisão necessária'}),auth=true,fail=false){
 let handler:any,calls=0,sent:any
 runInNewContext(readFileSync('pocketbase/hooks/ai_load_feedback.js','utf8'),{routerAdd:(_m:string,_p:string,fn:any)=>{handler=fn},$apis:{requireAuth:()=>null},$ai:{chat:(request:unknown)=>{calls++;sent=request;if(fail)throw Error('private-secret');return {choices:[{message:{content:response}}]}}}})
 return {...handler({auth:auth?{id:'u'}:null,requestInfo:()=>({body}),json:(status:number,data:unknown)=>({status,data})}),calls,sent}
}
it('requires authentication',()=>expect(call(input,'',false)).toMatchObject({status:401,calls:0}))
it.each([{weightUsed:'20'},{weightUsed:-1},{difficulty:11},{painReported:undefined},{techniqueDifficulty:'no'},{reps:''}])('rejects missing or invalid context before AI',change=>expect(call({...input,...change})).toMatchObject({status:400,calls:0}))
it.each([{painReported:true},{techniqueDifficulty:true}])('routes concerning reports to professional review without AI',change=>expect(call({...input,...change})).toMatchObject({status:409,calls:0}))
it('preserves zero weight and effort instead of substituting defaults',()=>{const r=call();expect(r.status).toBe(200);expect(JSON.parse(r.sent.messages[1].content)).toMatchObject({weightUsed:0,difficulty:0})})
it.each(['not JSON','{}','null','x'.repeat(6001)])('rejects malformed AI response without generic load increment',response=>{const r=call(input,response);expect(r.status).toBe(502);expect(r.data.suggestedLoad).toBeUndefined()})
it('ignores suggested actions and loads from provider',()=>{const r=call(input,JSON.stringify({recommendation:'Revisar',rationale:'Dados para análise',action:'increase',suggestedLoad:'200kg'}));expect(r.data).toMatchObject({action:'review',requiresProfessionalReview:true,suggestedLoad:'A definir após revisão profissional'})})
it('hides provider errors',()=>{const r=call(input,'',true,true);expect(r.status).toBe(503);expect(JSON.stringify(r)).not.toContain('private-secret')})

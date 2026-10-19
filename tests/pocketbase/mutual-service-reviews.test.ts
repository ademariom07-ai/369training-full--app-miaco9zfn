import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {describe,it,expect} from 'vitest'
const source=readFileSync('pocketbase/hooks/on_review_created.js','utf8')
const block=source.slice(source.indexOf('  // 1. Atualizar'),source.indexOf('  // 2. Atualizar'))
const review=(reviewer:string,reviewee:string,rating=5)=>({get:(k:string)=>({reviewer,reviewee,rating} as any)[k]})
function run(reviews:ReturnType<typeof review>[],fail=false,professional='p'){
 const values:any={student:'a',professional,validated:true,validated_at:'old'};let saves=0,continued=false;const offsets:number[]=[]
 const service={get:(k:string)=>values[k],set:(k:string,v:unknown)=>values[k]=v}
 runInNewContext('(function(){'+block+'\nmarkContinued()})()',{serviceId:'s',Date,console:{error:()=>{}},markContinued:()=>{continued=true},$app:{findRecordById:()=>service,findRecordsByFilter:(_c:string,_f:string,_o:string,limit:number,offset:number)=>{if(fail)throw Error('db failure');offsets.push(offset);return reviews.slice(offset,offset+limit)},save:()=>{saves++}}})
 return {values,saves,continued,offsets}
}
describe('reciprocal service validation in actual hook block',()=>{
 it('one review cannot validate or retain an old timestamp',()=>{expect(run([review('a','p')]).values).toMatchObject({validated:false,validated_at:''})})
 it('repeated student reviews do not impersonate professional approval',()=>{expect(run([review('a','p'),review('a','p')]).values.validated).toBe(false)})
 it('third party and self reviews do not validate',()=>{expect(run([review('a','p'),review('x','a'),review('p','p')]).values.validated).toBe(false)})
 it('reciprocal reviews including zero rating validate',()=>{const r=run([review('a','p',0),review('p','a',4)]);expect(r.values).toMatchObject({validated:true,validation_status:'totalmente_validada'});expect(r.saves).toBe(1)})
 it('rejects invalid numerical ratings as validation evidence',()=>{for(const rating of [NaN,-1,5.1,'5' as any])expect(run([review('a','p'),review('p','a',rating)]).values.validated).toBe(false)})
 it('searches beyond first page',()=>{const r=run([...Array(500).fill(review('a','p')),review('p','a')]);expect(r.offsets).toEqual([0,500]);expect(r.values.validated).toBe(true)})
 it('missing professional cannot validate',()=>{expect(run([review('a','p'),review('p','a')],false,'').values.validated).toBe(false)})
 it('database failure stops before ranking recalculation',()=>{const r=run([],true);expect(r.saves).toBe(0);expect(r.continued).toBe(false)})
})

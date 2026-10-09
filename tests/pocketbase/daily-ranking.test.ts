import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'
function run(){
 const writes:{collection:string;values:Record<string,unknown>}[]=[]
 const users=[['z-free','profissional','gratis'],['a-free','aluno','gratis'],['p-paid','aluno','pro']].map(([id,role,plan])=>({id,get:(key:string)=>({role,plan,created:'2025-01-01T00:00:00Z',rating_avg:4,linked_professional:'p-paid',subscription_status:'ativa'} as Record<string,unknown>)[key]}))
 class Entry{values:Record<string,unknown>={};constructor(public collection:string){}set(key:string,value:unknown){this.values[key]=value}}
 const RealDate=Date;class LastDay extends RealDate{constructor(value?:string|number){super(value??'2026-10-31T03:00:00Z')}}
 let registered=0
 runInNewContext(readFileSync('pocketbase/hooks/cron_recalculate_rank.js','utf8'),{
 Date:LastDay,console,Record:Entry,
 cronAdd:(name:string,schedule:string,fn:()=>void)=>{expect(name).toBe('recalculate_rank');expect(schedule).toBe('0 3 * * *');registered++;fn()},
 $app:{findRecordsByFilter:(collection:string)=>{if(collection==='users')return users;if(collection==='services')return Array.from({length:200},(_,i)=>({id:String(i),get:(key:string)=>key==='professional'?'pro':key==='type'?'consulta':null}));if(collection==='referrals')return [{id:'ref'}];if(['rank_entries','wallet_transactions','monthly_rank_snapshots'].includes(collection))return [];throw Error('Unexpected collection '+collection)},findCollectionByNameOrId:(name:string)=>name,save:(r:Entry)=>writes.push({collection:r.collection,values:r.values}),delete:()=>{throw Error('Unexpected delete')},findRecordById:()=>{throw Error('Must not inherit linked plan')}}
 })
 expect(registered).toBe(1);return writes
}
it('daily legacy ranking includes free students and professionals with only rating and seniority',()=>{const writes=run();for(const id of ['a-free','z-free']){const row=writes.find(r=>r.values.user===id)!;expect(row.values.points).toBe(14);expect(row.values.tie_break_details).toMatchObject({plan_multiplier:0,monthly_points:14})}})
it('daily legacy ranking resolves exact ties deterministically by identity',()=>{const writes=run();expect(writes.map(r=>r.values.user)).toEqual(['p-paid','a-free','z-free']);expect(writes.map(r=>r.values.ranking_position)).toEqual([1,2,3])})
it('last day daily run does not close the month or create financial records',()=>{const writes=run();expect(writes).toHaveLength(3);expect(writes.every(r=>r.collection==='rank_entries')).toBe(true)})

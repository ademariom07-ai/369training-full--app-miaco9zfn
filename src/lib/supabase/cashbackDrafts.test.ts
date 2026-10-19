import {describe,it,expect,vi} from 'vitest'
import {saveCashbackDraft,readCashbackDrafts} from './cashbackDrafts'
const id='11111111-1111-1111-1111-111111111111',key='22222222-2222-2222-2222-222222222222'
const body={title:'Default',topPoolPercent:80,topParticipantsPercent:20,topRatio:10}
const row={id,request_id:key,created_by:id,created_at:'2026-10-19T12:00:00Z',title:'Default',top_pool_percent:80,top_participants_percent:20,top_ratio:10,status:'draft',algorithm_version:'pareto-configurable-v1'}
function setup(role='admin'){
 const single=vi.fn().mockResolvedValue({data:row,error:null})
 const query:any={select:vi.fn(),eq:vi.fn(),order:vi.fn(),single:vi.fn().mockResolvedValue({data:{id,role},error:null}),range:vi.fn().mockResolvedValue({data:[row],error:null})};for(const k of ['select','eq','order'])query[k].mockReturnValue(query)
 return {auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id},access_token:'token'}},error:null}),getUser:vi.fn().mockResolvedValue({data:{user:{id,is_anonymous:false}},error:null})},from:vi.fn().mockReturnValue(query),rpc:vi.fn().mockReturnValue({single}),query,single}
}
describe('cashback draft administrative client',()=>{
 it('sends bounded draft fields and explicit idempotency key',async()=>{const c=setup();expect(await saveCashbackDraft(c as any,id,key,body)).toMatchObject({requestId:key,status:'draft',topRatio:10});expect(c.rpc).toHaveBeenCalledWith('create_cashback_policy_draft',{p_request_id:key,p_title:'Default',p_top_pool_percent:80,p_top_participants_percent:20,p_top_ratio:10})})
 it('denies students before mutation',async()=>{const c=setup('aluno');await expect(saveCashbackDraft(c as any,id,key,body)).rejects.toThrow('administrativo');expect(c.rpc).not.toHaveBeenCalled()})
 it('rejects a mismatched identity before querying',async()=>{const c=setup();await expect(saveCashbackDraft(c as any,key,key,body)).rejects.toThrow();expect(c.from).not.toHaveBeenCalled()})
 it('rejects malformed configuration without authenticating or writing',async()=>{const c=setup();await expect(saveCashbackDraft(c as any,id,key,{...body,topRatio:0})).rejects.toThrow();expect(c.auth.getSession).not.toHaveBeenCalled()})
 it('rejects an active status instead of treating it as a saved draft',async()=>{const c=setup();c.single.mockResolvedValue({data:{...row,status:'active'},error:null});await expect(saveCashbackDraft(c as any,id,key,body)).rejects.toThrow('inválido')})
 it('discards successful mutation response when session changes',async()=>{const c=setup();c.single.mockImplementation(async()=>{c.auth.getSession.mockResolvedValue({data:{session:null},error:null});return {data:row,error:null}});await expect(saveCashbackDraft(c as any,id,key,body)).rejects.toThrow('sessão mudou')})
 it('paginates history with one-row lookahead',async()=>{const c=setup();c.query.range.mockResolvedValue({data:Array(21).fill(row),error:null});const r=await readCashbackDrafts(c as any,id,2);expect(c.query.range).toHaveBeenCalledWith(20,40);expect(r.rows).toHaveLength(20);expect(r.hasNext).toBe(true)})
 it('does not disclose server error details',async()=>{const c=setup();c.single.mockResolvedValue({error:{message:'private error'},data:null});await expect(saveCashbackDraft(c as any,id,key,body)).rejects.toThrow('confirmar o salvamento')})
})

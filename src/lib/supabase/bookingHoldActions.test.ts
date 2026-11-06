import {beforeEach,it,expect,vi} from 'vitest'
const mock=vi.hoisted(()=>({client:vi.fn()}))
vi.mock('./client',()=>({getSupabaseClient:mock.client}))
import {holdMinutes,reserve,cancelHold} from './bookingHoldActions'
import type {BookingQuote} from './bookingQuote'
const s='11111111-1111-4111-8111-111111111111',p='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333'
const row={id,request_id:id,student_id:s,professional_id:p,starts_at:'2026-11-20T15:00:00Z',ends_at:'2026-11-20T16:00:00Z',created_at:'2026-11-19T15:00:00Z',expires_at:'2026-11-19T15:15:00Z',status:'pending_payment'}
const q={professional_id:p,day:'2026-11-20',hour:12,availability_version:1,terms_id:id,starts_at:row.starts_at} as BookingQuote
let state:{token:string;data:unknown;error:unknown;change:boolean},rpc:ReturnType<typeof vi.fn>
beforeEach(()=>{
 state={token:'one',data:row,error:null,change:false}
 const result=()=>{if(state.change)state.token='two';return {data:state.data,error:state.error}}
 rpc=vi.fn(()=>({...result(),single:async()=>result()}))
 mock.client.mockReturnValue({auth:{getSession:async()=>({data:{session:{access_token:state.token,user:{id:s}}},error:null}),getUser:async()=>({data:{user:{id:s,is_anonymous:false}},error:null})},rpc})
})
it('blocks an unexpected actor before any mutation',async()=>{
 for(const action of [()=>holdMinutes(p,{expected:0,minutes:15}),()=>reserve(p,q,id),()=>cancelHold(p,'profissional',id)])await expect(action()).rejects.toThrow('sessão mudou')
 expect(rpc).not.toHaveBeenCalled()
})
it('rejects results after token changes during each operation',async()=>{
 for(const action of [()=>holdMinutes(s),()=>reserve(s,q,id),()=>cancelHold(s,'aluno',id)]){state.token='one';state.change=true;await expect(action()).rejects.toThrow('Sessão alterada')}
})
it('rejects malformed duration and server errors',async()=>{
 for(const value of [null,-1,1441,1.5,'15']){state.data=value;await expect(holdMinutes(s)).rejects.toThrow()}
 state.data=15;state.error=Error('denied');await expect(holdMinutes(s)).rejects.toThrow()
})
it('sends versioned policy and original reservation identity',async()=>{
 state.data=30;expect(await holdMinutes(s,{expected:15,minutes:30})).toBe(30)
 expect(rpc).toHaveBeenLastCalledWith('set_booking_hold_minutes',{p_expected:15,p_minutes:30})
 state.data=row;expect(await reserve(s,q,id)).toEqual(row)
 expect(rpc).toHaveBeenLastCalledWith('create_booking_hold',{p_request:id,p_professional:p,p_day:q.day,p_hour:12,p_availability:1,p_terms:id})
})
it('rejects another participant, request, professional or start time',async()=>{
 for(const patch of [{student_id:p},{request_id:p},{professional_id:id},{starts_at:'2026-11-20T14:00:00Z',ends_at:'2026-11-20T15:00:00Z'}]){state.data={...row,...patch};await expect(reserve(s,q,id)).rejects.toThrow()}
})
it('does not accept pending, paid or unrelated cancellation results',async()=>{
 for(const patch of [{status:'pending_payment'},{status:'paid'},{status:'cancelled',id:p}]){state.data={...row,...patch};await expect(cancelHold(s,'aluno',id)).rejects.toThrow()}
 for(const status of ['cancelled','expired']){state.data={...row,status};expect((await cancelHold(s,'aluno',id)).status).toBe(status)}
})

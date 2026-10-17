import {describe,it,expect,vi} from 'vitest'
import {readServiceIntake} from './serviceIntake'
const session={user:{id:'admin'},access_token:'token'}
const id='11111111-1111-1111-1111-111111111111'
const row={event_id:id,service_id:id,student_id:id,partner_id:id,created_by:id,period:'2026-10-01',revision:1,state:'completed',reported_payment:'confirmed',student_reviewed:true,partner_reviewed:true,verification:'unverified',created_at:'2026-10-17T10:00:00Z'}
function setup(data:any[]=[row]) {
 const query:any={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,error:null})}
 for(const k of ['select','eq','order'])query[k].mockReturnValue(query)
 return {auth:{getSession:vi.fn().mockResolvedValue({data:{session},error:null})},from:vi.fn().mockReturnValue(query),query}
}
describe('administrative intake reader',()=>{
 it('rejects invalid filters before querying',async()=>{const c=setup();await expect(readServiceIntake(c as any,'admin','2026-13',1)).rejects.toThrow();await expect(readServiceIntake(c as any,'admin','2026-10',0)).rejects.toThrow();expect(c.from).not.toHaveBeenCalled()})
 it('rejects another account',async()=>{const c=setup();await expect(readServiceIntake(c as any,'other','2026-10',1)).rejects.toThrow();expect(c.from).not.toHaveBeenCalled()})
 it('filters month and uses a bounded lookahead page',async()=>{const c=setup(Array(21).fill(row));const r=await readServiceIntake(c as any,'admin','2026-10',2);expect(c.query.eq).toHaveBeenCalledWith('period','2026-10-01');expect(c.query.range).toHaveBeenCalledWith(20,40);expect(r.rows).toHaveLength(20);expect(r.hasNext).toBe(true);expect(r.rows[0].verification).toBe('unverified')})
 it('discards responses after logout',async()=>{const c=setup();c.auth.getSession.mockResolvedValueOnce({data:{session},error:null}).mockResolvedValueOnce({data:{session:null},error:null});await expect(readServiceIntake(c as any,'admin','2026-10',1)).rejects.toThrow('sessão mudou')})
 it('never accepts verified money claims or another month',async()=>{for(const change of [{verification:'verified'},{period:'2026-11-01'},{revision:0}]){const c=setup([{...row,...change}]);await expect(readServiceIntake(c as any,'admin','2026-10',1)).rejects.toThrow('inválidos')}})
 it('does not expose database errors',async()=>{const c=setup();c.query.range.mockResolvedValue({data:null,error:{message:'private server detail'}});await expect(readServiceIntake(c as any,'admin','2026-10',1)).rejects.toThrow('acesso administrativo')})
 it('supports an empty result without fabricating records',async()=>{const c=setup([]);expect(await readServiceIntake(c as any,'admin','2026-10',1)).toEqual({rows:[],hasNext:false})})
})

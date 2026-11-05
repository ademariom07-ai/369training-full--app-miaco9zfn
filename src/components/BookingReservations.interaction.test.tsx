// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const api=vi.hoisted(()=>({read:vi.fn(),cancel:vi.fn()}))
vi.mock('@/lib/supabase/bookingReservations',()=>({readBookingReservations:api.read}))
vi.mock('@/lib/supabase/bookingHoldActions',()=>({cancelHold:api.cancel}))
import BookingReservations from './BookingReservations'
import type {OwnProfile} from '@/lib/supabase/profiles'
const account={id:'11111111-1111-4111-8111-111111111111',role:'aluno',approved:false,display_name:'Aluno teste',created_at:'2026-01-01T00:00:00Z'} as OwnProfile
const row={id:'22222222-2222-4222-8222-222222222222',starts_at:'2026-11-20T15:00:00Z',ends_at:'2026-11-20T16:00:00Z',expires_at:'2026-11-20T14:50:00Z',status:'pending_payment'}
let host:HTMLDivElement,root:Root
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});api.read.mockReset().mockResolvedValue([row]);api.cancel.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
function button(label:string){const b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent===label);if(!b)throw Error(label);return b}
async function click(label:string){await act(async()=>button(label).click())}
async function start(){await act(async()=>root.render(<BookingReservations account={account} disabled={false}/>));await click('Cancelar reserva temporária')}
it('keeping a reservation never calls the server',async()=>{await start();await click('Manter reserva');expect(api.cancel).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Pendente de pagamento')})
it('success reloads the list and renders the returned cancelled state',async()=>{
 api.cancel.mockResolvedValue({...row,status:'cancelled'})
 await start();api.read.mockResolvedValue([{...row,status:'cancelled'}]);await click('Confirmar cancelamento')
 expect(api.cancel).toHaveBeenCalledExactlyOnceWith(account.id,'aluno',row.id)
 expect(document.body.textContent).toContain('Reserva cancelada.')
 expect(document.body.textContent).toContain('Cancelada')
 expect(document.querySelector('[role="alertdialog"]')).toBeNull()
})
it('failure displays uncertainty rather than success and refreshes the server state',async()=>{
 api.cancel.mockRejectedValue(Error('network timeout'))
 await start();await click('Confirmar cancelamento')
 expect(document.body.textContent).toContain('Não foi possível verificar o cancelamento.')
 expect(document.body.textContent).not.toContain('Reserva cancelada.')
 expect(api.read).toHaveBeenCalledTimes(2)
})
it('a hold already expired displays expiry without claiming cancellation',async()=>{
 api.cancel.mockResolvedValue({...row,status:'expired'})
 await start();api.read.mockResolvedValue([{...row,status:'expired'}]);await click('Confirmar cancelamento')
 expect(document.body.textContent).toContain('Esta reserva já expirou.')
 expect(document.body.textContent).not.toContain('Reserva cancelada.')
})
it('repeat clicks while waiting cannot submit a second cancellation',async()=>{
 let finish!:(value:unknown)=>void
 api.cancel.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
 await start();await click('Confirmar cancelamento')
 expect(button('Verificando…').disabled).toBe(true)
 await click('Verificando…')
 expect(api.cancel).toHaveBeenCalledTimes(1)
 api.read.mockResolvedValue([{...row,status:'cancelled'}])
 await act(async()=>finish({...row,status:'cancelled'}))
})

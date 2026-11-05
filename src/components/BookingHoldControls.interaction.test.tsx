// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const api=vi.hoisted(()=>({minutes:vi.fn(),reserve:vi.fn()}))
vi.mock('@/lib/supabase/bookingHoldActions',()=>({holdMinutes:api.minutes,reserve:api.reserve}))
import {HoldRequest} from './BookingHoldControls'
import type {BookingQuote} from '@/lib/supabase/bookingQuote'
const owner='11111111-1111-4111-8111-111111111111'
const quote={professional_id:'22222222-2222-4222-8222-222222222222',day:'2026-11-20',hour:12,starts_at:'2026-11-20T15:00:00Z',availability_version:1,terms_id:'33333333-3333-4333-8333-333333333333'} as BookingQuote
const pending={status:'pending_payment',expires_at:'2026-11-20T14:00:00Z'}
let host:HTMLDivElement,root:Root
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 api.minutes.mockReset().mockResolvedValue(15);api.reserve.mockReset()
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks()})
async function render(disabled=false){await act(async()=>root.render(<HoldRequest owner={owner} q={quote} disabled={disabled}/>))}
function button(){return host.querySelector('button')!}
async function click(){await act(async()=>button().click())}
it('paused policy offers no reservation action',async()=>{
 api.minutes.mockResolvedValue(0);await render()
 expect(host.textContent).toContain('pausadas pelo administrativo');expect(button()).toBeNull();expect(api.reserve).not.toHaveBeenCalled()
})
it('policy lookup failure never enables reservation',async()=>{
 api.minutes.mockRejectedValue(Error('offline'));await render()
 expect(host.textContent).toContain('Não foi possível consultar o prazo');expect(button()).toBeNull();expect(api.reserve).not.toHaveBeenCalled()
})
it('disabled session prevents submission',async()=>{
 await render(true);await click();expect(button().disabled).toBe(true);expect(api.reserve).not.toHaveBeenCalled()
})
it('simultaneous clicks submit once and success keeps the action disabled',async()=>{
 let finish!:(row:unknown)=>void
 api.reserve.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
 const event=vi.fn();window.addEventListener('wellness:reservas',event)
 try{
  await render();await act(async()=>{button().click();button().click()})
  expect(api.reserve).toHaveBeenCalledTimes(1);expect(button().disabled).toBe(true)
  await act(async()=>finish(pending))
  expect(host.textContent).toContain('Atendimento ainda não confirmado.');expect(button().disabled).toBe(true);expect(event).toHaveBeenCalledTimes(1)
 }finally{window.removeEventListener('wellness:reservas',event)}
})
it('retry after an uncertain failure reuses the request key',async()=>{
 api.reserve.mockRejectedValueOnce(Error('Confira Minhas reservas.')).mockResolvedValueOnce(pending)
 await render();await click()
 expect(host.textContent).not.toContain('Horário reservado até');expect(button().disabled).toBe(false)
 const key=api.reserve.mock.calls[0][2]
 expect(key).toMatch(/^[0-9a-f-]{36}$/i)
 await click()
 expect(api.reserve).toHaveBeenNthCalledWith(1,owner,quote,key);expect(api.reserve).toHaveBeenNthCalledWith(2,owner,quote,key)
 expect(host.textContent).toContain('Horário reservado até')
})
it('replayed expired request never claims a new reservation',async()=>{
 api.reserve.mockResolvedValue({...pending,status:'expired'});await render();await click()
 expect(host.textContent).toContain('O pedido anterior já terminou');expect(host.textContent).not.toContain('Horário reservado até');expect(button().disabled).toBe(true)
})

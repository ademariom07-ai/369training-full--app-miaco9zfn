// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const api=vi.hoisted(()=>({minutes:vi.fn()}))
vi.mock('@/lib/supabase/bookingHoldActions',()=>({holdMinutes:api.minutes,reserve:vi.fn()}))
import {HoldPolicy} from './BookingHoldControls'
const owner='11111111-1111-4111-8111-111111111111'
let host:HTMLDivElement,root:Root
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});api.minutes.mockReset().mockResolvedValue(15);host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
async function render(disabled=false){await act(async()=>root.render(<HoldPolicy owner={owner} disabled={disabled}/>))}
function button(label:string){return Array.from(host.querySelectorAll('button')).find(x=>x.textContent===label)!}
const apply='Aplicar prazo e permitir reservas',pause='Pausar novas reservas'
async function input(value:string){await act(async()=>{const el=host.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))})}
async function click(label:string){await act(async()=>button(label).click())}
it('rejects empty, fractional and out-of-range durations in the interface',async()=>{
 await render();for(const value of ['', '0','1.5','1441']){await input(value);expect(button(apply).disabled).toBe(true)}
 for(const value of ['1','1440']){await input(value);expect(button(apply).disabled).toBe(false)}
 expect(api.minutes).toHaveBeenCalledTimes(1)
})
it('saves using the observed version and clears the draft only on success',async()=>{
 await render();await input('30');api.minutes.mockResolvedValueOnce(30);await click(apply)
 expect(api.minutes).toHaveBeenLastCalledWith(owner,{expected:15,minutes:30});expect(host.textContent).toContain('Prazo atual: 30 min.');expect(host.querySelector('input')!.value).toBe('')
})
it('conflict refreshes current policy without falsely reporting success',async()=>{
 await render();await input('30');api.minutes.mockRejectedValueOnce(Error('conflict')).mockResolvedValueOnce(45);await click(apply)
 expect(host.textContent).toContain('Não foi possível salvar');expect(host.textContent).not.toContain('Prazo salvo.');expect(host.textContent).toContain('Prazo atual: 45 min.')
 api.minutes.mockResolvedValueOnce(30);await click(apply);expect(api.minutes).toHaveBeenLastCalledWith(owner,{expected:45,minutes:30})
})
it('pause is versioned and blocks further pause after success',async()=>{
 await render();api.minutes.mockResolvedValueOnce(0);await click(pause);expect(api.minutes).toHaveBeenLastCalledWith(owner,{expected:15,minutes:0});expect(button(pause).disabled).toBe(true)
})
it('failed lookup and disabled account cannot modify policy',async()=>{
 api.minutes.mockRejectedValueOnce(Error('offline'));await render(true);await input('30');await click(apply);await click(pause);expect(api.minutes).toHaveBeenCalledTimes(1);expect(host.textContent).toContain('Falha ao consultar.')
})

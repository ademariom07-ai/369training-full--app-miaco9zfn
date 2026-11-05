// @vitest-environment jsdom
import React, {act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import CancelBookingDialog from './CancelBookingDialog'
let host:HTMLDivElement,root:Root
const time='2026-11-20T15:00:00Z'
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
async function render(onConfirm=vi.fn(async()=>{}),disabled=false){await act(async()=>root.render(<CancelBookingDialog startsAt={time} onConfirm={onConfirm} disabled={disabled}/>));return onConfirm}
function button(label:string){const el=Array.from(document.querySelectorAll('button')).find(b=>b.textContent===label);if(!el)throw Error('Missing '+label);return el}
async function click(label:string){await act(async()=>button(label).click())}
it('opens with the selected time in Brasília and initially focuses keeping the reservation',async()=>{
 await render();await click('Cancelar reserva temporária')
 const dialog=document.querySelector('[role="alertdialog"]')!
 expect(dialog.textContent).toContain('12:00');expect(dialog.textContent).toContain('Brasília')
 expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
 expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
 expect(document.activeElement).toBe(button('Manter reserva'))
})
it('keeping reservation closes without a mutation and restores trigger focus',async()=>{
 const confirm=await render();await click('Cancelar reserva temporária');await click('Manter reserva')
 expect(confirm).not.toHaveBeenCalled();expect(document.querySelector('[role="alertdialog"]')).toBeNull()
 await vi.waitFor(()=>expect(document.activeElement).toBe(button('Cancelar reserva temporária')))
})
it('escape abandons without cancellation',async()=>{
 const confirm=await render();await click('Cancelar reserva temporária')
 await act(async()=>document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
 expect(confirm).not.toHaveBeenCalled();expect(document.querySelector('[role="alertdialog"]')).toBeNull()
})
it('confirm invokes one request and closes after successful response',async()=>{
 const confirm=await render();await click('Cancelar reserva temporária');await click('Confirmar cancelamento')
 expect(confirm).toHaveBeenCalledTimes(1);expect(document.querySelector('[role="alertdialog"]')).toBeNull()
})
it('a disabled trigger does not open a cancellation',async()=>{
 const confirm=await render(undefined,true);await click('Cancelar reserva temporária')
 expect(document.querySelector('[role="alertdialog"]')).toBeNull();expect(confirm).not.toHaveBeenCalled()
})

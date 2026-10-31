import {it,expect} from 'vitest'
import {upcomingAvailability} from './upcomingAvailability'
const row={professional_id:'p',day:'2026-10-31',available_hours:[5,6,12,23]}
it('removes elapsed days and the hour already started in Brasilia',()=>{
 expect(upcomingAvailability([{...row,day:'2026-10-30'},row],new Date('2026-10-31T09:00:00Z'))).toEqual([{...row,available_hours:[12,23]}])
})
it('keeps future dates and never mutates the server response',()=>{
 const copy=JSON.stringify(row)
 expect(upcomingAvailability([row],new Date('2026-10-30T22:00:00Z'))).toEqual([row])
 expect(JSON.stringify(row)).toBe(copy)
})
it('uses local midnight rather than UTC calendar day',()=>{
 expect(upcomingAvailability([row],new Date('2026-11-01T01:00:00Z'))).toEqual([{...row,available_hours:[23]}])
 expect(upcomingAvailability([row],new Date('2026-11-01T02:00:00Z'))).toEqual([])
})
it('excludes empty days and returns separate hour arrays',()=>{
 expect(upcomingAvailability([{...row,available_hours:[]}],new Date('2026-10-30T12:00:00Z'))).toEqual([])
 expect(upcomingAvailability([row],new Date('2026-10-30T12:00:00Z'))[0].available_hours).not.toBe(row.available_hours)
})

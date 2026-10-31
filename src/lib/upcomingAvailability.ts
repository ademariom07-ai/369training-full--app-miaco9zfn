import {saoPauloToday,saoPauloHour,type ReleasedDay} from './supabase/availability'
/** Presentation filter only. Server remains authoritative for quotes and reservations. */
export function upcomingAvailability(rows:ReleasedDay[],now=new Date()):ReleasedDay[]{
 const day=saoPauloToday(now),hour=saoPauloHour(now)
 return rows.filter(row=>row.day>=day).map(row=>({...row,available_hours:row.available_hours.filter(value=>row.day>day||value>hour)})).filter(row=>row.available_hours.length>0)
}

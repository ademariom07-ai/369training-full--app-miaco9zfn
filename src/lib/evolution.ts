import type {Session} from './supabase/routines'

// Evolução do aluno a partir dos treinos registrados (cargas, esforço, frequência e volume).
// Cargas escritas livremente ("12 kg", "12,5kg", "20") viram número; o que não tiver número fica de fora.
export function parseKg(load:string):number|null{
 const m=load.replace(',','.').match(/(\d+(?:\.\d+)?)\s*(kg|quilos?)?/i)
 if(!m)return null
 const n=Number(m[1]);return Number.isFinite(n)&&n>0&&n<=500?n:null
}
export function parseReps(reps:string):number|null{const m=reps.match(/\d+/);const n=m?Number(m[0]):NaN;return Number.isFinite(n)&&n>0&&n<=100?n:null}

const byDate=(a:Session,b:Session)=>a.done_on.localeCompare(b.done_on)
// Segunda-feira da semana (aaaa-mm-dd) de uma data.
export function weekStart(iso:string){const d=new Date(iso+'T12:00:00Z');const wd=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-wd);return d.toISOString().slice(0,10)}
export const shortDate=(iso:string)=>{const [,m,d]=iso.split('-');return `${d}/${m}`}

// Exercícios com carga registrada, do mais frequente para o menos.
export function exercisesWithLoad(sessions:Session[]){
 const count=new Map<string,number>()
 for(const s of sessions)for(const e of s.entries)if(e.done&&parseKg(e.load)!==null)count.set(e.name,(count.get(e.name)??0)+1)
 return [...count.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name])=>name)
}
// Carga de um exercício ao longo do tempo (maior carga do dia).
export function loadSeries(sessions:Session[],exercise:string){
 const day=new Map<string,number>()
 for(const s of [...sessions].sort(byDate))for(const e of s.entries){if(!e.done||e.name!==exercise)continue;const kg=parseKg(e.load);if(kg!==null)day.set(s.done_on,Math.max(day.get(s.done_on)??0,kg))}
 return [...day.entries()].map(([date,kg])=>({date,label:shortDate(date),kg}))
}
// Esforço (1 a 10) e dor por sessão.
export function effortSeries(sessions:Session[]){
 return [...sessions].sort(byDate).filter(s=>s.effort!==null).map(s=>({date:s.done_on,label:shortDate(s.done_on),effort:s.effort as number,pain:s.pain}))
}
// Por semana: treinos feitos e volume (séries × repetições × kg dos exercícios com carga).
export function weeklySeries(sessions:Session[]){
 const weeks=new Map<string,{treinos:number,volume:number}>()
 for(const s of sessions){const w=weekStart(s.done_on),cur=weeks.get(w)??{treinos:0,volume:0};cur.treinos++
  for(const e of s.entries){if(!e.done)continue;const kg=parseKg(e.load),reps=parseReps(e.reps);if(kg!==null&&reps!==null&&e.sets)cur.volume+=Math.round(e.sets*reps*kg)}
  weeks.set(w,cur)}
 return [...weeks.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([week,v])=>({week,label:shortDate(week),...v}))
}
// Resumo em frases curtas (sem IA), para o aluno e o profissional.
export function evolutionHighlights(sessions:Session[]){
 const out:string[]=[]
 for(const name of exercisesWithLoad(sessions).slice(0,3)){const s=loadSeries(sessions,name);if(s.length<2)continue
  const diff=s[s.length-1].kg-s[0].kg
  if(diff>0)out.push(`${name}: subiu de ${s[0].kg} kg para ${s[s.length-1].kg} kg.`)
  else if(diff<0)out.push(`${name}: carga caiu de ${s[0].kg} kg para ${s[s.length-1].kg} kg.`)}
 const weeks=weeklySeries(sessions);if(weeks.length)out.push(`Média de ${(weeks.reduce((n,w)=>n+w.treinos,0)/weeks.length).toFixed(1).replace('.',',')} treinos por semana.`)
 const pains=sessions.filter(s=>s.pain>0).length;if(pains)out.push(`Relatou dor em ${pains} treino${pains>1?'s':''}.`)
 return out
}

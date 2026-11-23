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

// Descanso escrito livremente ("60s", "1 min", "1:30", "90") em segundos (10 a 600; padrão 60).
export function parseRestSeconds(rest:string):number{
 const t=rest.trim().toLowerCase().replace(',','.');let s=NaN
 const mmss=t.match(/^(\d{1,2}):(\d{2})$/),min=t.match(/(\d+(?:\.\d+)?)\s*(min|m\b|')/),sec=t.match(/(\d+)\s*(s|seg)/),num=t.match(/^(\d+)$/)
 if(mmss)s=Number(mmss[1])*60+Number(mmss[2])
 else if(min||sec)s=(min?Number(min[1])*60:0)+(sec&&(!min||sec.index!==min.index)?Number(sec[1]):0)
 else if(num)s=Number(num[1])
 return Number.isFinite(s)&&s>0?Math.min(600,Math.max(10,Math.round(s))):60
}

// Sugestão de carga para a próxima vez (sobrecarga progressiva), a partir do último registro do exercício.
// Regras simples e conservadoras: dor → não aumentar; esforço baixo e tudo feito → subir um pouco; esforço alto → manter.
export type LoadSuggestion={kind:'subir'|'manter'|'reduzir'|'sem-dados',text:string,lastKg:number|null,nextKg:number|null}
export function suggestLoad(sessions:Session[],exercise:string):LoadSuggestion{
 const last=[...sessions].sort((a,b)=>b.done_on.localeCompare(a.done_on)).find(s=>s.entries.some(e=>e.name===exercise))
 if(!last)return{kind:'sem-dados',text:'Primeira vez: comece com uma carga que permita fazer todas as repetições com boa técnica.',lastKg:null,nextKg:null}
 const e=last.entries.find(x=>x.name===exercise)!,kg=parseKg(e.load),step=kg===null?0:kg<10?1:kg<40?2:kg<100?2.5:5
 if(last.pain===2)return{kind:'reduzir',text:'Na última vez você relatou dor forte. Use carga leve ou fale com seu profissional antes.',lastKg:kg,nextKg:kg===null?null:Math.max(0,kg-step)}
 if(last.pain===1)return{kind:'manter',text:'Na última vez houve dor leve: mantenha a carga e capriche na técnica.',lastKg:kg,nextKg:kg}
 if(!e.done)return{kind:'manter',text:'Na última vez este exercício ficou de fora. Comece com a mesma carga.',lastKg:kg,nextKg:kg}
 const effort=last.effort
 if(effort!==null&&effort<=4&&kg!==null)return{kind:'subir',text:`Na última vez ficou leve (esforço ${effort}/10). Tente ${kg+step} kg.`,lastKg:kg,nextKg:kg+step}
 if(effort!==null&&effort>=8)return{kind:'manter',text:`Na última vez ficou pesado (esforço ${effort}/10). Mantenha ${kg!==null?kg+' kg':'a carga'}.`,lastKg:kg,nextKg:kg}
 if(kg!==null&&effort!==null)return{kind:'subir',text:`Esforço bom na última vez (${effort}/10). Se fizer todas as repetições com folga, suba para ${kg+step} kg.`,lastKg:kg,nextKg:kg+step}
 return{kind:'manter',text:kg!==null?`Última carga: ${kg} kg.`:'Registre a carga usada para receber sugestões.',lastKg:kg,nextKg:kg}
}

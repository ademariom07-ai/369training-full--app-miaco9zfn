import React,{useEffect,useState} from 'react'
import {AlertTriangle,CheckCircle2,XCircle} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {dayShort,deleteRoutineSession,effortLabel,listRoutineSessions,painLabels,recentDates,saveRoutineSession,sessionEntriesFrom,summarizeSessions,todayInfo,
 type DayKey,type Session,type SessionEntry,type TrainingDay} from '@/lib/supabase/routines'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const field='mt-1 block w-full rounded-md border p-2 text-sm'
const weekdayOf=(iso:string)=>todayInfo(new Date(iso+'T12:00:00-03:00')).day
export const dateLabel=(iso:string)=>{const t=todayInfo().iso,y=recentDates()[1];const [,m,d]=iso.split('-');return iso===t?'Hoje':iso===y?'Ontem':`${dayShort[weekdayOf(iso)]}, ${d}/${m}`}

// Aluno: registra o que fez num dia do treino (hoje ou até 7 dias atrás).
export function SessionForm({plan,day,existing,onDone,onCancel}:{plan:string,day:TrainingDay,existing?:Session,onDone:()=>void,onCancel:()=>void}){
 const dates=recentDates()
 const [date,setDate]=useState(existing?.done_on??(dates.find(d=>weekdayOf(d)===day.key)??dates[0]))
 const [entries,setEntries]=useState<SessionEntry[]>(existing?.entries.length?existing.entries:sessionEntriesFrom(day))
 const [effort,setEffort]=useState<number>(existing?.effort??6),[pain,setPain]=useState<number>(existing?.pain??0),[note,setNote]=useState(existing?.note??'')
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const upd=(i:number,patch:Partial<SessionEntry>)=>setEntries(list=>list.map((e,j)=>j===i?{...e,...patch}:e))
 async function save(){setBusy(true);setError('');try{await saveRoutineSession({plan,day:day.key,date,effort,pain,note,entries});onDone()}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 async function remove(){if(!existing||!window.confirm('Apagar este registro?'))return;setBusy(true);try{await deleteRoutineSession(existing.session_id);onDone()}catch(err){setError(errorText(err,'Não foi possível apagar.'))}finally{setBusy(false)}}
 return <form className={card+' space-y-4 border-[#a5ce41]'} onSubmit={e=>{e.preventDefault();void save()}}>
  <h4 className="text-lg font-extrabold">Registrar treino · {day.name}</h4>
  <label className="block font-semibold">Quando você treinou?<select className={field} value={date} disabled={!!existing} onChange={e=>setDate(e.target.value)}>{dates.map(d=><option key={d} value={d}>{dateLabel(d)}</option>)}</select></label>
  <fieldset className="space-y-2"><legend className="font-semibold">Exercícios (desmarque o que não fez e ajuste o que mudou)</legend>
   {entries.map((e,i)=><div key={i} className={'rounded-md border p-2 '+(e.done?'border-[#dddee4]':'border-dashed border-[#b0b0bb] bg-[#f7f6f2]')}>
    <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5" checked={e.done} onChange={ev=>upd(i,{done:ev.target.checked})}/>{e.name}</label>
    {e.done&&<div className="grid grid-cols-3 gap-2">
     <label className="text-xs font-semibold">Séries<Input type="number" min={0} max={10} inputMode="numeric" value={e.sets??''} onChange={ev=>upd(i,{sets:ev.target.value===''?null:Number(ev.target.value)})}/></label>
     <label className="text-xs font-semibold">Repetições<Input maxLength={20} value={e.reps} onChange={ev=>upd(i,{reps:ev.target.value})}/></label>
     <label className="text-xs font-semibold">Carga<Input maxLength={40} value={e.load} placeholder="ex.: 10 kg" onChange={ev=>upd(i,{load:ev.target.value})}/></label>
    </div>}
   </div>)}
  </fieldset>
  <label className="block font-semibold">Esforço: {effort} de 10 · {effortLabel(effort)}<input type="range" min={1} max={10} step={1} value={effort} onChange={e=>setEffort(Number(e.target.value))} className="mt-2 block w-full accent-[#33325a]"/></label>
  <fieldset><legend className="font-semibold">Sentiu alguma dor?</legend><div className="mt-1 flex flex-wrap gap-2">{painLabels.map((l,i)=><Button key={l} type="button" variant={pain===i?'default':'outline'} aria-pressed={pain===i} onClick={()=>setPain(i)} className={pain===i&&i===2?'!bg-[#b42318] !text-white':''}>{l}</Button>)}</div></fieldset>
  <label className="block font-semibold">Recado para o profissional (opcional)<textarea className={field} rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder={pain?'Onde doeu e em qual exercício?':'Como foi o treino?'}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Salvar registro</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button>
   {existing&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void remove()}>Apagar</Button>}</div>
 </form>
}

// Mostra um treino registrado (aluno e profissional).
export function SessionCard({session,showStudent=false}:{session:Session,showStudent?:boolean}){
 const done=session.entries.filter(e=>e.done).length
 return <article className={card+(session.pain===2?' border-[#b42318]':session.pain===1?' border-amber-400':'')}>
  <header className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-extrabold">{showStudent?`${session.student_name} · `:''}{dateLabel(session.done_on)} · {session.day_name||dayShort[session.day_key]}</h4>
   <span className="text-sm text-[#626274]">{done} de {session.entries.length} exercícios</span></header>
  <p className="mt-1 text-sm">{session.effort?`Esforço ${session.effort}/10 (${effortLabel(session.effort)})`:'Esforço não informado'}{' · '}
   <span className={session.pain===2?'font-bold text-[#b42318]':session.pain===1?'font-bold text-amber-700':''}>{session.pain>0&&<AlertTriangle aria-hidden="true" className="mr-1 inline h-4 w-4"/>}{painLabels[session.pain]}</span></p>
  {session.note&&<p className="mt-2 rounded-md bg-[#f7f6f2] p-2 text-sm">“{session.note}”</p>}
  <details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Ver exercícios</summary>
   <ul className="space-y-1 text-sm">{session.entries.map((e,i)=><li key={i} className="flex items-start gap-2">{e.done?<CheckCircle2 aria-label="feito" className="mt-0.5 h-4 w-4 shrink-0 text-[#6a8a27]"/>:<XCircle aria-label="não feito" className="mt-0.5 h-4 w-4 shrink-0 text-[#b0b0bb]"/>}
    <span><b>{e.name}</b>{e.done&&[e.sets!==null?`${e.sets} séries`:'',e.reps?`${e.reps} rep.`:'',e.load].filter(Boolean).length?' — '+[e.sets!==null?`${e.sets} séries`:'',e.reps?`${e.reps} rep.`:'',e.load].filter(Boolean).join(' · '):''}{!e.done&&' — não fez'}</span></li>)}</ul></details>
 </article>
}

// Profissional: o que os alunos fizeram (resumo de todos + lista do aluno escolhido).
export function ProActivity({student,owner}:{student:string,owner:string}){
 const [all,setAll]=useState<Session[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;setLoading(true);listRoutineSessions(null).then(r=>{if(live)setAll(r)}).catch(err=>{if(live)setError(errorText(err,'Não foi possível carregar os registros.'))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[owner])
 const summary=summarizeSessions(all),mine=all.filter(s=>s.student_id===student),today=todayInfo().iso
 return <section className="space-y-3" aria-label="Acompanhamento">
  <h3 className="text-lg font-extrabold">O que seus alunos fizeram</h3>
  {error&&<p role="alert">{error}</p>}
  {loading?<p role="status">Carregando…</p>:!summary.length?<p className={card+' text-sm'}>Quando um aluno registrar um treino, ele aparece aqui: o que fez, a carga, o esforço e se sentiu dor.</p>:
   <ul className="flex gap-2 overflow-x-auto pb-1">{summary.map(s=><li key={s.student_id} className={card+' min-w-48 shrink-0 p-3 text-sm'+(s.pain?' border-amber-400':'')}>
    <p className="font-bold">{s.student_name}</p><p>{s.week} treino{s.week===1?'':'s'} em 7 dias</p><p className="text-[#626274]">Último: {dateLabel(s.last.done_on)}{s.last.done_on===today?' ✓':''}</p>
    {s.pain&&<p className="font-bold text-amber-700"><AlertTriangle aria-hidden="true" className="mr-1 inline h-4 w-4"/>Relatou dor</p>}</li>)}</ul>}
  {!loading&&student&&<><h4 className="font-bold">Registros deste aluno</h4>{mine.length?<div className="space-y-2">{mine.slice(0,20).map(s=><SessionCard key={s.session_id} session={s}/>)}</div>:<p className="text-sm text-[#626274]">Este aluno ainda não registrou treinos.</p>}</>}
 </section>
}

export type {DayKey}

import React,{useEffect,useMemo,useRef,useState} from 'react'
import {CheckCircle2,Pause,Play,SkipForward,TrendingDown,TrendingUp,Minus,Volume2,VolumeX,X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import ExerciseAnimationView from '@/components/ExerciseAnimationView'
import {YoutubePlayer} from '@/components/VideoFeed'
import {resolveExercise,useExerciseLibrary} from '@/lib/supabase/exerciseLibrary'
import {effortLabel,painLabels,saveRoutineSession,todayInfo,type Exercise,type Session,type SessionEntry,type TrainingDay} from '@/lib/supabase/routines'
import {parseKg,parseRestSeconds,suggestLoad} from '@/lib/evolution'

const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
type SetLog={reps:string,load:string}
const fmt=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

// Bipe curto (sem arquivo de som) e vibração, quando o aparelho permite.
function beep(times=2){try{const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Ctx)return;const ctx=new Ctx()
 for(let i=0;i<times;i++){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=880;o.connect(g);g.connect(ctx.destination);const t=ctx.currentTime+i*0.3;g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);o.start(t);o.stop(t+0.22)}
 setTimeout(()=>void ctx.close(),1200)}catch{/* sem som */}
 try{navigator.vibrate?.([200,100,200])}catch{/* sem vibração */}}

function SuggestionBox({sessions,name}:{sessions:Session[],name:string}){
 const s=suggestLoad(sessions,name),Icon=s.kind==='subir'?TrendingUp:s.kind==='reduzir'?TrendingDown:Minus
 return <p className={'flex items-start gap-2 rounded-md p-2 text-sm '+(s.kind==='subir'?'bg-[#eef6dc]':s.kind==='reduzir'?'bg-red-50':'bg-[#f7f6f2]')}><Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/><span><b>Sugestão de carga:</b> {s.text}</span></p>
}

// Treino guiado: um exercício por vez, séries marcadas uma a uma, descanso com cronômetro e registro no final.
export default function WorkoutRunner({plan,day,sessions,onClose,onSaved}:{plan:string,day:TrainingDay,sessions:Session[],onClose:()=>void,onSaved:()=>void}){
 const library=useExerciseLibrary()
 const items=day.items
 const [index,setIndex]=useState(0)
 const [logs,setLogs]=useState<SetLog[][]>(()=>items.map(()=>[]))
 const [draft,setDraft]=useState<SetLog>({reps:'',load:''})
 const [rest,setRest]=useState<{left:number,total:number,paused:boolean}|null>(null)
 const [sound,setSound]=useState(true),[finishing,setFinishing]=useState(false)
 const [effort,setEffort]=useState(6),[pain,setPain]=useState(0),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const it:Exercise|undefined=items[index]
 const target=it?.sets??3
 const done=logs[index]?.length??0
 // Prefill: repetições prescritas e carga sugerida (ou a da última série).
 useEffect(()=>{if(!it)return;const prev=logs[index][logs[index].length-1];const sug=suggestLoad(sessions,it.name)
  setDraft({reps:prev?.reps??(it.reps.match(/\d+/)?.[0]??it.reps),load:prev?.load??(sug.nextKg!==null?`${sug.nextKg} kg`:it.load)})
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[index,done])
 // Mantém a tela acesa durante o treino, quando o navegador permite.
 useEffect(()=>{let lock:{release:()=>Promise<void>}|null=null;const nav=navigator as unknown as {wakeLock?:{request:(t:'screen')=>Promise<{release:()=>Promise<void>}>}}
  nav.wakeLock?.request('screen').then(l=>{lock=l}).catch(()=>{});return()=>{void lock?.release().catch(()=>{})}},[])
 // Cronômetro de descanso.
 const soundRef=useRef(sound);soundRef.current=sound
 useEffect(()=>{if(!rest||rest.paused)return;if(rest.left<=0){if(soundRef.current)beep(3);setRest(null);return}
  const t=setTimeout(()=>setRest(r=>r&&{...r,left:r.left-1}),1000);return()=>clearTimeout(t)},[rest])
 const resolved=useMemo(()=>it?resolveExercise(it.name,library):null,[it,library])
 const totalSets=items.reduce((n,x)=>n+(x.sets??3),0),doneSets=logs.reduce((n,l)=>n+l.length,0)

 function completeSet(){if(!it)return;const next=[...logs];next[index]=[...next[index],{reps:draft.reps.trim(),load:draft.load.trim()}];setLogs(next)
  const nowDone=next[index].length
  if(nowDone<target||index<items.length-1)setRest({left:parseRestSeconds(it.rest),total:parseRestSeconds(it.rest),paused:false})
  if(nowDone>=target)goNext()}
 function goNext(){if(index<items.length-1)setIndex(index+1);else{setRest(null);setFinishing(true)}}
 function skip(){setRest(null);goNext()}
 function entries():SessionEntry[]{return items.map((x,i)=>{const l=logs[i];if(!l.length)return{name:x.name,done:false,sets:null,reps:'',load:''}
  const best=l.reduce((a,b)=>(parseKg(b.load)??-1)>(parseKg(a.load)??-1)?b:a,l[0]);return{name:x.name,done:true,sets:l.length,reps:l[l.length-1].reps.slice(0,20),load:best.load.slice(0,40)}})}
 async function save(){setBusy(true);setError('');try{await saveRoutineSession({plan,day:day.key,date:todayInfo().iso,effort,pain,note,entries:entries()});onSaved()}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}

 const header=<div className="flex items-center justify-between gap-2">
  <div><p className="text-xs font-bold uppercase tracking-wider text-[#6a8a27]">Treino guiado · {day.name}</p><p className="text-sm text-[#626274]">{doneSets} de {totalSets} séries</p></div>
  <div className="flex gap-1"><Button type="button" variant="outline" aria-label={sound?'Desligar som':'Ligar som'} onClick={()=>setSound(v=>!v)}>{sound?<Volume2 aria-hidden="true" className="h-4 w-4"/>:<VolumeX aria-hidden="true" className="h-4 w-4"/>}</Button>
   <Button type="button" variant="outline" aria-label="Sair do treino" onClick={()=>{if(doneSets===0||window.confirm('Sair do treino? O que você fez até agora não será salvo.'))onClose()}}><X aria-hidden="true" className="h-4 w-4"/></Button></div></div>
 const progress=<div className="h-2 overflow-hidden rounded-full bg-[#eeedf4]" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}><div className="h-full bg-[#a5ce41] transition-all" style={{width:`${totalSets?doneSets/totalSets*100:0}%`}}/></div>

 if(finishing){const ents=entries(),count=ents.filter(e=>e.done).length
  return <section className={card+' space-y-4 border-[#a5ce41]'} aria-label="Treino concluído">{header}{progress}
   <p className="text-xl font-extrabold">{count===items.length?'Parabéns! Todos os exercícios do dia foram concluídos! 🔥':`Treino finalizado: ${count} de ${items.length} exercícios.`}</p>
   <ul className="space-y-1 text-sm">{ents.map((e,i)=><li key={i}>{e.done?'✓':'—'} <b>{e.name}</b>{e.done?` · ${e.sets} séries${e.reps?` × ${e.reps}`:''}${e.load?` · ${e.load}`:''}`:' · não fez'}</li>)}</ul>
   <label className="block font-semibold">Esforço do treino: {effort} de 10 · {effortLabel(effort)}<input type="range" min={1} max={10} value={effort} onChange={e=>setEffort(Number(e.target.value))} className="mt-2 block w-full accent-[#33325a]"/></label>
   <fieldset><legend className="font-semibold">Sentiu alguma dor?</legend><div className="mt-1 flex flex-wrap gap-2">{painLabels.map((l,i)=><Button key={l} type="button" variant={pain===i?'default':'outline'} aria-pressed={pain===i} onClick={()=>setPain(i)} className={pain===i&&i===2?'!bg-[#b42318] !text-white':''}>{l}</Button>)}</div></fieldset>
   <label className="block font-semibold">Recado para o profissional (opcional)<textarea className="mt-1 block w-full rounded-md border p-2 text-sm" rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
   {error&&<p role="alert">{error}</p>}
   <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy||count===0} onClick={()=>void save()}>Salvar treino</Button><Button type="button" variant="outline" onClick={()=>{setFinishing(false);setIndex(items.length-1)}}>Voltar</Button></div>
   {count===0&&<p className="text-sm">Marque pelo menos uma série para salvar.</p>}
  </section>}
 if(!it)return null
 return <section className={card+' space-y-4 border-[#a5ce41]'} aria-label="Treino guiado">{header}{progress}
  <div><p className="text-sm text-[#626274]">Exercício {index+1} de {items.length}</p><h3 className="text-2xl font-extrabold">{it.name}</h3>
   <p>{[it.sets?`${it.sets} séries`:'',it.reps?`${it.reps} repetições`:'',it.rest?`descanso ${it.rest}`:'',it.load?`carga ${it.load}`:''].filter(Boolean).join(' · ')}</p>
   {it.notes&&<p className="text-sm text-[#626274]">{it.notes}</p>}</div>
  {rest?<div className="space-y-3 rounded-[12px_30px_12px_30px] bg-[#33325a] p-5 text-center text-[#f7f6f2]" role="timer" aria-live="polite">
    <p className="text-sm font-bold uppercase tracking-wider text-[#a5ce41]">Descanso</p><p className="text-6xl font-extrabold tabular-nums">{fmt(rest.left)}</p>
    <p className="text-sm">{done<target?`Próxima: série ${done+1} de ${target}`:`Próximo: ${it.name}`}</p>
    <div className="flex flex-wrap justify-center gap-2"><Button type="button" variant="outline" className="!bg-white !text-[#33325a]" onClick={()=>setRest(r=>r&&{...r,paused:!r.paused})}>{rest.paused?<><Play aria-hidden="true" className="mr-1 h-4 w-4"/>Continuar</>:<><Pause aria-hidden="true" className="mr-1 h-4 w-4"/>Pausar</>}</Button>
     <Button type="button" variant="outline" className="!bg-white !text-[#33325a]" onClick={()=>setRest(r=>r&&{...r,left:r.left+15,total:r.total+15})}>+15 s</Button>
     <Button type="button" className="!bg-[#a5ce41] !text-[#33325a]" onClick={()=>setRest(null)}><SkipForward aria-hidden="true" className="mr-1 h-4 w-4"/>Pular descanso</Button></div></div>
  :<>
   <SuggestionBox sessions={sessions} name={it.name}/>
   <div className={card+' space-y-3'}><p className="font-extrabold">Série {Math.min(done+1,target)} de {target}</p>
    <div className="grid grid-cols-2 gap-2"><label className="text-sm font-semibold">Repetições feitas<Input inputMode="numeric" maxLength={20} value={draft.reps} onChange={e=>setDraft(d=>({...d,reps:e.target.value}))}/></label>
     <label className="text-sm font-semibold">Carga<Input maxLength={40} value={draft.load} placeholder="ex.: 12 kg" onChange={e=>setDraft(d=>({...d,load:e.target.value}))}/></label></div>
    <div className="flex flex-wrap gap-2"><Button type="button" className="!bg-[#a5ce41] !text-[#33325a]" onClick={completeSet}><CheckCircle2 aria-hidden="true" className="mr-2 h-5 w-5"/>Série feita</Button>
     <Button type="button" variant="outline" onClick={skip}>Pular exercício</Button></div>
    {logs[index].length>0&&<p className="text-sm text-[#626274]">Feitas: {logs[index].map((l,i)=>`${i+1}ª ${l.reps||'?'} rep${l.load?` · ${l.load}`:''}`).join(' | ')}</p>}
   </div></>}
  {resolved&&(resolved.animation||resolved.entry?.video||it.video)?<div className="grid max-w-3xl gap-3 md:grid-cols-2">{resolved.animation&&<ExerciseAnimationView exercise={resolved.animation}/>}{(it.video||resolved.entry?.video)&&<YoutubePlayer id={(it.video||resolved.entry?.video)!} title={it.name}/>}</div>:null}
  <div className="flex flex-wrap gap-2">{index>0&&<Button type="button" variant="outline" onClick={()=>{setRest(null);setIndex(index-1)}}>← Exercício anterior</Button>}
   {index<items.length-1?<Button type="button" variant="outline" onClick={()=>{setRest(null);setIndex(index+1)}}>Próximo exercício →</Button>:<Button type="button" variant="outline" onClick={()=>{setRest(null);setFinishing(true)}}>Finalizar treino</Button>}</div>
 </section>
}

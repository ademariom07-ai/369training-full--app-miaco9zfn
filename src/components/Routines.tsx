import React,{Suspense,lazy,useCallback,useEffect,useState} from 'react'
const Evolution=lazy(()=>import('@/components/Evolution'))
import {Apple,CheckCircle2,Circle,Dumbbell,LineChart as ChartIcon,Plus,Sparkles,Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {YoutubePlayer} from '@/components/VideoFeed'
import ExerciseAnimationView from '@/components/ExerciseAnimationView'
import {exerciseAnimations} from '@/lib/exerciseAnimations'
import {resolveExercise,useExerciseLibrary} from '@/lib/supabase/exerciseLibrary'
import {ProActivity,SessionCard,SessionForm,dateLabel,latestDateFor} from '@/components/WorkoutLog'
import {archiveRoutine,dayKeys,dayLabels,dayShort,listRoutineSessions,listRoutines,logRoutineDay,saveRoutineSession,sessionEntriesFrom,publishRoutine,reviewRoutine,routineProgress,saveRoutine,todayInfo,
 type DayKey,type Exercise,type Kind,type Meal,type Routine,type Session,type Source,type Structure,type TrainingDay} from '@/lib/supabase/routines'
import type {ParticipantLink} from '@/lib/supabase/participantLinks'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const sourceLabel=(r:Routine)=>r.source==='ia_aluno'?'Sugestão da IA':r.source==='ia_profissional'?`Por ${r.author_name}, com apoio de IA`:`Por ${r.author_name}`

// Mostra um plano. Treino: semana com o dia de hoje em destaque, exercícios com vídeo. Dieta: refeições.
export function RoutineDisplay({routine,logs,canLog,onToggle,logSlot}:{routine:Routine,logs:{day_key:string,done_on:string}[],canLog:boolean,onToggle?:(day:DayKey|'todos',done:boolean)=>void,logSlot?:(day:TrainingDay)=>React.ReactNode}){
 const today=todayInfo(),library=useExerciseLibrary()
 const trainingDays='days' in routine.structure?routine.structure.days:[]
 const [open,setOpen]=useState<DayKey>(trainingDays.some(d=>d.key===today.day)?today.day:(trainingDays[0]?.key??'seg'))
 const doneToday=(day:string)=>logs.some(l=>l.day_key===day&&l.done_on===today.iso)
 const weekCount=logs.filter(l=>Date.parse(l.done_on)>=Date.parse(today.iso)-6*86400000).length
 if('meals' in routine.structure){const meals=routine.structure.meals
  return <div className="space-y-3">
   {routine.notes&&<p className={card}>{routine.notes}</p>}
   {meals.map((m,i)=><section key={i} className={card}><h4 className="font-extrabold">{m.time?m.time+' · ':''}{m.name}</h4>
    <ul className="mt-2 space-y-1">{m.items.map((it,j)=><li key={j}><b>{it.food}</b>{it.qty&&` — ${it.qty}`}{it.subs&&<span className="block text-sm text-[#626274]">Pode trocar por: {it.subs}</span>}{it.notes&&<span className="block text-sm text-[#626274]">{it.notes}</span>}</li>)}</ul></section>)}
   {canLog&&onToggle&&<Button type="button" onClick={()=>onToggle('todos',!doneToday('todos'))} className={doneToday('todos')?'bg-[#a5ce41] text-[#33325a]':''}>{doneToday('todos')?'✓ Segui a dieta hoje':'Marcar: segui a dieta hoje'}</Button>}
   <p className="text-sm text-[#626274]">Dias seguidos nos últimos 7 dias: {weekCount}</p>
  </div>}
 const days=trainingDays
 const day=days.find(d=>d.key===open)
 return <div className="space-y-3">
  {routine.notes&&<p className={card}>{routine.notes}</p>}
  <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Dias da semana">{dayKeys.map(k=>{const has=days.find(d=>d.key===k)
   return <button key={k} type="button" role="tab" aria-selected={open===k} disabled={!has} onClick={()=>setOpen(k)} className={'min-h-11 min-w-14 shrink-0 rounded-[8px_16px_8px_16px] border px-2 text-sm font-bold '+(open===k?'border-[#33325a] bg-[#33325a] text-[#f7f6f2]':has?'border-[#a5ce41] bg-white':'border-[#eeedf4] bg-[#f7f6f2] text-[#b0b0bb]')}>
    {dayShort[k]}{k===today.day&&<span className="block text-[10px] font-semibold">hoje</span>}{has&&doneToday(k)&&' ✓'}</button>})}</div>
  {day&&<section className="space-y-3"><h4 className="text-lg font-extrabold">{dayLabels[day.key]} · {day.name}</h4>
   <ol className="space-y-3">{day.items.map((it,i)=><li key={i} className={card}>
    <p className="font-bold">{i+1}. {it.name}</p>
    <p className="text-sm">{[it.sets?`${it.sets} séries`:'',it.reps?`${it.reps} repetições`:'',it.rest?`descanso ${it.rest}`:'',it.load?`carga ${it.load}`:''].filter(Boolean).join(' · ')}</p>
    {it.notes&&<p className="text-sm text-[#626274]">{it.notes}</p>}
    {(()=>{const {entry,animation:anim}=resolveExercise(it.name,library),video=it.video||entry?.video||null
     return <>{!anim&&entry?.instructions&&<p className="mt-1 whitespace-pre-line text-sm">{entry.instructions}</p>}
      {anim||video?<div className="mt-2 grid max-w-3xl gap-3 md:grid-cols-2">{anim&&<ExerciseAnimationView exercise={anim}/>}{video&&<YoutubePlayer id={video} title={it.name}/>}</div>:null}</>})()}
   </li>)}</ol>
   {logSlot?logSlot(day):<>{canLog&&onToggle&&day.key===today.day&&<Button type="button" onClick={()=>onToggle(day.key,!doneToday(day.key))} className={doneToday(day.key)?'bg-[#a5ce41] text-[#33325a]':''}>{doneToday(day.key)?'✓ Treino de hoje concluído':'Concluí o treino de hoje'}</Button>}
   {canLog&&day.key!==today.day&&<p className="text-sm text-[#626274]">Você marca o treino como feito no dia dele.</p>}</>}
  </section>}
  <p className="text-sm text-[#626274]">Treinos feitos nos últimos 7 dias: {weekCount}</p>
 </div>
}

// Aluno: "Meu treino / dieta".
export function StudentRoutines({owner,onAi,legacy}:{owner:string,onAi:()=>void,legacy?:React.ReactNode}){
 const [kind,setKind]=useState<Kind|'evolucao'>('treino'),[rows,setRows]=useState<Routine[]>([]),[logs,setLogs]=useState<{day_key:string,done_on:string}[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(await listRoutines(null))}catch(err){setError(errorText(err,'Não foi possível carregar.'))}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load,owner])
 const active=rows.find(r=>r.kind===kind&&r.status==='publicado'),review=rows.find(r=>r.kind===kind&&r.status==='revisao')
 const [quickBusy,setQuickBusy]=useState(false)
 const [sessions,setSessions]=useState<Session[]>([]),[logging,setLogging]=useState<{day:TrainingDay,existing?:Session}|null>(null)
 const refresh=useCallback(()=>{if(!active)return;routineProgress(active.plan_id).then(setLogs).catch(()=>{});listRoutineSessions(null).then(setSessions).catch(()=>{})},[active?.plan_id])
 useEffect(()=>{setLogs([]);setSessions([]);setLogging(null);refresh()},[refresh])
 const today=todayInfo().iso
 const logSlot=(day:TrainingDay)=>{if(!active)return null
  const recent=sessions.filter(s=>s.plan_id===active.plan_id&&s.day_key===day.key)[0]
  if(logging&&logging.day.key===day.key)return <SessionForm plan={active.plan_id} day={day} existing={logging.existing} onCancel={()=>setLogging(null)} onDone={()=>{setLogging(null);refresh()}}/>
  const quickDate=latestDateFor(day.key),quickDone=sessions.some(s=>s.plan_id===active.plan_id&&s.day_key===day.key&&s.done_on===quickDate)
  return <div className="space-y-2">{recent&&<SessionCard session={recent}/>}
   <div className="flex flex-wrap gap-2">{!quickDone&&<Button type="button" disabled={quickBusy} className="!bg-[#a5ce41] !text-[#33325a]" onClick={()=>void completeAll(day,quickDate)}>✓ Concluí todos os exercícios ({dateLabel(quickDate).toLowerCase()})</Button>}
    <Button type="button" variant={quickDone?'default':'outline'} onClick={()=>setLogging({day})}>{quickDone?'Registrar outro dia':'Registrar com detalhes'}</Button>
    {recent&&<Button type="button" variant="outline" onClick={()=>setLogging({day,existing:recent})}>Editar último registro</Button>}</div>
   <p className="text-sm text-[#626274]">Fez tudo como está no treino? Um toque em "Concluí todos". Mudou carga, pulou algum exercício ou sentiu dor? Use "Registrar com detalhes". Seu profissional acompanha por aqui.</p></div>}
 async function completeAll(day:TrainingDay,date:string){if(!active)return;setQuickBusy(true);setError('')
  try{await saveRoutineSession({plan:active.plan_id,day:day.key,date,effort:null,pain:0,note:'',entries:sessionEntriesFrom(day)});refresh()}catch(err){setError(errorText(err,'Não foi possível registrar.'))}finally{setQuickBusy(false)}}
 async function toggle(day:DayKey|'todos',done:boolean){if(!active)return;try{await logRoutineDay(active.plan_id,day,todayInfo().iso,done);setLogs(await routineProgress(active.plan_id))}catch(err){setError(errorText(err,'Não foi possível registrar.'))}}
 return <section className="space-y-4" aria-label="Meu treino e dieta">
  <div className="flex flex-wrap gap-2" role="tablist">{([['treino','Treino',Dumbbell],['dieta','Dieta',Apple],['evolucao','Evolução',ChartIcon]] as const).map(([k,label,Icon])=><Button key={k} type="button" role="tab" aria-selected={kind===k} variant={kind===k?'default':'outline'} onClick={()=>setKind(k)}><Icon aria-hidden="true" className="mr-2 h-4 w-4"/>{label}</Button>)}</div>
  {error&&<p role="alert">{error}</p>}
  {kind==='evolucao'?<Suspense fallback={<p role="status">Carregando…</p>}><Evolution student={null} owner={owner}/></Suspense>:loading?<p role="status">Carregando…</p>:active?<><div><h3 className="text-xl font-extrabold">{active.title}</h3><p className="text-sm text-[#626274]">{sourceLabel(active)}{active.source==='ia_aluno'&&' · não substitui a orientação de um profissional'}</p></div>
   <RoutineDisplay routine={active} logs={logs} canLog onToggle={(d,v)=>void toggle(d,v)} logSlot={active.kind==='treino'?logSlot:undefined}/>
   {active.kind==='treino'&&sessions.length>1&&<details className={card}><summary className="min-h-11 cursor-pointer py-2 font-bold">Meu histórico ({sessions.length})</summary><div className="mt-2 space-y-2">{sessions.slice(0,30).map(s=><SessionCard key={s.session_id} session={s}/>)}</div></details>}</>
  :<div className={card}><p className="font-semibold">{kind==='treino'?'Você ainda não tem um treino.':'Você ainda não tem uma dieta.'}</p>
   <p className="text-sm">{kind==='treino'?'Seu profissional monta o treino por aqui. Se ainda não tem um, encontre em "Encontrar profissionais" ou gere uma sugestão com a IA.':'A dieta é feita por um nutricionista. Encontre um em "Encontrar profissionais" › Nutrição.'}</p>
   {kind==='treino'&&<Button type="button" className="mt-3" onClick={onAi}><Sparkles aria-hidden="true" className="mr-2 h-4 w-4"/>Gerar treino com IA</Button>}</div>}
  {review&&<p className={card+' border-amber-300 bg-amber-50'}>Seu treino sugerido pela IA ("{review.title}") está com o seu profissional para revisão.</p>}
  {legacy&&<details className={card}><summary className="min-h-11 cursor-pointer py-2 font-bold">Planos anteriores (texto)</summary><div className="mt-3">{legacy}</div></details>}
 </section>
}

// ----- Profissional: "Treinos e dietas" -----
const emptyExercise=():Exercise=>({name:'',sets:3,reps:'10',rest:'60s',load:'',video:null,notes:''})
const emptyMeal=():Meal=>({name:'',time:null,items:[{food:'',qty:'',notes:'',subs:''}]})
const field='mt-1 block w-full rounded-md border p-2 text-sm'

export function RoutineEditor({student,kind,source='profissional',initial,onDone,onCancel}:{student:string,kind:Kind,source?:Source,initial?:Routine|{title:string,notes:string|null,structure:Structure},onDone:()=>void,onCancel:()=>void}){
 const [title,setTitle]=useState(initial?.title||''),[notes,setNotes]=useState(initial?.notes||'')
 const [days,setDays]=useState<TrainingDay[]>(initial&&'days' in initial.structure?initial.structure.days:[{key:'seg',name:'Treino A',items:[emptyExercise()]}])
 const [meals,setMeals]=useState<Meal[]>(initial&&'meals' in initial.structure?initial.structure.meals:[{...emptyMeal(),name:'Café da manhã',time:'07:00'}])
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),library=useExerciseLibrary()
 const id=initial&&'plan_id' in initial?initial.plan_id:null
 async function save(publish:boolean){setBusy(true);setError('')
  try{const saved=await saveRoutine({id,student,kind,source:initial&&'source' in initial?initial.source:source,title,notes,structure:kind==='treino'?{days}:{meals}});if(publish)await publishRoutine(saved);onDone()}
  catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 const updDay=(i:number,patch:Partial<TrainingDay>)=>setDays(d=>d.map((x,j)=>j===i?{...x,...patch}:x))
 const updEx=(i:number,k:number,patch:Partial<Exercise>)=>updDay(i,{items:days[i].items.map((x,j)=>j===k?{...x,...patch}:x)})
 const updMeal=(i:number,patch:Partial<Meal>)=>setMeals(m=>m.map((x,j)=>j===i?{...x,...patch}:x))
 const free=dayKeys.filter(k=>!days.some(d=>d.key===k))
 return <form className="space-y-4" onSubmit={e=>{e.preventDefault();void save(false)}}>
  <datalist id="biblioteca-369">{[...new Set([...library.map(e=>e.name),...exerciseAnimations.map(e=>e.name)])].map(n=><option key={n} value={n}/>)}</datalist>
  <label className="block font-semibold">Título<Input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind==='treino'?'Ex.: Hipertrofia — mês 1':'Ex.: Plano alimentar — emagrecimento'}/></label>
  <label className="block font-semibold">Orientações gerais (opcional)<textarea className={field} rows={2} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={kind==='treino'?'Aquecimento, cuidados, progressão de carga…':'Hidratação, horários, observações…'}/></label>
  {kind==='treino'?<>{days.map((d,i)=><fieldset key={i} className={card+' space-y-3'}>
   <div className="flex flex-wrap items-end gap-2"><label className="text-sm">Dia<select className={field} value={d.key} onChange={e=>updDay(i,{key:e.target.value as DayKey})}>{dayKeys.filter(k=>k===d.key||free.includes(k)).map(k=><option key={k} value={k}>{dayLabels[k]}</option>)}</select></label>
    <label className="flex-1 text-sm">Nome do treino<Input maxLength={60} value={d.name} onChange={e=>updDay(i,{name:e.target.value})} placeholder="Treino A — pernas"/></label>
    <Button type="button" variant="outline" aria-label={'Remover '+dayLabels[d.key]} onClick={()=>setDays(x=>x.filter((_,j)=>j!==i))} disabled={days.length<2}><Trash2 aria-hidden="true" className="h-4 w-4"/></Button></div>
   {d.items.map((it,k)=><div key={k} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
    <label className="text-sm sm:col-span-3">Exercício{resolveExercise(it.name,library).animation&&<span className="ml-2 text-xs font-bold text-[#6a8a27]">✓ com animação</span>}<Input list="biblioteca-369" maxLength={80} value={it.name} onChange={e=>updEx(i,k,{name:e.target.value})} placeholder="Digite e escolha da biblioteca"/></label>
    <label className="text-sm">Séries<Input type="number" min={1} max={10} value={it.sets??''} onChange={e=>updEx(i,k,{sets:e.target.value===''?null:Number(e.target.value)})}/></label>
    <label className="text-sm">Repetições<Input maxLength={20} value={it.reps} onChange={e=>updEx(i,k,{reps:e.target.value})} placeholder="8-12"/></label>
    <label className="text-sm">Descanso<Input maxLength={20} value={it.rest} onChange={e=>updEx(i,k,{rest:e.target.value})} placeholder="60s"/></label>
    <label className="text-sm sm:col-span-2">Carga<Input maxLength={40} value={it.load} onChange={e=>updEx(i,k,{load:e.target.value})} placeholder="20 kg / leve"/></label>
    <label className="text-sm sm:col-span-4">Vídeo do YouTube (opcional)<Input inputMode="url" maxLength={300} value={it.video??''} onChange={e=>updEx(i,k,{video:e.target.value||null})} placeholder="https://youtu.be/..."/></label>
    <label className="text-sm sm:col-span-5">Observação<Input maxLength={300} value={it.notes} onChange={e=>updEx(i,k,{notes:e.target.value})} placeholder="Desça até 90°, coluna neutra"/></label>
    <Button type="button" variant="outline" className="self-end" aria-label="Remover exercício" disabled={d.items.length<2} onClick={()=>updDay(i,{items:d.items.filter((_,j)=>j!==k)})}><Trash2 aria-hidden="true" className="h-4 w-4"/></Button>
   </div>)}
   {d.items.length<15&&<Button type="button" variant="outline" onClick={()=>updDay(i,{items:[...d.items,emptyExercise()]})}><Plus aria-hidden="true" className="mr-1 h-4 w-4"/>Exercício</Button>}
  </fieldset>)}
  {free.length>0&&<Button type="button" variant="outline" onClick={()=>setDays(d=>[...d,{key:free[0],name:'Treino '+String.fromCharCode(65+d.length),items:[emptyExercise()]}])}><Plus aria-hidden="true" className="mr-1 h-4 w-4"/>Adicionar dia</Button>}</>
  :<>{meals.map((m,i)=><fieldset key={i} className={card+' space-y-3'}>
   <div className="flex flex-wrap items-end gap-2"><label className="flex-1 text-sm">Refeição<Input maxLength={60} value={m.name} onChange={e=>updMeal(i,{name:e.target.value})} placeholder="Almoço"/></label>
    <label className="text-sm">Horário<Input type="time" value={m.time??''} onChange={e=>updMeal(i,{time:e.target.value||null})}/></label>
    <Button type="button" variant="outline" aria-label="Remover refeição" disabled={meals.length<2} onClick={()=>setMeals(x=>x.filter((_,j)=>j!==i))}><Trash2 aria-hidden="true" className="h-4 w-4"/></Button></div>
   {m.items.map((it,k)=><div key={k} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
    <label className="text-sm sm:col-span-3">Alimento<Input maxLength={80} value={it.food} onChange={e=>updMeal(i,{items:m.items.map((x,j)=>j===k?{...x,food:e.target.value}:x)})} placeholder="Arroz integral"/></label>
    <label className="text-sm sm:col-span-2">Quantidade<Input maxLength={40} value={it.qty} onChange={e=>updMeal(i,{items:m.items.map((x,j)=>j===k?{...x,qty:e.target.value}:x)})} placeholder="4 colheres"/></label>
    <Button type="button" variant="outline" className="self-end" aria-label="Remover alimento" disabled={m.items.length<2} onClick={()=>updMeal(i,{items:m.items.filter((_,j)=>j!==k)})}><Trash2 aria-hidden="true" className="h-4 w-4"/></Button>
    <label className="text-sm sm:col-span-3">Substituições<Input maxLength={200} value={it.subs} onChange={e=>updMeal(i,{items:m.items.map((x,j)=>j===k?{...x,subs:e.target.value}:x)})} placeholder="Batata-doce, quinoa"/></label>
    <label className="text-sm sm:col-span-3">Observação<Input maxLength={200} value={it.notes} onChange={e=>updMeal(i,{items:m.items.map((x,j)=>j===k?{...x,notes:e.target.value}:x)})}/></label>
   </div>)}
   {m.items.length<15&&<Button type="button" variant="outline" onClick={()=>updMeal(i,{items:[...m.items,{food:'',qty:'',notes:'',subs:''}]})}><Plus aria-hidden="true" className="mr-1 h-4 w-4"/>Alimento</Button>}
  </fieldset>)}
  {meals.length<8&&<Button type="button" variant="outline" onClick={()=>setMeals(m=>[...m,emptyMeal()])}><Plus aria-hidden="true" className="mr-1 h-4 w-4"/>Adicionar refeição</Button>}</>}
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap gap-2"><Button type="submit" variant="outline" disabled={busy}>Salvar rascunho</Button><Button type="button" disabled={busy} onClick={()=>void save(true)}>Publicar para o aluno</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
 </form>
}

export function ProRoutines({owner,links,onAi}:{owner:string,links:ParticipantLink[],onAi:(student:string)=>void}){
 const students=links.filter(l=>l.state==='active')
 const [student,setStudent]=useState(students[0]?.student_id||''),[rows,setRows]=useState<Routine[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const [editing,setEditing]=useState<{kind:Kind,initial?:Routine}|null>(null),[viewing,setViewing]=useState<Routine|null>(null),[logs,setLogs]=useState<{day_key:string,done_on:string}[]>([])
 useEffect(()=>{if(!students.some(st=>st.student_id===student)&&students[0])setStudent(students[0].student_id)},[students,student])
 const load=useCallback(async()=>{if(!student)return;setLoading(true);setError('');try{setRows(await listRoutines(student))}catch(err){setError(errorText(err,'Não foi possível carregar.'))}finally{setLoading(false)}},[student])
 useEffect(()=>{setEditing(null);setViewing(null);void load()},[load,owner])
 useEffect(()=>{setLogs([]);if(viewing?.status==='publicado')routineProgress(viewing.plan_id).then(setLogs).catch(()=>{})},[viewing?.plan_id])
 async function act(task:()=>Promise<unknown>){setError('');try{await task();setViewing(null);await load()}catch(err){setError(errorText(err,'Não foi possível concluir.'))}}
 if(!students.length)return <p className={card}>Quando você aceitar um aluno em "Meus alunos", poderá montar o treino ou a dieta dele aqui.</p>
 if(editing)return <div className="space-y-3"><h3 className="text-xl font-extrabold">{editing.initial?'Editar':'Novo'} {editing.kind==='treino'?'treino':'plano alimentar'} · {students.find(s=>s.student_id===student)?.participant_name}</h3>
  <RoutineEditor student={student} kind={editing.kind} initial={editing.initial} onDone={()=>{setEditing(null);void load()}} onCancel={()=>setEditing(null)}/></div>
 if(viewing)return <div className="space-y-3"><Button type="button" variant="outline" onClick={()=>setViewing(null)}>← Voltar</Button>
  <h3 className="text-xl font-extrabold">{viewing.title}</h3><p className="text-sm text-[#626274]">{sourceLabel(viewing)} · {viewing.status==='publicado'?'Publicado':viewing.status==='revisao'?'Aguardando sua revisão':'Rascunho'}</p>
  <RoutineDisplay routine={viewing} logs={logs} canLog={false}/>
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap gap-2">{viewing.can_review&&<><Button type="button" onClick={()=>void act(()=>reviewRoutine(viewing.plan_id,true))}>Aprovar e publicar</Button><Button type="button" variant="outline" onClick={()=>void act(()=>reviewRoutine(viewing.plan_id,false))}>Devolver ao aluno</Button></>}
   {viewing.mine&&<Button type="button" variant="outline" onClick={()=>setEditing({kind:viewing.kind,initial:viewing})}>Editar</Button>}
   {viewing.mine&&viewing.status==='rascunho'&&<Button type="button" onClick={()=>void act(()=>publishRoutine(viewing.plan_id))}>Publicar</Button>}
   {viewing.mine&&<Button type="button" variant="outline" onClick={()=>{if(window.confirm('Arquivar este plano? O aluno deixa de ver.'))void act(()=>archiveRoutine(viewing.plan_id))}}>Arquivar</Button>}</div></div>
 return <section className="space-y-4" aria-label="Treinos e dietas">
  <label className="block font-semibold">Aluno<select className={field} value={student} onChange={e=>setStudent(e.target.value)}>{students.map(s=><option key={s.student_id} value={s.student_id}>{s.participant_name||'Aluno'}</option>)}</select></label>
  <div className="flex flex-wrap gap-2"><Button type="button" onClick={()=>setEditing({kind:'treino'})}><Dumbbell aria-hidden="true" className="mr-2 h-4 w-4"/>Novo treino</Button><Button type="button" variant="outline" onClick={()=>setEditing({kind:'dieta'})}><Apple aria-hidden="true" className="mr-2 h-4 w-4"/>Nova dieta</Button><Button type="button" variant="outline" onClick={()=>onAi(student)}><Sparkles aria-hidden="true" className="mr-2 h-4 w-4"/>Montar com IA</Button></div>
  <p className="text-sm text-[#626274]">Treino: educação física, fisioterapia ou artes marciais. Dieta: só nutricionistas.</p>
  {error&&<p role="alert">{error}</p>}
  {loading?<p role="status">Carregando…</p>:!rows.length?<p className={card}>Nenhum plano para este aluno ainda.</p>:
  <ul className="space-y-2">{rows.map(r=><li key={r.plan_id}><button type="button" onClick={()=>setViewing(r)} className={card+' flex w-full items-center gap-3 text-left hover:border-[#a5ce41]'}>
   {r.status==='publicado'?<CheckCircle2 aria-hidden="true" className="h-5 w-5 text-[#6a8a27]"/>:<Circle aria-hidden="true" className="h-5 w-5 text-[#626274]"/>}
   <span className="flex-1"><span className="block font-bold">{r.kind==='treino'?'Treino':'Dieta'} · {r.title}</span><span className="block text-sm text-[#626274]">{sourceLabel(r)} · {r.status==='publicado'?'Publicado':r.status==='revisao'?'Aguardando sua revisão':'Rascunho'}</span></span>
  </button></li>)}</ul>}
  <ProActivity student={student} owner={owner}/>
 </section>
}

import React,{useCallback,useEffect,useRef,useState} from 'react'
import {Bell,BellOff,Droplets,Plus,Trophy} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {addWater,archiveChallenge,challengeKindLabels,challengeParticipants,challengeState,checkinChallenge,daysLeft,hydrationSummary,joinChallenge,listChallenges,
 saveChallenge,saveHydrationSettings,shouldRemind,type Challenge,type ChallengeKind,type Hydration} from '@/lib/supabase/challenges'
import {todayInfo} from '@/lib/supabase/routines'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const field='mt-1 block w-full rounded-md border p-2 text-sm'
const fmtDate=(iso:string)=>{const [,m,d]=iso.split('-');return `${d}/${m}`}
const liters=(ml:number)=>ml>=1000?`${(ml/1000).toFixed(ml%1000?2:1).replace('.',',').replace(/,?0+$/,'')} L`:`${ml} ml`
const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}

function Bar({value,max,color='#a5ce41'}:{value:number,max:number,color?:string}){
 return <div className="h-3 overflow-hidden rounded-full bg-[#eeedf4]" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value,max)}><div className="h-full rounded-full transition-all" style={{width:`${max?Math.min(100,value/max*100):0}%`,background:color}}/></div>
}

// ----- Hidratação (aluno) -----
const LAST_KEY='369:agua:ultimo-lembrete'
export function HydrationCard({compact=false,onOpen}:{compact?:boolean,onOpen?:()=>void}){
 const [data,setData]=useState<Hydration|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false)
 const load=useCallback(()=>{hydrationSummary().then(setData).catch(err=>setError(errorText(err,'Não foi possível carregar.')))},[])
 useEffect(()=>{load()},[load])
 const today=todayInfo().iso,todayMl=data?.days.find(d=>d.day===today)?.ml??0
 async function add(ml:number){setBusy(true);setError('');try{const total=await addWater(ml);setData(d=>d&&{...d,days:d.days.some(x=>x.day===today)?d.days.map(x=>x.day===today?{...x,ml:total}:x):[...d.days,{day:today,ml:total}]})}catch(err){setError(errorText(err,'Não foi possível registrar.'))}finally{setBusy(false)}}
 if(error&&!data)return compact?null:<p role="alert">{error}</p>
 if(!data)return compact?null:<p role="status">Carregando…</p>
 const done=todayMl>=data.goal_ml
 return <section className={card+' space-y-3'} aria-label="Hidratação">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-extrabold"><Droplets aria-hidden="true" className="h-5 w-5 text-sky-600"/>Água hoje</h3>
   <span className="text-sm font-bold">{liters(todayMl)} de {liters(data.goal_ml)}{done&&' ✓'}</span></div>
  <Bar value={todayMl} max={data.goal_ml} color={done?'#a5ce41':'#0284c7'}/>
  <div className="flex flex-wrap gap-2">{[250,500].map(ml=><Button key={ml} type="button" disabled={busy} onClick={()=>void add(ml)}>+ {ml} ml</Button>)}
   <Button type="button" variant="outline" disabled={busy||todayMl===0} onClick={()=>void add(-250)}>− 250 ml</Button>
   {compact&&onOpen&&<Button type="button" variant="outline" onClick={onOpen}>Desafios e água</Button>}</div>
  {done&&<p className="text-sm font-bold text-[#4d6b14]">Meta de hoje batida! 💧</p>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
  {!compact&&<>
   <div><p className="text-sm font-semibold">Últimos 7 dias</p><div className="mt-2 flex h-24 items-end gap-2" aria-label="Água nos últimos 7 dias">{data.days.map(d=>{const pct=Math.min(100,d.ml/data.goal_ml*100)
    return <div key={d.day} className="flex flex-1 flex-col items-center gap-1"><div className="flex h-16 w-full items-end rounded bg-[#eeedf4]"><div className="w-full rounded" style={{height:`${pct}%`,background:d.ml>=data.goal_ml?'#a5ce41':'#7dd3fc'}} title={`${fmtDate(d.day)}: ${liters(d.ml)}`}/></div><span className="text-[10px]">{fmtDate(d.day)}</span></div>})}</div></div>
   {editing?<HydrationSettings value={data} onDone={v=>{setEditing(false);if(v)setData({...data,...v})}}/>
    :<Button type="button" variant="outline" onClick={()=>setEditing(true)}>{data.remind?<Bell aria-hidden="true" className="mr-2 h-4 w-4"/>:<BellOff aria-hidden="true" className="mr-2 h-4 w-4"/>}Meta e lembretes</Button>}
  </>}
 </section>
}
function HydrationSettings({value,onDone}:{value:Hydration,onDone:(v:Omit<Hydration,'days'>|null)=>void}){
 const [s,setS]=useState({goal_ml:value.goal_ml,remind:value.remind,every_min:value.every_min,from_hour:value.from_hour,to_hour:value.to_hour}),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function save(){setBusy(true);setError('')
  try{if(s.remind&&typeof Notification!=='undefined'&&Notification.permission==='default')await Notification.requestPermission().catch(()=>'denied');await saveHydrationSettings(s);onDone(s)}
  catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 return <div className="space-y-3 rounded-md border p-3">
  <label className="block text-sm font-semibold">Meta diária (ml)<Input type="number" min={500} max={6000} step={100} value={s.goal_ml} onChange={e=>setS({...s,goal_ml:Number(e.target.value)})}/><span className="text-xs font-normal text-[#626274]">Uma referência comum é 35 ml por quilo de peso. Na dúvida, pergunte ao seu nutricionista.</span></label>
  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={s.remind} onChange={e=>setS({...s,remind:e.target.checked})}/>Lembrar de beber água</label>
  {s.remind&&<div className="grid grid-cols-3 gap-2 text-sm">
   <label className="font-semibold">A cada<select className={field} value={s.every_min} onChange={e=>setS({...s,every_min:Number(e.target.value)})}>{[30,45,60,90,120].map(m=><option key={m} value={m}>{m} min</option>)}</select></label>
   <label className="font-semibold">Das<select className={field} value={s.from_hour} onChange={e=>setS({...s,from_hour:Number(e.target.value)})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{h}h</option>)}</select></label>
   <label className="font-semibold">Até<select className={field} value={s.to_hour} onChange={e=>setS({...s,to_hour:Number(e.target.value)})}>{Array.from({length:24},(_,h)=>h+1).map(h=><option key={h} value={h}>{h}h</option>)}</select></label>
  </div>}
  {s.remind&&<p className="text-xs text-[#626274]">Os lembretes aparecem enquanto o app estiver aberto (inclusive em segundo plano no celular, se o navegador permitir notificações).</p>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
  <div className="flex gap-2"><Button type="button" disabled={busy} onClick={()=>void save()}>Salvar</Button><Button type="button" variant="outline" onClick={()=>onDone(null)}>Cancelar</Button></div>
 </div>
}

// Lembrete de água enquanto o app está aberto (aluno). Não mostra nada na tela além do aviso.
export function HydrationReminder(){
 const [msg,setMsg]=useState(''),settings=useRef<Hydration|null>(null)
 useEffect(()=>{let live=true
  const refresh=()=>hydrationSummary().then(h=>{if(live)settings.current=h}).catch(()=>{})
  void refresh()
  const tick=setInterval(()=>{const s=settings.current;if(!s)return
   let last:number|null=null;try{const v=localStorage.getItem(LAST_KEY);last=v?Number(v):null}catch{/* sem armazenamento */}
   const ml=s.days.find(d=>d.day===todayInfo().iso)?.ml??0
   if(!shouldRemind(s,ml,last))return
   try{localStorage.setItem(LAST_KEY,String(Date.now()))}catch{/* sem armazenamento */}
   const text=`Hora de beber água 💧 Hoje: ${liters(ml)} de ${liters(s.goal_ml)}.`
   try{if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&document.visibilityState!=='visible')new Notification('369 WELLNESS',{body:text,icon:'/assets/pwa/icon-192.png'});else setMsg(text)}catch{setMsg(text)}
   void refresh()},60000)
  return()=>{live=false;clearInterval(tick)}},[])
 if(!msg)return null
 return <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-[12px_30px_12px_30px] bg-[#33325a] p-4 text-[#f7f6f2] shadow-lg">
  <span>{msg}</span><div className="flex gap-2"><Button type="button" className="!bg-[#a5ce41] !text-[#33325a]" onClick={()=>{void addWater(250).catch(()=>{});setMsg('')}}>+250 ml</Button><Button type="button" variant="outline" className="!bg-white !text-[#33325a]" onClick={()=>setMsg('')}>Fechar</Button></div></div>
}

// ----- Desafios -----
function ChallengeCard({c,onChanged}:{c:Challenge,onChanged:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const state=challengeState(c),today=todayInfo().iso
 async function act(task:()=>Promise<unknown>){setBusy(true);setError('');try{await task();onChanged()}catch(err){setError(errorText(err,'Não foi possível concluir.'))}finally{setBusy(false)}}
 return <article className={card+' space-y-2'+(state==='concluido'?' border-[#a5ce41]':'')}>
  <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-[#eeedf4] px-2 py-0.5 text-[#33325a]">{c.kind==='manual'?'Marcar cada dia':c.kind==='treino'?'Treinos':'Hidratação'}</span>
   <span className="text-[#626274]">{fmtDate(c.starts_on)} a {fmtDate(c.ends_on)}{state==='em-andamento'&&` · faltam ${daysLeft(c.ends_on)} dia(s)`}{state==='em-breve'&&' · começa em breve'}{state==='encerrado'&&' · encerrado'}</span></div>
  <h3 className="text-lg font-extrabold">{state==='concluido'&&<Trophy aria-hidden="true" className="mr-1 inline h-5 w-5 text-amber-500"/>}{c.title}</h3>
  <p className="text-sm text-[#626274]">Por {c.owner_name} · meta: {c.goal_days} dia(s) · {c.participants} participante(s){c.completed?`, ${c.completed} concluíram`:''}</p>
  {c.description&&<p className="whitespace-pre-line text-sm">{c.description}</p>}
  {c.joined?<>
   <div className="flex items-center gap-3"><div className="flex-1"><Bar value={c.progress} max={c.goal_days}/></div><span className="text-sm font-bold">{Math.min(c.progress,c.goal_days)}/{c.goal_days}</span></div>
   {state==='concluido'?<p className="font-bold text-[#4d6b14]">Desafio concluído! Conquista 369 🏆</p>
    :c.kind==='manual'&&state==='em-andamento'?<Button type="button" disabled={busy} variant={c.checked_today?'outline':'default'} onClick={()=>void act(()=>checkinChallenge(c.challenge_id,today,!c.checked_today))}>{c.checked_today?'✓ Hoje feito (desmarcar)':'Marcar hoje como feito'}</Button>
    :c.kind==='treino'?<p className="text-sm text-[#626274]">Conta sozinho: cada dia com treino registrado.</p>:c.kind==='hidratacao'?<p className="text-sm text-[#626274]">Conta sozinho: cada dia em que você bate a meta de água.</p>:null}
   {state!=='concluido'&&<button type="button" className="block min-h-11 text-sm underline" disabled={busy} onClick={()=>{if(window.confirm('Sair deste desafio? Os dias marcados serão apagados.'))void act(()=>joinChallenge(c.challenge_id,false))}}>Sair do desafio</button>}
  </>:state!=='encerrado'&&<Button type="button" disabled={busy} onClick={()=>void act(()=>joinChallenge(c.challenge_id,true))}>Aceitar desafio</Button>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
 </article>
}

// Aluno: "Desafios e água".
export default function StudentChallenges({owner}:{owner:string}){
 const [rows,setRows]=useState<Challenge[]|null>(null),[error,setError]=useState('')
 const load=useCallback(()=>{listChallenges().then(setRows).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setRows([])})},[])
 useEffect(()=>{load()},[load,owner])
 const active=(rows??[]).filter(c=>challengeState(c)!=='encerrado'||c.joined)
 return <section className="space-y-4" aria-label="Desafios e água">
  <div><h2 className="text-xl font-extrabold">Desafios e água</h2><p className="text-sm text-[#626274]">Disciplina no dia a dia: aceite desafios do seu profissional e da equipe 369 e acompanhe sua hidratação.</p></div>
  <HydrationCard/>
  <h3 className="text-lg font-extrabold">Desafios</h3>
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:active.length?<div className="grid gap-3 lg:grid-cols-2">{active.map(c=><ChallengeCard key={c.challenge_id} c={c} onChanged={load}/>)}</div>
   :<p className={card}>Nenhum desafio aberto agora. Quando seu profissional ou a equipe 369 criar um, ele aparece aqui.</p>}
 </section>
}

// Home do aluno: desafio em andamento mais adiantado.
export function ChallengeHighlight({owner,onView}:{owner:string,onView:(id:string)=>void}){
 const [rows,setRows]=useState<Challenge[]>([])
 useEffect(()=>{let live=true;listChallenges().then(r=>{if(live)setRows(r)}).catch(()=>{});return()=>{live=false}},[owner])
 const open=rows.filter(c=>challengeState(c)==='em-andamento')
 const mine=open.filter(c=>c.joined).sort((a,b)=>b.progress/b.goal_days-a.progress/a.goal_days)[0]
 const invite=!mine?open.find(c=>!c.joined):undefined
 const c=mine??invite;if(!c)return null
 return <button type="button" onClick={()=>onView('desafios')} className={card+' block w-full space-y-2 text-left hover:border-[#a5ce41]'}>
  <p className="text-xs font-bold uppercase tracking-wider text-[#6a8a27]">{mine?'Seu desafio':'Novo desafio para você'}</p>
  <p className="font-extrabold">{c.title}</p>
  {mine?<div className="flex items-center gap-3"><div className="flex-1"><Bar value={c.progress} max={c.goal_days}/></div><span className="text-sm font-bold">{Math.min(c.progress,c.goal_days)}/{c.goal_days}</span></div>
   :<p className="text-sm">Por {c.owner_name} · toque para aceitar</p>}
 </button>
}

// ----- Profissional e admin: criar e acompanhar desafios -----
function ChallengeForm({role,onDone}:{role:'admin'|'profissional',onDone:()=>void}){
 const today=todayInfo().iso
 const [f,setF]=useState({title:'',description:'',kind:'manual' as ChallengeKind,goalDays:7,startsOn:today,endsOn:addDays(today,6)}),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const presets=[{title:'7 dias de alongamento',description:'10 minutos de alongamento por dia.',kind:'manual' as ChallengeKind,goalDays:7,days:7},{title:'Hidratação: meta de água por 7 dias',description:'Bata sua meta diária de água.',kind:'hidratacao' as ChallengeKind,goalDays:7,days:7},{title:'12 treinos no mês',description:'Registre 12 treinos em 30 dias.',kind:'treino' as ChallengeKind,goalDays:12,days:30}]
 async function save(){setBusy(true);setError('');try{await saveChallenge({id:null,...f});onDone()}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 return <form className={card+' space-y-3'} onSubmit={e=>{e.preventDefault();void save()}}>
  <h3 className="text-lg font-extrabold">Novo desafio {role==='admin'?'para todos os alunos':'para os seus alunos'}</h3>
  <div className="flex flex-wrap gap-2">{presets.map(p=><button key={p.title} type="button" className="min-h-11 rounded-[8px_16px_8px_16px] border border-[#a5ce41] px-3 text-left text-sm" onClick={()=>setF({title:p.title,description:p.description,kind:p.kind,goalDays:p.goalDays,startsOn:today,endsOn:addDays(today,p.days-1)})}>{p.title}</button>)}</div>
  <label className="block font-semibold">Título<Input required minLength={3} maxLength={80} value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label>
  <label className="block font-semibold">Descrição (opcional)<textarea className={field} rows={2} maxLength={1000} value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
  <label className="block font-semibold">Como conta<select className={field} value={f.kind} onChange={e=>setF({...f,kind:e.target.value as ChallengeKind})}>{(Object.keys(challengeKindLabels) as ChallengeKind[]).map(k=><option key={k} value={k}>{challengeKindLabels[k]}</option>)}</select></label>
  <div className="grid grid-cols-3 gap-2"><label className="text-sm font-semibold">Início<Input type="date" value={f.startsOn} onChange={e=>setF({...f,startsOn:e.target.value})}/></label>
   <label className="text-sm font-semibold">Fim<Input type="date" value={f.endsOn} onChange={e=>setF({...f,endsOn:e.target.value})}/></label>
   <label className="text-sm font-semibold">Meta (dias)<Input type="number" min={1} max={90} value={f.goalDays} onChange={e=>setF({...f,goalDays:Number(e.target.value)})}/></label></div>
  {error&&<p role="alert">{error}</p>}
  <div className="flex gap-2"><Button type="submit" disabled={busy}>Publicar desafio</Button><Button type="button" variant="outline" onClick={onDone}>Cancelar</Button></div>
 </form>
}
function Participants({id}:{id:string}){
 const [rows,setRows]=useState<{user_id:string,name:string,progress:number}[]|null>(null)
 useEffect(()=>{challengeParticipants(id).then(setRows).catch(()=>setRows([]))},[id])
 if(!rows)return <p role="status" className="text-sm">Carregando…</p>
 return rows.length?<ol className="space-y-1 text-sm">{rows.map((r,i)=><li key={r.user_id}>{i+1}. {r.name} — {r.progress} dia(s)</li>)}</ol>:<p className="text-sm">Ninguém entrou ainda.</p>
}
export function ChallengeManager({owner,role}:{owner:string,role:'admin'|'profissional'}){
 const [rows,setRows]=useState<Challenge[]|null>(null),[creating,setCreating]=useState(false),[error,setError]=useState('')
 const load=useCallback(()=>{listChallenges().then(r=>setRows(r.filter(c=>c.mine))).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setRows([])})},[])
 useEffect(()=>{load()},[load,owner])
 return <section className="space-y-4" aria-label="Desafios">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold">Desafios</h2><p className="text-sm text-[#626274]">{role==='admin'?'Desafios da equipe 369 para todos os alunos.':'Crie desafios para os seus alunos e acompanhe quem está cumprindo.'}</p></div>
   {!creating&&<Button type="button" onClick={()=>setCreating(true)}><Plus aria-hidden="true" className="mr-1 h-4 w-4"/>Novo desafio</Button>}</div>
  {creating&&<ChallengeForm role={role} onDone={()=>{setCreating(false);load()}}/>}
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:!rows.length?<p className={card}>Você ainda não criou desafios.</p>:<ul className="space-y-2">{rows.map(c=><li key={c.challenge_id} className={card+' space-y-2'}>
   <p className="font-extrabold">{c.title}</p><p className="text-sm text-[#626274]">{challengeKindLabels[c.kind]} · {fmtDate(c.starts_on)} a {fmtDate(c.ends_on)} · meta {c.goal_days} dia(s) · {c.participants} participante(s), {c.completed} concluíram</p>
   <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Ver participantes</summary><Participants id={c.challenge_id}/></details>
   <Button type="button" variant="outline" onClick={()=>{if(window.confirm('Encerrar e arquivar este desafio?'))void archiveChallenge(c.challenge_id).then(load).catch(err=>setError(errorText(err,'Não foi possível arquivar.')))}}>Arquivar</Button>
  </li>)}</ul>}
 </section>
}

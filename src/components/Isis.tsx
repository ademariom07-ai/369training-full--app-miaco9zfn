import React,{useEffect,useRef,useState} from 'react'
import {Mic,MicOff,Send} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {RoutineDisplay} from '@/components/Routines'
import {ASSISTANT_NAME,askIsis,type IsisMessage,type IsisResult} from '@/lib/supabase/isis'
import {listRoutines,publishRoutine,type Routine} from '@/lib/supabase/routines'
import type {ParticipantLink} from '@/lib/supabase/participantLinks'

const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
type Turn=IsisMessage&{results?:IsisResult[]}
const storeKey=(owner:string)=>'isis:'+owner
function loadTurns(owner:string):Turn[]{try{const v=JSON.parse(sessionStorage.getItem(storeKey(owner))||'[]');return Array.isArray(v)?v.slice(-30):[]}catch{return []}}
function saveTurns(owner:string,turns:Turn[]){try{sessionStorage.setItem(storeKey(owner),JSON.stringify(turns.slice(-30)))}catch{/* sem armazenamento */}}

// Ditado por voz do navegador (Chrome/Android/Edge/Safari), quando existir.
type Recognition={lang:string,interimResults:boolean,continuous:boolean,start:()=>void,stop:()=>void,onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null,onend:(()=>void)|null,onerror:(()=>void)|null}
const speechCtor=()=>typeof window==='undefined'?null:((window as unknown as {SpeechRecognition?:new()=>Recognition,webkitSpeechRecognition?:new()=>Recognition}).SpeechRecognition??(window as unknown as {webkitSpeechRecognition?:new()=>Recognition}).webkitSpeechRecognition??null)

export function IsisAvatar({size=40}:{size?:number}){
 return <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-[10px_20px_10px_20px] bg-[#33325a] font-extrabold text-[#a5ce41]" style={{width:size,height:size,fontSize:size*0.42}}>9</span>
}

function ResultCard({result,onChanged}:{result:IsisResult,onChanged:()=>void}){
 const [open,setOpen]=useState(false),[plan,setPlan]=useState<Routine|null>(null),[status,setStatus]=useState(result.status),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{if(!open||plan||!result.plan_id)return;listRoutines(result.student_id).then(rows=>setPlan(rows.find(r=>r.plan_id===result.plan_id)??null)).catch(err=>setError(errorText(err,'Não foi possível abrir.')))},[open,plan,result])
 async function send(){if(!result.plan_id)return;setBusy(true);setError('');try{setStatus(await publishRoutine(result.plan_id));onChanged()}catch(err){setError(errorText(err,'Não foi possível enviar.'))}finally{setBusy(false)}}
 const sent=status==='publicado'
 if(status==='erro')return <p className={card+' border-amber-300 bg-amber-50 text-sm'}><b>{result.student_name}:</b> {result.error||'não foi possível concluir.'}</p>
 return <div className={card+' space-y-2 '+(sent?'border-[#a5ce41]':'')}>
  <p className="font-bold">{result.student_name} · {sent?'✓ Enviado — o aluno já vê no celular':status==='revisao'?'Em revisão':'Rascunho para você validar'}</p>
  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(v=>!v)}>{open?'Fechar treino':'Ver treino'}</Button>
   {!sent&&result.plan_id&&<Button type="button" disabled={busy} onClick={()=>void send()}>Enviar para o aluno</Button>}</div>
  {error&&<p role="alert" className="text-sm">{error}</p>}
  {open&&(plan?<div className="space-y-2"><p className="font-extrabold">{plan.title}</p><RoutineDisplay routine={plan} logs={[]} canLog={false}/></div>:!error&&<p role="status">Carregando…</p>)}
 </div>
}

// Profissional conversa com a Ísis para criar, ajustar e enviar treinos.
export default function Isis({owner,links,onOpenPlans}:{owner:string,links:ParticipantLink[],onOpenPlans:()=>void}){
 const students=links.filter(l=>l.state==='active')
 const [turns,setTurns]=useState<Turn[]>(()=>loadTurns(owner)),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [listening,setListening]=useState(false),rec=useRef<Recognition|null>(null),end=useRef<HTMLDivElement|null>(null)
 const canSpeak=!!speechCtor()
 useEffect(()=>{saveTurns(owner,turns);end.current?.scrollIntoView?.({block:'end'})},[owner,turns])
 useEffect(()=>()=>rec.current?.stop(),[])
 const first=students[0]?.participant_name?.split(' ')[0]
 const suggestions=[first?`Cria o treino da semana de ${first}. Usa os registros dele(a) e me traz para eu validar.`:'Cria o treino da semana do meu aluno.','Quem está evoluindo e quem está parado?','Faça o relatório da semana dos meus alunos.','Algum aluno relatou dor? O que você sugere ajustar?']
 async function send(message:string){const content=message.trim();if(!content||busy)return
  const next=[...turns,{role:'user' as const,content}];setTurns(next);setText('');setBusy(true);setError('')
  try{const {reply,results}=await askIsis(next.map(t=>({role:t.role,content:t.content})));setTurns(t=>[...t,{role:'assistant',content:reply,results}])}
  catch(err){setError(errorText(err,`A ${ASSISTANT_NAME} não respondeu.`));setTurns(t=>t.slice(0,-1));setText(content)}
  finally{setBusy(false)}}
 function toggleMic(){if(listening){rec.current?.stop();return}const Ctor=speechCtor();if(!Ctor)return
  const r=new Ctor();r.lang='pt-BR';r.interimResults=false;r.continuous=false
  r.onresult=e=>{const said=Array.from(e.results).map(x=>x[0]?.transcript??'').join(' ').trim();if(said)setText(t=>(t?t+' ':'')+said)}
  r.onend=()=>setListening(false);r.onerror=()=>setListening(false);rec.current=r;setListening(true);r.start()}
 return <section className="space-y-4" aria-label={`${ASSISTANT_NAME}, assistente 369`}>
  <header className="flex items-center gap-3"><IsisAvatar size={48}/><div><h2 className="text-xl font-extrabold">{ASSISTANT_NAME}</h2><p className="text-sm text-[#626274]">Sua assistente 369. Ela monta e ajusta os treinos dos seus alunos usando os registros deles. Você valida, ela envia.</p></div></header>
  {!students.length&&<p className={card}>Quando você aceitar um aluno em "Meus alunos", a {ASSISTANT_NAME} poderá montar os treinos dele.</p>}
  <div className="space-y-3" aria-live="polite">
   {!turns.length&&<div className={card+' space-y-2'}><p>Oi! Sou a <b>{ASSISTANT_NAME}</b>. Me diga o que precisa, do seu jeito. Por exemplo:</p>
    <div className="flex flex-wrap gap-2">{suggestions.map(s=><button key={s} type="button" disabled={busy||!students.length} onClick={()=>void send(s)} className="min-h-11 rounded-[8px_16px_8px_16px] border border-[#a5ce41] bg-white px-3 py-2 text-left text-sm hover:bg-[#f4f9e8]">{s}</button>)}</div></div>}
   {turns.map((t,i)=>t.role==='user'
    ?<p key={i} className="ml-auto max-w-[85%] whitespace-pre-line rounded-[16px_4px_16px_16px] bg-[#33325a] p-3 text-[#f7f6f2]">{t.content}</p>
    :<div key={i} className="flex max-w-[95%] gap-2"><IsisAvatar size={32}/><div className="flex-1 space-y-2"><p className="whitespace-pre-line rounded-[4px_16px_16px_16px] border border-[#dddee4] bg-white p-3">{t.content}</p>
      {t.results?.map((r,j)=><ResultCard key={j+(r.plan_id||'')} result={r} onChanged={()=>{}}/>)}</div></div>)}
   {busy&&<p role="status" className="flex items-center gap-2 text-sm text-[#626274]"><IsisAvatar size={24}/>{ASSISTANT_NAME} está pensando…</p>}
   <div ref={end}/>
  </div>
  {error&&<p role="alert">{error}</p>}
  <form className="flex items-end gap-2" onSubmit={e=>{e.preventDefault();void send(text)}}>
   <label className="flex-1"><span className="sr-only">Mensagem para a {ASSISTANT_NAME}</span>
    <textarea rows={2} maxLength={2000} value={text} disabled={busy||!students.length} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send(text)}}}
     placeholder={`Ex.: ${ASSISTANT_NAME}, tira o levantamento terra dessa semana`} className="block w-full rounded-md border p-2"/></label>
   {canSpeak&&<Button type="button" variant="outline" aria-pressed={listening} aria-label={listening?'Parar de ouvir':'Falar'} disabled={busy||!students.length} onClick={toggleMic}>{listening?<MicOff aria-hidden="true" className="h-5 w-5"/>:<Mic aria-hidden="true" className="h-5 w-5"/>}</Button>}
   <Button type="submit" aria-label="Enviar" disabled={busy||!text.trim()}><Send aria-hidden="true" className="h-5 w-5"/></Button>
  </form>
  <div className="flex flex-wrap items-center gap-3 text-sm text-[#626274]"><span>A {ASSISTANT_NAME} sugere; você revisa antes de enviar. Os treinos também ficam em "Treinos e dietas".</span>
   <button type="button" className="underline" onClick={onOpenPlans}>Abrir Treinos e dietas</button>
   {turns.length>0&&<button type="button" className="underline" onClick={()=>{setTurns([]);setError('')}}>Nova conversa</button>}</div>
 </section>
}

import React,{useState} from 'react'
import {Sparkles} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {RoutineDisplay,RoutineEditor} from '@/components/Routines'
import {generateRoutine,parqQuestions,type AiAnswers} from '@/lib/supabase/aiRoutine'
import {archiveRoutine,dayKeys,dayShort,listRoutines,publishRoutine,type DayKey,type Kind,type Routine} from '@/lib/supabase/routines'
import {goals} from '@/lib/supabase/onboarding'
import type {ParticipantLink} from '@/lib/supabase/participantLinks'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const field='mt-1 block w-full rounded-md border p-2'

// "Treinos com IA": aluno gera o próprio treino (após o questionário de saúde); profissional gera treino ou dieta para um aluno.
export default function AiRoutine({owner,role,links,initialStudent,onOpenPlans}:{owner:string,role:'aluno'|'profissional',links:ParticipantLink[],initialStudent?:string|null,onOpenPlans:()=>void}){
 const students=links.filter(l=>l.state==='active')
 const [student,setStudent]=useState(role==='aluno'?owner:(initialStudent||students[0]?.student_id||''))
 const [kind,setKind]=useState<Kind>('treino')
 const [a,setA]=useState<AiAnswers>({goal:'Saúde e bem-estar',level:'Iniciante',days:['seg','qua','sex'],minutes:45,place:'Academia',equipment:'',limitations:'',meals_per_day:5,avoid_foods:'',restrictions:'',parq:Array(7).fill(false)})
 const [parqDone,setParqDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<Routine|null>(null),[editing,setEditing]=useState(false),[notice,setNotice]=useState('')
 const set=<K extends keyof AiAnswers>(k:K,v:AiAnswers[K])=>setA(x=>({...x,[k]:v}))
 async function generate(){setBusy(true);setError('');setNotice('');setDraft(null)
  try{const id=await generateRoutine(kind,student,role==='aluno'?a:{...a,parq:undefined});const rows=await listRoutines(role==='aluno'?null:student);setDraft(rows.find(r=>r.plan_id===id)||null)}
  catch(err){setError(errorText(err,'Não foi possível gerar.'))}finally{setBusy(false)}}
 async function use(){if(!draft)return;setBusy(true);setError('')
  try{const status=await publishRoutine(draft.plan_id);setNotice(status==='revisao'?'Enviado para o seu profissional revisar. Quando ele aprovar, aparece em "Meu treino / dieta".':'Pronto! Seu treino está em "Meu treino / dieta".');setDraft(null)}
  catch(err){setError(errorText(err,'Não foi possível publicar.'))}finally{setBusy(false)}}
 async function discard(){if(!draft)return;try{await archiveRoutine(draft.plan_id)}catch{/* já arquivado */}setDraft(null)}
 if(role==='profissional'&&!students.length)return <p className={card}>Aceite um aluno em "Meus alunos" para gerar treinos e dietas para ele com a IA.</p>
 if(draft&&editing)return <div className="space-y-3"><h3 className="text-xl font-extrabold">Revisar e editar</h3><RoutineEditor student={draft.student_id} kind={draft.kind} initial={draft} onDone={()=>{setEditing(false);setDraft(null);setNotice('Plano salvo. Veja em "Treinos e dietas".');onOpenPlans()}} onCancel={()=>setEditing(false)}/></div>
 if(draft)return <div className="space-y-4">
  <div className={card+' border-[#a5ce41] bg-[#f3f9e6]'}><p className="font-bold">{draft.title}</p><p className="text-sm">Sugestão gerada por IA. {role==='aluno'?'Confira com atenção; ela não substitui a orientação de um profissional.':'Revise e ajuste antes de publicar para o aluno.'}</p></div>
  <RoutineDisplay routine={draft} logs={[]} canLog={false}/>
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap gap-2">{role==='aluno'?<Button type="button" disabled={busy} onClick={()=>void use()}>Usar este treino</Button>:<Button type="button" onClick={()=>setEditing(true)}>Revisar e editar</Button>}
   <Button type="button" variant="outline" disabled={busy} onClick={()=>void generate()}>Gerar outro</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>void discard()}>Descartar</Button></div>
 </div>
 const needParq=role==='aluno'&&!parqDone
 return <form className="space-y-4" onSubmit={e=>{e.preventDefault();void generate()}}>
  <div><h2 className="flex items-center gap-2 text-xl font-extrabold"><Sparkles aria-hidden="true" className="h-5 w-5 text-[#6a8a27]"/>Treinos com IA</h2>
   <p className="text-sm text-[#626274]">{role==='aluno'?'Responda algumas perguntas e a IA monta um treino semanal para você. Se você tiver profissional, ele revisa antes.':'A IA monta um rascunho a partir das informações do aluno. Você revisa, ajusta e publica.'}</p></div>
  {notice&&<p role="status" className={card+' border-[#a5ce41] bg-[#f3f9e6]'}>{notice}</p>}
  {needParq?<fieldset className={card+' space-y-3'}><legend className="font-extrabold">Antes de começar: questionário de saúde (PAR-Q)</legend>
   <p className="text-sm">Responda com sinceridade. As respostas não ficam salvas; servem só para saber se é seguro gerar um treino automático.</p>
   {parqQuestions.map((q,i)=><div key={i} className="space-y-1"><p className="text-sm">{i+1}. {q}</p><div className="flex gap-2">{[false,true].map(v=><button key={String(v)} type="button" aria-pressed={a.parq![i]===v} onClick={()=>set('parq',a.parq!.map((x,j)=>j===i?v:x))} className={'min-h-11 rounded-[10px_22px_10px_22px] border px-4 text-sm font-semibold '+(a.parq![i]===v?'border-[#33325a] bg-[#33325a] text-white':'bg-white')}>{v?'Sim':'Não'}</button>)}</div></div>)}
   {a.parq!.some(Boolean)?<p role="alert" className="font-semibold">Pelas suas respostas, o mais seguro é começar com um profissional e liberação médica. Procure um em "Encontrar profissionais".</p>
   :<Button type="button" onClick={()=>setParqDone(true)}>Respondi tudo com "Não" — continuar</Button>}
  </fieldset>:<>
  {role==='profissional'&&<div className="grid gap-3 sm:grid-cols-2"><label className="font-semibold">Aluno<select className={field} value={student} onChange={e=>setStudent(e.target.value)}>{students.map(s=><option key={s.student_id} value={s.student_id}>{s.participant_name||'Aluno'}</option>)}</select></label>
   <label className="font-semibold">Tipo<select className={field} value={kind} onChange={e=>setKind(e.target.value as Kind)}><option value="treino">Treino</option><option value="dieta">Dieta (nutricionistas)</option></select></label></div>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="font-semibold">Objetivo<select className={field} value={a.goal} onChange={e=>set('goal',e.target.value)}>{Object.values(goals).map(g=><option key={g}>{g}</option>)}</select></label>
   <label className="font-semibold">Nível<select className={field} value={a.level} onChange={e=>set('level',e.target.value)}>{['Iniciante','Intermediário','Avançado'].map(l=><option key={l}>{l}</option>)}</select></label>
  </div>
  {kind==='treino'?<>
   <fieldset><legend className="font-semibold">Dias da semana</legend><div className="mt-1 flex flex-wrap gap-2">{dayKeys.map(d=><button key={d} type="button" aria-pressed={a.days.includes(d)} onClick={()=>set('days',a.days.includes(d)?a.days.filter(x=>x!==d):[...a.days,d].sort((x,y)=>dayKeys.indexOf(x as DayKey)-dayKeys.indexOf(y as DayKey)))} className={'min-h-11 min-w-14 rounded-[8px_16px_8px_16px] border px-3 text-sm font-bold '+(a.days.includes(d)?'border-[#a5ce41] bg-[#a5ce41] text-[#33325a]':'bg-white')}>{dayShort[d]}</button>)}</div></fieldset>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="font-semibold">Minutos por treino<Input type="number" min={15} max={120} step={5} value={a.minutes} onChange={e=>set('minutes',Number(e.target.value))}/></label>
    <label className="font-semibold">Onde vai treinar<select className={field} value={a.place} onChange={e=>set('place',e.target.value)}>{['Academia','Em casa','Ao ar livre','Condomínio'].map(p=><option key={p}>{p}</option>)}</select></label>
   </div>
   <label className="block font-semibold">Equipamentos disponíveis<Input maxLength={300} value={a.equipment} onChange={e=>set('equipment',e.target.value)} placeholder="Ex.: halteres de 5 kg, elástico, colchonete"/></label>
  </>:<div className="grid gap-3 sm:grid-cols-3">
   <label className="font-semibold">Refeições por dia<Input type="number" min={3} max={8} value={a.meals_per_day} onChange={e=>set('meals_per_day',Number(e.target.value))}/></label>
   <label className="font-semibold sm:col-span-2">Alimentos a evitar<Input maxLength={300} value={a.avoid_foods} onChange={e=>set('avoid_foods',e.target.value)} placeholder="Ex.: leite, amendoim"/></label>
   <label className="font-semibold sm:col-span-3">Restrições<Input maxLength={300} value={a.restrictions} onChange={e=>set('restrictions',e.target.value)} placeholder="Ex.: vegetariano, intolerância à lactose"/></label>
  </div>}
  <label className="block font-semibold">Lesões, dores ou limitações<Input maxLength={400} value={a.limitations} onChange={e=>set('limitations',e.target.value)} placeholder="Ex.: dor no joelho direito ao agachar"/></label>
  <p className="text-xs text-[#626274]">As informações são enviadas à IA (Claude, da Anthropic) só para montar o plano. Não informe nome, documentos ou contatos.</p>
  {error&&<p role="alert">{error}</p>}
  <Button type="submit" disabled={busy}><Sparkles aria-hidden="true" className="mr-2 h-4 w-4"/>{busy?'Montando… pode levar até 1 minuto':'Gerar com IA'}</Button>
  </>}
 </form>
}

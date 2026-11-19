import React,{useEffect,useState} from 'react'
import {Check,Compass,Crosshair,Repeat,Route} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {goals,readMyGoal,saveMyGoal,type Goal} from '@/lib/supabase/onboarding'
import {readMyLocation,readMyVideos} from '@/lib/supabase/videoFeed'
import {readMyShowcase} from '@/lib/supabase/showcase'
import {readBookingReservations} from '@/lib/supabase/bookingReservations'
import {readTrainingPlans} from '@/lib/supabase/trainingPlans'
import {readTrainingCompletions} from '@/lib/supabase/trainingCompletions'
import type {ParticipantLink} from '@/lib/supabase/participantLinks'

// Os 3 pilares da 369 WELLNESS, na linguagem do dia a dia.
export const pillars=[
 {name:'Foco',icon:Crosshair,text:'Saber aonde você quer chegar. Você escolhe seu objetivo e a 369 mostra o que importa para chegar lá.'},
 {name:'Disciplina',icon:Repeat,text:'Fazer um pouco todo dia. Treinos, agenda e lembretes ajudam você a manter a rotina.'},
 {name:'Estratégia',icon:Route,text:'O caminho certo, com quem entende. Profissionais perto de você ou online montam e acompanham seu plano.'},
] as const

// "Conheça a 369" fica marcado neste aparelho quando a pessoa abre "Como funciona".
const tourKey=(owner:string)=>'369-tour-'+owner
export function markTourSeen(owner:string){try{localStorage.setItem(tourKey(owner),'1')}catch{/* sem armazenamento */}}
function tourSeen(owner:string){try{return localStorage.getItem(tourKey(owner))==='1'}catch{return false}}

type Step={id:string,title:string,text:string,done:boolean,action:string,view?:string,custom?:React.ReactNode}

function StepList({title,steps,onView}:{title:string,steps:Step[],onView:(id:string)=>void}){
 const next=steps.find(step=>!step.done),doneCount=steps.filter(step=>step.done).length
 return <section aria-label={title} className="space-y-3 rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-5">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-extrabold">{title}</h2><p className="text-sm text-[#626274]">{doneCount} de {steps.length} passos</p></div>
  <div className="h-2 overflow-hidden rounded-full bg-[#eeedf4]" aria-hidden="true"><div className="h-full bg-[#a5ce41]" style={{width:`${Math.round(doneCount/steps.length*100)}%`}}/></div>
  {next?<div className="rounded-[10px_22px_10px_22px] bg-[#33325a] p-4 text-[#f7f6f2]">
   <p className="text-sm font-bold uppercase tracking-wider text-[#a5ce41]">Seu próximo passo</p>
   <p className="mt-1 text-lg font-extrabold text-[#f7f6f2]">{next.title}</p><p className="text-[#d5d4e1]">{next.text}</p>
   {next.custom||(next.view&&<Button type="button" className="mt-3 bg-[#a5ce41] text-[#33325a] hover:bg-[#b5db5d]" onClick={()=>onView(next.view!)}>{next.action}</Button>)}
  </div>:<p className="rounded-[10px_22px_10px_22px] bg-[#f3f9e6] p-4 font-semibold">Parabéns! Você completou o caminho inicial. Continue acompanhando sua evolução.</p>}
  <ol className="space-y-1">{steps.map((step,index)=><li key={step.id} className="flex min-h-11 items-center gap-3">
   <span className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold '+(step.done?'bg-[#a5ce41] text-[#33325a]':'border border-[#dddee4] text-[#626274]')}>{step.done?<Check aria-label="feito" className="h-4 w-4"/>:index+1}</span>
   {step.view&&step!==next?<button type="button" className={'text-left underline-offset-2 hover:underline '+(step.done?'text-[#626274]':'')} onClick={()=>onView(step.view!)}>{step.title}</button>:<span className={step.done?'text-[#626274]':'font-semibold'}>{step.title}</span>}
  </li>)}</ol>
 </section>
}

function GoalPicker({onSaved}:{onSaved:(goal:Goal)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 return <div className="mt-3 space-y-2"><div className="flex flex-wrap gap-2">{(Object.keys(goals) as Goal[]).map(goal=><button key={goal} type="button" disabled={busy}
  onClick={async()=>{setBusy(true);setError('');try{onSaved(await saveMyGoal(goal))}catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar.')}finally{setBusy(false)}}}
  className="min-h-11 rounded-[10px_22px_10px_22px] border border-[#a5ce41] bg-transparent px-3 text-sm font-semibold text-[#f7f6f2] hover:bg-[#a5ce41] hover:text-[#33325a]">{goals[goal]}</button>)}</div>
  {error&&<p role="alert" className="text-[#ffd7d7]">{error}</p>}</div>
}

// Caminho inicial do aluno: conhecer, objetivo, profissional, rotina, evolução.
export function StudentJourney({owner,links,onView}:{owner:string,links:ParticipantLink[],onView:(id:string)=>void}){
 const [goal,setGoal]=useState<Goal|null>(null),[routine,setRoutine]=useState(false),[progress,setProgress]=useState(false)
 useEffect(()=>{let alive=true
  readMyGoal().then(g=>{if(alive)setGoal(g)}).catch(()=>{})
  const account={id:owner,role:'aluno'}
  Promise.all([readBookingReservations(account,1).catch(()=>[]),readTrainingPlans(account,1).catch(()=>[])]).then(async([reservations,plans])=>{
   if(!alive)return;setRoutine(reservations.length>0||plans.length>0)
   if(plans.length){const done=await readTrainingCompletions(plans,account).catch(()=>[]);if(alive)setProgress(done.length>0)}
  })
  return()=>{alive=false}},[owner])
 const linked=links.some(row=>row.state==='pending'||row.state==='active')
 const steps:Step[]=[
  {id:'conheca',title:'Conheça a 369',text:'Entenda em 1 minuto como a plataforma ajuda você: foco, disciplina e estratégia.',done:tourSeen(owner),action:'Ver como funciona',view:'como-funciona'},
  {id:'objetivo',title:goal?'Seu objetivo: '+goals[goal]:'Defina seu objetivo',text:'O que você mais quer agora? Você pode mudar depois.',done:!!goal,action:'',custom:<GoalPicker onSaved={setGoal}/>},
  {id:'profissional',title:'Encontre seu profissional',text:'Veja os vídeos do feed e escolha quem vai acompanhar você, perto de casa ou online.',done:linked,action:'Ver profissionais',view:'profissionais'},
  {id:'rotina',title:'Organize sua rotina',text:'Reserve um horário ou receba seu primeiro treino do seu profissional.',done:routine,action:linked?'Abrir minha agenda':'Ver profissionais',view:linked?'agenda':'profissionais'},
  {id:'evolucao',title:'Acompanhe sua evolução',text:'Conclua seu primeiro treino para começar a registrar seu progresso.',done:progress,action:'Abrir meu treino',view:'treino'},
 ]
 return <StepList title="Seu caminho na 369" steps={steps} onView={onView}/>
}

// Caminho inicial do parceiro: conhecer, região, primeiro vídeo, primeiro aluno.
export function PartnerJourney({owner,links,onView}:{owner:string,links:ParticipantLink[],onView:(id:string)=>void}){
 const [region,setRegion]=useState(false),[video,setVideo]=useState(false),[showcase,setShowcase]=useState(false)
 useEffect(()=>{let alive=true
  readMyLocation().then(l=>{if(alive)setRegion(!!l)}).catch(()=>{})
  readMyVideos().then(v=>{if(alive)setVideo(v.length>0)}).catch(()=>{})
  readMyShowcase().then(v=>{if(alive)setShowcase(!!v)}).catch(()=>{})
  return()=>{alive=false}},[owner])
 const steps:Step[]=[
  {id:'conheca',title:'Conheça a 369',text:'Veja como a plataforma ajuda você a ser encontrado e a organizar seus alunos.',done:tourSeen(owner),action:'Ver como funciona',view:'como-funciona'},
  {id:'vitrine',title:'Monte sua vitrine',text:'Apresentação, formação, modalidades e se atende presencial ou online. É o que os alunos veem na busca.',done:showcase,action:'Montar vitrine',view:'vitrine'},
  {id:'regiao',title:'Informe sua região de atendimento',text:'Alunos perto de você passam a ver você primeiro.',done:region,action:'Informar região',view:'meus-videos'},
  {id:'video',title:'Publique seu primeiro vídeo',text:'Um vídeo curto mostrando seu trabalho é a melhor apresentação para novos alunos.',done:video,action:'Enviar vídeo',view:'meus-videos'},
  {id:'aluno',title:'Aceite seu primeiro aluno',text:'Quando um aluno pedir acompanhamento, aceite em "Meus alunos" para montar treinos e agenda.',done:links.some(row=>row.state==='active'),action:'Ver meus alunos',view:'alunos'},
 ]
 return <StepList title="Seu caminho como parceiro" steps={steps} onView={onView}/>
}

// "Como funciona": pilares, benefícios e passo a passo, para cada perfil.
export function HowItWorks({owner,kind,onView}:{owner:string,kind:'aluno'|'parceiro'|'parceiro_pendente'|'admin',onView:(id:string)=>void}){
 useEffect(()=>{markTourSeen(owner)},[owner])
 const partner=kind!=='aluno'
 return <div className="space-y-5">
  <section className="rounded-[12px_30px_12px_30px] bg-[#33325a] p-6 text-[#f7f6f2]">
   <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#a5ce41]"><Compass aria-hidden="true" className="h-4 w-4"/>Como funciona</p>
   <h2 className="mt-2 text-2xl font-extrabold text-[#f7f6f2]">A 369 WELLNESS une você aos profissionais certos para cuidar do corpo e da mente.</h2>
   <p className="mt-2 text-[#d5d4e1]">Treino, nutrição, fisioterapia, psicologia e outras áreas, perto de você ou online, com tudo organizado em um só lugar.</p>
  </section>
  <section aria-label="Os 3 pilares" className="grid gap-3 md:grid-cols-3">{pillars.map(pillar=>{const Icon=pillar.icon
   return <article key={pillar.name} className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-5"><Icon aria-hidden="true" className="h-7 w-7 text-[#6a8a27]"/><h3 className="mt-2 text-xl font-extrabold">{pillar.name}</h3><p className="mt-1">{pillar.text}</p></article>})}</section>
  <section className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-5">
   <h3 className="text-xl font-extrabold">{partner?'O que a 369 faz por você, profissional':'O que a 369 faz por você'}</h3>
   <ul className="mt-2 list-disc space-y-1 pl-5">{(partner?[
    'Uma vitrine para alunos da sua região e de todo o Brasil (online).',
    'Seus vídeos no feed dos alunos que estão perto de você.',
    'Agenda, treinos e acompanhamento dos alunos no mesmo lugar.',
    'Menos tempo com organização, mais tempo atendendo.',
   ]:[
    'Encontre profissionais perto de casa ou atendimento online.',
    'Treinos, agenda e conteúdos em um só aplicativo.',
    'Vídeos gratuitos de profissionais da sua região.',
    'Veja sua evolução e mantenha a constância.',
   ]).map(item=><li key={item}>{item}</li>)}</ul>
  </section>
  <section className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-5">
   <h3 className="text-xl font-extrabold">Por onde começar</h3>
   <ol className="mt-2 list-decimal space-y-1 pl-5">{(partner?[
    'Informe sua região de atendimento.','Publique um vídeo curto apresentando seu trabalho.','Abra seus horários na agenda.','Aceite os pedidos dos alunos e monte os treinos.',
   ]:[
    'Defina seu objetivo.','Encontre um profissional ou uma modalidade.','Organize sua rotina: agenda e treinos.','Conclua os treinos e acompanhe sua evolução.',
   ]).map(item=><li key={item}>{item}</li>)}</ol>
   <Button type="button" className="mt-4" onClick={()=>onView('inicio')}>Voltar para o meu caminho</Button>
  </section>
 </div>
}

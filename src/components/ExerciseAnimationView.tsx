import React,{useEffect,useRef,useState} from 'react'
import {body,frameAt,solve,type ExerciseAnimation,type Joints} from '@/lib/exerciseAnimations'

// Desenha a animação 369 (SVG, estilo flat) de um exercício, com fase, respiração e cadência.
// "time" fixo serve para prévias estáticas; sem ele, a animação roda sozinha (e para quando a pessoa pede menos movimento).
const C={bg:'#13213a',grid:'#1c2c4a',floor:'#22334f',skin:'#e0a77d',shirt:'#2bb3a3',pants:'#34405f',hair:'#4a3328',shoe:'#eef0f3',bar:'#1b1b22',plate:'#9b3434',bench:'#55607a',accent:'#f5c451'}
const limb=(a:{x:number,y:number},b:{x:number,y:number},w:number,color:string)=><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w} strokeLinecap="round"/>

function Figure({j,ex}:{j:Joints,ex:ExerciseAnimation}){
 return <g>
  {ex.bench&&<rect x={ex.bench.x} y={ex.bench.y} width={ex.bench.w} height={ex.bench.h} rx={10} fill={C.bench}/>}
  {/* perna de trás (mais escura) e da frente */}
  {limb(j.hip,j.knee,58,C.pants)}{limb(j.knee,j.ankle,44,C.skin)}
  <line x1={j.ankle.x-12} y1={j.ankle.y+4} x2={j.toe.x} y2={j.toe.y+4} stroke={C.shoe} strokeWidth={30} strokeLinecap="round"/>
  {limb(j.hip,j.shoulder,92,C.shirt)}
  <circle cx={j.hip.x} cy={j.hip.y} r={40} fill={C.pants}/>
  {limb(j.neck,j.shoulder,26,C.skin)}
  <circle cx={j.head.x} cy={j.head.y} r={body.head} fill={C.skin}/>
  <path d={`M ${j.head.x-body.head} ${j.head.y} A ${body.head} ${body.head} 0 0 1 ${j.head.x+body.head} ${j.head.y} Z`} fill={C.hair} transform={`rotate(${Math.atan2(j.head.y-j.neck.y,j.head.x-j.neck.x)*180/Math.PI+90} ${j.head.x} ${j.head.y})`}/>
  {limb(j.shoulder,j.elbow,34,C.shirt)}{limb(j.elbow,j.wrist,28,C.skin)}
  <circle cx={j.wrist.x} cy={j.wrist.y} r={17} fill={C.skin}/>
  {ex.prop==='barra'&&<g><circle cx={j.wrist.x} cy={j.wrist.y+6} r={92} fill={C.bar} stroke={C.plate} strokeWidth={12} opacity={.92}/><circle cx={j.wrist.x} cy={j.wrist.y+6} r={14} fill="#c9c9cf"/></g>}
  {ex.prop==='halteres'&&<rect x={j.wrist.x-42} y={j.wrist.y-14} width={84} height={28} rx={10} fill={C.bar}/>}
  
 </g>
}

export default function ExerciseAnimationView({exercise,time,showText=true}:{exercise:ExerciseAnimation,time?:number,showText?:boolean}){
 const [now,setNow]=useState(0),start=useRef(0)
 useEffect(()=>{if(time!==undefined)return
  const reduce=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if(reduce){setNow(0);return}
  let id=0;start.current=performance.now()
  const tick=(t:number)=>{setNow((t-start.current)/1000);id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(id)},[time,exercise.id])
 const f=frameAt(exercise,time??now),j=solve(exercise,f.pose),phase=exercise.phases[f.phase]
 const breath=phase.breath==='inspire'?'↓ Inspire':phase.breath==='expire'?'↑ Expire':'• Mantenha a respiração'
 return <figure className="overflow-hidden rounded-[12px_30px_12px_30px] bg-[#13213a] text-white" aria-label={'Animação: '+exercise.name}>
  <svg viewBox="0 0 1000 1000" className="block w-full" role="img" aria-label={`${exercise.name}, fase: ${phase.label}`}>
   <rect width="1000" height="1000" fill={C.bg}/>
   {Array.from({length:20},(_,i)=><g key={i}><line x1={i*50} y1={0} x2={i*50} y2={1000} stroke={C.grid} strokeWidth={2}/><line x1={0} y1={i*50} x2={1000} y2={i*50} stroke={C.grid} strokeWidth={2}/></g>)}
   <rect x={0} y={880} width={1000} height={120} fill={C.floor}/>
   <ellipse cx={500} cy={884} rx={260} ry={12} fill="#0e1830" opacity={.7}/>
   <Figure j={j} ex={exercise}/>
   <text x={40} y={70} fill="#fff" fontSize={46} fontWeight={800} fontFamily="Catamaran, system-ui, sans-serif">{exercise.name.toUpperCase()}</text>
   <text x={40} y={112} fill="#9fb0cc" fontSize={28} fontFamily="Catamaran, system-ui, sans-serif">{exercise.subtitle}</text>
   <text x={40} y={950} fill={C.accent} fontSize={34} fontWeight={800} fontFamily="Catamaran, system-ui, sans-serif">{f.phase+1} · {phase.label}</text>
   <text x={960} y={950} textAnchor="end" fill="#9fdcff" fontSize={30} fontWeight={700} fontFamily="Catamaran, system-ui, sans-serif">{breath}</text>
   <rect x={0} y={994} width={1000*((exercise.phases.slice(0,f.phase).reduce((s,p)=>s+p.seconds,0)+f.progress*phase.seconds)/f.total)} height={6} fill={C.accent}/>
  </svg>
  {showText&&<figcaption className="space-y-2 bg-[#0f1a2e] p-4 text-sm text-[#e8edf5]">
   <ul className="list-disc space-y-1 pl-5">{phase.cues.map(c=><li key={c}>{c}</li>)}</ul>
   <p className="text-[#9fb0cc]">Cadência: {exercise.phases.map(p=>`${p.label} ${p.seconds}s`).join(' · ')}</p>
   <p><b className="text-[#ff9c8a]">Músculos:</b> <span className="text-[#cfd8e6]">{exercise.muscles}</span></p>
  </figcaption>}
 </figure>
}

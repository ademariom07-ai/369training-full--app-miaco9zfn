import React,{useEffect,useMemo,useRef,useState} from 'react'
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

// Quebra um texto em linhas de até "max" caracteres (para as legendas dentro do SVG).
function wrap(text:string,max:number){const lines:string[]=[];let line=''
 for(const word of text.split(' ')){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}
 if(line)lines.push(line);return lines}
const font='Catamaran, system-ui, sans-serif'
const phaseColor:Record<string,string>={inspire:'#5fb0ff',expire:'#7ad48a',mantenha:'#f5c451'}

// Formato vertical (como Shorts/Reels): cena no alto e legendas explicativas embaixo, tudo dentro da animação.
export default function ExerciseAnimationView({exercise,time,showText=true}:{exercise:ExerciseAnimation,time?:number,showText?:boolean}){
 const [now,setNow]=useState(0),[playing,setPlaying]=useState(true),[stepMode,setStepMode]=useState(false)
 const clock=useRef(0),playingRef=useRef(true),stepRef=useRef(false)
 const {total,bounds}=useMemo(()=>({total:exercise.phases.reduce((sum,p)=>sum+p.seconds,0),bounds:exercise.phases.reduce<number[]>((acc,p)=>[...acc,(acc[acc.length-1]??0)+p.seconds],[])}),[exercise])
 playingRef.current=playing;stepRef.current=stepMode
 useEffect(()=>{if(time!==undefined)return
  const reduce=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if(reduce){setPlaying(false);setStepMode(true);clock.current=(bounds[0]??0)-0.001;setNow(clock.current);return}
  let id=0,last=performance.now()
  const tick=(t:number)=>{const dt=Math.min(.1,(t-last)/1000);last=t
   if(playingRef.current){const before=clock.current%total,next=clock.current+dt,after=next%total
    // No modo "parar em cada fase", segura no fim da fase em vez de passar para a próxima.
    const crossed=bounds.find(b=>before<b&&(after>=b||after<before))
    if(stepRef.current&&crossed!==undefined){clock.current=clock.current-before+crossed-0.001;setPlaying(false)}else clock.current=next
    setNow(clock.current)}
   id=requestAnimationFrame(tick)}
  id=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(id)},[time,exercise.id,total,bounds])
 // Vai para o fim de uma fase (a posição que as dicas descrevem) e pausa.
 function goTo(index:number){const i=(index+exercise.phases.length)%exercise.phases.length;clock.current=bounds[i]-0.001;setNow(clock.current);setPlaying(false)}
 const f=frameAt(exercise,time??now),j=solve(exercise,f.pose),phase=exercise.phases[f.phase]
 const breath=phase.breath==='inspire'?'↓  Respiração: INSPIRE':phase.breath==='expire'?'↑  Respiração: EXPIRE':'•  Respiração: SEGURE'
 const elapsed=exercise.phases.slice(0,f.phase).reduce((s,p)=>s+p.seconds,0)+f.progress*phase.seconds
 const H=showText?1740:1000
 // Legendas: dicas (até 3, quebradas em linhas) e músculos.
 const cueLines=phase.cues.slice(0,3).map(c=>wrap(c,36))
 const muscleLines=wrap(exercise.muscles,52).slice(0,2)
 let y=1150
 return <figure className="overflow-hidden rounded-[12px_30px_12px_30px] bg-[#13213a] text-white" aria-label={'Animação: '+exercise.name}>
  <svg viewBox={`0 0 1000 ${H}`} className="block w-full" role="img" aria-label={`${exercise.name}. Fase ${f.phase+1}: ${phase.label}. ${phase.cues.join('. ')}. ${breath.replace(/^\W+/,'')}.`}>
   <rect width="1000" height={H} fill={C.bg}/>
   {Array.from({length:20},(_,i)=><g key={i}><line x1={i*50} y1={0} x2={i*50} y2={1000} stroke={C.grid} strokeWidth={2}/><line x1={0} y1={i*50} x2={1000} y2={i*50} stroke={C.grid} strokeWidth={2}/></g>)}
   <rect x={0} y={880} width={1000} height={120} fill={C.floor}/>
   <ellipse cx={500} cy={884} rx={260} ry={12} fill="#0e1830" opacity={.7}/>
   <g transform="translate(500 884) scale(.86) translate(-500 -884)"><Figure j={j} ex={exercise}/></g>
   <text x={40} y={70} fill="#fff" fontSize={46} fontWeight={800} fontFamily={font}>{exercise.name.toUpperCase()}</text>
   <text x={40} y={112} fill="#9fb0cc" fontSize={28} fontFamily={font}>{exercise.subtitle}</text>
   {!showText&&<><text x={40} y={950} fill={C.accent} fontSize={34} fontWeight={800} fontFamily={font}>{f.phase+1} · {phase.label}</text>
    <text x={960} y={950} textAnchor="end" fill="#9fdcff" fontSize={30} fontWeight={700} fontFamily={font}>{breath}</text></>}
   {showText&&<g>
    <rect x={0} y={1000} width={1000} height={740} fill="#0e1830"/>
    <rect x={40} y={1030} width={920} height={680} rx={28} fill="#111c33" stroke="#22314f" strokeWidth={2}/>
    <text x={920} y={1085} textAnchor="end" fill="#9fb0cc" fontSize={26} fontWeight={700} fontFamily={font}>FASE {f.phase+1}/{exercise.phases.length}</text>
    <text x={80} y={1110} fill={phaseColor[phase.breath]} fontSize={52} fontWeight={800} fontFamily={font}>{f.phase+1} · {phase.label}</text>
    {cueLines.map((lines,i)=>{const top=y+=i===0?0:0;const block=<g key={i}>
      <circle cx={92} cy={top-10} r={8} fill={C.accent}/>
      {lines.map((l,k)=><text key={k} x={115} y={top+k*40} fill="#e8edf5" fontSize={34} fontFamily={font}>{l}</text>)}</g>
     y=top+lines.length*40+14;return block})}
    <rect x={80} y={1420} width={640} height={62} rx={14} fill="#1c2c4a"/>
    <text x={104} y={1462} fill="#9fdcff" fontSize={32} fontWeight={800} fontFamily={font}>{breath}</text>
    <text x={80} y={1530} fill="#9fb0cc" fontSize={24} fontWeight={800} fontFamily={font}>CADÊNCIA ({f.total.toFixed(1).replace('.',',').replace(',0','')} s por repetição)</text>
    {(()=>{let x=80;const w=840;return exercise.phases.map((p,i)=>{const pw=w*p.seconds/f.total,el=<g key={i}>
      <rect x={x+2} y={1545} width={Math.max(pw-4,4)} height={44} rx={6} fill={i===f.phase?phaseColor[p.breath]:'#22314f'} opacity={i===f.phase?1:.9}/>
      {(()=>{const secs=String(p.seconds).replace('.',',')+'s',full=`${p.label} ${secs}`,label=pw>full.length*12.5+20?full:pw>secs.length*12.5+16?secs:'';return label&&<text x={x+12} y={1576} fill={i===f.phase?'#0e1830':'#cfd8e6'} fontSize={22} fontWeight={800} fontFamily={font}>{label}</text>})()}</g>;x+=pw;return el})})()}
    <rect x={80+840*elapsed/f.total-3} y={1538} width={6} height={58} rx={3} fill="#fff"/>
    <text x={80} y={1632} fill="#ff9c8a" fontSize={26} fontWeight={800} fontFamily={font}>MÚSCULOS PRINCIPAIS</text>
    {muscleLines.map((l,k)=><text key={k} x={80} y={1666+k*0} dy={k*30} fill="#cfd8e6" fontSize={24} fontFamily={font}>{l}</text>)}
   </g>}
   <rect x={0} y={H-6} width={1000*elapsed/f.total} height={6} fill={C.accent}/>
  </svg>
  {time===undefined&&<div className="flex flex-wrap items-center justify-center gap-2 bg-[#0e1830] p-3" role="group" aria-label="Controles da animação">
   <button type="button" onClick={()=>goTo(f.phase-1)} className="min-h-11 rounded-[10px_22px_10px_22px] bg-[#1c2c4a] px-3 text-sm font-bold !text-white">◀ Fase anterior</button>
   <button type="button" onClick={()=>setPlaying(p=>!p)} aria-pressed={!playing} className="min-h-11 min-w-28 rounded-[10px_22px_10px_22px] bg-[#a5ce41] px-4 text-sm font-extrabold text-[#33325a]">{playing?'❚❚ Pausar':'▶ Continuar'}</button>
   <button type="button" onClick={()=>goTo(f.phase+1)} className="min-h-11 rounded-[10px_22px_10px_22px] bg-[#1c2c4a] px-3 text-sm font-bold !text-white">Próxima fase ▶</button>
   <label className="flex min-h-11 items-center gap-2 px-2 text-sm text-[#cfd8e6]"><input type="checkbox" checked={stepMode} onChange={e=>setStepMode(e.target.checked)} className="h-5 w-5 accent-[#a5ce41]"/>Parar em cada fase</label>
  </div>}
 </figure>
}

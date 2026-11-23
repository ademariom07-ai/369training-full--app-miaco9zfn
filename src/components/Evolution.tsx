import React,{useEffect,useMemo,useState} from 'react'
import {Bar,BarChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis,ReferenceArea} from 'recharts'
import {listRoutineSessions,type Session} from '@/lib/supabase/routines'
import {effortSeries,evolutionHighlights,exercisesWithLoad,loadSeries,weeklySeries} from '@/lib/evolution'

const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const navy='#33325a',lime='#7fa52a',grid='#eeedf4'
const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback

// Gráficos de evolução feitos com os treinos registrados (últimos 60 dias).
export function EvolutionCharts({sessions}:{sessions:Session[]}){
 const exercises=useMemo(()=>exercisesWithLoad(sessions),[sessions])
 const [exercise,setExercise]=useState('')
 const active=exercises.includes(exercise)?exercise:exercises[0]??''
 const load=useMemo(()=>active?loadSeries(sessions,active):[],[sessions,active])
 const effort=useMemo(()=>effortSeries(sessions),[sessions]),weekly=useMemo(()=>weeklySeries(sessions),[sessions])
 const highlights=useMemo(()=>evolutionHighlights(sessions),[sessions])
 if(!sessions.length)return <p className={card}>Ainda não há treinos registrados. Depois de treinar, toque em "Concluí todos os exercícios" ou "Registrar com detalhes": a evolução aparece aqui.</p>
 return <div className="space-y-4">
  {highlights.length>0&&<div className={card}><h4 className="font-extrabold">Resumo</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{highlights.map(h=><li key={h}>{h}</li>)}</ul></div>}
  <section className={card} aria-label="Treinos por semana">
   <h4 className="font-extrabold">Treinos por semana</h4>
   <div className="mt-2 h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekly} margin={{top:8,right:8,left:-20,bottom:0}}>
    <CartesianGrid stroke={grid} vertical={false}/><XAxis dataKey="label" tick={{fontSize:12}}/><YAxis allowDecimals={false} tick={{fontSize:12}}/>
    <Tooltip formatter={(v)=>[`${v} treino(s)`,'Semana']} labelFormatter={l=>`Semana de ${l}`}/><Bar dataKey="treinos" fill={navy} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>
  </section>
  <section className={card} aria-label="Evolução de carga">
   <div className="flex flex-wrap items-end justify-between gap-2"><h4 className="font-extrabold">Evolução de carga</h4>
    {exercises.length>0&&<label className="text-sm font-semibold">Exercício <select className="ml-1 rounded-md border p-1" value={active} onChange={e=>setExercise(e.target.value)}>{exercises.map(n=><option key={n}>{n}</option>)}</select></label>}</div>
   {load.length?<div className="mt-2 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={load} margin={{top:8,right:12,left:-16,bottom:0}}>
    <CartesianGrid stroke={grid}/><XAxis dataKey="label" tick={{fontSize:12}}/><YAxis unit=" kg" tick={{fontSize:12}} domain={['dataMin - 2','dataMax + 2']}/>
    <Tooltip formatter={(v)=>[`${v} kg`,'Carga']}/><Line type="monotone" dataKey="kg" stroke={lime} strokeWidth={3} dot={{r:4,fill:lime}}/></LineChart></ResponsiveContainer></div>
   :<p className="mt-2 text-sm text-[#626274]">Registre a carga usada (ex.: "12 kg") em "Registrar com detalhes" para ver a evolução.</p>}
  </section>
  <section className={card} aria-label="Esforço por treino">
   <h4 className="font-extrabold">Esforço por treino (1 a 10)</h4>
   {effort.length?<><div className="mt-2 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={effort} margin={{top:8,right:12,left:-20,bottom:0}}>
    <ReferenceArea y1={6} y2={8} fill="#a5ce41" fillOpacity={0.15}/>
    <CartesianGrid stroke={grid}/><XAxis dataKey="label" tick={{fontSize:12}}/><YAxis domain={[0,10]} ticks={[0,2,4,6,8,10]} tick={{fontSize:12}}/>
    <Tooltip formatter={(v)=>[`${v}/10`,'Esforço']}/><Line type="monotone" dataKey="effort" stroke={navy} strokeWidth={3} dot={({cx,cy,payload,index})=><circle key={index} cx={cx} cy={cy} r={payload.pain?6:4} fill={payload.pain===2?'#b42318':payload.pain===1?'#d97706':navy}/>}/></LineChart></ResponsiveContainer></div>
    <p className="text-xs text-[#626274]">Faixa verde (6 a 8): esforço ideal para evoluir. Pontos laranja/vermelhos: treinos com dor.</p></>
   :<p className="mt-2 text-sm text-[#626274]">Informe o esforço ao registrar o treino para ver este gráfico.</p>}
  </section>
 </div>
}

// Carrega os registros (aluno: os próprios; profissional: do aluno escolhido) e mostra os gráficos.
export default function Evolution({student,owner}:{student:string|null,owner:string}){
 const [rows,setRows]=useState<Session[]|null>(null),[error,setError]=useState('')
 useEffect(()=>{let live=true;setRows(null);setError('');listRoutineSessions(student).then(r=>{if(live)setRows(r)}).catch(err=>{if(live)setError(errorText(err,'Não foi possível carregar a evolução.'))});return()=>{live=false}},[student,owner])
 if(error)return <p role="alert">{error}</p>
 if(!rows)return <p role="status">Carregando evolução…</p>
 return <EvolutionCharts sessions={rows}/>
}

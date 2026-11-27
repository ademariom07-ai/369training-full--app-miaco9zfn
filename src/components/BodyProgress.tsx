import React,{useCallback,useEffect,useMemo,useState} from 'react'
import {Camera,Ruler,Trash2} from 'lucide-react'
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {bmi,bmiLabel,deleteAssessment,deleteProgressPhoto,latestHeight,listAssessments,listProgressPhotos,measureFields,photoSharingStatus,poseLabels,poses,progressPhotoUrl,
 saveAssessment,setPhotoSharing,uploadProgressPhoto,whr,type Assessment,type MeasureKey,type ProgressPhoto} from '@/lib/supabase/body'
import {todayInfo} from '@/lib/supabase/routines'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const br=(iso:string)=>{const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`}
const short=(iso:string)=>{const [,m,d]=iso.split('-');return `${d}/${m}`}
const num=(n:number|null|undefined,unit:string)=>n===null||n===undefined?'—':`${String(n).replace('.',',')} ${unit}`

function AssessmentForm({student,initial,onDone}:{student:string,initial?:Assessment,onDone:()=>void}){
 const [date,setDate]=useState(initial?.measured_on??todayInfo().iso),[notes,setNotes]=useState(initial?.notes??''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [values,setValues]=useState<Partial<Record<MeasureKey,string>>>(()=>{const o:Partial<Record<MeasureKey,string>>={};if(initial)for(const [k] of measureFields)if(initial[k]!==null)o[k]=String(initial[k]).replace('.',',');return o})
 const w=Number((values.weight_kg??'').replace(',','.'))||null,h=Number((values.height_cm??'').replace(',','.'))||null,imc=bmi(w,h)
 async function save(){setBusy(true);setError('');try{await saveAssessment({id:initial?.assessment_id??null,student,date,values,notes});onDone()}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 return <form className={card+' space-y-3 border-[#a5ce41]'} onSubmit={e=>{e.preventDefault();void save()}}>
  <h4 className="font-extrabold">{initial?'Editar avaliação':'Nova avaliação'}</h4>
  <label className="block max-w-xs text-sm font-semibold">Data<Input type="date" max={todayInfo().iso} value={date} onChange={e=>setDate(e.target.value)}/></label>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{measureFields.map(([k,label,unit])=><label key={k} className="text-sm font-semibold">{label} ({unit})<Input inputMode="decimal" value={values[k]??''} onChange={e=>setValues(v=>({...v,[k]:e.target.value}))}/></label>)}</div>
  {imc&&<p className="text-sm">IMC: <b>{String(imc).replace('.',',')}</b> ({bmiLabel(imc)})</p>}
  <p className="text-xs text-[#626274]">Preencha só o que tiver. Circunferências em centímetros, com fita métrica, sempre no mesmo ponto do corpo.</p>
  <label className="block text-sm font-semibold">Observações (opcional)<Input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: bioimpedância, em jejum"/></label>
  {error&&<p role="alert" className="text-sm">{error}</p>}
  <div className="flex gap-2"><Button type="submit" disabled={busy}>Salvar</Button><Button type="button" variant="outline" onClick={onDone}>Cancelar</Button></div>
 </form>
}

function MeasureCharts({rows}:{rows:Assessment[]}){
 const asc=useMemo(()=>[...rows].reverse(),[rows])
 const series=[['weight_kg','Peso (kg)','#33325a'],['body_fat_pct','Gordura (%)','#d97706'],['waist_cm','Cintura (cm)','#7fa52a']] as const
 const shown=series.filter(([k])=>asc.filter(r=>r[k]!==null).length>=2)
 if(!shown.length)return <p className="text-sm text-[#626274]">Com duas avaliações ou mais, aparecem os gráficos de evolução.</p>
 return <div className="grid gap-3 md:grid-cols-2">{shown.map(([k,label,color])=>{const data=asc.filter(r=>r[k]!==null).map(r=>({label:short(r.measured_on),v:r[k]}))
  const first=data[0].v as number,last=data[data.length-1].v as number,diff=Math.round((last-first)*10)/10
  return <section key={k} className={card} aria-label={label}><p className="font-extrabold">{label} <span className="text-sm font-normal text-[#626274]">{diff===0?'sem mudança':`${diff>0?'+':''}${String(diff).replace('.',',')} desde ${data[0].label}`}</span></p>
   <div className="mt-2 h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:8,right:12,left:-16,bottom:0}}><CartesianGrid stroke="#eeedf4"/><XAxis dataKey="label" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}} domain={['dataMin - 2','dataMax + 2']}/><Tooltip/><Line type="monotone" dataKey="v" name={label} stroke={color} strokeWidth={3} dot={{r:4,fill:color}}/></LineChart></ResponsiveContainer></div></section>})}</div>
}

export function Measurements({student,owner,canAdd=true}:{student:string,owner:string,canAdd?:boolean}){
 const [rows,setRows]=useState<Assessment[]|null>(null),[editing,setEditing]=useState<Assessment|'nova'|null>(null),[error,setError]=useState('')
 const load=useCallback(()=>{listAssessments(student).then(setRows).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setRows([])})},[student])
 useEffect(()=>{load()},[load,owner])
 const height=rows?latestHeight(rows):null,last=rows?.[0]
 return <section className="space-y-3" aria-label="Medidas">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-lg font-extrabold"><Ruler aria-hidden="true" className="h-5 w-5"/>Medidas</h3>
   {canAdd&&!editing&&<Button type="button" onClick={()=>setEditing('nova')}>Nova avaliação</Button>}</div>
  {editing&&<AssessmentForm student={student} initial={editing==='nova'?undefined:editing} onDone={()=>{setEditing(null);load()}}/>}
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:!rows.length?<p className={card}>Nenhuma avaliação ainda. Registre peso e medidas para acompanhar sua evolução além da balança.</p>:<>
   {last&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Peso',num(last.weight_kg,'kg')],['IMC',(()=>{const v=bmi(last.weight_kg,last.height_cm??height);return v?`${String(v).replace('.',',')} · ${bmiLabel(v)}`:'—'})()],['Gordura',num(last.body_fat_pct,'%')],['Cintura/quadril',(()=>{const v=whr(last.waist_cm,last.hip_cm);return v?String(v).replace('.',','):'—'})()]].map(([l,v])=><div key={l} className={card+' p-3'}><p className="text-xs text-[#626274]">{l}</p><p className="font-extrabold">{v}</p></div>)}</div>}
   <MeasureCharts rows={rows}/>
   <details className={card}><summary className="min-h-11 cursor-pointer py-2 font-bold">Histórico ({rows.length})</summary>
    <ul className="mt-2 space-y-2">{rows.map(r=><li key={r.assessment_id} className="rounded-md border border-[#eeedf4] p-3 text-sm">
     <p className="font-bold">{br(r.measured_on)} · {r.author_name}</p>
     <p>{measureFields.filter(([k])=>r[k]!==null).map(([k,l,u])=>`${l} ${num(r[k],u)}`).join(' · ')}</p>{r.notes&&<p className="text-[#626274]">{r.notes}</p>}
     {r.mine&&<div className="mt-1 flex gap-2"><Button type="button" variant="outline" onClick={()=>setEditing(r)}>Editar</Button><Button type="button" variant="outline" onClick={()=>{if(window.confirm('Apagar esta avaliação?'))void deleteAssessment(r.assessment_id).then(load).catch(err=>setError(errorText(err,'Não foi possível apagar.')))}}>Apagar</Button></div>}
    </li>)}</ul></details>
  </>}
 </section>
}

function PhotoImg({path,alt}:{path:string,alt:string}){
 const [url,setUrl]=useState('')
 useEffect(()=>{let live=true,made='';progressPhotoUrl(path).then(u=>{made=u;if(live)setUrl(u)}).catch(()=>{});return()=>{live=false;if(made)URL.revokeObjectURL(made)}},[path])
 return url?<img src={url} alt={alt} className="aspect-[3/4] w-full rounded-md border object-cover"/>:<div className="aspect-[3/4] w-full animate-pulse rounded-md bg-[#eeedf4]" role="status" aria-label="Carregando foto"/>
}
function Compare({photos}:{photos:ProgressPhoto[]}){
 const dates=[...new Set(photos.map(p=>p.taken_on))].sort()
 const [a,setA]=useState(dates[0]),[b,setB]=useState(dates[dates.length-1])
 if(dates.length<2)return null
 return <section className={card+' space-y-2'} aria-label="Comparar fotos"><h4 className="font-extrabold">Comparar</h4>
  <div className="flex flex-wrap gap-2 text-sm">{[[a,setA,'Antes'],[b,setB,'Depois']].map(([v,set,l])=><label key={l as string} className="font-semibold">{l as string}<select className="ml-1 rounded-md border p-1" value={v as string} onChange={e=>(set as (x:string)=>void)(e.target.value)}>{dates.map(d=><option key={d} value={d}>{br(d)}</option>)}</select></label>)}</div>
  {poses.map(pose=>{const pa=photos.find(p=>p.taken_on===a&&p.pose===pose),pb=photos.find(p=>p.taken_on===b&&p.pose===pose);if(!pa&&!pb)return null
   return <div key={pose}><p className="text-sm font-bold">{poseLabels[pose]}</p><div className="grid grid-cols-2 gap-2">{[pa,pb].map((p,i)=>p?<PhotoImg key={i} path={p.path} alt={`${poseLabels[pose]} em ${br(p.taken_on)}`}/>:<p key={i} className="text-sm text-[#626274]">Sem foto</p>)}</div></div>})}
 </section>
}
export function ProgressPhotos({student,owner,isOwner}:{student:string,owner:string,isOwner:boolean}){
 const [photos,setPhotos]=useState<ProgressPhoto[]|null>(null),[shared,setShared]=useState(false),[date,setDate]=useState(todayInfo().iso),[busy,setBusy]=useState(''),[error,setError]=useState('')
 const load=useCallback(()=>{listProgressPhotos(student).then(setPhotos).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setPhotos([])});photoSharingStatus(student).then(setShared).catch(()=>{})},[student])
 useEffect(()=>{load()},[load,owner])
 async function up(pose:typeof poses[number],file?:File){if(!file)return;setBusy(pose);setError('');try{await uploadProgressPhoto(owner,date,pose,file);load()}catch(err){setError(errorText(err,'Não foi possível enviar.'))}finally{setBusy('')}}
 async function toggleShare(v:boolean){setError('');try{await setPhotoSharing(v);setShared(v)}catch(err){setError(errorText(err,'Não foi possível salvar.'))}}
 const dates=[...new Set((photos??[]).map(p=>p.taken_on))]
 return <section className="space-y-3" aria-label="Fotos de evolução">
  <h3 className="flex items-center gap-2 text-lg font-extrabold"><Camera aria-hidden="true" className="h-5 w-5"/>Fotos de evolução</h3>
  {isOwner?<>
   <p className="text-sm text-[#626274]">As fotos ficam em área privada. Só você vê, a não ser que você compartilhe com seu profissional. Dica: mesma luz, mesmo lugar, roupa justa, de corpo inteiro.</p>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={shared} onChange={e=>void toggleShare(e.target.checked)}/><span><b>Compartilhar minhas fotos com meu profissional</b> (você pode desligar quando quiser).</span></label>
   <div className={card+' space-y-2'}><label className="block max-w-xs text-sm font-semibold">Data das fotos<Input type="date" max={todayInfo().iso} value={date} onChange={e=>setDate(e.target.value)}/></label>
    <div className="flex flex-wrap gap-2">{poses.map(p=><label key={p} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold"><Camera aria-hidden="true" className="h-4 w-4"/>{busy===p?'Enviando…':poseLabels[p]}
     <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={!!busy} onChange={e=>void up(p,e.target.files?.[0])}/></label>)}</div></div>
  </>:<p className="text-sm text-[#626274]">{shared?'O aluno compartilhou as fotos com você.':'O aluno ainda não compartilhou as fotos com você.'}</p>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
  {!photos?<p role="status">Carregando…</p>:!photos.length?(isOwner?<p className="text-sm">Nenhuma foto ainda.</p>:null):<>
   <Compare key={dates.join()} photos={photos}/>
   <details className={card}><summary className="min-h-11 cursor-pointer py-2 font-bold">Todas as fotos ({photos.length})</summary>
    <div className="mt-2 space-y-3">{dates.map(d=><div key={d}><p className="text-sm font-bold">{br(d)}</p><div className="grid grid-cols-3 gap-2">{poses.map(pose=>{const p=photos.find(x=>x.taken_on===d&&x.pose===pose)
     return p?<div key={pose} className="space-y-1"><PhotoImg path={p.path} alt={`${poseLabels[pose]} em ${br(d)}`}/>{isOwner&&<button type="button" className="inline-flex items-center gap-1 text-xs underline" onClick={()=>{if(window.confirm('Apagar esta foto?'))void deleteProgressPhoto(p.photo_id).then(load).catch(err=>setError(errorText(err,'Não foi possível apagar.')))}}><Trash2 aria-hidden="true" className="h-3 w-3"/>Apagar</button>}</div>:<div key={pose}/>})}</div></div>)}</div></details>
  </>}
 </section>
}

// Aluno: "Medidas e fotos".
export default function StudentBody({owner}:{owner:string}){
 return <section className="space-y-6" aria-label="Medidas e fotos">
  <div><h2 className="text-xl font-extrabold">Medidas e fotos</h2><p className="text-sm text-[#626274]">Acompanhe sua evolução além da balança: medidas, gordura corporal e fotos de antes e depois. Seu profissional também pode registrar suas avaliações.</p></div>
  <Measurements student={owner} owner={owner}/>
  <ProgressPhotos student={owner} owner={owner} isOwner/>
 </section>
}
// Profissional: avaliação física do aluno escolhido.
export function ProBody({student,owner}:{student:string,owner:string}){
 return <div className="space-y-6"><Measurements student={student} owner={owner}/><ProgressPhotos student={student} owner={owner} isOwner={false}/></div>
}

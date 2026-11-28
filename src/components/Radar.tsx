import React,{useCallback,useEffect,useState} from 'react'
import {ExternalLink,FlaskConical,Lightbulb,Megaphone,RefreshCw,Stethoscope} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {evidenceLabels,hideRadar,listRadar,radarMySpecialty,radarSpecialties,refreshRadar,safeUrl,saveRadarNote,type RadarItem,type RadarSpecialty} from '@/lib/supabase/radar'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const strengthColor={forte:'bg-[#eef6dc] text-[#4d6b14]',moderada:'bg-sky-50 text-sky-800',inicial:'bg-[#f7f6f2] text-[#626274]'}

function RadarCard({item,admin,onChanged}:{item:RadarItem,admin:boolean,onChanged:()=>void}){
 const ev=item.evidence?evidenceLabels[item.evidence]:null,url=safeUrl(item.url)
 return <article className={card+' space-y-2'+(item.hidden?' opacity-60':'')}>
  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
   {item.kind==='nota'?<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900"><Megaphone aria-hidden="true" className="h-3.5 w-3.5"/>Nota da equipe 369</span>
    :ev&&<span className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 '+strengthColor[ev.strength]}><FlaskConical aria-hidden="true" className="h-3.5 w-3.5"/>{ev.label} · evidência {ev.strength}</span>}
   <span className="text-[#626274]">{radarSpecialties[item.specialty as RadarSpecialty]??'Todas as áreas'}</span>{item.hidden&&<span>OCULTO</span>}</div>
  <h3 className="text-lg font-extrabold">{item.title}</h3>
  {item.kind==='estudo'&&<p className="text-xs text-[#626274]">{[item.journal,item.pub_year].filter(Boolean).join(' · ')}{item.title_original&&<span className="block italic">“{item.title_original}”</span>}</p>}
  <p className="whitespace-pre-line text-sm">{item.summary}</p>
  {item.practice&&<p className="rounded-md bg-[#f4f9e8] p-2 text-sm"><Stethoscope aria-hidden="true" className="mr-1 inline h-4 w-4"/><b>Na prática:</b> {item.practice}</p>}
  {item.content_idea&&<p className="rounded-md bg-[#f7f6f2] p-2 text-sm"><Lightbulb aria-hidden="true" className="mr-1 inline h-4 w-4"/><b>Ideia de conteúdo:</b> {item.content_idea}</p>}
  <div className="flex flex-wrap items-center gap-2">{url&&<a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline">{item.kind==='estudo'?'Ver estudo original (PubMed)':'Abrir link'}<ExternalLink aria-hidden="true" className="h-4 w-4"/></a>}
   {admin&&<Button type="button" variant="outline" onClick={()=>void hideRadar(item.item_id,!item.hidden).then(onChanged).catch(()=>{})}>{item.hidden?'Mostrar':'Ocultar'}</Button>}</div>
 </article>
}

function NoteForm({onDone}:{onDone:()=>void}){
 const [f,setF]=useState({specialty:'todas' as RadarSpecialty|'todas',title:'',body:'',url:''}),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function save(){setBusy(true);setError('');try{await saveRadarNote(f);onDone()}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 return <form className={card+' space-y-2 border-[#a5ce41]'} onSubmit={e=>{e.preventDefault();void save()}}>
  <h3 className="font-extrabold">Nova nota (ex.: resolução de conselho)</h3>
  <label className="block text-sm font-semibold">Área<select className="mt-1 block w-full rounded-md border p-2 text-sm" value={f.specialty} onChange={e=>setF({...f,specialty:e.target.value as RadarSpecialty|'todas'})}><option value="todas">Todas</option>{Object.entries(radarSpecialties).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label className="block text-sm font-semibold">Título<Input maxLength={150} value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label>
  <label className="block text-sm font-semibold">Texto<textarea className="mt-1 block w-full rounded-md border p-2 text-sm" rows={3} maxLength={1500} value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></label>
  <label className="block text-sm font-semibold">Link (opcional, https://)<Input maxLength={500} value={f.url} onChange={e=>setF({...f,url:e.target.value})}/></label>
  {error&&<p role="alert" className="text-sm">{error}</p>}
  <div className="flex gap-2"><Button type="submit" disabled={busy}>Publicar nota</Button><Button type="button" variant="outline" onClick={onDone}>Cancelar</Button></div>
 </form>
}

// Parceiro e admin: "Radar 369".
export default function Radar({owner,admin=false}:{owner:string,admin?:boolean}){
 const [spec,setSpec]=useState<RadarSpecialty|null|undefined>(undefined),[rows,setRows]=useState<RadarItem[]|null>(null),[error,setError]=useState(''),[note,setNote]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{if(admin){setSpec(null);return}radarMySpecialty().then(s=>setSpec(s??null)).catch(()=>setSpec(null))},[admin,owner])
 const load=useCallback(()=>{if(spec===undefined)return;setRows(null);listRadar(spec).then(setRows).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setRows([])})},[spec])
 useEffect(()=>{load()},[load])
 async function refresh(){setBusy(true);setError('');setNotice('');try{const r=await refreshRadar();const total=Object.values(r).filter((v):v is number=>typeof v==='number').reduce((a,b)=>a+b,0);setNotice(`Atualizado: ${total} estudo(s) novo(s).`);load()}catch(err){setError(errorText(err,'Não foi possível atualizar.'))}finally{setBusy(false)}}
 return <section className="space-y-4" aria-label="Radar 369">
  <div><h2 className="flex items-center gap-2 text-xl font-extrabold"><FlaskConical aria-hidden="true" className="h-5 w-5"/>Radar 369</h2>
   <p className="text-sm text-[#626274]">Estudos científicos recentes da sua área, resumidos em português toda semana, com o que muda na prática e ideias de conteúdo. Fonte: PubMed. Os resumos são feitos por IA a partir do resumo do artigo — confira o estudo original antes de aplicar.</p></div>
  <div className="flex flex-wrap gap-2"><Button type="button" variant={spec===null?'default':'outline'} onClick={()=>setSpec(null)}>Todas</Button>
   {(Object.keys(radarSpecialties) as RadarSpecialty[]).map(k=><Button key={k} type="button" variant={spec===k?'default':'outline'} onClick={()=>setSpec(k)}>{radarSpecialties[k]}</Button>)}</div>
  {admin&&<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>void refresh()}><RefreshCw aria-hidden="true" className={'mr-1 h-4 w-4'+(busy?' animate-spin':'')}/>{busy?'Buscando estudos… (até 2 min)':'Atualizar agora'}</Button>
   {!note&&<Button type="button" variant="outline" onClick={()=>setNote(true)}><Megaphone aria-hidden="true" className="mr-1 h-4 w-4"/>Nova nota</Button>}</div>}
  {note&&<NoteForm onDone={()=>{setNote(false);load()}}/>}
  {notice&&<p role="status" className={card+' border-[#a5ce41]'}>{notice}</p>}{error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:!rows.length?<p className={card}>O Radar é atualizado toda semana (domingo à noite). Os primeiros estudos aparecem aqui depois da primeira atualização.</p>
   :<div className="grid gap-3 lg:grid-cols-2">{rows.map(r=><RadarCard key={r.item_id} item={r} admin={admin} onChanged={load}/>)}</div>}
 </section>
}

import {VerifiedBadge} from '@/components/Verification'
import {verifiedPartners} from '@/lib/supabase/verification'
import {RatingBadge,RatingLine,ReviewList} from '@/components/Reviews'
import {reviewSummaries,type ReviewSummary} from '@/lib/supabase/reviews'
import React,{useCallback,useEffect,useRef,useState} from 'react'
import {ArrowLeft,LocateFixed,MapPin,MessageCircle,Monitor} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {YoutubePlayer} from '@/components/VideoFeed'
import {modalities,modeLabels,readMyShowcase,readShowcase,saveMyShowcase,searchProfessionals,type Modality,type Mode,type SearchResult,type Showcase,type ShowcaseDetail} from '@/lib/supabase/showcase'
import type {Coordinates} from '@/lib/supabase/videoFeed'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join('')
const place=(r:{neighborhood:string|null,city:string|null,uf:string|null})=>[r.neighborhood,r.city&&r.uf?`${r.city}/${r.uf}`:r.city].filter(Boolean).join(', ')
function distanceText(r:SearchResult){
 if(r.distance_km!==null)return r.distance_km<=1?'a menos de 1 km':`a cerca de ${r.distance_km} km`
 return r.proximity==='bairro'?'no seu bairro':r.proximity==='cidade'?'na sua cidade':r.proximity==='estado'?'no seu estado':''
}
function locate():Promise<Coordinates>{return new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(Error('Este aparelho não oferece localização.'));return}
 navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),e=>reject(Error(e.code===1?'Permissão de localização negada. Usamos a região salva.':'Não foi possível obter a localização.')),{enableHighAccuracy:false,timeout:15000,maximumAge:600000})})}

function Chip({active,onClick,children}:{active:boolean,onClick:()=>void,children:React.ReactNode}){
 return <button type="button" aria-pressed={active} onClick={onClick} className={'min-h-11 shrink-0 rounded-[10px_22px_10px_22px] border px-3 text-sm font-semibold '+(active?'border-[#a5ce41] bg-[#a5ce41] text-[#33325a]':'border-[#dddee4] bg-white text-[#33325a] hover:border-[#a5ce41]')}>{children}</button>
}

// Busca do aluno: modalidade + perto de mim / online, com cartões que abrem a vitrine.
export function ProfessionalSearch({owner,disabled,canRequest,onRequest,onChat}:{owner:string,disabled:boolean,canRequest:boolean,onRequest:(id:string)=>Promise<void>,onChat:(id:string)=>void}){
 const [modality,setModality]=useState<Modality|null>(null),[mode,setMode]=useState<Mode|null>(null),[coords,setCoords]=useState<Coordinates|null>(null)
 const [rows,setRows]=useState<SearchResult[]>([]),[page,setPage]=useState(1),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const [open,setOpen]=useState<string|null>(null),[ratings,setRatings]=useState<Record<string,ReviewSummary>>({}),[verified,setVerified]=useState<Set<string>>(new Set())
 useEffect(()=>{const ids=rows.map(r=>r.professional_id);if(ids.length)verifiedPartners(ids).then(v=>setVerified(x=>new Set([...x,...v]))).catch(()=>{})},[rows])
 const ticket=useRef(0)
 useEffect(()=>{const ids=rows.map(r=>r.professional_id).filter(id=>!(id in ratings));if(ids.length)reviewSummaries(ids).then(r=>setRatings(x=>({...x,...Object.fromEntries(ids.map(id=>[id,r[id]??{user_id:id,average:null,counted:0,total:0,dropped:0}]))}))).catch(()=>{})
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[rows])
 const load=useCallback(async(next:number)=>{const mine=++ticket.current;setLoading(true);setError('')
  try{const found=await searchProfessionals({modality,mode,coords},next);if(mine!==ticket.current)return;setRows(prev=>next===1?found:[...prev,...found]);setPage(next);setMore(found.length===12)}
  catch(err){if(mine===ticket.current)setError(errorText(err,'Não foi possível buscar.'))}finally{if(mine===ticket.current)setLoading(false)}},[modality,mode,coords])
 useEffect(()=>{void load(1)},[load,owner])
 if(open)return <ShowcaseView professionalId={open} disabled={disabled} canRequest={canRequest} onBack={()=>{setOpen(null);void load(1)}} onRequest={onRequest} onChat={onChat}/>
 return <section aria-label="Encontrar profissionais" className="space-y-4">
  <div><h2 className="text-xl font-extrabold">Encontre seu profissional</h2><p className="text-sm text-[#626274]">Escolha a modalidade e veja quem atende perto de você ou online.</p></div>
  <div className="flex gap-2 overflow-x-auto pb-1"><Chip active={modality===null} onClick={()=>setModality(null)}>Todas</Chip>{(Object.keys(modalities) as Modality[]).map(m=><Chip key={m} active={modality===m} onClick={()=>setModality(m)}>{modalities[m]}</Chip>)}</div>
  <div className="flex flex-wrap gap-2">
   <Chip active={mode===null&&!coords} onClick={()=>{setMode(null);setCoords(null)}}>Perto da minha região</Chip>
   <Chip active={!!coords} onClick={()=>{setMode('presencial');locate().then(setCoords).catch(err=>setError(errorText(err,'')))}}><LocateFixed aria-hidden="true" className="mr-1 inline h-4 w-4"/>Perto de mim agora</Chip>
   <Chip active={mode==='online'} onClick={()=>{setMode('online');setCoords(null)}}><Monitor aria-hidden="true" className="mr-1 inline h-4 w-4"/>Online</Chip>
  </div>
  {error&&<p role="alert">{error}</p>}
  {!loading&&!rows.length&&!error&&<p className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4">Nenhum profissional encontrado com esses filtros. Tente "Todas" ou "Online".</p>}
  <ul className="grid gap-3 md:grid-cols-2">{rows.map(r=><li key={r.professional_id}>
   <button type="button" onClick={()=>setOpen(r.professional_id)} className="flex w-full items-start gap-3 rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4 text-left hover:border-[#a5ce41]">
    <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#33325a] font-bold text-[#a5ce41]">{initials(r.display_name)}</span>
    <span className="min-w-0"><span className="block font-bold">{r.display_name}</span>{verified.has(r.professional_id)&&<span className="block"><VerifiedBadge/></span>}
     {ratings[r.professional_id]?.total?<span className="block"><RatingLine summary={ratings[r.professional_id]}/></span>:null}
     {r.headline&&<span className="block text-sm">{r.headline}</span>}
     <span className="block text-sm text-[#626274]">{r.modalities.map(m=>modalities[m]).join(' · ')}</span>
     <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-[#626274]">{place(r)&&<span><MapPin aria-hidden="true" className="inline h-3 w-3"/> {place(r)}{distanceText(r)&&' · '+distanceText(r)}</span>}<span>{r.modes.map(m=>modeLabels[m]).join(' e ')}</span>{r.video_count>0&&<span>{r.video_count} vídeo(s)</span>}</span>
     {r.link_state&&<span className="mt-1 inline-block rounded-full bg-[#f3f9e6] px-2 text-sm font-semibold">{r.link_state==='active'?'Seu profissional':'Pedido enviado'}</span>}
    </span>
   </button></li>)}</ul>
  {loading&&<p role="status">Buscando…</p>}
  {more&&!loading&&<Button type="button" variant="outline" onClick={()=>void load(page+1)}>Ver mais</Button>}
 </section>
}

// Vitrine de um profissional: apresentação, formação, modalidades, atendimento, região e vídeos.
export function ShowcaseView({professionalId,disabled,canRequest,onBack,onRequest,onChat}:{professionalId:string,disabled:boolean,canRequest:boolean,onBack:()=>void,onRequest:(id:string)=>Promise<void>,onChat:(id:string)=>void}){
 const [data,setData]=useState<ShowcaseDetail|null|undefined>(undefined),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [isVerified,setIsVerified]=useState(false)
 useEffect(()=>{verifiedPartners([professionalId]).then(v=>setIsVerified(v.has(professionalId))).catch(()=>{})},[professionalId])
 const reload=useCallback(()=>{readShowcase(professionalId).then(setData).catch(err=>{setData(null);setError(errorText(err,'Vitrine indisponível.'))})},[professionalId])
 useEffect(reload,[reload])
 async function request(){setBusy(true);setError('');try{await onRequest(professionalId);setNotice('Pedido enviado! O profissional vai receber e aceitar. Você já pode mandar uma mensagem.');reload()}catch(err){setError(errorText(err,'Não foi possível enviar o pedido.'))}finally{setBusy(false)}}
 return <article className="space-y-4">
  <Button type="button" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4"/>Voltar para a busca</Button>
  {data===undefined&&<p role="status">Carregando…</p>}
  {data===null&&<p role="alert">{error||'Este profissional não está disponível.'}</p>}
  {data&&<>
   <header className="flex flex-wrap items-center gap-4 rounded-[12px_30px_12px_30px] bg-[#33325a] p-5 text-[#f7f6f2]">
    <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-[#a5ce41] text-xl font-extrabold text-[#33325a]">{initials(data.display_name)}</span>
    <div className="min-w-0"><h2 className="text-2xl font-extrabold text-[#f7f6f2]">{data.display_name}</h2>{data.headline&&<p className="text-[#d5d4e1]">{data.headline}</p>}
     <p className="text-sm text-[#a5ce41]">{data.modalities.map(m=>modalities[m]).join(' · ')}</p>
     {isVerified&&<div className="mt-1"><VerifiedBadge/></div>}
     <div className="mt-1 rounded-md bg-white/95 px-2 py-1 text-[#33325a]"><RatingBadge user={data.professional_id} showRule/></div></div>
   </header>
   <dl className="grid gap-3 sm:grid-cols-2">
    <div className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4"><dt className="text-sm text-[#626274]">Atendimento</dt><dd className="font-semibold">{data.modes.map(m=>modeLabels[m]).join(' e ')}</dd></div>
    <div className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4"><dt className="text-sm text-[#626274]">Região</dt><dd className="font-semibold">{place(data)||'Não informada'}</dd></div>
   </dl>
   <div className="flex flex-wrap gap-2 rounded-[12px_30px_12px_30px] border border-[#a5ce41] bg-[#f3f9e6] p-3">
    {data.link_state?<><span className="flex min-h-11 items-center font-semibold">{data.link_state==='active'?'✓ Este é o seu profissional':'✓ Pedido enviado — aguardando o aceite'}</span><Button type="button" onClick={()=>onChat(data.professional_id)}><MessageCircle aria-hidden="true" className="mr-2 h-4 w-4"/>Enviar mensagem</Button></>
    :canRequest?<Button type="button" disabled={disabled||busy} onClick={()=>void request()} className="bg-[#a5ce41] text-[#33325a] hover:bg-[#b5db5d]">Quero ser acompanhado</Button>
    :<p className="text-sm">Você já tem um profissional. Para escolher outro, encerre o acompanhamento atual em "Seus profissionais".</p>}
   </div>
   {[['Sobre',data.bio],['Formação',data.education],['Experiência',data.experience]].filter(([,v])=>v).map(([title,value])=><section key={title as string} className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4"><h3 className="font-extrabold">{title}</h3><p className="mt-1 whitespace-pre-line">{value}</p></section>)}
   {!data.bio&&!data.education&&<p className="text-sm text-[#626274]">Este profissional ainda está completando a vitrine.</p>}
   {data.videos.length>0&&<section className="space-y-2"><h3 className="text-lg font-extrabold">Vídeos</h3><div className="grid gap-3 md:grid-cols-2">{data.videos.map(v=><div key={v.youtube_id} className="space-y-1"><YoutubePlayer id={v.youtube_id} title={v.title}/><p className="text-sm font-semibold">{v.title}</p></div>)}</div></section>}
   <section className="space-y-2 rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4"><h3 className="font-extrabold">Avaliações dos alunos</h3><ReviewList user={data.professional_id}/></section>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </>}
 </article>
}

// Parceiro: edita a própria vitrine.
export function MyShowcase({owner,disabled}:{owner:string,disabled:boolean}){
 const empty:Showcase={headline:'',bio:'',education:'',experience:'',modalities:[],modes:['presencial']}
 const [form,setForm]=useState<Showcase>(empty),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{readMyShowcase().then(s=>{if(s)setForm(s)}).catch(()=>{}).finally(()=>setLoaded(true))},[owner])
 const set=<K extends keyof Showcase>(k:K,v:Showcase[K])=>setForm(f=>({...f,[k]:v}))
 const toggle=<T extends string>(list:T[],item:T)=>list.includes(item)?list.filter(x=>x!==item):[...list,item]
 async function save(){setBusy(true);setError('');setNotice('');try{await saveMyShowcase(form);setNotice('Vitrine salva! Ela já aparece para os alunos na busca.')}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 if(!loaded)return <p role="status">Carregando…</p>
 return <form className="space-y-4" onSubmit={e=>{e.preventDefault();void save()}}>
  <div><h2 className="text-xl font-extrabold">Minha vitrine</h2><p className="text-sm">É assim que os alunos conhecem você na busca. Capriche na apresentação: diga o que você faz e para quem.</p></div>
  <label className="block">Frase de apresentação<Input required minLength={3} maxLength={120} placeholder="Ex.: Personal trainer para emagrecimento e saúde" value={form.headline} onChange={e=>set('headline',e.target.value)} disabled={disabled||busy}/></label>
  <fieldset><legend className="font-semibold">Modalidades (até 6)</legend><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(modalities) as Modality[]).map(m=><Chip key={m} active={form.modalities.includes(m)} onClick={()=>set('modalities',toggle(form.modalities,m))}>{modalities[m]}</Chip>)}</div></fieldset>
  <fieldset><legend className="font-semibold">Como você atende</legend><div className="mt-2 flex flex-wrap gap-2">{(['presencial','online'] as Mode[]).map(m=><Chip key={m} active={form.modes.includes(m)} onClick={()=>set('modes',toggle(form.modes,m))}>{modeLabels[m]}</Chip>)}</div><p className="mt-1 text-sm text-[#626274]">A região do atendimento presencial é a mesma de "Meus vídeos".</p></fieldset>
  <label className="block">Sobre você<textarea maxLength={1500} rows={4} value={form.bio} onChange={e=>set('bio',e.target.value)} disabled={disabled||busy} className="mt-1 block w-full rounded-md border p-2" placeholder="Como você trabalha e como ajuda seus alunos."/></label>
  <label className="block">Formação<textarea maxLength={1000} rows={3} value={form.education} onChange={e=>set('education',e.target.value)} disabled={disabled||busy} className="mt-1 block w-full rounded-md border p-2" placeholder="Graduação, especializações, cursos."/></label>
  <label className="block">Experiência<textarea maxLength={1000} rows={3} value={form.experience} onChange={e=>set('experience',e.target.value)} disabled={disabled||busy} className="mt-1 block w-full rounded-md border p-2" placeholder="Onde atuou, há quanto tempo, públicos que atende."/></label>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <Button type="submit" disabled={disabled||busy}>Salvar vitrine</Button>
 </form>
}

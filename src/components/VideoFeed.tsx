import React,{useCallback,useEffect,useRef,useState} from 'react'
import {LocateFixed,MapPin,Play} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {specialties} from '@/lib/supabase/applications'
import {readMyLocation,readMyVideos,readReviewQueue,readVideoFeed,removeVideo,reviewVideo,saveMyLocation,submitVideo,ufs,youtubeEmbed,youtubeThumbnail,type Coordinates,type FeedItem,type MyLocation,type MyVideo,type ReviewItem} from '@/lib/supabase/videoFeed'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback

// Localização aproximada do aparelho. Só é pedida quando a pessoa toca no botão.
function currentPosition():Promise<Coordinates>{
 return new Promise((resolve,reject)=>{
  if(typeof navigator==='undefined'||!navigator.geolocation){reject(Error('Este aparelho não oferece localização.'));return}
  navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
   e=>reject(Error(e.code===1?'Permissão de localização negada. Você pode usar cidade e bairro.':'Não foi possível obter a localização.')),
   {enableHighAccuracy:false,timeout:15000,maximumAge:600000})
 })
}

// Player leve: mostra a capa e só carrega o YouTube (modo sem cookies) quando a pessoa toca em reproduzir.
export function YoutubePlayer({id,title}:{id:string,title:string}){
 const [playing,setPlaying]=useState(false)
 return <div className="relative w-full overflow-hidden rounded-[8px_16px_8px_16px] bg-black" style={{aspectRatio:'16/9'}}>
  {playing?<iframe className="absolute inset-0 h-full w-full" src={youtubeEmbed(id)} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
  :<button type="button" onClick={()=>setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={'Reproduzir vídeo: '+title}>
    <img src={youtubeThumbnail(id)} alt="" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden'}} className="h-full w-full object-cover opacity-90 group-hover:opacity-100"/>
    <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#a5ce41] text-[#33325a] shadow-lg"><Play aria-hidden="true" className="ml-1 h-7 w-7"/></span>
   </button>}
 </div>
}

const placeLabel=(l:{neighborhood:string|null,city:string|null,uf:string|null})=>[l.neighborhood,l.city&&l.uf?`${l.city}/${l.uf}`:l.city].filter(Boolean).join(', ')

export function LocationForm({initial,disabled,withCoordinates,onSaved,onCancel,intro}:{initial:MyLocation|null,disabled:boolean,withCoordinates:boolean,onSaved:(l:MyLocation)=>void,onCancel?:()=>void,intro:string}){
 const [uf,setUf]=useState(initial?.uf||''),[city,setCity]=useState(initial?.city||''),[hood,setHood]=useState(initial?.neighborhood||'')
 const [coords,setCoords]=useState<Coordinates|null>(initial?.lat!=null&&initial?.lng!=null?{lat:initial.lat,lng:initial.lng}:null)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function locate(){setError('');try{setCoords(await currentPosition())}catch(err){setError(errorText(err,'Não foi possível obter a localização.'))}}
 async function save(){setBusy(true);setError('');try{onSaved(await saveMyLocation({uf,city,neighborhood:hood,coords:withCoordinates?coords:null}))}catch(err){setError(errorText(err,'Não foi possível salvar sua região.'))}finally{setBusy(false)}}
 return <form className="space-y-3" onSubmit={e=>{e.preventDefault();void save()}}>
  <p className="text-sm">{intro}</p>
  <div className="grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
   <label className="block text-sm">Estado<select required value={uf} onChange={e=>setUf(e.target.value)} disabled={disabled||busy} className="mt-1 block h-10 w-full rounded-md border px-2"><option value="">UF</option>{ufs.map(u=><option key={u}>{u}</option>)}</select></label>
   <label className="block text-sm">Cidade<Input required maxLength={80} value={city} onChange={e=>setCity(e.target.value)} disabled={disabled||busy} autoComplete="address-level2"/></label>
   <label className="block text-sm">Bairro<Input maxLength={80} value={hood} onChange={e=>setHood(e.target.value)} disabled={disabled||busy} placeholder="Opcional"/></label>
  </div>
  {withCoordinates&&<div className="flex flex-wrap items-center gap-3 text-sm"><Button type="button" variant="outline" disabled={disabled||busy} onClick={()=>void locate()}><LocateFixed aria-hidden="true" className="mr-2 h-4 w-4"/>{coords?'Atualizar ponto aproximado':'Usar minha localização aproximada'}</Button>{coords&&<><span>Ponto salvo com precisão de cerca de 1 km.</span><button type="button" className="underline" onClick={()=>setCoords(null)}>Não usar ponto</button></>}</div>}
  {error&&<p role="alert">{error}</p>}
  <div className="flex gap-2"><Button type="submit" disabled={disabled||busy}>Salvar região</Button>{onCancel&&<Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>}</div>
 </form>
}

function proximityText(item:FeedItem){
 if(item.distance_km!==null)return item.distance_km<=1?'a menos de 1 km':`a cerca de ${item.distance_km} km`
 return item.proximity==='bairro'?'no seu bairro':item.proximity==='cidade'?'na sua cidade':item.proximity==='estado'?'no seu estado':''
}

// Feed da home do aluno: vídeos aprovados, do profissional mais próximo ao mais distante.
export function StudentVideoFeed({owner,disabled}:{owner:string,disabled:boolean}){
 const [location,setLocation]=useState<MyLocation|null>(null),[editing,setEditing]=useState(false),[gps,setGps]=useState<Coordinates|null>(null)
 const [items,setItems]=useState<FeedItem[]>([]),[page,setPage]=useState(1),[more,setMore]=useState(false)
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[gpsError,setGpsError]=useState('')
 const ticket=useRef(0)
 const load=useCallback(async(nextPage:number,coords:Coordinates|null)=>{
  const mine=++ticket.current;setLoading(true);setError('')
  try{const rows=await readVideoFeed(coords,nextPage);if(mine!==ticket.current)return;setItems(prev=>nextPage===1?rows:[...prev,...rows.filter(r=>!prev.some(p=>p.video_id===r.video_id))]);setPage(nextPage);setMore(rows.length===12)}
  catch(err){if(mine===ticket.current)setError(errorText(err,'Não foi possível carregar o feed.'))}
  finally{if(mine===ticket.current)setLoading(false)}
 },[])
 useEffect(()=>{let alive=true;setGps(null);setItems([])
  readMyLocation().then(l=>{if(alive){setLocation(l);setEditing(!l)}}).catch(()=>{if(alive)setEditing(true)}).finally(()=>{if(alive)void load(1,null)})
  return()=>{alive=false;ticket.current++}
 },[owner,load])
 async function locateDevice(){setGpsError('');try{const c=await currentPosition();setGps(c);void load(1,c)}catch(err){setGpsError(errorText(err,'Não foi possível obter a localização.'))}}
 return <section aria-label="Feed de vídeos" className="space-y-4">
  <div className="flex flex-wrap items-end justify-between gap-3">
   <div><h2 className="text-xl font-extrabold">Vídeos de profissionais perto de você</h2>
    <p className="flex items-center gap-1 text-sm text-[#626274]"><MapPin aria-hidden="true" className="h-4 w-4"/>{gps?'Usando a localização deste aparelho (não fica salva).':location?'Sua região: '+placeLabel(location):'Informe sua região para ver primeiro quem está perto.'}</p></div>
   <div className="flex flex-wrap gap-2">
    {!editing&&<Button type="button" variant="outline" disabled={disabled} onClick={()=>setEditing(true)}>{location?'Alterar região':'Informar região'}</Button>}
    {gps?<Button type="button" variant="outline" disabled={disabled||loading} onClick={()=>{setGps(null);void load(1,null)}}>Usar região salva</Button>
     :<Button type="button" variant="outline" disabled={disabled||loading} onClick={()=>void locateDevice()}><LocateFixed aria-hidden="true" className="mr-2 h-4 w-4"/>Usar minha localização</Button>}
   </div>
  </div>
  {gpsError&&<p role="alert">{gpsError}</p>}
  {editing&&<div className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4"><LocationForm initial={location} disabled={disabled} withCoordinates={false} intro="Usamos estado, cidade e bairro para mostrar primeiro os profissionais mais próximos. Seu endereço não é pedido." onCancel={location?()=>setEditing(false):undefined} onSaved={l=>{setLocation(l);setEditing(false);void load(1,gps)}}/></div>}
  {error&&<p role="alert">{error}</p>}
  {!error&&!loading&&!items.length&&<p className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4">Ainda não há vídeos publicados. Assim que os profissionais compartilharem conteúdos aprovados, eles aparecem aqui.</p>}
  <div className="grid gap-4 lg:grid-cols-2">
   {items.map(item=><article key={item.video_id} className="space-y-3 rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-3">
    <YoutubePlayer id={item.youtube_id} title={item.title}/>
    <div className="px-1 pb-1">
     <h3 className="font-bold">{item.title}</h3>
     <p className="text-sm text-[#626274]">{item.professional_name}{item.specialty&&item.specialty in specialties?' · '+specialties[item.specialty as keyof typeof specialties]:''}</p>
     <p className="text-sm text-[#626274]">{[placeLabel(item),proximityText(item)].filter(Boolean).join(' · ')}</p>
     {item.description&&<p className="mt-2 whitespace-pre-line text-sm">{item.description}</p>}
    </div>
   </article>)}
  </div>
  {loading&&<p role="status">Carregando vídeos…</p>}
  {more&&!loading&&<Button type="button" variant="outline" disabled={disabled} onClick={()=>void load(page+1,gps)}>Ver mais vídeos</Button>}
 </section>
}

const statusLabel:Record<MyVideo['status'],string>={pending:'Em análise',approved:'Publicado no feed',rejected:'Recusado',removed:'Retirado'}

// Profissional aprovado: região de atendimento, envio de link do YouTube e situação de cada vídeo.
export function ProfessionalVideos({owner,disabled}:{owner:string,disabled:boolean}){
 const [location,setLocation]=useState<MyLocation|null>(null),[editing,setEditing]=useState(false)
 const [videos,setVideos]=useState<MyVideo[]>([]),[loading,setLoading]=useState(true)
 const [url,setUrl]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState('')
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const refresh=useCallback(async()=>{setLoading(true);try{setVideos(await readMyVideos())}catch(err){setError(errorText(err,'Não foi possível carregar seus vídeos.'))}finally{setLoading(false)}},[])
 useEffect(()=>{readMyLocation().then(l=>{setLocation(l);setEditing(!l)}).catch(()=>setEditing(true));void refresh()},[owner,refresh])
 async function send(){setBusy(true);setError('');setNotice('');try{await submitVideo({url,title,description});setUrl('');setTitle('');setDescription('');setNotice('Vídeo enviado! Ele aparece no feed dos alunos depois da aprovação da equipe.');await refresh()}catch(err){setError(errorText(err,'Não foi possível enviar o vídeo.'))}finally{setBusy(false)}}
 async function remove(video:MyVideo){if(!window.confirm('Retirar este vídeo do feed?'))return;setBusy(true);setError('');try{await removeVideo(video.id);await refresh()}catch(err){setError(errorText(err,'Não foi possível retirar o vídeo.'))}finally{setBusy(false)}}
 return <div className="space-y-6">
  <section className="space-y-3"><h2 className="text-xl font-bold">Sua região de atendimento</h2>
   {editing?<LocationForm initial={location} disabled={disabled} withCoordinates intro="Os alunos mais próximos veem seus vídeos primeiro. Mostramos só bairro e cidade; o ponto aproximado (opcional) serve para calcular a distância e nunca é exibido." onCancel={location?()=>setEditing(false):undefined} onSaved={l=>{setLocation(l);setEditing(false)}}/>
   :<div className="flex flex-wrap items-center gap-3"><p>{location?placeLabel(location):''}{location?.lat!=null?' · com ponto aproximado':''}</p><Button type="button" variant="outline" disabled={disabled} onClick={()=>setEditing(true)}>Alterar</Button></div>}
  </section>
  <section className="space-y-3"><h2 className="text-xl font-bold">Enviar vídeo para o feed</h2>
   <p className="text-sm">Publique o vídeo no YouTube (pode ser “não listado”) e cole o link aqui. A equipe analisa antes de liberar para os alunos.</p>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();void send()}}>
    <label className="block">Link do YouTube<Input type="url" required maxLength={300} placeholder="https://youtu.be/..." value={url} onChange={e=>setUrl(e.target.value)} disabled={disabled||busy}/></label>
    <label className="block">Título<Input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} disabled={disabled||busy}/></label>
    <label className="block">Descrição (opcional)<textarea maxLength={1000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} disabled={disabled||busy} className="mt-1 block w-full rounded-md border p-2"/></label>
    <Button type="submit" disabled={disabled||busy}>Enviar para análise</Button>
   </form>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>
  <section className="space-y-3"><h2 className="text-xl font-bold">Meus vídeos</h2>
   {loading?<p role="status">Carregando…</p>:!videos.length?<p>Você ainda não enviou vídeos.</p>:<ul className="grid gap-4 lg:grid-cols-2">{videos.map(v=><li key={v.id} className="space-y-2 rounded-lg border p-3"><YoutubePlayer id={v.youtube_id} title={v.title}/><p className="font-bold">{v.title}</p><p className="text-sm">{statusLabel[v.status]}{v.review_reason&&v.status!=='approved'?' — '+v.review_reason:''}</p>{(v.status==='pending'||v.status==='approved')&&<Button type="button" variant="outline" disabled={disabled||busy} onClick={()=>void remove(v)}>Retirar</Button>}</li>)}</ul>}
  </section>
 </div>
}

// Admin: aprova ou recusa vídeos pendentes e pode retirar vídeos publicados. Motivo obrigatório.
export function AdminVideoReview({owner,disabled}:{owner:string,disabled:boolean}){
 const [tab,setTab]=useState<'pending'|'approved'>('pending'),[rows,setRows]=useState<ReviewItem[]>([]),[loading,setLoading]=useState(true)
 const [reasons,setReasons]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const refresh=useCallback(async(which:'pending'|'approved')=>{setLoading(true);setError('');try{setRows(await readReviewQueue(which))}catch(err){setError(errorText(err,'Fila indisponível.'))}finally{setLoading(false)}},[])
 useEffect(()=>{void refresh(tab)},[owner,tab,refresh])
 async function decide(row:ReviewItem,decision:'approved'|'rejected'|'removed'){
  const fallback=decision==='approved'?'Conteúdo adequado.':''
  setBusy(true);setError('');setNotice('')
  try{await reviewVideo(row.video_id,decision,reasons[row.video_id]?.trim()||fallback);setNotice(decision==='approved'?'Vídeo publicado no feed.':decision==='rejected'?'Vídeo recusado.':'Vídeo retirado do feed.');await refresh(tab)}
  catch(err){setError(errorText(err,'Não foi possível registrar a análise.'))}finally{setBusy(false)}
 }
 return <div className="space-y-4">
  <h2 className="text-xl font-bold">Vídeos do feed</h2>
  <div className="flex gap-2" role="tablist">{([['pending','Aguardando análise'],['approved','Publicados']] as const).map(([id,label])=><Button key={id} type="button" role="tab" aria-selected={tab===id} variant={tab===id?'default':'outline'} onClick={()=>setTab(id)}>{label}</Button>)}</div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loading?<p role="status">Carregando…</p>:!rows.length?<p>{tab==='pending'?'Nenhum vídeo aguardando análise.':'Nenhum vídeo publicado.'}</p>:
  <ul className="grid gap-4 lg:grid-cols-2">{rows.map(row=><li key={row.video_id} className="space-y-2 rounded-lg border p-3">
   <YoutubePlayer id={row.youtube_id} title={row.title}/>
   <p className="font-bold">{row.title}</p><p className="text-sm">{row.professional_name} · enviado em {new Date(row.created_at).toLocaleString('pt-BR')}</p>
   {row.description&&<p className="whitespace-pre-line text-sm">{row.description}</p>}
   <label className="block text-sm">Motivo{tab==='pending'?' (obrigatório para recusar)':' (obrigatório para retirar)'}<Input maxLength={1000} value={reasons[row.video_id]||''} onChange={e=>setReasons(r=>({...r,[row.video_id]:e.target.value}))} disabled={disabled||busy}/></label>
   <div className="flex flex-wrap gap-2">{tab==='pending'?<><Button type="button" disabled={disabled||busy} onClick={()=>void decide(row,'approved')}>Aprovar</Button><Button type="button" variant="outline" disabled={disabled||busy||!reasons[row.video_id]?.trim()} onClick={()=>void decide(row,'rejected')}>Recusar</Button></>
    :<Button type="button" variant="outline" disabled={disabled||busy||!reasons[row.video_id]?.trim()} onClick={()=>void decide(row,'removed')}>Retirar do feed</Button>}</div>
  </li>)}</ul>}
 </div>
}

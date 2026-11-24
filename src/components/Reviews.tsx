import React,{useCallback,useEffect,useState} from 'react'
import {Star} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {formatAverage,hideReview,listRecentReviews,listReviews,myReviewStatus,reviewSummaries,submitReview,type AdminReview,type Review,type ReviewSummary} from '@/lib/supabase/reviews'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const dateBr=(iso:string)=>new Date(iso).toLocaleDateString('pt-BR')

export function Stars({value,size=16}:{value:number,size?:number}){
 return <span className="inline-flex" aria-label={`${formatAverage(value)} de 5 estrelas`}>{[1,2,3,4,5].map(i=>{const fill=Math.max(0,Math.min(1,value-i+1))
  return <span key={i} className="relative inline-block" style={{width:size,height:size}}><Star aria-hidden="true" className="absolute inset-0 text-[#d5d4e1]" style={{width:size,height:size}}/>
   <span className="absolute inset-0 overflow-hidden" style={{width:`${fill*100}%`}}><Star aria-hidden="true" className="fill-amber-400 text-amber-400" style={{width:size,height:size}}/></span></span>})}</span>
}
// "★ 4,8 (23)" — a média ignora as 3 piores das 100 últimas.
export function RatingLine({summary,showRule=false}:{summary?:ReviewSummary,showRule?:boolean}){
 if(!summary||!summary.total||summary.average===null)return <span className="text-sm text-[#626274]">Sem avaliações ainda</span>
 return <span className="inline-flex flex-wrap items-center gap-1 text-sm"><Stars value={summary.average}/><b>{formatAverage(summary.average)}</b><span className="text-[#626274]">({summary.total} avaliação{summary.total===1?'':'ões'})</span>
  {showRule&&summary.dropped>0&&<span className="w-full text-xs text-[#626274]">Média das últimas {Math.min(summary.total,100)} avaliações, sem as 3 piores.</span>}</span>
}
// Busca o resumo de uma pessoa e mostra a linha de estrelas.
export function RatingBadge({user,showRule}:{user:string,showRule?:boolean}){
 const [s,setS]=useState<ReviewSummary|undefined>(),[ready,setReady]=useState(false)
 useEffect(()=>{let live=true;reviewSummaries([user]).then(r=>{if(live){setS(r[user]);setReady(true)}}).catch(()=>{if(live)setReady(true)});return()=>{live=false}},[user])
 return ready?<RatingLine summary={s} showRule={showRule}/>:null
}
// Lista dos comentários (vitrine e perfil).
export function ReviewList({user}:{user:string}){
 const [rows,setRows]=useState<Review[]|null>(null)
 useEffect(()=>{let live=true;listReviews(user).then(r=>{if(live)setRows(r)}).catch(()=>{if(live)setRows([])});return()=>{live=false}},[user])
 if(!rows)return null
 if(!rows.length)return <p className="text-sm text-[#626274]">Ainda não há comentários.</p>
 return <ul className="space-y-2">{rows.map(r=><li key={r.review_id} className="rounded-md border border-[#eeedf4] p-3"><div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size={14}/><b className="text-sm">{r.reviewer_name}</b><span className="text-xs text-[#626274]">{dateBr(r.created_at)}</span></div>
  {r.comment&&<p className="mt-1 whitespace-pre-line text-sm">{r.comment}</p>}</li>)}</ul>
}

// Botão "Avaliar" com o formulário (estrelas + comentário). Some quando não pode avaliar.
export function ReviewButton({user,name,role}:{user:string,name:string,role:'aluno'|'profissional'}){
 const [status,setStatus]=useState<{canReview:boolean,nextAt:string|null,lastRating:number|null}|null>(null),[open,setOpen]=useState(false)
 const [rating,setRating]=useState(0),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false)
 const load=useCallback(()=>{myReviewStatus(user).then(setStatus).catch(()=>setStatus(null))},[user])
 useEffect(()=>{load()},[load])
 async function send(){setBusy(true);setError('');try{await submitReview(user,rating,comment);setDone(true);setOpen(false);load()}catch(err){setError(errorText(err,'Não foi possível enviar.'))}finally{setBusy(false)}}
 if(!status)return null
 if(done)return <span className="text-sm font-bold text-[#4d6b14]">Obrigado pela avaliação!</span>
 if(!status.canReview)return status.lastRating?<span className="text-sm text-[#626274]">Você avaliou com {status.lastRating} estrela{status.lastRating>1?'s':''}{status.nextAt?` · nova avaliação a partir de ${dateBr(status.nextAt)}`:''}</span>:null
 if(!open)return <Button type="button" variant="outline" onClick={()=>setOpen(true)}><Star aria-hidden="true" className="mr-1 h-4 w-4"/>Avaliar {name.split(' ')[0]}</Button>
 return <div className="w-full space-y-2 rounded-md border p-3">
  <p className="font-bold">Como foi {role==='aluno'?'o acompanhamento com':'acompanhar'} {name.split(' ')[0]}?</p>
  <div className="flex gap-1" role="radiogroup" aria-label="Nota">{[1,2,3,4,5].map(i=><button key={i} type="button" role="radio" aria-checked={rating===i} aria-label={`${i} estrela${i>1?'s':''}`} onClick={()=>setRating(i)} className="p-1">
   <Star aria-hidden="true" className={'h-8 w-8 '+(i<=rating?'fill-amber-400 text-amber-400':'text-[#b0b0bb]')}/></button>)}</div>
  <label className="block text-sm font-semibold">Comentário (opcional{role==='aluno'?'; aparece na vitrine do profissional com seu primeiro nome':''})<textarea className="mt-1 block w-full rounded-md border p-2 text-sm" rows={2} maxLength={500} value={comment} onChange={e=>setComment(e.target.value)}/></label>
  {error&&<p role="alert" className="text-sm">{error}</p>}
  <div className="flex gap-2"><Button type="button" disabled={busy||!rating} onClick={()=>void send()}>Enviar avaliação</Button><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button></div>
 </div>
}

// Admin: avaliações recentes, com opção de ocultar.
export function AdminReviews({owner}:{owner:string}){
 const [rows,setRows]=useState<AdminReview[]|null>(null),[reason,setReason]=useState<Record<string,string>>({}),[error,setError]=useState('')
 const load=useCallback(()=>{listRecentReviews().then(setRows).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setRows([])})},[])
 useEffect(()=>{load()},[load,owner])
 async function toggle(r:AdminReview){setError('');try{await hideReview(r.review_id,!r.hidden,reason[r.review_id]??'');load()}catch(err){setError(errorText(err,'Não foi possível alterar.'))}}
 return <section className="space-y-3" aria-label="Avaliações">
  <div><h2 className="text-xl font-extrabold">Avaliações</h2><p className="text-sm text-[#626274]">As 100 mais recentes. Oculte comentários ofensivos ou falsos (com motivo). A média de cada pessoa usa as 100 últimas sem as 3 piores.</p></div>
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:!rows.length?<p className={card}>Nenhuma avaliação ainda.</p>:<ul className="space-y-2">{rows.map(r=><li key={r.review_id} className={card+' space-y-2'+(r.hidden?' opacity-60':'')}>
   <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size={14}/><span className="text-sm"><b>{r.reviewer_name}</b> → <b>{r.reviewee_name}</b> ({r.direction==='aluno_profissional'?'aluno avaliou profissional':'profissional avaliou aluno'}) · {dateBr(r.created_at)}</span>{r.hidden&&<span className="text-xs font-bold">OCULTA</span>}</div>
   {r.comment&&<p className="text-sm">{r.comment}</p>}
   <div className="flex flex-wrap items-end gap-2">{!r.hidden&&<label className="text-sm font-semibold">Motivo<Input maxLength={300} value={reason[r.review_id]??''} onChange={e=>setReason(x=>({...x,[r.review_id]:e.target.value}))}/></label>}
    <Button type="button" variant="outline" onClick={()=>void toggle(r)}>{r.hidden?'Mostrar de novo':'Ocultar'}</Button></div>
  </li>)}</ul>}
 </section>
}

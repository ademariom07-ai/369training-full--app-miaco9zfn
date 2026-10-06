import {useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {readOwnApplication} from '@/lib/supabase/applications'
import {readTrainingPlans,readTrainingNotices,type TrainingPlan,type TrainingNotice} from '@/lib/supabase/trainingPlans'
import type {OwnProfile} from '@/lib/supabase/profiles'
import type {ParticipantLink} from '@/lib/supabase/participantLinks'
type Props={account:OwnProfile;links:ParticipantLink[];disabled:boolean;onPublish:(link:ParticipantLink,title:string,content:string)=>Promise<void>;onRead:(planId:string)=>Promise<void>}
export default function TrainingPlans({account,links,disabled,onPublish,onRead}:Props){
 const [rows,setRows]=useState<TrainingPlan[]>([]),[notices,setNotices]=useState<TrainingNotice[]>([]),[qualified,setQualified]=useState(false),[owner,setOwner]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[page,setPage]=useState(1),[reload,setReload]=useState(0)
 const [student,setStudent]=useState(''),[title,setTitle]=useState(''),[content,setContent]=useState(''),[sending,setSending]=useState(false)
 const lock=useRef(false),mounted=useRef(true),professional=account.role==='profissional'
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{setPage(1);setStudent('');setTitle('');setContent('')},[account.id])
 useEffect(()=>{let active=true;setRows([]);setNotices([]);setOwner(null);setError('');setQualified(false);setLoading(true)
  void (async()=>{
   const [plans,application]=await Promise.all([readTrainingPlans({id:account.id,role:account.role},page),professional?readOwnApplication(account.id):Promise.resolve(null)])
   const alerts=professional?[]:await readTrainingNotices(plans.map(plan=>plan.id),account.id)
   if(active){setRows(plans);setNotices(alerts);setQualified(application?.status==='approved'&&application.specialty==='educacao_fisica');setOwner(account.id)}
  })().catch(()=>{if(active)setError('Não foi possível carregar os treinos. Atualize sua conta antes de tentar novamente.')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[account.id,account.role,professional,page,reload])
 async function act(task:()=>Promise<void>){if(lock.current||disabled)return;lock.current=true;setSending(true);setError('');try{await task();if(mounted.current){setTitle('');setContent('');setReload(n=>n+1)}}catch{if(mounted.current)setError('Não foi possível concluir. Atualize e confira os treinos antes de reenviar.')}finally{lock.current=false;if(mounted.current)setSending(false)}}
 const activeLinks=links.filter(link=>link.state==='active'&&link.professional_id===account.id),selected=activeLinks.find(link=>link.student_id===student),blocked=disabled||loading||sending||owner!==account.id
 return <section className="space-y-3 rounded-lg border p-4" aria-label="Treinos"><h2 className="text-lg font-semibold">Treinos</h2>{loading&&<p role="status">Carregando treinos…</p>}{error&&<p role="alert">{error}</p>}
  {!loading&&owner===account.id&&<>{professional&&qualified&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();if(!selected)return;void act(()=>onPublish(selected,title,content))}}><p>Publique orientações de treino para um aluno com vínculo ativo. A publicação enviada fica disponível para leitura.</p><label className="block">Aluno nesta página de vínculos<select className="mt-1 block w-full rounded border bg-white p-2" required value={selected?.student_id||''} onChange={e=>setStudent(e.target.value)} disabled={blocked}><option value="">Selecione o aluno</option>{activeLinks.map(link=><option key={link.student_id} value={link.student_id}>{link.participant_name||'Nome indisponível'}</option>)}</select></label>{!activeLinks.length&&<p>Nenhum aluno com vínculo ativo nesta página. Confira os vínculos abaixo.</p>}<label className="block">Título<Input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} disabled={blocked}/></label><label className="block">Orientações<textarea className="mt-1 block w-full rounded border p-2" required maxLength={6000} rows={5} value={content} onChange={e=>setContent(e.target.value)} disabled={blocked}/></label><Button type="submit" disabled={blocked||!selected||!title.trim()||!content.trim()}>Publicar treino e avisar aluno</Button></form>}{professional&&!qualified&&<p>A publicação de treinos exige aprovação na área de Educação Física.</p>}
   {rows.length?<ul className="space-y-3">{rows.map(plan=>{const alert=notices.find(item=>item.plan_id===plan.id);return <li key={plan.id} className="space-y-2 rounded border p-3"><h3 className="font-semibold">{plan.title}</h3>{professional&&<p>Aluno: {links.find(link=>link.student_id===plan.student_id)?.participant_name||'Nome indisponível nesta página'}</p>}<p className="text-sm">Publicado em {new Date(plan.created_at).toLocaleString('pt-BR')}</p><p className="whitespace-pre-wrap">{plan.content}</p>{!professional&&alert&&<div>{alert.read_at?<p>Aviso lido.</p>:<><p>Novo treino disponível.</p><Button type="button" variant="outline" disabled={blocked} onClick={()=>void act(()=>onRead(plan.id))}>Marcar aviso como lido</Button></>}</div>}</li>})}</ul>:<p>Nenhum treino disponível nesta página.</p>}
   <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={blocked||page<=1} onClick={()=>setPage(n=>n-1)}>Anterior</Button><span>Página {page}</span><Button type="button" variant="outline" disabled={blocked||rows.length<20||page>=10000} onClick={()=>setPage(n=>n+1)}>Próxima</Button></div>
  </>}
  <Button type="button" variant="outline" disabled={disabled||loading||sending} onClick={()=>setReload(n=>n+1)}>Atualizar treinos</Button>
 </section>
}

import React,{useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Card} from '@/components/ui/card'
import {getSupabaseClient} from '@/lib/supabase/client'
import {createAccountSession,type AccountState} from '@/lib/supabase/accountSession'
import ProfessionalDirectory from '@/components/ProfessionalDirectory'
import {readParticipantLinks,type ParticipantLink} from '@/lib/supabase/participantLinks'
const initial:AccountState={phase:'checking',profile:null,busy:false,error:''}
export default function SupabaseAccount(){
 const [state,setState]=useState(initial),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState(''),[links,setLinks]=useState<ParticipantLink[]>([]),[linkError,setLinkError]=useState(''),[linksLoading,setLinksLoading]=useState(false),[linkPage,setLinkPage]=useState(1),[ending,setEnding]=useState<ParticipantLink|null>(null),[linkOwner,setLinkOwner]=useState<string|null>(null)
 const controller=useRef<ReturnType<typeof createAccountSession>|null>(null)
 useEffect(()=>{
  try{const session=createAccountSession(getSupabaseClient(),setState);controller.current=session;session.start();return()=>{session.dispose();controller.current=null}}
  catch{setState({phase:'error',profile:null,busy:false,error:'O acesso está indisponível neste ambiente.'})}
 },[])
 useEffect(()=>{setLinkPage(1)},[state.profile?.id])
 useEffect(()=>{setLinkOwner(null);setEnding(null);setName(state.profile?.display_name||'');setLinks([]);setLinkError('');setLinksLoading(false);let active=true
  if(state.phase==='ready'&&state.profile){
   setLinksLoading(true)
   const client=getSupabaseClient(),role=state.profile.role
   const request=role==='aluno'||role==='profissional'&&state.profile.approved?readParticipantLinks(state.profile,role==='aluno'?1:linkPage,client):Promise.resolve([])
   request.then(rows=>{if(active){setLinks(rows);setLinkOwner(state.profile!.id)}}).catch(()=>{if(active)setLinkError('Não foi possível carregar seus vínculos.')}).finally(()=>{if(active)setLinksLoading(false)})
  }
  return()=>{active=false}
 },[state.phase,state.profile,linkPage])
 async function act(task:()=>Promise<void>){setMessage('');try{await task()}catch{setMessage('Não foi possível concluir. Verifique os dados e tente novamente.')}finally{setPassword('')}}
 const profile=state.profile
 return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-xl space-y-5"><Link to="/" className="text-blue-700">369 WELLNESS</Link><h1 className="text-2xl font-bold">Sua conta</h1><Card className="space-y-4 p-6">
  {state.phase==='checking'&&<p role="status">Verificando sua conta…</p>}
  {state.error&&<p role="alert">{state.error}</p>}{message&&<p role="alert">{message}</p>}
  {(state.phase==='signed_out'||state.phase==='error')&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void act(()=>controller.current!.login(email,password))}}><label className="block">E-mail<Input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={state.busy}/></label><label className="block">Senha<Input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)} disabled={state.busy}/></label><Button type="submit" disabled={state.busy||!controller.current}>Entrar</Button></form>}
  {state.phase==='profile_missing'&&<><p>Escolha o nome que deseja exibir na sua conta.</p><form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>controller.current!.createProfile(name))}}><label className="block">Nome<Input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} disabled={state.busy}/></label><Button type="submit" disabled={state.busy}>Criar meu perfil</Button></form></>}
  {state.phase==='ready'&&profile&&<><p>Perfil: {profile.role==='aluno'?'Aluno':profile.role==='profissional'?'Profissional':'Administrador'}</p>{profile.role==='profissional'&&!profile.approved&&<p>Aprovação profissional pendente.</p>}<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>controller.current!.renameProfile(name))}}><label className="block">Nome<Input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} disabled={state.busy}/></label><Button type="submit" disabled={state.busy}>Salvar nome</Button></form>{profile.role==='aluno'&&linkOwner===profile.id&&!linksLoading&&!linkError&&!links.some(row=>row.state!=='revoked')&&<ProfessionalDirectory disabled={state.busy} onRequest={id=>controller.current!.requestLink(id)}/>}<h2 className="text-lg font-semibold">Seus vínculos</h2>{linkError?<p role="alert">{linkError}</p>:linksLoading||linkOwner!==profile.id?<p role="status">Carregando vínculos…</p>:links.length?<ul className="space-y-2">{links.map(row=><li key={row.student_id} className="rounded-lg border p-3"><p>{row.state==='pending'?'Aguardando aceite':row.state==='active'?'Ativo':'Encerrado'}</p><p>{profile.role==='aluno'?'Profissional':'Aluno'}: {row.participant_name||(row.state==='revoked'?'Vínculo encerrado':'Nome indisponível')}</p><p className="text-sm text-slate-600">Solicitado em {new Date(row.requested_at).toLocaleString('pt-BR')}</p>{row.state!=='revoked'&&<div className="mt-2 flex gap-2">{profile.role==='profissional'&&profile.approved&&row.state==='pending'&&<Button type="button" disabled={state.busy||linksLoading} onClick={()=>void act(()=>controller.current!.acceptLink(row))}>Aceitar vínculo</Button>}<Button type="button" variant="outline" disabled={state.busy||linksLoading} onClick={()=>setEnding(row)}>Encerrar vínculo</Button></div>}</li>)}</ul>:<p>Nenhum vínculo nesta página.</p>}{ending&&linkOwner===profile.id&&<div className="space-y-3 rounded-lg border p-4" role="group" aria-label="Confirmar encerramento"><p>{profile.role==='aluno'?'Profissional':'Aluno'}: {ending.participant_name||'Nome indisponível'}</p><p>Encerrar o vínculo solicitado em {new Date(ending.requested_at).toLocaleString('pt-BR')}? Será necessário um novo pedido e aceite para retomá-lo.</p><div className="flex gap-2"><Button type="button" disabled={state.busy} onClick={()=>void act(async()=>{await controller.current!.revokeLink(ending);setEnding(null)})}>Confirmar encerramento</Button><Button type="button" variant="outline" disabled={state.busy} onClick={()=>setEnding(null)}>Cancelar</Button></div></div>}{profile.role==='profissional'&&profile.approved&&<div className="flex items-center gap-3"><Button type="button" variant="outline" disabled={linksLoading||state.busy||linkPage<=1} onClick={()=>setLinkPage(p=>p-1)}>Anterior</Button><span>Página {linkPage}</span><Button type="button" variant="outline" disabled={linksLoading||state.busy||links.length<20||linkPage>=10000} onClick={()=>setLinkPage(p=>p+1)}>Próxima</Button></div>}</>}
  {state.phase!=='signed_out'&&<div className="flex gap-3"><Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={()=>void controller.current?.refresh()}>Atualizar conta</Button><Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={()=>void act(async()=>{await controller.current!.logout();setEmail('');setName('')})}>Sair deste dispositivo</Button></div>}
 </Card></div></main>
}

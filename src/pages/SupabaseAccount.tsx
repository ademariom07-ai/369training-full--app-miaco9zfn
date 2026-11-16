import {HoldPolicy} from '@/components/BookingHoldControls'
import BookingReservations from '@/components/BookingReservations'
import {StudentVideoFeed,ProfessionalVideos,AdminVideoReview,PendingVideosNotice} from '@/components/VideoFeed'
import {RoleShell,RoleOverview,pickView,roleKind} from '@/components/RoleHome'
import CashbackPolicyDrafts from '@/components/CashbackPolicyDrafts'
import AdminServiceIntake from '@/components/AdminServiceIntake'
import SupabaseVideoPilot from '@/components/SupabaseVideoPilot'
import AdminParticipantOverview from '@/components/AdminParticipantOverview'
import EsgProjects from '@/components/EsgProjects'
import BookingTerms from '@/components/BookingTerms'
import ProfessionalAvailability from '@/components/ProfessionalAvailability'
import ReleasedAvailability from '@/components/ReleasedAvailability'
import {saoPauloToday} from '@/lib/supabase/availability'
import RankingPolicyDrafts from '@/components/RankingPolicyDrafts'
import SupabaseWallet from '@/components/SupabaseWallet'
import React,{useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Card} from '@/components/ui/card'
import {getSupabaseClient} from '@/lib/supabase/client'
import {enabledProviders} from '@/lib/supabase/authProviders'
import {normalizeBrazilPhone,normalizeFullName} from '@/lib/supabase/phone'
import {createAccountSession,type AccountState} from '@/lib/supabase/accountSession'
import TrainingPlans from '@/components/TrainingPlans'
import ProfessionalApplications from '@/components/ProfessionalApplications'
import ProfessionalDirectory from '@/components/ProfessionalDirectory'
import {readParticipantLinks,type ParticipantLink} from '@/lib/supabase/participantLinks'
const initial:AccountState={phase:'checking',profile:null,busy:false,error:''}
export default function SupabaseAccount({redirectPath='/conta-supabase'}:{redirectPath?:string}={}){
 const [state,setState]=useState(initial),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState(''),[links,setLinks]=useState<ParticipantLink[]>([]),[linkError,setLinkError]=useState(''),[linksLoading,setLinksLoading]=useState(false),[linkPage,setLinkPage]=useState(1),[ending,setEnding]=useState<ParticipantLink|null>(null),[linkOwner,setLinkOwner]=useState<string|null>(null)
 const [availabilityDay,setAvailabilityDay]=useState(()=>saoPauloToday())
 const [mode,setMode]=useState<'login'|'signup'|'recover'>('login'),[confirmation,setConfirmation]=useState(''),[notice,setNotice]=useState('')
 const [fullName,setFullName]=useState(''),[phone,setPhone]=useState(''),[code,setCode]=useState(''),[codeSent,setCodeSent]=useState(false)
 const [view,setView]=useState(()=>typeof window==='undefined'?'':decodeURIComponent(window.location.hash.slice(1)))
 const [google,setGoogle]=useState(false)
 useEffect(()=>{let alive=true;void enabledProviders().then(set=>{if(alive)setGoogle(set.has('google'))});return()=>{alive=false}},[])
 const controller=useRef<ReturnType<typeof createAccountSession>|null>(null)
 useEffect(()=>{
  try{const session=createAccountSession(getSupabaseClient(),setState,undefined,new URL(redirectPath,window.location.origin).href);controller.current=session;session.start();return()=>{session.dispose();controller.current=null}}
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
 async function act(task:()=>Promise<void>){setMessage('');setNotice('');try{await task()}catch(err){const shown=['Entrar com Google está indisponível no momento.','Código inválido ou expirado. Peça um novo código.','Digite o código de 6 dígitos que chegou no e-mail.','Aguarde 1 minuto antes de tentar novamente.','Muitas tentativas. Aguarde alguns minutos e tente novamente.','Confira o e-mail, a senha e a confirmação do endereço antes de entrar.','Confirme seu e-mail antes de entrar.'];setMessage(err instanceof Error&&shown.includes(err.message)?err.message:'Não foi possível concluir. Verifique os dados e tente novamente.')}finally{setPassword('');setConfirmation('')}}
 function chooseMode(next:typeof mode){setMode(next);setCode('');setCodeSent(false);setPassword('');setConfirmation('');setMessage('');setNotice('')}
 async function submitAccess(){
  if(mode==='signup'&&password!==confirmation){setMessage('As senhas precisam ser iguais.');setPassword('');setConfirmation('');return}
  if(mode==='signup'&&!normalizeFullName(fullName)){setMessage('Preencha seu nome completo (nome e sobrenome).');return}
  if(mode==='signup'&&!normalizeBrazilPhone(phone)){setMessage('Preencha um celular válido com DDD, por exemplo (11) 98765-4321.');return}
  await act(async()=>{
   if(mode==='login')await controller.current!.login(email,password)
   else if(mode==='signup'){const started=await controller.current!.signup(email,password,{fullName,phone});setNotice(started?'Conta criada! Bem-vindo(a) ao 369 WELLNESS.':'Se a confirmação for necessária, siga as instruções no seu e-mail. Se já possui conta, use Entrar.')}
   else if(codeSent){await controller.current!.verifyRecoveryCode(email,code);setCode('')}
   else{await controller.current!.recover(email);setCodeSent(true);setNotice('Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos. Confira também o spam/lixo eletrônico.')}
  })
 }
 const profile=state.profile
 function openView(id:string){setView(id);setMessage('');setNotice('');try{window.history.replaceState(null,'','#'+id)}catch{/* sem histórico */}window.scrollTo?.({top:0})}
 const logout=()=>void act(async()=>{await controller.current!.logout();setEmail('');setName('')})
 const alerts=<>{state.error&&<p role="alert">{state.error}</p>}{message&&<p role="alert">{message}</p>}{notice&&<p role="status">{notice}</p>}</>
 if(state.phase==='ready'&&profile){
  const kind=roleKind(profile),current=pickView(profile,view),busy=state.busy
  const linksReady=linkOwner===profile.id&&!linksLoading&&!linkError
  const panel=(children:React.ReactNode)=><Card className="space-y-4 p-6">{children}</Card>
  const linksBlock=<><h2 className="text-lg font-semibold">{kind==='aluno'?'Seus profissionais':'Seus alunos'}</h2>{linkError?<p role="alert">{linkError}</p>:linksLoading||linkOwner!==profile.id?<p role="status">Carregando vínculos…</p>:links.length?<ul className="space-y-2">{links.map(row=><li key={row.student_id} className="rounded-lg border p-3"><p>{row.state==='pending'?'Aguardando aceite':row.state==='active'?'Ativo':'Encerrado'}</p><p>{kind==='aluno'?'Profissional':'Aluno'}: {row.participant_name||(row.state==='revoked'?'Vínculo encerrado':'Nome indisponível')}</p>{kind==='aluno'&&row.state!=='revoked'&&<ReleasedAvailability key={profile.id+row.professional_id} owner={profile.id} professionalId={row.professional_id} disabled={busy}/>}<p className="text-sm text-slate-600">Solicitado em {new Date(row.requested_at).toLocaleString('pt-BR')}</p>{row.state!=='revoked'&&<div className="mt-2 flex gap-2">{kind==='parceiro'&&row.state==='pending'&&<Button type="button" disabled={busy||linksLoading} onClick={()=>void act(()=>controller.current!.acceptLink(row))}>Aceitar vínculo</Button>}<Button type="button" variant="outline" disabled={busy||linksLoading} onClick={()=>setEnding(row)}>Encerrar vínculo</Button></div>}</li>)}</ul>:<p>{kind==='aluno'?'Você ainda não tem vínculo com um profissional.':'Nenhum vínculo nesta página.'}</p>}{ending&&linkOwner===profile.id&&<div className="space-y-3 rounded-lg border p-4" role="group" aria-label="Confirmar encerramento"><p>{kind==='aluno'?'Profissional':'Aluno'}: {ending.participant_name||'Nome indisponível'}</p><p>Encerrar o vínculo solicitado em {new Date(ending.requested_at).toLocaleString('pt-BR')}? Será necessário um novo pedido e aceite para retomá-lo.</p><div className="flex gap-2"><Button type="button" disabled={busy} onClick={()=>void act(async()=>{await controller.current!.revokeLink(ending);setEnding(null)})}>Confirmar encerramento</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setEnding(null)}>Cancelar</Button></div></div>}{kind==='parceiro'&&<div className="flex items-center gap-3"><Button type="button" variant="outline" disabled={linksLoading||busy||linkPage<=1} onClick={()=>setLinkPage(p=>p-1)}>Anterior</Button><span>Página {linkPage}</span><Button type="button" variant="outline" disabled={linksLoading||busy||links.length<20||linkPage>=10000} onClick={()=>setLinkPage(p=>p+1)}>Próxima</Button></div>}</>
  const training=linksReady&&(kind==='aluno'||kind==='parceiro')?<TrainingPlans account={profile} links={links} disabled={busy} onPublish={(link,title,content)=>controller.current!.publishTraining(link,title,content)} onRead={id=>controller.current!.readTraining(id)} onComplete={id=>controller.current!.completeTraining(id)}/>:<p role="status">Carregando treinos…</p>
  const applications=<ProfessionalApplications account={profile} disabled={busy} onSubmit={(specialty,credential)=>controller.current!.applyProfessional(specialty,credential)} onReview={(row,decision,reason)=>controller.current!.reviewProfessional(row,decision,reason)}/>
  const wallet=<><p className="rounded-lg bg-sky-50 p-3">Pagamentos e saques reais ainda não estão disponíveis neste piloto.</p><SupabaseWallet account={profile} disabled={busy} onInitialize={()=>controller.current!.initializeWallet()} onReserve={amount=>controller.current!.reserveWithdrawal(amount)} onCancel={row=>controller.current!.cancelWithdrawal(row)}/></>
  const reservations=<BookingReservations key={'reservations'+profile.id} account={profile} disabled={busy}/>
  const activeLinks=links.filter(row=>row.state==='active').length,pendingLinks=links.filter(row=>row.state==='pending').length
  const highlights=kind==='aluno'&&linksReady?<p className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4">{activeLinks?`Você tem ${activeLinks} profissional(is) acompanhando sua evolução.`:pendingLinks?'Seu pedido de vínculo aguarda o aceite do profissional.':'Comece escolhendo um profissional em “Profissionais”.'}</p>
   :kind==='parceiro'&&linksReady?<p className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4">{pendingLinks?`${pendingLinks} pedido(s) de vínculo aguardando seu aceite em “Meus alunos”.`:`Alunos ativos nesta página: ${activeLinks}.`}</p>
   :kind==='admin'?<PendingVideosNotice key={'pending'+profile.id} owner={profile.id} onOpen={()=>openView('feed')}/>
   :kind==='parceiro_pendente'?<p className="rounded-[12px_30px_12px_30px] border border-amber-300 bg-amber-50 p-4">Aprovação profissional pendente. Confira o andamento em “Meu cadastro profissional”.</p>:null
  const views:Record<string,()=>React.ReactNode>={
   inicio:()=><RoleOverview profile={profile} onView={openView} highlights={highlights} feed={kind==='aluno'?<StudentVideoFeed key={'feed'+profile.id} owner={profile.id} disabled={busy}/>:undefined}/>,
   perfil:()=>panel(<><h2 className="text-xl font-bold">Meu perfil</h2><p>Perfil: {profile.role==='aluno'?'Aluno':profile.role==='profissional'?'Profissional':'Administrador'}</p>{kind==='parceiro_pendente'&&<p>Aprovação profissional pendente.</p>}<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>controller.current!.renameProfile(name))}}><label className="block">Nome<Input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><Button type="submit" disabled={busy}>Salvar nome</Button></form></>),
   esg:()=>panel(<EsgProjects key={'esg'+profile.id} account={profile} disabled={busy} onSubmit={input=>controller.current!.submitEsg(input)} onReview={(row,decision,reason)=>controller.current!.reviewEsg(row,decision,reason)}/>),
   carteira:()=>panel(wallet),
   // Aluno
   profissionais:()=>panel(<>{linksReady&&!links.some(row=>row.state!=='revoked')&&<ProfessionalDirectory owner={profile.id} disabled={busy} onRequest={id=>controller.current!.requestLink(id)}/>}{linksBlock}</>),
   treino:()=>panel(training),
   parceiro:()=>panel(applications),
   // Parceiro
   alunos:()=>panel(linksBlock),
   treinos:()=>panel(training),
   cadastro:()=>panel(applications),
   'meus-videos':()=>panel(<ProfessionalVideos key={'myvideos'+profile.id} owner={profile.id} disabled={busy}/>),
   agenda:()=>kind==='parceiro'?<>{panel(<><h2 className="text-xl font-bold">Minha agenda</h2><BookingTerms key={'terms'+profile.id} owner={profile.id} disabled={busy} onSave={input=>controller.current!.saveTerms(input)}/><ProfessionalAvailability key={profile.id} owner={profile.id} selectedDay={availabilityDay} onSelectDay={setAvailabilityDay} disabled={busy} onSave={input=>controller.current!.saveAvailability(input)}/></>)}{panel(reservations)}</>:panel(reservations),
   // Admin
   aprovacoes:()=><><PendingVideosNotice key={'pendingA'+profile.id} owner={profile.id} onOpen={()=>openView('feed')}/>{panel(applications)}</>,
   feed:()=>panel(<AdminVideoReview key={'review'+profile.id} owner={profile.id} disabled={busy}/>),
   participantes:()=>panel(<AdminParticipantOverview key={'overview'+profile.id} owner={profile.id} disabled={busy}/>),
   servicos:()=>panel(<AdminServiceIntake key={'intake'+profile.id} owner={profile.id} disabled={busy}/>),
   videos:()=>panel(<SupabaseVideoPilot key={'video'+profile.id} owner={profile.id} disabled={busy}/>),
   financeiro:()=><>{panel(<><h2 className="text-xl font-bold">Financeiro</h2><p>Os parâmetros financeiros salvos como rascunho não ativam pagamentos ou distribuição de cashback.</p><HoldPolicy key={profile.id} owner={profile.id} disabled={busy}/></>)}{panel(<CashbackPolicyDrafts key={'cashdraft'+profile.id} owner={profile.id} disabled={busy}/>)}{panel(reservations)}{panel(wallet)}</>,
   ranking:()=>panel(<RankingPolicyDrafts key={profile.id} owner={profile.id} disabled={busy} onSave={input=>controller.current!.saveRankingDraft(input)}/>),
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900"><RoleShell profile={profile} view={current} onView={openView} busy={busy} onRefresh={()=>void controller.current?.refresh()} onLogout={logout}>
   {(state.error||message||notice)&&<div className="space-y-2">{alerts}</div>}
   <section aria-label={current} className="space-y-5">{views[current]()}</section>
  </RoleShell></main>
 }
 return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-3xl space-y-5"><a href="/" className="text-blue-700">369 WELLNESS · Voltar ao início</a><h1 className="text-2xl font-bold">Sua conta</h1>
 <aside aria-label="Escolha de ambiente" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-base"><p className="font-semibold">Você está na área de contas reais</p><p>Entre para ver os módulos disponíveis para seu perfil. Ranking e cashback ainda estão em preparação; as configurações administrativas são rascunhos.</p><div className="mt-3 flex flex-wrap gap-3"><a className="rounded-lg border bg-white px-4 py-3 text-blue-800 underline" href="/demonstracao.html">Ver demonstração dos perfis — dados fictícios</a><a className="rounded-lg border bg-white px-4 py-3 text-blue-800 underline" href="/evolucao.html">Ver evolução e simuladores — sem pagamentos reais</a></div></aside><Card className="space-y-4 p-6">
  {state.phase==='checking'&&<p role="status">Validando acesso… Aguarde a confirmação para entrar.</p>}
  {alerts}
  {(state.phase==='signed_out'||state.phase==='error')&&<>
   <div className="flex flex-wrap gap-2" aria-label="Opções de acesso">{([['login','Entrar'],['signup','Criar conta'],['recover','Recuperar senha']] as const).map(([value,label])=><Button key={value} type="button" variant={mode===value?'default':'outline'} disabled={state.busy||!controller.current} onClick={()=>chooseMode(value)}>{label}</Button>)}</div>
   {mode!=='recover'&&google&&<><button type="button" disabled={state.busy||!controller.current} onClick={()=>void act(()=>controller.current!.loginWithGoogle())} className="flex min-h-11 w-full items-center justify-center gap-3 rounded-[10px_22px_10px_22px] border border-[#747775] bg-white px-4 py-2 font-semibold text-[#1f1f1f] hover:bg-[#f2f2f2]">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
    {mode==='signup'?'Cadastrar com Google':'Entrar com Google'}</button>
   <p className="text-center text-sm text-[#626274]">ou use seu e-mail</p></>}
   <form className="space-y-4" onSubmit={e=>{e.preventDefault();void submitAccess()}}>
    {mode==='signup'&&<><label className="block">Nome completo<Input autoComplete="name" required maxLength={160} value={fullName} onChange={e=>setFullName(e.target.value)} disabled={state.busy}/></label>
    <label className="block">Celular (WhatsApp)<Input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" required maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} disabled={state.busy}/></label></>}
    <label className="block">E-mail<Input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={state.busy}/></label>
    {mode!=='recover'&&<label className="block">{mode==='signup'?'Nova senha':'Senha'}<Input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?10:undefined} maxLength={mode==='signup'?72:1024} value={password} onChange={e=>setPassword(e.target.value)} disabled={state.busy}/></label>}
    {mode==='signup'&&<><p>Use pelo menos 10 caracteres. O cadastro inicial é de aluno; o acesso profissional depende de aprovação.</p><label className="block">Confirme a senha<Input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={state.busy}/></label></>}
    {mode==='recover'&&codeSent&&<label className="block">Código recebido no e-mail<Input inputMode="numeric" autoComplete="one-time-code" required maxLength={12} placeholder="123456" value={code} onChange={e=>setCode(e.target.value)} disabled={state.busy}/></label>}
    {mode==='recover'&&codeSent&&<p className="text-sm">Também é possível clicar no link do e-mail. <button type="button" className="underline" onClick={()=>{setCodeSent(false);setCode('');setNotice('')}}>Enviar outro código</button></p>}
    <Button type="submit" disabled={state.busy||!controller.current}>{mode==='login'?'Entrar':mode==='signup'?'Cadastrar':codeSent?'Confirmar código':'Enviar código'}</Button>
   </form><Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={()=>void act(async()=>{await controller.current!.resendConfirmation(email);setNotice('Se o cadastro estiver aguardando confirmação, um novo e-mail será enviado. Use somente o link mais recente; confira também o spam.')})}>Reenviar confirmação de e-mail</Button><p className="text-sm">Se a confirmação abrir uma página “localhost”, o endereço de retorno no Supabase precisa ser configurado. Não crie outra conta.</p></>}
  {state.phase==='password_recovery'&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();if(password!==confirmation){setMessage('As senhas precisam ser iguais.');setPassword('');setConfirmation('');return}void act(async()=>{await controller.current!.updateRecoveredPassword(password);chooseMode('login');setNotice('Senha atualizada. Entre novamente.')})}}><p>Defina uma nova senha com pelo menos 10 caracteres.</p><label className="block">Nova senha<Input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} disabled={state.busy}/></label><label className="block">Confirme a nova senha<Input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={state.busy}/></label><Button type="submit" disabled={state.busy||!controller.current}>Salvar nova senha</Button></form>}
  {state.phase==='profile_missing'&&<><p>Escolha o nome que deseja exibir na sua conta.</p><form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>controller.current!.createProfile(name))}}><label className="block">Nome<Input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} disabled={state.busy}/></label><Button type="submit" disabled={state.busy}>Criar meu perfil</Button></form></>}
  {state.phase!=='signed_out'&&<div className="flex gap-3"><Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={()=>void controller.current?.refresh()}>Atualizar conta</Button><Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={logout}>Sair deste dispositivo</Button></div>}
 </Card></div></main>
}

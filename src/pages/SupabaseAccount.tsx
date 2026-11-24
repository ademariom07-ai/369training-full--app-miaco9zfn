import {PendingVideosNotice} from '@/components/VideoFeed'
import {unreadTotal} from '@/lib/supabase/chat'
import {StudentJourney,PartnerJourney,HowItWorks} from '@/components/Journey'
import {formatBrazilPhone,readMyPhone,saveMyPhone,suggestEmail} from '@/lib/supabase/onboarding'
import {RoleShell,RoleOverview,pickView,roleKind} from '@/components/RoleHome'
import {saoPauloToday} from '@/lib/supabase/availability'
import React,{Suspense,lazy,useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Card} from '@/components/ui/card'
import {getSupabaseClient} from '@/lib/supabase/client'
import InstallApp from '@/components/InstallApp'
import {enabledProviders} from '@/lib/supabase/authProviders'
import {normalizeBrazilPhone,normalizeFullName} from '@/lib/supabase/phone'
import {createAccountSession,type AccountState} from '@/lib/supabase/accountSession'
import {readParticipantLinks,type ParticipantLink} from '@/lib/supabase/participantLinks'
// Telas carregadas sob demanda: o app abre mais rápido e só baixa o que a pessoa usa.
const BookingReservations=lazy(()=>import('@/components/BookingReservations'))
const CashbackPolicyDrafts=lazy(()=>import('@/components/CashbackPolicyDrafts'))
const AdminServiceIntake=lazy(()=>import('@/components/AdminServiceIntake'))
const SupabaseVideoPilot=lazy(()=>import('@/components/SupabaseVideoPilot'))
const AdminParticipantOverview=lazy(()=>import('@/components/AdminParticipantOverview'))
const EsgProjects=lazy(()=>import('@/components/EsgProjects'))
const BookingTerms=lazy(()=>import('@/components/BookingTerms'))
const ProfessionalAvailability=lazy(()=>import('@/components/ProfessionalAvailability'))
const ReleasedAvailability=lazy(()=>import('@/components/ReleasedAvailability'))
const RankingPolicyDrafts=lazy(()=>import('@/components/RankingPolicyDrafts'))
const SupabaseWallet=lazy(()=>import('@/components/SupabaseWallet'))
const TrainingPlans=lazy(()=>import('@/components/TrainingPlans'))
const ProfessionalApplications=lazy(()=>import('@/components/ProfessionalApplications'))
const StudentRoutines=lazy(()=>import('@/components/Routines').then(m=>({default:m.StudentRoutines})))
const ProRoutines=lazy(()=>import('@/components/Routines').then(m=>({default:m.ProRoutines})))
const AiRoutine=lazy(()=>import('@/components/AiRoutine'))
const Isis=lazy(()=>import('@/components/Isis'))
const ContentLibrary=lazy(()=>import('@/components/Contents'))
const ContentManager=lazy(()=>import('@/components/Contents').then(m=>({default:m.ContentManager})))
const ContentReview=lazy(()=>import('@/components/Contents').then(m=>({default:m.ContentReview})))
const RatingBadge=lazy(()=>import('@/components/Reviews').then(m=>({default:m.RatingBadge})))
const ReviewButton=lazy(()=>import('@/components/Reviews').then(m=>({default:m.ReviewButton})))
const AdminReviews=lazy(()=>import('@/components/Reviews').then(m=>({default:m.AdminReviews})))
const StudentChallenges=lazy(()=>import('@/components/Challenges'))
const ChallengeManager=lazy(()=>import('@/components/Challenges').then(m=>({default:m.ChallengeManager})))
const ChallengeHighlight=lazy(()=>import('@/components/Challenges').then(m=>({default:m.ChallengeHighlight})))
const HydrationCard=lazy(()=>import('@/components/Challenges').then(m=>({default:m.HydrationCard})))
const HydrationReminder=lazy(()=>import('@/components/Challenges').then(m=>({default:m.HydrationReminder})))
const ContentHighlights=lazy(()=>import('@/components/Contents').then(m=>({default:m.ContentHighlights})))
const ExerciseLibraryManager=lazy(()=>import('@/components/ExerciseLibraryManager'))
const Chat=lazy(()=>import('@/components/Chat'))
const ProfessionalSearch=lazy(()=>import('@/components/Showcase').then(m=>({default:m.ProfessionalSearch})))
const MyShowcase=lazy(()=>import('@/components/Showcase').then(m=>({default:m.MyShowcase})))
const HoldPolicy=lazy(()=>import('@/components/BookingHoldControls').then(m=>({default:m.HoldPolicy})))
const StudentVideoFeed=lazy(()=>import('@/components/VideoFeed').then(m=>({default:m.StudentVideoFeed})))
const ProfessionalVideos=lazy(()=>import('@/components/VideoFeed').then(m=>({default:m.ProfessionalVideos})))
const AdminVideoReview=lazy(()=>import('@/components/VideoFeed').then(m=>({default:m.AdminVideoReview})))
const initial:AccountState={phase:'checking',profile:null,busy:false,error:''}
export default function SupabaseAccount({redirectPath='/conta-supabase'}:{redirectPath?:string}={}){
 const [state,setState]=useState(initial),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState(''),[links,setLinks]=useState<ParticipantLink[]>([]),[linkError,setLinkError]=useState(''),[linksLoading,setLinksLoading]=useState(false),[linkPage,setLinkPage]=useState(1),[ending,setEnding]=useState<ParticipantLink|null>(null),[linkOwner,setLinkOwner]=useState<string|null>(null)
 const [availabilityDay,setAvailabilityDay]=useState(()=>saoPauloToday())
 const [mode,setMode]=useState<'login'|'signup'|'recover'>('login'),[confirmation,setConfirmation]=useState(''),[notice,setNotice]=useState('')
 const [fullName,setFullName]=useState(''),[phone,setPhone]=useState(''),[code,setCode]=useState(''),[codeSent,setCodeSent]=useState(false)
 const [view,setView]=useState(()=>typeof window==='undefined'?'':decodeURIComponent(window.location.hash.slice(1)))
 const [aiStudent,setAiStudent]=useState<string|null>(null)
 const [chatWith,setChatWith]=useState<string|null>(null),[unread,setUnread]=useState(0)
 const [google,setGoogle]=useState(false),[myPhone,setMyPhone]=useState(''),[phoneDraft,setPhoneDraft]=useState(''),[phoneNote,setPhoneNote]=useState('')
 // Voltar do celular/navegador volta para a tela anterior do app, sem perder o lugar.
 useEffect(()=>{const back=()=>{setView(decodeURIComponent(window.location.hash.slice(1)));setMessage('');setNotice('')};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back)},[])
 useEffect(()=>{let alive=true;void enabledProviders().then(set=>{if(alive)setGoogle(set.has('google'))});return()=>{alive=false}},[])
 const controller=useRef<ReturnType<typeof createAccountSession>|null>(null)
 useEffect(()=>{
  try{const session=createAccountSession(getSupabaseClient(),setState,undefined,new URL(redirectPath,window.location.origin).href);controller.current=session;session.start();return()=>{session.dispose();controller.current=null}}
  catch{setState({phase:'error',profile:null,busy:false,error:'O acesso está indisponível neste ambiente.'})}
 },[])
 useEffect(()=>{setLinkPage(1)},[state.profile?.id])
 const checkUnread=React.useCallback(()=>{unreadTotal().then(setUnread).catch(()=>{})},[])
 useEffect(()=>{setUnread(0);if(state.phase!=='ready'||!state.profile)return;checkUnread();const id=setInterval(()=>{if(document.visibilityState==='visible')checkUnread()},60000);return()=>clearInterval(id)},[state.phase,state.profile?.id,checkUnread])
 useEffect(()=>{setMyPhone('');setPhoneDraft('');setPhoneNote('');if(state.phase!=='ready'||!state.profile)return;let alive=true;readMyPhone().then(p=>{if(alive&&p){setMyPhone(p);setPhoneDraft(formatBrazilPhone(p))}}).catch(()=>{});return()=>{alive=false}},[state.phase,state.profile?.id])
 useEffect(()=>{setLinkOwner(null);setEnding(null);setName(state.profile?.display_name||'');setLinks([]);setLinkError('');setLinksLoading(false);let active=true
  if(state.phase==='ready'&&state.profile){
   setLinksLoading(true)
   const client=getSupabaseClient(),role=state.profile.role
   const request=role==='aluno'||role==='profissional'&&state.profile.approved?readParticipantLinks(state.profile,role==='aluno'?1:linkPage,client):Promise.resolve([])
   request.then(rows=>{if(active){setLinks(rows);setLinkOwner(state.profile!.id)}}).catch(()=>{if(active)setLinkError('Não foi possível carregar seus vínculos.')}).finally(()=>{if(active)setLinksLoading(false)})
  }
  return()=>{active=false}
 },[state.phase,state.profile,linkPage])
 async function act(task:()=>Promise<void>){setMessage('');setNotice('');try{await task()}catch(err){const shown=['Digite um celular válido com DDD, por exemplo (11) 98765-4321.','Entrar com Google está indisponível no momento.','Código inválido ou expirado. Peça um novo código.','Digite o código de 6 dígitos que chegou no e-mail.','Aguarde 1 minuto antes de tentar novamente.','Muitas tentativas. Aguarde alguns minutos e tente novamente.','Confira o e-mail, a senha e a confirmação do endereço antes de entrar.','Confirme seu e-mail antes de entrar.'];setMessage(err instanceof Error&&shown.includes(err.message)?err.message:'Não foi possível concluir. Verifique os dados e tente novamente.')}finally{setPassword('');setConfirmation('')}}
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
 function openView(id:string){setView(id);setMessage('');setNotice('');try{if(window.location.hash!=='#'+id)window.history.pushState(null,'','#'+id)}catch{/* sem histórico */}window.scrollTo?.({top:0})}
 function startChat(id:string){setChatWith(id);openView('mensagens')}
 const logout=()=>void act(async()=>{await controller.current!.logout();setEmail('');setName('')})
 const alerts=<>{state.error&&<p role="alert">{state.error}</p>}{message&&<p role="alert">{message}</p>}{notice&&<p role="status">{notice}</p>}</>
 if(state.phase==='ready'&&profile){
  const kind=roleKind(profile),current=pickView(profile,view),busy=state.busy
  const linksReady=linkOwner===profile.id&&!linksLoading&&!linkError
  const panel=(children:React.ReactNode)=><Card className="space-y-4 p-6">{children}</Card>
  const linksBlock=<><h2 className="text-lg font-semibold">{kind==='aluno'?'Seus profissionais':'Seus alunos'}</h2>{linkError?<p role="alert">{linkError}</p>:linksLoading||linkOwner!==profile.id?<p role="status">Carregando vínculos…</p>:links.length?<ul className="space-y-2">{links.map(row=><li key={row.student_id} className="rounded-lg border p-3"><p>{row.state==='pending'?'Aguardando aceite':row.state==='active'?'Ativo':'Encerrado'}</p><p>{kind==='aluno'?'Profissional':'Aluno'}: {row.participant_name||(row.state==='revoked'?'Vínculo encerrado':'Nome indisponível')}</p>{kind==='aluno'&&row.state!=='revoked'&&<ReleasedAvailability key={profile.id+row.professional_id} owner={profile.id} professionalId={row.professional_id} disabled={busy}/>}<p className="text-sm text-slate-600">Solicitado em {new Date(row.requested_at).toLocaleString('pt-BR')}</p>{kind==='parceiro'&&<Suspense fallback={null}><div className="mt-1"><RatingBadge user={row.student_id}/></div></Suspense>}{(row.state==='active'||(row.state==='revoked'&&row.accepted_at))&&(kind==='aluno'||kind==='parceiro')&&<Suspense fallback={null}><div className="mt-2"><ReviewButton user={kind==='aluno'?row.professional_id:row.student_id} name={row.participant_name||(kind==='aluno'?'o profissional':'o aluno')} role={kind==='aluno'?'aluno':'profissional'}/></div></Suspense>}{row.state!=='revoked'&&<div className="mt-2 flex gap-2">{kind==='parceiro'&&row.state==='pending'&&<Button type="button" disabled={busy||linksLoading} onClick={()=>void act(()=>controller.current!.acceptLink(row))}>Aceitar vínculo</Button>}<Button type="button" variant="outline" disabled={busy} onClick={()=>startChat(kind==='aluno'?row.professional_id:row.student_id)}>Mensagem</Button><Button type="button" variant="outline" disabled={busy||linksLoading} onClick={()=>setEnding(row)}>Encerrar vínculo</Button></div>}</li>)}</ul>:<p>{kind==='aluno'?'Você ainda não tem vínculo com um profissional.':'Nenhum vínculo nesta página.'}</p>}{ending&&linkOwner===profile.id&&<div className="space-y-3 rounded-lg border p-4" role="group" aria-label="Confirmar encerramento"><p>{kind==='aluno'?'Profissional':'Aluno'}: {ending.participant_name||'Nome indisponível'}</p><p>Encerrar o vínculo solicitado em {new Date(ending.requested_at).toLocaleString('pt-BR')}? Será necessário um novo pedido e aceite para retomá-lo.</p><div className="flex gap-2"><Button type="button" disabled={busy} onClick={()=>void act(async()=>{await controller.current!.revokeLink(ending);setEnding(null)})}>Confirmar encerramento</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setEnding(null)}>Cancelar</Button></div></div>}{kind==='parceiro'&&<div className="flex items-center gap-3"><Button type="button" variant="outline" disabled={linksLoading||busy||linkPage<=1} onClick={()=>setLinkPage(p=>p-1)}>Anterior</Button><span>Página {linkPage}</span><Button type="button" variant="outline" disabled={linksLoading||busy||links.length<20||linkPage>=10000} onClick={()=>setLinkPage(p=>p+1)}>Próxima</Button></div>}</>
  const training=linksReady&&(kind==='aluno'||kind==='parceiro')?<TrainingPlans account={profile} links={links} disabled={busy} onPublish={(link,title,content)=>controller.current!.publishTraining(link,title,content)} onRead={id=>controller.current!.readTraining(id)} onComplete={id=>controller.current!.completeTraining(id)}/>:<p role="status">Carregando treinos…</p>
  const applications=<ProfessionalApplications account={profile} disabled={busy} onSubmit={(specialty,credential)=>controller.current!.applyProfessional(specialty,credential)} onReview={(row,decision,reason)=>controller.current!.reviewProfessional(row,decision,reason)}/>
  const wallet=<><p className="rounded-lg bg-sky-50 p-3">Pagamentos e saques reais ainda não estão disponíveis neste piloto.</p><SupabaseWallet account={profile} disabled={busy} onInitialize={()=>controller.current!.initializeWallet()} onReserve={amount=>controller.current!.reserveWithdrawal(amount)} onCancel={row=>controller.current!.cancelWithdrawal(row)}/></>
  const reservations=<BookingReservations key={'reservations'+profile.id} account={profile} disabled={busy}/>
  const activeLinks=links.filter(row=>row.state==='active').length,pendingLinks=links.filter(row=>row.state==='pending').length
  const partnerShortcuts=<section className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4" aria-label="Atalhos"><h3 className="font-extrabold">Atalhos do dia</h3><div className="mt-2 flex flex-wrap gap-2"><Button type="button" onClick={()=>openView('isis')}>Falar com a Ísis</Button><Button type="button" variant="outline" onClick={()=>openView('treinos')}>O que meus alunos fizeram</Button><Button type="button" variant="outline" onClick={()=>openView('meus-conteudos')}>Novo conteúdo</Button></div></section>
  const highlights=kind==='parceiro'&&linksReady?<><p className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4">{pendingLinks?`${pendingLinks} pedido(s) de vínculo aguardando seu aceite em “Meus alunos”.`:`Alunos ativos nesta página: ${activeLinks}.`}</p>{partnerShortcuts}</>
   :kind==='aluno'?<div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2"><HydrationCard key={'hc'+profile.id} compact onOpen={()=>openView('desafios')}/><ChallengeHighlight key={'chl'+profile.id} owner={profile.id} onView={openView}/></div><ContentHighlights key={'chh'+profile.id} owner={profile.id} onView={openView} title="Conteúdos para você" scope="todos" max={4}/></div>
   :kind==='admin'?<PendingVideosNotice key={'pending'+profile.id} owner={profile.id} onOpen={()=>openView('feed')}/>
   :kind==='parceiro_pendente'?<p className="rounded-[12px_30px_12px_30px] border border-amber-300 bg-amber-50 p-4">Aprovação profissional pendente. Confira o andamento em “Meu cadastro profissional”.</p>:null
  const views:Record<string,()=>React.ReactNode>={
   'como-funciona':()=><HowItWorks owner={profile.id} kind={kind} onView={openView}/>,
   inicio:()=><RoleOverview profile={profile} onView={openView} highlights={highlights} journey={kind==='aluno'?<StudentJourney key={'j'+profile.id} owner={profile.id} links={links} onView={openView}/>:kind==='parceiro'?<PartnerJourney key={'j'+profile.id} owner={profile.id} links={links} onView={openView}/>:undefined} feed={kind==='aluno'?<StudentVideoFeed key={'feed'+profile.id} owner={profile.id} disabled={busy}/>:undefined}/>,
   perfil:()=>panel(<><h2 className="text-xl font-bold">Meu perfil</h2><p>Perfil: {profile.role==='aluno'?'Aluno':profile.role==='profissional'?'Profissional':'Administrador'}</p>{kind==='parceiro_pendente'&&<p>Aprovação profissional pendente.</p>}<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>controller.current!.renameProfile(name))}}><label className="block">Nome<Input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><Button type="submit" disabled={busy}>Salvar nome</Button></form><form className="space-y-3 border-t pt-4" onSubmit={e=>{e.preventDefault();setPhoneNote('');void act(async()=>{const saved=await saveMyPhone(phoneDraft);setMyPhone(saved);setPhoneDraft(formatBrazilPhone(saved));setPhoneNote('Celular salvo.')})}}><label className="block">Celular (WhatsApp)<Input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" required maxLength={40} value={phoneDraft} onChange={e=>setPhoneDraft(e.target.value)} disabled={busy}/></label>{!myPhone&&<p className="text-sm">Informe seu celular para os profissionais conseguirem falar com você.</p>}{phoneNote&&<p role="status">{phoneNote}</p>}<Button type="submit" disabled={busy}>{myPhone?'Corrigir celular':'Salvar celular'}</Button></form></>),
   esg:()=>panel(<EsgProjects key={'esg'+profile.id} account={profile} disabled={busy} onSubmit={input=>controller.current!.submitEsg(input)} onReview={(row,decision,reason)=>controller.current!.reviewEsg(row,decision,reason)}/>),
   carteira:()=>panel(wallet),
   // Aluno
   profissionais:()=><>{panel(<ProfessionalSearch owner={profile.id} disabled={busy} canRequest={linksReady&&!links.some(row=>row.state!=='revoked')} onRequest={async id=>{await controller.current!.requestLink(id)}} onChat={startChat}/>)}{panel(linksBlock)}</>,
   mensagens:()=>panel(<Chat key={'chat'+profile.id} owner={profile.id} role={profile.role==='admin'?'admin':profile.role==='profissional'?'profissional':'aluno'} startWith={chatWith} onUnreadChange={checkUnread}/>),
   'meus-exercicios':()=>panel(<ExerciseLibraryManager key={'lib'+profile.id} role="profissional"/>),
   biblioteca:()=>panel(<ExerciseLibraryManager key={'libadm'+profile.id} role="admin"/>),
   vitrine:()=>panel(<MyShowcase key={'vitrine'+profile.id} owner={profile.id} disabled={busy}/>),
   treino:()=><>{panel(<StudentRoutines key={'rt'+profile.id} owner={profile.id} onAi={()=>openView('ia')} legacy={training}/>)}<ContentHighlights key={'ch'+profile.id} owner={profile.id} onView={openView}/></>,
   desafios:()=>panel(<StudentChallenges key={'dc'+profile.id} owner={profile.id}/>),
   'desafios-pro':()=>panel(<ChallengeManager key={'dcp'+profile.id} owner={profile.id} role="profissional"/>),
   avaliacoes:()=>panel(<AdminReviews key={'rv'+profile.id} owner={profile.id}/>),
   'desafios-admin':()=>panel(<ChallengeManager key={'dca'+profile.id} owner={profile.id} role="admin"/>),
   conteudos:()=>panel(<ContentLibrary key={'cl'+profile.id} owner={profile.id} onChat={startChat}/>),
   'meus-conteudos':()=>panel(linksReady?<ContentManager key={'cm'+profile.id} owner={profile.id} role="profissional" links={links}/>:<p role="status">Carregando…</p>),
   'conteudos-admin':()=><>{panel(<ContentReview key={'cr'+profile.id} owner={profile.id}/>)}{panel(<ContentManager key={'cma'+profile.id} owner={profile.id} role="admin" links={[]}/>)}</>,
   ia:()=>panel(<AiRoutine key={'ai'+profile.id+(aiStudent||'')} owner={profile.id} role={kind==='aluno'?'aluno':'profissional'} links={links} initialStudent={aiStudent} onOpenPlans={()=>openView('treinos')}/>),
   parceiro:()=>panel(applications),
   // Parceiro
   alunos:()=>panel(linksBlock),
   treinos:()=><>{panel(linksReady?<ProRoutines key={'pr'+profile.id} owner={profile.id} links={links} onAi={id=>{setAiStudent(id);openView('ia')}}/>:<p role="status">Carregando…</p>)}{panel(<details><summary className="min-h-11 cursor-pointer py-2 font-bold">Planos em texto (modelo anterior)</summary><div className="mt-3">{training}</div></details>)}</>,
   isis:()=>panel(linksReady?<Isis key={'isis'+profile.id} owner={profile.id} links={links} onOpenPlans={()=>openView('treinos')}/>:<p role="status">Carregando…</p>),
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
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900"><RoleShell profile={profile} view={current} onView={id=>{if(id!=='mensagens')setChatWith(null);openView(id)}} badges={{mensagens:unread}} busy={busy} onRefresh={()=>void controller.current?.refresh()} onLogout={logout}>
   {(state.error||message||notice)&&<div className="space-y-2">{alerts}</div>}
   <section aria-label={current} className="space-y-5"><Suspense fallback={<p role="status">Carregando…</p>}>{views[current]()}</Suspense></section>
   {kind==='aluno'&&<Suspense fallback={null}><HydrationReminder key={'hr'+profile.id}/></Suspense>}
  </RoleShell></main>
 }
 return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-3xl space-y-5"><a href="/" className="text-blue-700">369 WELLNESS · Voltar ao início</a><h1 className="text-2xl font-bold">Sua conta</h1>
 <InstallApp/><aside aria-label="Sobre a 369" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-base"><p className="font-semibold">Foco, disciplina e estratégia para o seu bem-estar.</p><p>Encontre profissionais perto de você ou online e organize treinos, agenda e evolução em um só lugar. Criar conta é grátis e leva 1 minuto.</p><p className="mt-2"><a className="underline" href="/#como-funciona">Como funciona a 369</a></p></aside><Card className="space-y-4 p-6">
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
    {mode!=='login'&&suggestEmail(email)&&<p className="text-sm" role="status">Você quis dizer <b>{suggestEmail(email)}</b>? <button type="button" className="underline" onClick={()=>setEmail(suggestEmail(email)!)}>Usar este e-mail</button></p>}
    {mode==='signup'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())&&!suggestEmail(email)&&<p className="text-sm text-[#626274]">Confira: vamos usar <b>{email.trim().toLowerCase()}</b> para a sua conta.</p>}
    {mode!=='recover'&&<label className="block">{mode==='signup'?'Nova senha':'Senha'}<Input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?10:undefined} maxLength={mode==='signup'?72:1024} value={password} onChange={e=>setPassword(e.target.value)} disabled={state.busy}/></label>}
    {mode==='signup'&&<><p>Use pelo menos 10 caracteres. O cadastro inicial é de aluno; o acesso profissional depende de aprovação.</p><label className="block">Confirme a senha<Input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={state.busy}/></label></>}
    {mode==='recover'&&codeSent&&<label className="block">Código recebido no e-mail<Input inputMode="numeric" autoComplete="one-time-code" required maxLength={12} placeholder="123456" value={code} onChange={e=>setCode(e.target.value)} disabled={state.busy}/></label>}
    {mode==='recover'&&codeSent&&<p className="text-sm">Também é possível clicar no link do e-mail. <button type="button" className="underline" onClick={()=>{setCodeSent(false);setCode('');setNotice('')}}>Enviar outro código</button></p>}
    <Button type="submit" disabled={state.busy||!controller.current}>{mode==='login'?'Entrar':mode==='signup'?'Cadastrar':codeSent?'Confirmar código':'Enviar código'}</Button>
   </form>{message==='Confirme seu e-mail antes de entrar.'&&<Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={()=>void act(async()=>{await controller.current!.resendConfirmation(email);setNotice('Se o cadastro estiver aguardando confirmação, um novo e-mail será enviado. Use somente o link mais recente; confira também o spam.')})}>Reenviar confirmação de e-mail</Button>}</>}
  {state.phase==='password_recovery'&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();if(password!==confirmation){setMessage('As senhas precisam ser iguais.');setPassword('');setConfirmation('');return}void act(async()=>{await controller.current!.updateRecoveredPassword(password);chooseMode('login');setNotice('Senha atualizada. Entre novamente.')})}}><p>Defina uma nova senha com pelo menos 10 caracteres.</p><label className="block">Nova senha<Input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} disabled={state.busy}/></label><label className="block">Confirme a nova senha<Input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={state.busy}/></label><Button type="submit" disabled={state.busy||!controller.current}>Salvar nova senha</Button></form>}
  {state.phase==='profile_missing'&&<><p>Escolha o nome que deseja exibir na sua conta.</p><form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>controller.current!.createProfile(name))}}><label className="block">Nome<Input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} disabled={state.busy}/></label><Button type="submit" disabled={state.busy}>Criar meu perfil</Button></form></>}
  {state.phase!=='signed_out'&&<div className="flex gap-3"><Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={()=>void controller.current?.refresh()}>Atualizar conta</Button><Button type="button" variant="outline" disabled={state.busy||!controller.current} onClick={logout}>Sair deste dispositivo</Button></div>}
 </Card></div></main>
}

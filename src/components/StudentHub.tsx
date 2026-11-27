import React,{Suspense,lazy,useState} from 'react'
import {Activity,ArrowLeft,Dumbbell,MessageCircle,Ruler} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {RatingBadge,ReviewButton} from '@/components/Reviews'
import type {ParticipantLink} from '@/lib/supabase/participantLinks'

const ProRoutines=lazy(()=>import('@/components/Routines').then(m=>({default:m.ProRoutines})))
const ProActivity=lazy(()=>import('@/components/WorkoutLog').then(m=>({default:m.ProActivity})))
const ProBody=lazy(()=>import('@/components/BodyProgress').then(m=>({default:m.ProBody})))
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback

type Tab='treinos'|'atividade'|'medidas'
// Ficha do aluno (parceiro): tudo do aluno num lugar só — treinos e dietas, o que ele fez, medidas e fotos, mensagem e avaliação.
export default function StudentHub({owner,link,onBack,onChat,onAi,onRevoke}:{owner:string,link:ParticipantLink,onBack:()=>void,onChat:(id:string)=>void,onAi:(id:string)=>void,onRevoke:()=>Promise<void>}){
 const [tab,setTab]=useState<Tab>('treinos'),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const name=link.participant_name||'Aluno'
 async function revoke(){setBusy(true);setError('');try{await onRevoke()}catch(err){setError(errorText(err,'Não foi possível encerrar o vínculo.'))}finally{setBusy(false)}}
 const tabs:[Tab,string,typeof Dumbbell][]=[['treinos','Treinos e dietas',Dumbbell],['atividade','O que fez e evolução',Activity],['medidas','Medidas e fotos',Ruler]]
 return <section className="space-y-4" aria-label={`Ficha de ${name}`}>
  <Button type="button" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4"/>Meus alunos</Button>
  <header className="space-y-2 rounded-[12px_30px_12px_30px] bg-[#33325a] p-5 text-[#f7f6f2]">
   <p className="text-sm font-bold uppercase tracking-wider text-[#a5ce41]">Ficha do aluno</p>
   <h2 className="text-2xl font-extrabold text-[#f7f6f2]">{name}</h2>
   <p className="text-sm text-[#d5d4e1]">{link.accepted_at?`Acompanhando desde ${new Date(link.accepted_at).toLocaleDateString('pt-BR')}`:'Vínculo ativo'}</p>
   <div className="inline-block rounded-md bg-white/95 px-2 py-1 text-[#33325a]"><RatingBadge user={link.student_id}/></div>
   <div className="flex flex-wrap gap-2 pt-1">
    <Button type="button" className="!bg-[#a5ce41] !text-[#33325a]" onClick={()=>onChat(link.student_id)}><MessageCircle aria-hidden="true" className="mr-2 h-4 w-4"/>Mensagem</Button>
    <div className="rounded-md bg-white p-1 text-[#33325a]"><ReviewButton user={link.student_id} name={name} role="profissional"/></div>
   </div>
  </header>
  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções da ficha">{tabs.map(([k,l,Icon])=><Button key={k} type="button" role="tab" aria-selected={tab===k} variant={tab===k?'default':'outline'} onClick={()=>setTab(k)}><Icon aria-hidden="true" className="mr-2 h-4 w-4"/>{l}</Button>)}</div>
  <div className={card}><Suspense fallback={<p role="status">Carregando…</p>}>
   {tab==='treinos'&&<ProRoutines key={'r'+link.student_id} owner={owner} links={[link]} onAi={onAi} focus/>}
   {tab==='atividade'&&<ProActivity key={'a'+link.student_id} student={link.student_id} owner={owner} only/>}
   {tab==='medidas'&&<ProBody key={'b'+link.student_id} student={link.student_id} owner={owner}/>}
  </Suspense></div>
  <div className={card+' space-y-2'}>
   {!confirm?<Button type="button" variant="outline" onClick={()=>setConfirm(true)}>Encerrar vínculo com {name.split(' ')[0]}</Button>
   :<><p>Encerrar o acompanhamento de <b>{name}</b>? Ele deixa de aparecer em "Meus alunos" e perde o acesso aos seus treinos. Para voltar, será preciso um novo pedido e aceite.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={()=>void revoke()}>Confirmar encerramento</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancelar</Button></div></>}
   {error&&<p role="alert" className="text-sm">{error}</p>}
  </div>
 </section>
}

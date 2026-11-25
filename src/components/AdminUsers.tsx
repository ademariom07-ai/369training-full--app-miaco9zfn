import React,{useCallback,useEffect,useRef,useState} from 'react'
import {Search,ShieldAlert,Trash2,UserCheck,UserX} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {adminDeleteAccount,adminListActions,adminListUsers,adminReviewPartner,adminSetPartner,deleteOutcomes,filterLabels,specialtyLabels,type AdminUser,type UserFilter} from '@/lib/supabase/adminUsers'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const dateBr=(iso:string|null)=>iso?new Date(iso).toLocaleDateString('pt-BR'):'—'
const actionLabels:Record<string,string>={excluir_conta:'Excluiu a conta',anonimizar_conta:'Anonimizou a conta',suspender_parceiro:'Suspendeu o parceiro',reativar_parceiro:'Reativou o parceiro'}

function roleText(u:AdminUser){
 if(u.deleted)return 'Conta excluída'
 if(u.role==='admin')return 'Admin'
 if(u.role==='profissional')return u.approved?'Parceiro ativo':u.application_status==='approved'?'Parceiro suspenso':'Parceiro pendente'
 return 'Aluno'
}

type Mode={kind:'aprovar'|'recusar'|'suspender'|'reativar'|'excluir',user:AdminUser}
function ActionPanel({mode,onDone,onCancel}:{mode:Mode,onDone:(msg:string)=>void,onCancel:()=>void}){
 const [reason,setReason]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const u=mode.user
 const titles={aprovar:'Aprovar como parceiro',recusar:'Recusar pedido de parceiro',suspender:'Suspender parceiro',reativar:'Reativar parceiro',excluir:'Excluir conta'}
 async function run(){setBusy(true);setError('')
  try{
   if(mode.kind==='excluir'){const out=await adminDeleteAccount(u.user_id,confirm,reason);onDone(deleteOutcomes[out]??'Conta excluída.')}
   else if(mode.kind==='aprovar'||mode.kind==='recusar'){await adminReviewPartner(u,mode.kind==='aprovar',reason);onDone(mode.kind==='aprovar'?`${u.display_name} agora é parceiro.`:'Pedido recusado.')}
   else{await adminSetPartner(u.user_id,mode.kind==='reativar',reason);onDone(mode.kind==='reativar'?'Parceiro reativado.':'Parceiro suspenso: ele perde o acesso às funções de parceiro até ser reativado.')}
  }catch(err){setError(errorText(err,'Não foi possível concluir.'))}finally{setBusy(false)}}
 return <div className={'mt-3 space-y-3 rounded-md border p-3 '+(mode.kind==='excluir'?'border-red-300 bg-red-50':'border-[#a5ce41] bg-[#f7f6f2]')} role="group" aria-label={titles[mode.kind]}>
  <p className="font-extrabold">{titles[mode.kind]}: {u.display_name}</p>
  {mode.kind==='excluir'&&<ul className="list-disc pl-5 text-sm">
   <li>Apaga a conta e os dados pessoais (perfil, contato, região, vitrine, treinos, mensagens, conteúdos, avaliações).</li>
   <li>Se houver registros que precisam ficar guardados (reservas, carteira, histórico), a conta é <b>anonimizada</b> em vez de apagada, e o login é bloqueado.</li>
   <li><b>Não dá para desfazer.</b></li></ul>}
  {mode.kind==='suspender'&&<p className="text-sm">O parceiro deixa de aparecer na busca e perde as funções de parceiro (treinos, conteúdos, Ísis) até ser reativado. Os alunos continuam com o vínculo.</p>}
  <label className="block text-sm font-semibold">Motivo (fica registrado)<Input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder={mode.kind==='excluir'?'Ex.: pedido do usuário (LGPD)':mode.kind==='recusar'?'Ex.: registro profissional não confere':'Ex.: documentação conferida'}/></label>
  {mode.kind==='excluir'&&<label className="block text-sm font-semibold">Para confirmar, digite o e-mail <b>{u.email||'—'}</b> ou o nome <b>{u.display_name}</b><Input value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off"/></label>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
  <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy||reason.trim().length<3||(mode.kind==='excluir'&&!confirm.trim())} onClick={()=>void run()} className={mode.kind==='excluir'?'!bg-[#b42318] !text-white':''}>{mode.kind==='excluir'?'Excluir definitivamente':'Confirmar'}</Button>
   <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
 </div>
}

function UserRow({u,mode,setMode,onDone}:{u:AdminUser,mode:Mode|null,setMode:(m:Mode|null)=>void,onDone:(msg:string)=>void}){
 const pending=u.application_status==='pending',suspended=u.role==='profissional'&&!u.approved&&u.application_status==='approved',active=u.role==='profissional'&&u.approved
 return <li className={card+(pending?' border-amber-300':'')+(u.deleted?' opacity-60':'')}>
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div className="min-w-0"><p className="font-extrabold">{u.display_name||'Sem nome'}</p><p className="break-all text-sm text-[#626274]">{u.email||'—'}</p>
    <p className="text-sm"><span className="font-semibold">{roleText(u)}</span> · desde {dateBr(u.created_at)} · último acesso {dateBr(u.last_sign_in_at)}{u.active_links?` · ${u.active_links} vínculo(s) ativo(s)`:''}</p>
    {u.application_status&&<p className="text-sm">{pending?'🟠 Pedido de parceiro':'Pedido de parceiro'}: {specialtyLabels[u.specialty??'']??u.specialty} · registro {u.credential} · {u.application_status==='pending'?'aguardando análise':u.application_status==='approved'?'aprovado':'recusado'}</p>}
   </div>
   {u.role!=='admin'&&!u.deleted&&<div className="flex flex-wrap gap-2">
    {pending&&<><Button type="button" onClick={()=>setMode({kind:'aprovar',user:u})}><UserCheck aria-hidden="true" className="mr-1 h-4 w-4"/>Aprovar</Button><Button type="button" variant="outline" onClick={()=>setMode({kind:'recusar',user:u})}>Recusar</Button></>}
    {active&&<Button type="button" variant="outline" onClick={()=>setMode({kind:'suspender',user:u})}><UserX aria-hidden="true" className="mr-1 h-4 w-4"/>Suspender</Button>}
    {suspended&&<Button type="button" variant="outline" onClick={()=>setMode({kind:'reativar',user:u})}><UserCheck aria-hidden="true" className="mr-1 h-4 w-4"/>Reativar</Button>}
    <Button type="button" variant="outline" className="!text-[#b42318]" onClick={()=>setMode({kind:'excluir',user:u})}><Trash2 aria-hidden="true" className="mr-1 h-4 w-4"/>Excluir conta</Button>
   </div>}
  </div>
  {mode&&mode.user.user_id===u.user_id&&<ActionPanel mode={mode} onCancel={()=>setMode(null)} onDone={onDone}/>}
 </li>
}

// Admin: "Usuários" — busca, aprovação de parceiros, suspensão e exclusão de contas.
export default function AdminUsers({owner}:{owner:string}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<UserFilter>('pedido_pendente'),[rows,setRows]=useState<AdminUser[]|null>(null),[page,setPage]=useState(1),[more,setMore]=useState(false)
 const [mode,setMode]=useState<Mode|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState(''),ticket=useRef(0)
 const load=useCallback(async(next:number)=>{const mine=++ticket.current;setError('')
  try{const found=await adminListUsers(query,filter,next);if(mine!==ticket.current)return;setRows(prev=>next===1?found:[...(prev??[]),...found]);setPage(next);setMore(found.length===30)}
  catch(err){if(mine===ticket.current){setError(errorText(err,'Não foi possível carregar.'));setRows([])}}},[query,filter])
 useEffect(()=>{const t=setTimeout(()=>void load(1),300);return()=>clearTimeout(t)},[load,owner])
 return <section className="space-y-4" aria-label="Usuários">
  <div><h2 className="text-xl font-extrabold">Usuários</h2><p className="text-sm text-[#626274]">Busque por nome ou e-mail. Aprove ou recuse pedidos de parceiro, suspenda ou reative parceiros e exclua contas. Tudo fica registrado com o motivo.</p></div>
  <label className="relative block"><span className="sr-only">Buscar</span><Search aria-hidden="true" className="absolute left-3 top-3.5 h-4 w-4 text-[#626274]"/><Input className="pl-9" placeholder="Nome ou e-mail" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="flex flex-wrap gap-2">{(Object.keys(filterLabels) as UserFilter[]).map(f=><Button key={f||'todos'} type="button" variant={filter===f?'default':'outline'} onClick={()=>setFilter(f)}>{filterLabels[f]}</Button>)}</div>
  {notice&&<p role="status" className={card+' border-[#a5ce41]'}>{notice}</p>}
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:!rows.length?<p className={card}>{filter==='pedido_pendente'?'Nenhum pedido de parceiro aguardando análise.':'Nenhum usuário encontrado.'}</p>
   :<ul className="space-y-2">{rows.map(u=><UserRow key={u.user_id} u={u} mode={mode} setMode={m=>{setMode(m);setNotice('')}} onDone={msg=>{setMode(null);setNotice(msg);void load(1)}}/>)}</ul>}
  {more&&<Button type="button" variant="outline" onClick={()=>void load(page+1)}>Ver mais</Button>}
  <AuditLog key={notice}/>
 </section>
}

function AuditLog(){
 const [open,setOpen]=useState(false),[rows,setRows]=useState<Awaited<ReturnType<typeof adminListActions>>|null>(null)
 useEffect(()=>{if(open)adminListActions().then(setRows).catch(()=>setRows([]))},[open])
 return <details className={card} onToggle={e=>setOpen((e.target as HTMLDetailsElement).open)}><summary className="min-h-11 cursor-pointer py-2 font-bold"><ShieldAlert aria-hidden="true" className="mr-1 inline h-4 w-4"/>Registro de ações do admin</summary>
  {!rows?<p role="status" className="text-sm">Carregando…</p>:!rows.length?<p className="text-sm">Nenhuma ação registrada.</p>:<ul className="space-y-1 text-sm">{rows.map((a,i)=><li key={i}>{new Date(a.created_at).toLocaleString('pt-BR')} · <b>{a.actor_name}</b> {actionLabels[a.action]??a.action} <b>{a.target_name}</b> — {a.reason}</li>)}</ul>}
 </details>
}

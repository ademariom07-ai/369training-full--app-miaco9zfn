import React,{useCallback,useEffect,useRef,useState} from 'react'
import {ArrowLeft,Headset,Search,Send} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {listChats,openChat,readChat,sendChat,type ChatMessage,type ChatThread} from '@/lib/supabase/chat'
import {readAdminParticipantOverview} from '@/lib/supabase/adminOverview'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const when=(iso:string|null)=>{if(!iso)return '';const d=new Date(iso),today=new Date().toDateString()===d.toDateString();return today?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}

// Mensagens: lista de conversas + conversa aberta. Atualiza sozinho a cada poucos segundos enquanto aberto.
export default function Chat({owner,role,startWith,onUnreadChange}:{owner:string,role:'aluno'|'profissional'|'admin',startWith?:string|null,onUnreadChange?:()=>void}){
 const [threads,setThreads]=useState<ChatThread[]>([]),[current,setCurrent]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const refresh=useCallback(async()=>{try{setThreads(await listChats());setError('')}catch(err){setError(errorText(err,'Não foi possível carregar as conversas.'))}finally{setLoading(false)}},[])
 useEffect(()=>{void refresh();const id=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);return()=>clearInterval(id)},[refresh,owner])
 const start=useCallback(async(withId:string|null)=>{setError('');try{const id=await openChat(withId);setCurrent(id);void refresh()}catch(err){setError(errorText(err,'Não foi possível abrir a conversa.'))}},[refresh])
 useEffect(()=>{if(startWith)void start(startWith)},[startWith,start])
 const thread=threads.find(t=>t.thread_id===current)
 if(current)return <Conversation threadId={current} title={thread?.title||'Conversa'} canSend={thread?.can_send??true} onBack={()=>{setCurrent(null);void refresh();onUnreadChange?.()}}/>
 return <section aria-label="Mensagens" className="space-y-4">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold">Mensagens</h2>
   <p className="text-sm text-[#626274]">{role==='aluno'?'Converse com o seu profissional e com a equipe 369.':role==='profissional'?'Converse com seus alunos e com a equipe 369.':'Conversas de suporte com alunos e profissionais.'}</p></div>
   {role!=='admin'&&<Button type="button" variant="outline" onClick={()=>void start(null)}><Headset aria-hidden="true" className="mr-2 h-4 w-4"/>Falar com a equipe 369</Button>}
  </div>
  {role==='admin'&&<AdminNewChat owner={owner} onPick={id=>void start(id)}/>}
  {error&&<p role="alert">{error}</p>}
  {loading?<p role="status">Carregando…</p>:!threads.length?<p className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4">{role==='aluno'?'Nenhuma conversa ainda. Envie um pedido a um profissional em "Encontrar profissionais" para conversar com ele, ou fale com a equipe.':role==='profissional'?'Nenhuma conversa ainda. Quando um aluno pedir acompanhamento, vocês podem conversar por aqui.':'Nenhuma conversa ainda.'}</p>
  :<ul className="divide-y rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white">{threads.map(t=><li key={t.thread_id}><button type="button" onClick={()=>setCurrent(t.thread_id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[#f7f6f2]">
   <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-bold">{t.title}{t.kind==='suporte'&&role!=='admin'&&<span className="rounded-full bg-[#eeedf4] px-2 text-xs">Suporte</span>}</span>
    <span className="block truncate text-sm text-[#626274]">{t.last_body||'Sem mensagens ainda'}</span></span>
   <span className="flex flex-col items-end gap-1 text-xs text-[#626274]">{when(t.last_message_at)}{t.unread>0&&<span className="rounded-full bg-[#a5ce41] px-2 py-0.5 text-sm font-bold text-[#33325a]">{t.unread}</span>}</span>
  </button></li>)}</ul>}
 </section>
}

function Conversation({threadId,title,canSend,onBack}:{threadId:string,title:string,canSend:boolean,onBack:()=>void}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const last=useRef(0),bottom=useRef<HTMLDivElement>(null)
 const pull=useCallback(async()=>{try{const rows=await readChat(threadId,last.current);if(rows.length){last.current=rows[rows.length-1].message_id;setMessages(prev=>[...prev,...rows.filter(r=>!prev.some(p=>p.message_id===r.message_id))])}}catch(err){setError(errorText(err,'Não foi possível carregar.'))}},[threadId])
 useEffect(()=>{last.current=0;setMessages([]);void pull();const id=setInterval(()=>{if(document.visibilityState==='visible')void pull()},5000);return()=>clearInterval(id)},[pull])
 useEffect(()=>{bottom.current?.scrollIntoView?.({block:'end'})},[messages.length])
 async function send(){setBusy(true);setError('');try{await sendChat(threadId,text);setText('');await pull()}catch(err){setError(errorText(err,'Não foi possível enviar.'))}finally{setBusy(false)}}
 return <section aria-label={'Conversa com '+title} className="space-y-3">
  <div className="flex items-center gap-3"><Button type="button" variant="outline" onClick={onBack} aria-label="Voltar para as conversas"><ArrowLeft aria-hidden="true" className="h-4 w-4"/></Button><h2 className="text-xl font-extrabold">{title}</h2></div>
  <div className="max-h-[60vh] min-h-[40vh] space-y-2 overflow-y-auto rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4" aria-live="polite">
   {!messages.length&&<p className="text-sm text-[#626274]">Comece a conversa. Seja breve e cordial; não compartilhe senhas ou dados de cartão.</p>}
   {messages.map(m=><div key={m.message_id} className={'flex '+(m.mine?'justify-end':'justify-start')}><div className={'max-w-[80%] rounded-[8px_16px_8px_16px] px-3 py-2 '+(m.mine?'bg-[#a5ce41] text-[#33325a]':'bg-[#eeedf4]')}>
    {!m.mine&&<p className="text-xs font-bold">{m.sender_label}</p>}<p className="whitespace-pre-line break-words">{m.body}</p><p className="text-right text-xs opacity-70">{when(m.created_at)}</p></div></div>)}
   <div ref={bottom}/>
  </div>
  {error&&<p role="alert">{error}</p>}
  {canSend?<form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(text.trim())void send()}}>
   <label className="sr-only" htmlFor="chat-text">Mensagem</label>
   <textarea id="chat-text" rows={2} maxLength={2000} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(text.trim())void send()}}} placeholder="Escreva uma mensagem" className="min-h-11 flex-1 rounded-md border p-2" disabled={busy}/>
   <Button type="submit" disabled={busy||!text.trim()} aria-label="Enviar"><Send aria-hidden="true" className="h-4 w-4"/></Button>
  </form>:<p className="text-sm text-[#626274]">Esta conversa foi encerrada porque o acompanhamento terminou. O histórico continua disponível.</p>}
 </section>
}

// Admin: procura um aluno ou profissional pelo nome para iniciar uma conversa de suporte.
function AdminNewChat({owner,onPick}:{owner:string,onPick:(id:string)=>void}){
 const [query,setQuery]=useState(''),[rows,setRows]=useState<{id:string,name:string,role:string}[]>([]),[error,setError]=useState('')
 async function search(){setError('');try{const found=await readAdminParticipantOverview(owner,1,query.trim());setRows(found.map(r=>({id:r.participant_id,name:r.display_name,role:r.participant_role==='profissional'?'Profissional':'Aluno'})))}catch(err){setError(errorText(err,'Busca indisponível.'))}}
 return <div className="space-y-2 rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4">
  <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void search()}}><label className="flex-1"><span className="text-sm font-semibold">Nova conversa com aluno ou profissional</span><Input placeholder="Digite o nome" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)}/></label><Button type="submit" className="self-end" aria-label="Buscar"><Search aria-hidden="true" className="h-4 w-4"/></Button></form>
  {error&&<p role="alert">{error}</p>}
  {rows.length>0&&<ul className="space-y-1">{rows.map(r=><li key={r.id} className="flex items-center justify-between gap-2"><span>{r.name} <span className="text-sm text-[#626274]">· {r.role}</span></span><Button type="button" variant="outline" onClick={()=>onPick(r.id)}>Conversar</Button></li>)}</ul>}
 </div>
}

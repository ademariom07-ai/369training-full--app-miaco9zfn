import React,{useCallback,useEffect,useMemo,useState} from 'react'
import {BookOpen,FileText,GraduationCap,Lightbulb,Lock,PlayCircle,Plus,Video} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {YoutubePlayer} from '@/components/VideoFeed'
import {acceptedFiles,archiveContent,audienceLabels,contentKinds,deleteStudentGroup,formatPrice,formatSize,grantContent,kindLabels,listContents,listMyContents,listPendingContents,
 listStudentGroups,openContentFile,reviewContent,saveContent,saveStudentGroup,uploadContentFile,
 type Audience,type ContentItem,type ContentKind,type MyContent,type PendingContent,type StudentGroup} from '@/lib/supabase/contents'
import type {ParticipantLink} from '@/lib/supabase/participantLinks'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const field='mt-1 block w-full rounded-md border p-2 text-sm'
const kindIcon:Record<ContentKind,typeof Video>={aula:GraduationCap,video:Video,dica:Lightbulb,ebook:BookOpen,estudo:FileText,material:FileText}
const statusLabels:Record<MyContent['status'],string>={em_analise:'Em análise pela equipe',publicado:'Publicado',recusado:'Recusado'}

function KindBadge({kind}:{kind:ContentKind}){const Icon=kindIcon[kind];return <span className="inline-flex items-center gap-1 rounded-full bg-[#eeedf4] px-2 py-0.5 text-xs font-bold text-[#33325a]"><Icon aria-hidden="true" className="h-3.5 w-3.5"/>{kindLabels[kind]}</span>}
function PriceBadge({cents}:{cents:number}){return <span className={'rounded-full px-2 py-0.5 text-xs font-bold '+(cents?'bg-amber-100 text-amber-900':'bg-[#eef6dc] text-[#4d6b14]')}>{formatPrice(cents)}</span>}

// Abre o arquivo (link temporário conferido pelo Storage).
function FileButton({path,name,size}:{path:string,name:string|null,size:number|null}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function open(){setBusy(true);setError('');try{window.open(await openContentFile(path),'_blank','noopener')}catch(err){setError(errorText(err,'Não foi possível abrir.'))}finally{setBusy(false)}}
 return <span className="inline-flex flex-col"><Button type="button" variant="outline" disabled={busy} onClick={()=>void open()}><FileText aria-hidden="true" className="mr-2 h-4 w-4"/>Abrir {name||'arquivo'}{size?` (${formatSize(size)})`:''}</Button>{error&&<span role="alert" className="text-sm">{error}</span>}</span>
}

// Conteúdo aberto (vídeo, texto, arquivo) ou bloqueado (pago sem acesso).
export function ContentCard({item,onChat}:{item:ContentItem,onChat?:(user:string)=>void}){
 const [open,setOpen]=useState(false)
 return <article className={card+' space-y-2'}>
  <div className="flex flex-wrap items-center gap-2"><KindBadge kind={item.kind}/><PriceBadge cents={item.price_cents}/>{item.for_me&&<span className="text-xs font-bold text-[#6a8a27]">Enviado para você</span>}</div>
  <h3 className="text-lg font-extrabold">{item.title}</h3>
  <p className="text-sm text-[#626274]">Por {item.owner_name}</p>
  {item.description&&<p className="whitespace-pre-line text-sm">{item.description}</p>}
  {item.unlocked?<>{!open?<Button type="button" onClick={()=>setOpen(true)}><PlayCircle aria-hidden="true" className="mr-2 h-4 w-4"/>Abrir conteúdo</Button>:<div className="space-y-3">
    {item.youtube_id&&<div className="max-w-2xl"><YoutubePlayer id={item.youtube_id} title={item.title}/></div>}
    {item.body&&<p className="whitespace-pre-line rounded-md bg-[#f7f6f2] p-3">{item.body}</p>}
    {item.file_path&&<FileButton path={item.file_path} name={item.file_name} size={item.file_size}/>}
    <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Fechar</Button></div>}</>
  :<div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"><p className="font-bold"><Lock aria-hidden="true" className="mr-1 inline h-4 w-4"/>Conteúdo pago — {formatPrice(item.price_cents)}</p>
    <p>O pagamento pelo app chega em breve. Por enquanto, combine com {item.owner_name} e ele(a) libera o acesso para você.</p>
    {onChat&&item.for_me&&item.owner_name!=='Equipe 369 WELLNESS'&&<Button type="button" variant="outline" className="mt-2" onClick={()=>onChat(item.owner_id)}>Falar com {item.owner_name.split(' ')[0]}</Button>}</div>}
 </article>
}

// Aluno: "Conteúdos e e-books".
export default function ContentLibrary({owner,onChat}:{owner:string,onChat?:(user:string)=>void}){
 const [tab,setTab]=useState<'para_mim'|'publicos'>('para_mim'),[kind,setKind]=useState<ContentKind|''>(''),[rows,setRows]=useState<ContentItem[]|null>(null),[error,setError]=useState('')
 useEffect(()=>{let live=true;setRows(null);setError('');listContents(tab).then(r=>{if(live)setRows(r)}).catch(err=>{if(live)setError(errorText(err,'Não foi possível carregar.'))});return()=>{live=false}},[tab,owner])
 const shown=(rows??[]).filter(r=>!kind||r.kind===kind)
 return <section className="space-y-4" aria-label="Conteúdos e e-books">
  <div><h2 className="text-xl font-extrabold">Conteúdos e e-books</h2><p className="text-sm text-[#626274]">Aulas, vídeos, dicas, livros e materiais dos profissionais. Alguns são grátis; os pagos mostram o preço.</p></div>
  <div className="flex flex-wrap gap-2" role="tablist">{([['para_mim','Do meu profissional'],['publicos','Para todos']] as const).map(([k,l])=><Button key={k} type="button" role="tab" aria-selected={tab===k} variant={tab===k?'default':'outline'} onClick={()=>setTab(k)}>{l}</Button>)}</div>
  <label className="block max-w-xs text-sm font-semibold">Tipo<select className={field} value={kind} onChange={e=>setKind(e.target.value as ContentKind|'')}><option value="">Todos</option>{contentKinds.map(k=><option key={k} value={k}>{kindLabels[k]}</option>)}</select></label>
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:shown.length?<div className="grid gap-3 lg:grid-cols-2">{shown.map(r=><ContentCard key={r.content_id} item={r} onChat={onChat}/>)}</div>
   :<p className={card}>{tab==='para_mim'?'Seu profissional ainda não enviou materiais. Quando enviar, eles aparecem aqui e no seu treino.':'Ainda não há conteúdos públicos.'}</p>}
 </section>
}

// Bloco curto (home do aluno e página do treino): últimos materiais do profissional.
export function ContentHighlights({owner,onView,title='Materiais do seu profissional',scope='para_mim',max=3}:{owner:string,onView:(id:string)=>void,title?:string,scope?:'para_mim'|'todos',max?:number}){
 const [rows,setRows]=useState<ContentItem[]|null>(null)
 useEffect(()=>{let live=true;listContents(scope).then(r=>{if(live)setRows(r)}).catch(()=>{if(live)setRows([])});return()=>{live=false}},[owner,scope])
 if(!rows||!rows.length)return null
 return <section className={card+' space-y-2'} aria-label={title}>
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold">{title}</h3><button type="button" className="text-sm underline" onClick={()=>onView('conteudos')}>Ver todos</button></div>
  <ul className="space-y-2">{rows.slice(0,max).map(r=><li key={r.content_id}><button type="button" onClick={()=>onView('conteudos')} className="flex w-full flex-wrap items-center gap-2 rounded-md border border-[#eeedf4] p-2 text-left hover:border-[#a5ce41]">
   <KindBadge kind={r.kind}/><span className="flex-1 font-bold">{r.title}</span><PriceBadge cents={r.price_cents}/>{!r.unlocked&&<Lock aria-label="bloqueado" className="h-4 w-4"/>}</button></li>)}</ul>
 </section>
}

// ----- Profissional (e admin): "Meus conteúdos" -----
type Student={id:string,name:string}
function StudentPicker({students,groups,value,onChange,onGroupsChanged}:{students:Student[],groups:StudentGroup[],value:string[],onChange:(v:string[])=>void,onGroupsChanged:()=>void}){
 const [groupName,setGroupName]=useState(''),[msg,setMsg]=useState('')
 const toggle=(id:string)=>onChange(value.includes(id)?value.filter(x=>x!==id):[...value,id])
 async function saveGroup(){setMsg('');try{await saveStudentGroup(null,groupName,value);setGroupName('');setMsg('Grupo salvo.');onGroupsChanged()}catch(err){setMsg(errorText(err,'Não foi possível salvar o grupo.'))}}
 async function removeGroup(g:StudentGroup){if(!window.confirm(`Apagar o grupo "${g.name}"? Os conteúdos já enviados continuam com os alunos.`))return;try{await deleteStudentGroup(g.group_id);onGroupsChanged()}catch(err){setMsg(errorText(err,'Não foi possível apagar.'))}}
 return <div className="space-y-2 rounded-md border p-3">
  {groups.length>0&&<div><p className="text-sm font-semibold">Grupos</p><div className="mt-1 flex flex-wrap gap-2">{groups.map(g=><span key={g.group_id} className="inline-flex items-center gap-1">
   <Button type="button" variant="outline" onClick={()=>onChange([...new Set([...value,...g.members])])}>+ {g.name} ({g.members.length})</Button>
   <button type="button" aria-label={`Apagar grupo ${g.name}`} className="px-1 text-sm text-[#626274]" onClick={()=>void removeGroup(g)}>×</button></span>)}</div></div>}
  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>onChange(students.map(s=>s.id))}>Marcar todos</Button><Button type="button" variant="outline" onClick={()=>onChange([])}>Limpar</Button></div>
  <ul className="grid gap-1 sm:grid-cols-2">{students.map(s=><li key={s.id}><label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={value.includes(s.id)} onChange={()=>toggle(s.id)}/>{s.name}</label></li>)}</ul>
  {value.length>1&&<div className="flex flex-wrap items-end gap-2"><label className="text-sm font-semibold">Salvar como grupo<Input maxLength={60} value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Ex.: Turma da manhã"/></label><Button type="button" variant="outline" disabled={groupName.trim().length<2} onClick={()=>void saveGroup()}>Salvar grupo</Button></div>}
  {msg&&<p role="status" className="text-sm">{msg}</p>}
 </div>
}

function ContentForm({owner,role,initial,students,groups,onGroupsChanged,onDone}:{owner:string,role:'admin'|'profissional',initial:MyContent|null,students:Student[],groups:StudentGroup[],onGroupsChanged:()=>void,onDone:()=>void}){
 const [kind,setKind]=useState<ContentKind>(initial?.kind??'aula'),[title,setTitle]=useState(initial?.title??''),[description,setDescription]=useState(initial?.description??'')
 const [youtube,setYoutube]=useState(initial?.youtube_id?`https://youtu.be/${initial.youtube_id}`:''),[body,setBody]=useState(initial?.body??'')
 const [file,setFile]=useState(initial?.file_path?{path:initial.file_path,name:initial.file_name??'arquivo',size:initial.file_size??1}:null)
 const [paid,setPaid]=useState(!!initial?.price_cents),[price,setPrice]=useState(initial?.price_cents?(initial.price_cents/100).toFixed(2).replace('.',','):'')
 const [audience,setAudience]=useState<Audience>(role==='admin'?'publico':initial?.audience??'meus_alunos'),[recipients,setRecipients]=useState<string[]>(initial?.recipients??[])
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 async function pick(f:File|undefined){if(!f)return;setBusy(true);setError('');setStatus('Enviando arquivo…');try{setFile(await uploadContentFile(owner,f));setStatus('Arquivo enviado.')}catch(err){setError(errorText(err,'Não foi possível enviar.'));setStatus('')}finally{setBusy(false)}}
 async function save(){setBusy(true);setError('');try{await saveContent({id:initial?.content_id??null,kind,title,description,body,youtube,file,price:paid?price:'',audience,recipients});onDone()}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 return <form className="space-y-4" onSubmit={e=>{e.preventDefault();void save()}}>
  <Button type="button" variant="outline" onClick={onDone}>← Voltar</Button>
  <h2 className="text-xl font-extrabold">{initial?'Editar conteúdo':'Novo conteúdo'}</h2>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="font-semibold">Tipo<select className={field} value={kind} onChange={e=>setKind(e.target.value as ContentKind)}>{contentKinds.map(k=><option key={k} value={k}>{kindLabels[k]}</option>)}</select></label>
   <label className="font-semibold">Título<Input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Aula de mobilidade para lombar"/></label>
  </div>
  <label className="block font-semibold">Descrição (aparece para todos que veem, mesmo se for pago)<textarea className={field} rows={2} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Para quem é, o que a pessoa vai aprender."/></label>
  <fieldset className={card+' space-y-3'}><legend className="font-extrabold">Conteúdo (use um ou mais)</legend>
   <label className="block font-semibold">Vídeo do YouTube<Input inputMode="url" maxLength={300} value={youtube} onChange={e=>setYoutube(e.target.value)} placeholder="https://youtu.be/... (pode ser 'não listado')"/></label>
   <label className="block font-semibold">Texto<textarea className={field} rows={4} maxLength={8000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Dica, orientação, resumo do estudo…"/></label>
   <div><p className="font-semibold">Arquivo (PDF, e-book, Word, planilha, áudio ou vídeo curto — até 25 MB)</p>
    {file?<p className="mt-1 text-sm">📎 {file.name} {formatSize(file.size)} <button type="button" className="ml-2 underline" onClick={()=>setFile(null)}>Remover</button></p>
     :<input type="file" accept={acceptedFiles} disabled={busy} className="mt-1 block text-sm" onChange={e=>void pick(e.target.files?.[0])}/>}
   </div>
  </fieldset>
  <fieldset className={card+' space-y-2'}><legend className="font-extrabold">Preço</legend>
   <div className="flex flex-wrap gap-2"><Button type="button" variant={paid?'outline':'default'} onClick={()=>setPaid(false)}>Grátis</Button><Button type="button" variant={paid?'default':'outline'} onClick={()=>setPaid(true)}>Pago</Button></div>
   {paid&&<><label className="block max-w-xs font-semibold">Valor (R$)<Input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="29,90"/></label>
    <p className="text-sm text-[#626274]">O aluno vê o título, a descrição e o preço. Enquanto o pagamento pelo app não chega, você libera o acesso de quem pagou em "Liberar acesso".</p></>}
  </fieldset>
  <fieldset className={card+' space-y-2'}><legend className="font-extrabold">Para quem</legend>
   {(role==='admin'?(['publico'] as Audience[]):(['meus_alunos','selecionados','publico'] as Audience[])).map(a=><label key={a} className="flex min-h-11 items-center gap-2"><input type="radio" name="audience" checked={audience===a} onChange={()=>setAudience(a)}/>
    <span><b>{audienceLabels[a]}</b>{a==='publico'&&role!=='admin'&&<span className="block text-sm text-[#626274]">Aparece em "Conteúdos" para todos os alunos depois da aprovação da equipe 369.</span>}{a==='meus_alunos'&&<span className="block text-sm text-[#626274]">Todos os seus alunos ativos, inclusive os que entrarem depois. Aparece junto com o treino.</span>}</span></label>)}
   {audience==='selecionados'&&(students.length?<StudentPicker students={students} groups={groups} value={recipients} onChange={setRecipients} onGroupsChanged={onGroupsChanged}/>:<p className="text-sm">Você ainda não tem alunos ativos.</p>)}
  </fieldset>
  {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{audience==='publico'&&role!=='admin'?'Enviar para aprovação':'Publicar'}</Button><Button type="button" variant="outline" disabled={busy} onClick={onDone}>Cancelar</Button></div>
 </form>
}

// Liberar acesso a conteúdo pago (alunos que veem o conteúdo).
function GrantPanel({item,students,onChanged}:{item:MyContent,students:Student[],onChanged:()=>void}){
 const viewers=item.audience==='selecionados'?students.filter(s=>item.recipients.includes(s.id)):students
 const [busy,setBusy]=useState(''),[error,setError]=useState('')
 async function toggle(id:string,on:boolean){setBusy(id);setError('');try{await grantContent(item.content_id,id,on);onChanged()}catch(err){setError(errorText(err,'Não foi possível alterar.'))}finally{setBusy('')}}
 return <details className="rounded-md border p-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Liberar acesso ({item.grants.length} liberado{item.grants.length===1?'':'s'})</summary>
  {viewers.length?<ul className="space-y-1">{viewers.map(s=>{const on=item.grants.includes(s.id);return <li key={s.id} className="flex items-center justify-between gap-2 text-sm"><span>{s.name}</span>
   <Button type="button" variant={on?'default':'outline'} disabled={busy===s.id} onClick={()=>void toggle(s.id,!on)}>{on?'✓ Liberado':'Liberar'}</Button></li>})}</ul>
   :<p className="text-sm">Nenhum aluno seu vê este conteúdo.</p>}
  {item.audience==='publico'&&<p className="mt-1 text-xs text-[#626274]">Alunos de fora: a venda pelo app chega com os pagamentos.</p>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
 </details>
}

export function ContentManager({owner,role,links}:{owner:string,role:'admin'|'profissional',links:ParticipantLink[]}){
 const students=useMemo<Student[]>(()=>links.filter(l=>l.state==='active').map(l=>({id:l.student_id,name:l.participant_name||'Aluno'})),[links])
 const [rows,setRows]=useState<MyContent[]|null>(null),[groups,setGroups]=useState<StudentGroup[]>([]),[editing,setEditing]=useState<MyContent|'novo'|null>(null),[error,setError]=useState('')
 const load=useCallback(async()=>{setError('');try{setRows(await listMyContents())}catch(err){setError(errorText(err,'Não foi possível carregar.'));setRows([])}},[])
 const loadGroups=useCallback(()=>{if(role==='profissional')listStudentGroups().then(setGroups).catch(()=>{})},[role])
 useEffect(()=>{void load();loadGroups()},[load,loadGroups,owner])
 if(editing)return <ContentForm owner={owner} role={role} initial={editing==='novo'?null:editing} students={students} groups={groups} onGroupsChanged={loadGroups} onDone={()=>{setEditing(null);void load()}}/>
 const audienceText=(c:MyContent)=>c.audience==='selecionados'?`${c.recipients.length} aluno${c.recipients.length===1?'':'s'} escolhido${c.recipients.length===1?'':'s'}`:audienceLabels[c.audience]
 return <section className="space-y-4" aria-label="Meus conteúdos">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold">{role==='admin'?'Conteúdos da equipe 369':'Meus conteúdos'}</h2>
   <p className="text-sm text-[#626274]">Aulas, vídeos, dicas, e-books, estudos e materiais. Grátis ou pagos. Para todos, para seus alunos ou para alunos e grupos que você escolher.</p></div>
   <Button type="button" onClick={()=>setEditing('novo')}><Plus aria-hidden="true" className="mr-1 h-4 w-4"/>Novo conteúdo</Button></div>
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:!rows.length?<p className={card}>Você ainda não publicou conteúdos. Comece por uma dica ou um material para seus alunos.</p>:
   <ul className="space-y-2">{rows.map(c=><li key={c.content_id} className={card+' space-y-2'+(c.status==='recusado'?' border-amber-300':'')}>
    <div className="flex flex-wrap items-center gap-2"><KindBadge kind={c.kind}/><PriceBadge cents={c.price_cents}/><span className="text-xs font-bold text-[#626274]">{statusLabels[c.status]}</span></div>
    <p className="font-extrabold">{c.title}</p><p className="text-sm text-[#626274]">Para: {audienceText(c)}{c.file_name?` · 📎 ${c.file_name}`:''}{c.youtube_id?' · vídeo':''}</p>
    {c.status==='recusado'&&c.review_reason&&<p className="text-sm">Motivo: {c.review_reason}</p>}
    {c.price_cents>0&&c.status==='publicado'&&role==='profissional'&&<GrantPanel item={c} students={students} onChanged={()=>void load()}/>}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>setEditing(c)}>Editar</Button>
     <Button type="button" variant="outline" onClick={()=>{if(window.confirm('Arquivar este conteúdo? Ele deixa de aparecer para os alunos.'))void archiveContent(c.content_id).then(load).catch(err=>setError(errorText(err,'Não foi possível arquivar.')))}}>Arquivar</Button></div>
   </li>)}</ul>}
 </section>
}

// Admin: conteúdos públicos aguardando análise.
export function ContentReview({owner}:{owner:string}){
 const [rows,setRows]=useState<PendingContent[]|null>(null),[reason,setReason]=useState<Record<string,string>>({}),[error,setError]=useState('')
 const load=useCallback(()=>{listPendingContents().then(setRows).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setRows([])})},[])
 useEffect(()=>{load()},[load,owner])
 async function decide(id:string,approve:boolean){setError('');try{await reviewContent(id,approve,reason[id]??'');load()}catch(err){setError(errorText(err,'Não foi possível registrar.'))}}
 return <section className="space-y-3" aria-label="Conteúdos em análise">
  <h2 className="text-xl font-extrabold">Conteúdos para aprovar</h2>
  {error&&<p role="alert">{error}</p>}
  {!rows?<p role="status">Carregando…</p>:!rows.length?<p className={card}>Nenhum conteúdo aguardando análise.</p>:rows.map(c=><article key={c.content_id} className={card+' space-y-2'}>
   <div className="flex flex-wrap items-center gap-2"><KindBadge kind={c.kind}/><PriceBadge cents={c.price_cents}/></div>
   <p className="font-extrabold">{c.title}</p><p className="text-sm text-[#626274]">Por {c.owner_name}</p>
   {c.description&&<p className="text-sm">{c.description}</p>}
   {c.youtube_id&&<div className="max-w-xl"><YoutubePlayer id={c.youtube_id} title={c.title}/></div>}
   {c.body&&<p className="whitespace-pre-line rounded-md bg-[#f7f6f2] p-3 text-sm">{c.body}</p>}
   {c.file_path&&<FileButton path={c.file_path} name={c.file_name} size={null}/>}
   <label className="block text-sm font-semibold">Motivo (obrigatório para recusar)<Input maxLength={300} value={reason[c.content_id]??''} onChange={e=>setReason(r=>({...r,[c.content_id]:e.target.value}))}/></label>
   <div className="flex flex-wrap gap-2"><Button type="button" onClick={()=>void decide(c.content_id,true)}>Aprovar</Button><Button type="button" variant="outline" onClick={()=>void decide(c.content_id,false)}>Recusar</Button></div>
  </article>)}
 </section>
}

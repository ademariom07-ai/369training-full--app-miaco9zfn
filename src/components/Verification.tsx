import React,{useCallback,useEffect,useState} from 'react'
import {BadgeCheck,Camera,IdCard,ShieldCheck} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {CPF_DUPLICATE,adminListCpfReviews,adminListPartnerVerifications,adminReviewCpf,adminReviewPartner,councilLookup,cpfValid,formatCpf,myVerification,setMyCpf,submitPartnerVerification,
 uploadVerificationFile,verificationImageUrl,type Verification} from '@/lib/supabase/verification'
import {specialtyLabels} from '@/lib/supabase/adminUsers'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'

export function VerifiedBadge(){return <span className="inline-flex items-center gap-1 rounded-full bg-[#eef6dc] px-2 py-0.5 text-xs font-bold text-[#4d6b14]"><BadgeCheck aria-hidden="true" className="h-3.5 w-3.5"/>Identidade verificada</span>}

// "Meu perfil": CPF (etapa 2 do aluno; também pedido do parceiro).
export function CpfSection({owner}:{owner:string}){
 const [v,setV]=useState<Verification|null>(null),[cpf,setCpf]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[duplicate,setDuplicate]=useState(false),[notice,setNotice]=useState('')
 const load=useCallback(()=>{myVerification().then(setV).catch(()=>setV(null))},[])
 useEffect(()=>{load()},[load,owner])
 async function save(review:boolean){setBusy(true);setError('');setNotice('')
  try{const st=await setMyCpf(cpf,review);setDuplicate(false);setCpf('');setNotice(st==='verificado'?'CPF confirmado!':'Pedido enviado. A equipe 369 vai analisar e você recebe a resposta aqui.');load()}
  catch(err){const m=errorText(err,'Não foi possível salvar.');if(m===CPF_DUPLICATE)setDuplicate(true);setError(m)}finally{setBusy(false)}}
 const st=v?.cpf_status
 return <section className="space-y-3 border-t pt-4" aria-label="CPF">
  <h3 className="flex items-center gap-2 font-extrabold"><IdCard aria-hidden="true" className="h-5 w-5"/>CPF</h3>
  {st==='verificado'?<p className="font-semibold text-[#4d6b14]">✓ CPF confirmado ({v?.cpf_masked})</p>
  :st==='em_analise'?<p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">CPF {v?.cpf_masked} em análise pela equipe 369 (ele já aparece em outra conta). Você recebe a resposta aqui.</p>
  :<>{st==='recusado'&&<p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">O CPF {v?.cpf_masked} não foi aceito{v?.cpf_reason?`: ${v.cpf_reason}`:''}. Confira e tente de novo, ou fale com a equipe 369.</p>}
   <p className="text-sm text-[#626274]">Confirme seu CPF para dar mais segurança à sua conta. Guardamos só um código para conferir se ele não se repete e os 2 últimos dígitos — nunca o número inteiro.</p>
   <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();void save(false)}}>
    <label className="text-sm font-semibold">Seu CPF<Input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={e=>{setCpf(formatCpf(e.target.value));setDuplicate(false);setError('')}}/></label>
    <Button type="submit" disabled={busy||!cpfValid(cpf)}>Confirmar CPF</Button></form>
   {cpf.replace(/\D/g,'').length===11&&!cpfValid(cpf)&&<p className="text-sm text-[#b42318]">Este CPF não é válido. Confira os números.</p>}
   {error&&<p role="alert" className="text-sm">{error}</p>}
   {duplicate&&<div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"><p>Se o CPF é seu (por exemplo, você tinha outra conta), peça a análise. A equipe 369 confere e libera.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={()=>void save(true)}>Quero continuar e pedir análise</Button><Button type="button" variant="outline" onClick={()=>{setDuplicate(false);setError('')}}>Cancelar</Button></div></div>}
  </>}
  {notice&&<p role="status" className="text-sm font-semibold">{notice}</p>}
 </section>
}

// Parceiro: etapa 2 (para atender) — CPF confirmado + 3 fotos, analisadas pelo admin.
const shots=[
 {key:'doc',title:'1. Documento oficial com foto',hint:'RG, CNH ou passaporte, frente, inteiro e legível, sem reflexo.',capture:'environment'},
 {key:'selfie',title:'2. Selfie segurando o documento',hint:'Seu rosto e o documento aparecendo juntos, de frente, sem óculos escuros, boné ou filtro.',capture:'user'},
 {key:'credential',title:'3. Selfie segurando a carteira do conselho',hint:'Carteira/cédula do CREF, CRN, CREFITO, CRP ou certificado da confederação (CBJ, CBJJ, CBK), com o número legível.',capture:'user'},
] as const
export function PartnerVerification({owner,onGoProfile}:{owner:string,onGoProfile?:()=>void}){
 const [v,setV]=useState<Verification|null>(null),[paths,setPaths]=useState<Record<string,string>>({}),[busy,setBusy]=useState(''),[error,setError]=useState(''),[consent,setConsent]=useState(false),[notice,setNotice]=useState('')
 const load=useCallback(()=>{myVerification().then(setV).catch(()=>setV(null))},[])
 useEffect(()=>{load()},[load,owner])
 async function pick(key:string,file:File|undefined){if(!file)return;setBusy(key);setError('');try{const p=await uploadVerificationFile(owner,file);setPaths(x=>({...x,[key]:p}))}catch(err){setError(errorText(err,'Não foi possível enviar.'))}finally{setBusy('')}}
 async function send(){setBusy('send');setError('');try{await submitPartnerVerification(paths.doc,paths.selfie,paths.credential);setPaths({});setNotice('Enviado! A equipe 369 analisa em até 2 dias úteis. As fotos são apagadas depois da análise.');load()}catch(err){setError(errorText(err,'Não foi possível enviar.'))}finally{setBusy('')}}
 if(!v)return null
 const st=v.partner_status
 return <section className={card+' space-y-3'} aria-label="Verificação para atender">
  <h3 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck aria-hidden="true" className="h-5 w-5"/>Etapa 2: verificação para atender</h3>
  {st==='verificado'?<p className="font-semibold text-[#4d6b14]">✓ Identidade verificada. Você pode aceitar alunos e aparece com o selo na busca.</p>
  :st==='em_analise'?<p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Fotos enviadas e em análise pela equipe 369 (até 2 dias úteis).</p>
  :<>
   <p className="text-sm">Para <b>aceitar alunos</b> e ganhar o selo <b>"Identidade verificada"</b>, confirme quem você é. Leva 2 minutos.{v.partner_required?'':' (Hoje opcional.)'}</p>
   {st==='recusado'&&<p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">A verificação anterior não foi aprovada{v.partner_reason?`: ${v.partner_reason}`:''}. Envie as fotos de novo.</p>}
   {v.cpf_status!=='verificado'?<p className="rounded-md border p-3 text-sm">Primeiro confirme seu <b>CPF</b> em "Meu perfil".{onGoProfile&&<> <button type="button" className="underline" onClick={onGoProfile}>Ir para Meu perfil</button></>}</p>
   :<>
    <ul className="space-y-3">{shots.map(s=><li key={s.key} className="rounded-md border p-3">
     <p className="font-bold">{s.title}{paths[s.key]&&' ✓'}</p><p className="text-sm text-[#626274]">{s.hint}</p>
     <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold"><Camera aria-hidden="true" className="h-4 w-4"/>{busy===s.key?'Enviando…':paths[s.key]?'Trocar foto':'Tirar ou escolher foto'}
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture={s.capture} className="sr-only" disabled={!!busy} onChange={e=>void pick(s.key,e.target.files?.[0])}/></label>
    </li>)}</ul>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
     <span>Autorizo a 369 WELLNESS a usar estas fotos <b>só para confirmar minha identidade e meu registro profissional</b>. Elas ficam em área privada, são vistas apenas pela equipe de análise e <b>apagadas depois da análise</b> (LGPD).</span></label>
    {error&&<p role="alert" className="text-sm">{error}</p>}
    <Button type="button" disabled={!!busy||!consent||!paths.doc||!paths.selfie||!paths.credential} onClick={()=>void send()}>Enviar para análise</Button>
   </>}
  </>}
  {notice&&<p role="status" className="text-sm font-semibold">{notice}</p>}
 </section>
}

// Aviso na home do parceiro enquanto não estiver verificado.
export function PartnerVerificationBanner({owner,onOpen}:{owner:string,onOpen:()=>void}){
 const [v,setV]=useState<Verification|null>(null)
 useEffect(()=>{myVerification().then(setV).catch(()=>{})},[owner])
 if(!v||v.partner_status==='verificado')return null
 return <button type="button" onClick={onOpen} className="block w-full rounded-[12px_30px_12px_30px] border border-amber-300 bg-amber-50 p-4 text-left">
  <p className="font-extrabold"><ShieldCheck aria-hidden="true" className="mr-1 inline h-5 w-5"/>{v.partner_status==='em_analise'?'Sua verificação está em análise':'Conclua a verificação para aceitar alunos'}</p>
  <p className="text-sm">{v.partner_status==='em_analise'?'A equipe 369 responde em até 2 dias úteis.':'CPF + 3 fotos rápidas. Toque aqui para começar.'}</p></button>
}

// ----- Admin: "Verificações" -----
function Photo({path,label}:{path:string|null,label:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let live=true,made='';if(path)verificationImageUrl(path).then(u=>{made=u;if(live)setUrl(u)}).catch(()=>{if(live)setError('Não foi possível abrir.')});return()=>{live=false;if(made)URL.revokeObjectURL(made)}},[path])
 if(!path)return <p className="text-sm">{label}: não enviado</p>
 return <figure className="space-y-1"><figcaption className="text-sm font-bold">{label}</figcaption>
  {error?<p className="text-sm">{error}</p>:!url?<p role="status" className="text-sm">Carregando…</p>:path.endsWith('.pdf')?<a className="text-sm underline" href={url} target="_blank" rel="noreferrer">Abrir PDF</a>
   :<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="max-h-72 w-full rounded-md border object-contain"/></a>}</figure>
}
export default function AdminVerifications({owner}:{owner:string}){
 const [cpfs,setCpfs]=useState<Awaited<ReturnType<typeof adminListCpfReviews>>|null>(null),[partners,setPartners]=useState<Awaited<ReturnType<typeof adminListPartnerVerifications>>|null>(null)
 const [reason,setReason]=useState<Record<string,string>>({}),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const load=useCallback(()=>{adminListCpfReviews().then(setCpfs).catch(err=>{setError(errorText(err,'Não foi possível carregar.'));setCpfs([])});adminListPartnerVerifications().then(setPartners).catch(()=>setPartners([]))},[])
 useEffect(()=>{load()},[load,owner])
 async function run(task:()=>Promise<void>,msg:string){setError('');setNotice('');try{await task();setNotice(msg);load()}catch(err){setError(errorText(err,'Não foi possível registrar.'))}}
 return <section className="space-y-5" aria-label="Verificações">
  <div><h2 className="text-xl font-extrabold">Verificações</h2><p className="text-sm text-[#626274]">CPFs repetidos que pediram análise e parceiros que enviaram as fotos da etapa 2. Sempre com motivo.</p></div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status" className={card+' border-[#a5ce41]'}>{notice}</p>}
  <h3 className="text-lg font-extrabold">Parceiros (etapa 2)</h3>
  {!partners?<p role="status">Carregando…</p>:!partners.length?<p className={card}>Nenhuma verificação de parceiro aguardando.</p>:partners.map(p=>{const look=councilLookup[p.specialty??'']
   return <article key={p.user_id} className={card+' space-y-3'}>
    <p className="font-extrabold">{p.display_name} <span className="text-sm font-normal text-[#626274]">{p.email}</span></p>
    <p className="text-sm">{specialtyLabels[p.specialty??'']??p.specialty} · registro <b>{p.credential}</b> · CPF {p.cpf_masked} ({p.cpf_status==='verificado'?'confirmado':p.cpf_status})</p>
    <ul className="list-disc pl-5 text-sm"><li>O rosto da selfie é o mesmo do documento? Nome do documento bate com o da conta?</li><li>O número da carteira bate com o informado ({p.credential})?{look&&<> {look.url?<a className="underline" href={look.url} target="_blank" rel="noreferrer">{look.label}</a>:look.label}</>}</li><li>Fotos nítidas, sem edição, documento dentro da validade?</li></ul>
    <div className="grid gap-3 md:grid-cols-3"><Photo path={p.doc_path} label="Documento"/><Photo path={p.selfie_path} label="Selfie com documento"/><Photo path={p.credential_path} label="Selfie com carteira do conselho"/></div>
    <label className="block text-sm font-semibold">Motivo (o parceiro vê se for recusado)<Input maxLength={300} value={reason[p.user_id]??''} onChange={e=>setReason(r=>({...r,[p.user_id]:e.target.value}))} placeholder="Ex.: documento e CREF conferidos"/></label>
    <div className="flex flex-wrap gap-2"><Button type="button" onClick={()=>void run(()=>adminReviewPartner(p.user_id,true,reason[p.user_id]??'',[p.doc_path,p.selfie_path,p.credential_path]),`${p.display_name} verificado. As fotos foram apagadas.`)}>Aprovar</Button>
     <Button type="button" variant="outline" onClick={()=>void run(()=>adminReviewPartner(p.user_id,false,reason[p.user_id]??'',[p.doc_path,p.selfie_path,p.credential_path]),'Verificação recusada. As fotos foram apagadas; o parceiro pode enviar de novo.')}>Recusar</Button></div>
   </article>})}
  <h3 className="text-lg font-extrabold">CPFs repetidos em análise</h3>
  {!cpfs?<p role="status">Carregando…</p>:!cpfs.length?<p className={card}>Nenhum CPF aguardando análise.</p>:cpfs.map(c=><article key={c.user_id} className={card+' space-y-2'}>
   <p><b>{c.display_name}</b> ({c.email}, {c.role}) pediu análise do CPF {c.cpf_masked}.</p>
   <p className="text-sm">Já usado por: <b>{c.other_name??'conta excluída'}</b> {c.other_email?`(${c.other_email})`:''} · {c.other_status==='verificado'?'confirmado':c.other_status??''}</p>
   <p className="text-sm text-[#626274]">Dica: fale com as duas pessoas (Mensagens) antes de decidir. Aprovar deixa as duas contas com o mesmo CPF confirmado.</p>
   <label className="block text-sm font-semibold">Motivo<Input maxLength={300} value={reason[c.user_id]??''} onChange={e=>setReason(r=>({...r,[c.user_id]:e.target.value}))}/></label>
   <div className="flex flex-wrap gap-2"><Button type="button" onClick={()=>void run(()=>adminReviewCpf(c.user_id,true,reason[c.user_id]??''),'CPF aprovado.')}>Aprovar</Button>
    <Button type="button" variant="outline" onClick={()=>void run(()=>adminReviewCpf(c.user_id,false,reason[c.user_id]??''),'CPF recusado.')}>Recusar</Button></div>
  </article>)}
 </section>
}

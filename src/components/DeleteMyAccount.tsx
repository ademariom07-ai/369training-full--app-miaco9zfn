import React,{useEffect,useState} from 'react'
import {Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {deleteMyAccount,myEmail} from '@/lib/supabase/account'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback

// "Meu perfil" → excluir a própria conta e os dados (LGPD).
export default function DeleteMyAccount({role}:{role:'aluno'|'profissional'|'admin'}){
 const [open,setOpen]=useState(false),[email,setEmail]=useState(''),[confirm,setConfirm]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('')
 useEffect(()=>{if(open)myEmail().then(setEmail).catch(()=>{})},[open])
 async function run(){setBusy(true);setError('');try{const out=await deleteMyAccount(confirm,reason);setDone(out==='excluida'?'Sua conta e seus dados foram excluídos.':'Sua conta foi excluída e seus dados pessoais apagados. Alguns registros de reservas ou pagamentos ficam guardados sem seu nome, como exige a lei.');setTimeout(()=>{window.location.href='/'},4000)}catch(err){setError(errorText(err,'Não foi possível excluir.'))}finally{setBusy(false)}}
 if(role==='admin')return null
 if(done)return <p role="status" className="rounded-md border border-[#a5ce41] bg-[#f4f9e8] p-3 font-semibold">{done} Obrigado por ter usado a 369. Você será levado à página inicial.</p>
 return <section className="space-y-3 border-t pt-4" aria-label="Excluir minha conta">
  <h3 className="font-extrabold">Excluir minha conta</h3>
  {!open?<><p className="text-sm text-[#626274]">Você pode apagar sua conta e seus dados a qualquer momento (Lei Geral de Proteção de Dados).</p>
   <Button type="button" variant="outline" className="!text-[#b42318]" onClick={()=>setOpen(true)}><Trash2 aria-hidden="true" className="mr-1 h-4 w-4"/>Quero excluir minha conta</Button></>
  :<div className="space-y-3 rounded-md border border-red-300 bg-red-50 p-3">
   <ul className="list-disc space-y-1 pl-5 text-sm">
    <li>Apaga seu perfil, contato, região, {role==='profissional'?'vitrine, conteúdos, desafios, ':''}treinos, registros, água, mensagens e avaliações.</li>
    {role==='profissional'&&<li>Seus alunos perdem o vínculo com você e deixam de ver seus treinos e conteúdos.</li>}
    <li>Se houver reservas ou pagamentos, esses registros ficam guardados <b>sem seu nome</b>, como exige a lei, e o login é bloqueado.</li>
    <li><b>Não dá para desfazer.</b> Para voltar, será preciso criar uma conta nova.</li>
   </ul>
   <label className="block text-sm font-semibold">Por que você está saindo? (opcional)<Input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <label className="block text-sm font-semibold">Para confirmar, digite seu e-mail{email?<> (<b>{email}</b>)</>:''}<Input type="email" autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   {error&&<p role="alert" className="text-sm">{error}</p>}
   <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy||!confirm.trim()} className="!bg-[#b42318] !text-white" onClick={()=>void run()}>Excluir minha conta definitivamente</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</Button></div>
  </div>}
 </section>
}

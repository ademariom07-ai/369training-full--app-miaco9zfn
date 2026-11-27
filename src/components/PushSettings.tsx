import React,{useCallback,useEffect,useState} from 'react'
import {Bell,BellOff} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {currentSubscription,disablePush,enablePush,pushSettings,pushSupport,pushTest,savePushPrefs,type PushPrefs} from '@/lib/supabase/push'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback

// "Meu perfil": ativar notificações neste aparelho e escolher o que receber.
export default function PushSettings({role}:{role:'aluno'|'profissional'|'admin'}){
 const support=pushSupport()
 const [on,setOn]=useState<boolean|null>(null),[prefs,setPrefs]=useState<PushPrefs|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const load=useCallback(()=>{currentSubscription().then(s=>setOn(!!s)).catch(()=>setOn(false));pushSettings().then(r=>setPrefs(r.prefs)).catch(()=>{})},[])
 useEffect(()=>{load()},[load])
 async function run(task:()=>Promise<void>,msg:string){setBusy(true);setError('');setNotice('');try{await task();setNotice(msg);load()}catch(err){setError(errorText(err,'Não foi possível concluir.'))}finally{setBusy(false)}}
 async function setPref(k:keyof PushPrefs,v:boolean|number|null){if(!prefs)return;const next={...prefs,[k]:v};setPrefs(next);try{await savePushPrefs(next)}catch(err){setError(errorText(err,'Não foi possível salvar.'))}}
 const items:[keyof PushPrefs,string,boolean][]=[['mensagens','Mensagens novas',true],['treinos',role==='aluno'?'Treino ou dieta novos e lembrete de treino':'Treinos',role==='aluno'],['conteudos','Conteúdos novos do meu profissional',role==='aluno'],
  ['vinculos',role==='aluno'?'Pedido de acompanhamento aceito e verificações':'Pedidos de alunos e verificações',true],['agua','Lembretes de água (configure em Desafios e água)',role==='aluno']]
 return <section className="space-y-3 border-t pt-4" aria-label="Notificações">
  <h3 className="flex items-center gap-2 font-extrabold"><Bell aria-hidden="true" className="h-5 w-5"/>Notificações</h3>
  {!support.ok?<p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">{support.reason}</p>:<>
   <p className="text-sm text-[#626274]">Receba avisos no celular ou no computador, mesmo com o app fechado. Ative em cada aparelho que você usa.</p>
   <div className="flex flex-wrap gap-2">{on?<>
     <span className="flex min-h-11 items-center font-semibold text-[#4d6b14]">✓ Ativadas neste aparelho</span>
     <Button type="button" variant="outline" disabled={busy} onClick={()=>void run(pushTest,'Teste enviado! Deve chegar em até 1 minuto.')}>Enviar teste</Button>
     <Button type="button" variant="outline" disabled={busy} onClick={()=>void run(disablePush,'Notificações desativadas neste aparelho.')}><BellOff aria-hidden="true" className="mr-1 h-4 w-4"/>Desativar</Button>
    </>:<Button type="button" disabled={busy||on===null} onClick={()=>void run(enablePush,'Notificações ativadas! Use "Enviar teste" para conferir.')}><Bell aria-hidden="true" className="mr-1 h-4 w-4"/>Ativar notificações neste aparelho</Button>}</div>
   {prefs&&<fieldset className="space-y-1"><legend className="text-sm font-semibold">O que você quer receber</legend>
    {items.filter(([,,show])=>show).map(([k,label])=><label key={k} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!prefs[k]} onChange={e=>void setPref(k,e.target.checked)}/>{label}</label>)}
    {role==='aluno'&&<label className="block text-sm font-semibold">Lembrete do treino do dia<select className="mt-1 block w-full max-w-xs rounded-md border p-2 text-sm" value={prefs.treino_hora??''} onChange={e=>void setPref('treino_hora',e.target.value===''?null:Number(e.target.value))}>
     <option value="">Não lembrar</option>{Array.from({length:18},(_,i)=>i+5).map(h=><option key={h} value={h}>Às {h}h (se ainda não registrou o treino)</option>)}</select></label>}
   </fieldset>}
  </>}
  {error&&<p role="alert" className="text-sm">{error}</p>}{notice&&<p role="status" className="text-sm font-semibold">{notice}</p>}
 </section>
}

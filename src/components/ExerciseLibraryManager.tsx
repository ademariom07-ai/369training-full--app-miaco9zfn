import React,{useMemo,useState} from 'react'
import {Plus,Search} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import ExerciseAnimationView from '@/components/ExerciseAnimationView'
import {YoutubePlayer} from '@/components/VideoFeed'
import {exerciseAnimations,normalizeName} from '@/lib/exerciseAnimations'
import {applyOverrides,archiveExercise,saveExercise,useExerciseLibrary,type ExerciseInput,type LibraryExercise} from '@/lib/supabase/exerciseLibrary'

const errorText=(err:unknown,fallback:string)=>err instanceof Error&&err.message?err.message:fallback
const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const field='mt-1 block w-full rounded-md border p-2'
const levels:Record<string,string>={iniciante:'Iniciante',intermediario:'Intermediário',avancado:'Avançado'}

// Admin: edita os exercícios oficiais (inclusive os textos das animações) e cria novos.
// Profissional: vê os oficiais e cadastra/edita os próprios (visíveis para os alunos dele).
export default function ExerciseLibraryManager({role}:{role:'admin'|'profissional'}){
 const library=useExerciseLibrary()
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<LibraryExercise|'novo'|null>(null)
 const canEdit=(e:LibraryExercise)=>role==='admin'?e.official:e.mine
 const shown=useMemo(()=>{const q=normalizeName(query);return library.filter(e=>(role==='admin'?e.official:true)&&(!q||normalizeName(e.name).includes(q)||e.aliases.some(a=>normalizeName(a).includes(q))))},[library,query,role])
 if(editing)return <ExerciseForm role={role} entry={editing==='novo'?null:editing} onDone={()=>setEditing(null)}/>
 return <section className="space-y-4">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold">{role==='admin'?'Biblioteca de exercícios':'Meus exercícios'}</h2>
   <p className="text-sm text-[#626274]">{role==='admin'?'Edite os textos dos exercícios oficiais (os 30 animados e os novos). As mudanças aparecem para todos.':'Cadastre seus próprios exercícios com explicação e vídeo. Eles aparecem para você e seus alunos e podem ser usados nos treinos.'}</p></div>
   <Button type="button" onClick={()=>setEditing('novo')}><Plus aria-hidden="true" className="mr-1 h-4 w-4"/>{role==='admin'?'Novo exercício oficial':'Novo exercício'}</Button></div>
  <label className="relative block"><span className="sr-only">Buscar</span><Search aria-hidden="true" className="absolute left-3 top-3.5 h-4 w-4 text-[#626274]"/><Input className="pl-9" placeholder="Buscar exercício" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <ul className="grid gap-2 md:grid-cols-2">{shown.map(e=><li key={e.exercise_id} className={card+' flex items-start justify-between gap-3'}>
   <span><span className="block font-bold">{e.name}</span><span className="block text-sm text-[#626274]">{[e.slug?'Com animação':e.video?'Com vídeo':'Só texto',e.official?'Oficial 369':e.mine?'Meu':`De ${e.owner_name}`,e.level?levels[e.level]:''].filter(Boolean).join(' · ')}</span></span>
   {canEdit(e)?<Button type="button" variant="outline" onClick={()=>setEditing(e)}>Editar</Button>:null}
  </li>)}</ul>
  {!shown.length&&<p className={card}>{query?'Nenhum exercício encontrado.':'A lista está vazia.'}</p>}
 </section>
}

function ExerciseForm({role,entry,onDone}:{role:'admin'|'profissional',entry:LibraryExercise|null,onDone:()=>void}){
 const anim=entry?.slug?exerciseAnimations.find(a=>a.id===entry.slug)??null:null
 const [form,setForm]=useState<ExerciseInput>({id:entry?.exercise_id??null,name:entry?.name??'',aliases:(entry?.aliases??[]).join(', '),muscles:entry?.muscles??anim?.muscles??'',instructions:entry?.instructions??'',
  phaseCues:anim?anim.phases.map((p,i)=>{const c=entry?.phase_cues?.[i]?.cues?.length?entry.phase_cues[i].cues:p.cues;return [0,1,2].map(n=>c[n]??'')}):null,video:entry?.video??'',level:entry?.level??'',equipment:entry?.equipment??''})
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const set=<K extends keyof ExerciseInput>(k:K,v:ExerciseInput[K])=>setForm(f=>({...f,[k]:v}))
 const preview=anim?applyOverrides(anim,{...(entry as LibraryExercise),name:form.name||anim.name,muscles:form.muscles,phase_cues:form.phaseCues?.map(c=>({cues:c.filter(Boolean)}))??null}):null
 async function save(){setBusy(true);setError('');try{await saveExercise(form);onDone()}catch(err){setError(errorText(err,'Não foi possível salvar.'))}finally{setBusy(false)}}
 async function archive(){if(!entry||!window.confirm('Arquivar este exercício? Ele deixa de aparecer na biblioteca.'))return;setBusy(true);try{await archiveExercise(entry.exercise_id);onDone()}catch(err){setError(errorText(err,'Não foi possível arquivar.'))}finally{setBusy(false)}}
 return <form className="space-y-4" onSubmit={e=>{e.preventDefault();void save()}}>
  <Button type="button" variant="outline" onClick={onDone}>← Voltar</Button>
  <h2 className="text-xl font-extrabold">{entry?'Editar exercício':role==='admin'?'Novo exercício oficial':'Novo exercício'}</h2>
  <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
   <div className="space-y-3">
    <label className="block font-semibold">Nome<Input required minLength={3} maxLength={80} value={form.name} onChange={e=>set('name',e.target.value)}/></label>
    <label className="block font-semibold">Outros nomes (separados por vírgula)<Input maxLength={900} value={form.aliases} onChange={e=>set('aliases',e.target.value)} placeholder="Ex.: agachamento, squat"/><span className="text-xs font-normal text-[#626274]">Ajudam a reconhecer o exercício quando escrito de outro jeito no treino.</span></label>
    <label className="block font-semibold">Músculos trabalhados<Input maxLength={300} value={form.muscles} onChange={e=>set('muscles',e.target.value)}/></label>
    {!anim&&<label className="block font-semibold">Como executar<textarea className={field} rows={4} maxLength={1500} value={form.instructions} onChange={e=>set('instructions',e.target.value)} placeholder="Posição inicial, movimento, cuidados."/></label>}
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="font-semibold">Nível<select className={field} value={form.level} onChange={e=>set('level',e.target.value)}><option value="">—</option>{Object.entries(levels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label className="font-semibold">Equipamento<Input maxLength={80} value={form.equipment} onChange={e=>set('equipment',e.target.value)} placeholder="Ex.: halteres, banco"/></label>
    </div>
    <label className="block font-semibold">Vídeo do YouTube (opcional)<Input inputMode="url" maxLength={300} value={form.video} onChange={e=>set('video',e.target.value)} placeholder="https://youtu.be/..."/></label>
    {anim&&form.phaseCues&&<fieldset className={card+' space-y-3'}><legend className="font-extrabold">Dicas de cada fase (aparecem na animação)</legend>
     {anim.phases.map((p,i)=><div key={i} className="space-y-1"><p className="text-sm font-bold">{i+1} · {p.label}</p>
      {[0,1,2].map(k=><Input key={k} maxLength={90} value={form.phaseCues![i][k]??''} placeholder={k===0?'Dica (obrigatória)':'Dica (opcional)'} onChange={e=>set('phaseCues',form.phaseCues!.map((list,j)=>j===i?list.map((v,n)=>n===k?e.target.value:v):list))}/>)}
     </div>)}</fieldset>}
   </div>
   <div className="space-y-3">{preview?<ExerciseAnimationView exercise={preview}/>:form.video?<p className="text-sm">Prévia do vídeo depois de salvar.</p>:<p className={card+' text-sm'}>Exercícios novos aparecem com o texto "Como executar" e o vídeo (se houver). A animação existe só para os 30 da biblioteca 369.</p>}
    {entry?.video&&!preview&&<YoutubePlayer id={entry.video} title={entry.name}/>}</div>
  </div>
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Salvar</Button>{entry&&!entry.slug&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void archive()}>Arquivar</Button>}</div>
 </form>
}

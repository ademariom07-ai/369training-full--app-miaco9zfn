import ReleasedAvailability from '@/components/ReleasedAvailability'
import {useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {readApprovedProfessionals,type ProfessionalEntry} from '@/lib/supabase/directory'
export default function ProfessionalDirectory({owner,disabled,onRequest}:{owner:string;disabled:boolean;onRequest:(professionalId:string)=>Promise<void>}){
 const [page,setPage]=useState(1),[rows,setRows]=useState<ProfessionalEntry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState<ProfessionalEntry|null>(null),[sending,setSending]=useState(false),[reload,setReload]=useState(0)
 const lock=useRef(false),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{let active=true;setRows([]);setSelected(null);setError('');setLoading(true)
  readApprovedProfessionals(page).then(data=>{if(active)setRows(data)}).catch(()=>{if(active)setError('Não foi possível carregar os profissionais. Tente atualizar.')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[page,reload])
 async function request(){
  if(lock.current||disabled||loading||!selected)return
  lock.current=true;setSending(true);setError('');const id=selected.professional_id
  try{await onRequest(id)}catch{if(mounted.current)setError('Não foi possível solicitar. Atualize sua conta para conferir o vínculo antes de tentar novamente.')}
  finally{lock.current=false;if(mounted.current)setSending(false)}
 }
 const blocked=disabled||loading||sending
 return <section className="space-y-3 rounded-lg border p-4" aria-label="Encontrar profissional"><h2 className="text-lg font-semibold">Escolha um profissional</h2><p>O vínculo começa após o aceite do profissional. Isso não agenda uma consulta nem realiza um pagamento.</p>
  {loading&&<p role="status">Carregando profissionais…</p>}{error&&<p role="alert">{error}</p>}
  {!loading&&!error&&(rows.length?<label className="block">Profissional aprovado<select className="mt-1 block w-full rounded-md border bg-white p-2" value={selected?.professional_id||''} disabled={blocked} onChange={event=>setSelected(rows.find(row=>row.professional_id===event.target.value)||null)}><option value="">Selecione um profissional</option>{rows.map(row=><option key={row.professional_id} value={row.professional_id}>{row.display_name}</option>)}</select></label>:<p>Nenhum profissional disponível nesta página.</p>)}
  {selected&&<ReleasedAvailability key={owner+selected.professional_id} owner={owner} professionalId={selected.professional_id} disabled={blocked}/>}
  {selected&&<p>Solicitar acompanhamento com {selected.display_name}?</p>}<Button type="button" disabled={blocked||!!error||!selected} onClick={()=>void request()}>Solicitar vínculo</Button>
  <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" disabled={blocked||page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</Button><span>Página {page}</span><Button type="button" variant="outline" disabled={blocked||!!error||rows.length<20||page>=10000} onClick={()=>setPage(p=>p+1)}>Próxima</Button><Button type="button" variant="outline" disabled={blocked} onClick={()=>setReload(n=>n+1)}>Atualizar profissionais</Button></div>
 </section>
}

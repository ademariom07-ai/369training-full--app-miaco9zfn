import {useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {readOwnWallet,parseWalletAmount,type WalletAccount,type WalletWithdrawal} from '@/lib/supabase/wallet'
import type {OwnProfile} from '@/lib/supabase/profiles'
type Props={account:OwnProfile;disabled:boolean;onInitialize:()=>Promise<void>;onReserve:(amountCents:number)=>Promise<void>;onCancel:(row:WalletWithdrawal)=>Promise<void>}
function money(value:number){const cents=BigInt(value);return `R$ ${new Intl.NumberFormat('pt-BR').format(cents/100n)},${String(cents%100n).padStart(2,'0')}`}
export default function SupabaseWallet({account,disabled,onInitialize,onReserve,onCancel}:Props){
 const [wallet,setWallet]=useState<WalletAccount|null>(null),[rows,setRows]=useState<WalletWithdrawal[]>([]),[owner,setOwner]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[page,setPage]=useState(1),[reload,setReload]=useState(0),[amount,setAmount]=useState(''),[confirmation,setConfirmation]=useState<number|null>(null),[cancelling,setCancelling]=useState<WalletWithdrawal|null>(null),[sending,setSending]=useState(false)
 const lock=useRef(false),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{setPage(1);setAmount('')},[account.id])
 useEffect(()=>{let active=true;setWallet(null);setRows([]);setOwner(null);setConfirmation(null);setCancelling(null);setError('');setLoading(true)
  void readOwnWallet(account.id,page).then(result=>{if(active){setWallet(result.account);setRows(result.withdrawals);setOwner(account.id)}}).catch(()=>{if(active)setError('Não foi possível verificar a carteira. Atualize sua conta antes de continuar.')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[account.id,page,reload])
 async function act(task:()=>Promise<void>){if(lock.current||disabled||loading||owner!==account.id)return;lock.current=true;setSending(true);setError('');try{await task();if(mounted.current){setAmount('');setConfirmation(null);setCancelling(null);setReload(n=>n+1)}}catch{if(mounted.current)setError('Não foi possível concluir. Atualize e confira suas reservas antes de tentar novamente.')}finally{lock.current=false;if(mounted.current)setSending(false)}}
 const blocked=disabled||loading||sending||owner!==account.id
 return <section className="space-y-3 rounded-lg border p-4" aria-label="Carteira Supabase"><h2 className="text-lg font-semibold">Carteira</h2><p>Saldo em reais. Nesta etapa você pode preparar a carteira e reservar ou cancelar um valor disponível. Depósitos, cashback e transferências bancárias ainda não estão disponíveis.</p>{loading&&<p role="status">Verificando carteira…</p>}{error&&<p role="alert">{error}</p>}
  {!loading&&owner===account.id&&(!wallet?<Button type="button" disabled={blocked} onClick={()=>void act(onInitialize)}>Preparar carteira com saldo zero</Button>:<>
   <dl className="grid gap-2 sm:grid-cols-2"><div><dt>Disponível</dt><dd className="font-semibold">{money(wallet.available_cents)}</dd></div><div><dt>Reservado</dt><dd className="font-semibold">{money(wallet.reserved_cents)}</dd></div></dl><p>Reservas reduzem o saldo disponível. Reservar não transfere dinheiro.</p>
   <form className="space-y-2" onSubmit={e=>{e.preventDefault();try{const cents=parseWalletAmount(amount);if(cents>wallet.available_cents)throw Error();setConfirmation(cents);setCancelling(null);setError('')}catch{setConfirmation(null);setError('Informe um valor positivo, com até duas casas decimais e dentro do saldo disponível.')}}}><label className="block">Valor para reservar<Input required inputMode="decimal" maxLength={18} value={amount} onChange={e=>{setAmount(e.target.value);setConfirmation(null)}} disabled={blocked||wallet.available_cents===0}/></label><Button type="submit" disabled={blocked||wallet.available_cents===0||!amount.trim()}>Conferir reserva</Button></form>
   {confirmation!==null&&<div role="group" aria-label="Confirmar reserva" className="space-y-2 rounded border p-3"><p>Reservar {money(confirmation)} do saldo disponível? Nenhuma transferência bancária será realizada.</p><Button type="button" disabled={blocked} onClick={()=>void act(()=>onReserve(confirmation))}>Confirmar reserva</Button><Button type="button" variant="outline" disabled={blocked} onClick={()=>setConfirmation(null)}>Voltar</Button></div>}
   <h3 className="font-semibold">Suas reservas</h3>{rows.length?<ul className="space-y-2">{rows.map(row=><li className="rounded border p-3" key={row.id}><p>{money(row.amount_cents)} — {row.status==='reserved'?'Reservado':'Cancelado'}</p><p className="text-sm">Criado em {new Date(row.created_at).toLocaleString('pt-BR')}</p>{row.status==='reserved'&&<Button type="button" variant="outline" disabled={blocked} onClick={()=>{setCancelling(row);setConfirmation(null)}}>Cancelar reserva</Button>}</li>)}</ul>:<p>Nenhuma reserva nesta página.</p>}
   {cancelling&&<div role="group" aria-label="Confirmar cancelamento de reserva"><p>Devolver {money(cancelling.amount_cents)} ao saldo disponível?</p><Button type="button" disabled={blocked} onClick={()=>void act(()=>onCancel(cancelling))}>Confirmar cancelamento</Button><Button type="button" variant="outline" disabled={blocked} onClick={()=>setCancelling(null)}>Voltar</Button></div>}
   <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={blocked||page<=1} onClick={()=>setPage(n=>n-1)}>Anterior</Button><span>Página {page}</span><Button type="button" variant="outline" disabled={blocked||rows.length<20||page>=10000} onClick={()=>setPage(n=>n+1)}>Próxima</Button></div>
  </>)}
  <Button type="button" variant="outline" disabled={disabled||loading||sending} onClick={()=>setReload(n=>n+1)}>Atualizar carteira</Button>
 </section>
}

import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
export type WalletAccount=Database['public']['Tables']['wallet_accounts']['Row']
export type WalletWithdrawal=Database['public']['Tables']['wallet_withdrawals']['Row']
type Client=SupabaseClient<Database>
const accountFields='user_id,available_cents,reserved_cents,version,updated_at',withdrawalFields='id,user_id,request_id,amount_cents,status,created_at,cancelled_at'
function uuid(value:string){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificação inválida.');return value.toLowerCase()}
function integer(value:number,min=0){if(!Number.isSafeInteger(value)||value<min)throw Error('Valor inválido.');return value}
function date(value:string){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Data inválida.');return value}
function account(row:WalletAccount,owner:string){if(!row||uuid(row.user_id)!==owner)throw Error('Carteira indisponível.');const available_cents=integer(row.available_cents),reserved_cents=integer(row.reserved_cents);if(!Number.isSafeInteger(available_cents+reserved_cents))throw Error('Carteira indisponível.');return{user_id:owner,available_cents,reserved_cents,version:integer(row.version,1),updated_at:date(row.updated_at)}}
function withdrawal(row:WalletWithdrawal,owner:string){if(!row||uuid(row.user_id)!==owner||!['reserved','cancelled'].includes(row.status)||row.status==='reserved'&&row.cancelled_at!==null||row.status==='cancelled'&&!row.cancelled_at)throw Error('Reserva indisponível.');return{id:uuid(row.id),user_id:owner,request_id:uuid(row.request_id),amount_cents:integer(row.amount_cents,1),status:row.status,created_at:date(row.created_at),cancelled_at:row.cancelled_at===null?null:date(row.cancelled_at)}}
async function actor(client:Client,expectedId:string){const id=uuid(expectedId),identity=await verifiedIdentity(client);if(identity.id!==id)throw Error('Sessão alterada.');return identity}
export function parseWalletAmount(value:string){if(typeof value!=='string'||!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))throw Error('Informe um valor positivo com até duas casas decimais.');const [whole,fraction='']=value.trim().replace(',','.').split('.');const result=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));if(result<1n||result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Valor fora dos limites.');return Number(result)}
export async function ensureOwnWallet(expectedId:string,client:Client=getSupabaseClient()){
 const identity=await actor(client,expectedId),result=await client.rpc('ensure_wallet_account').single();await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível preparar a carteira.');return account(result.data,identity.id)
}
export async function reserveWallet(requestId:string,amountCents:number,expectedId:string,client:Client=getSupabaseClient()){
 const p_request_id=uuid(requestId),p_amount_cents=integer(amountCents,1),identity=await actor(client,expectedId)
 const result=await client.rpc('reserve_wallet_withdrawal',{p_request_id,p_amount_cents}).single();await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível reservar o saldo.');const row=withdrawal(result.data,identity.id)
 if(row.request_id!==p_request_id||row.amount_cents!==p_amount_cents)throw Error('Reserva indisponível.');return row
}
export async function cancelWallet(withdrawalId:string,expectedId:string,client:Client=getSupabaseClient()){
 const p_withdrawal_id=uuid(withdrawalId),identity=await actor(client,expectedId)
 const result=await client.rpc('cancel_wallet_withdrawal',{p_withdrawal_id}).single();await assertSessionUnchanged(client,identity)
 if(result.error||!result.data)throw Error('Não foi possível cancelar a reserva.');const row=withdrawal(result.data,identity.id)
 if(row.id!==p_withdrawal_id||row.status!=='cancelled')throw Error('Reserva indisponível.');return row
}
export async function readOwnWallet(expectedId:string,page=1,client:Client=getSupabaseClient()){
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Página inválida.');const identity=await actor(client,expectedId)
 const first=await client.from('wallet_accounts').select(accountFields).eq('user_id',identity.id).maybeSingle()
 await assertSessionUnchanged(client,identity)
 if(first.error)throw Error('Carteira indisponível.');if(!first.data)return{account:null,withdrawals:[]}
 const snapshot=account(first.data,identity.id)
 const result=await client.from('wallet_withdrawals').select(withdrawalFields).eq('user_id',identity.id).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1)
 const last=await client.from('wallet_accounts').select(accountFields).eq('user_id',identity.id).maybeSingle()
 await assertSessionUnchanged(client,identity)
 if(result.error||!Array.isArray(result.data)||result.data.length>20||last.error||!last.data)throw Error('Carteira indisponível.')
 const current=account(last.data,identity.id)
 if(current.version!==snapshot.version||current.available_cents!==snapshot.available_cents||current.reserved_cents!==snapshot.reserved_cents||current.updated_at!==snapshot.updated_at)throw Error('Saldo alterado. Atualize a carteira.')
 const seen=new Set<string>(),requests=new Set<string>()
 const withdrawals=result.data.map(value=>{const row=withdrawal(value,identity.id);if(seen.has(row.id)||requests.has(row.request_id))throw Error('Reserva indisponível.');seen.add(row.id);requests.add(row.request_id);return row})
 return{account:current,withdrawals}
}

import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'

// Verificação em duas etapas (migração 20261202120000): CPF (todos) e fotos do parceiro (para atender).
type Client=SupabaseClient<Database>
export const BUCKET='verificacao'
export type Verification={cpf_status:'verificado'|'em_analise'|'recusado'|null,cpf_masked:string|null,cpf_reason:string|null,partner_status:'em_analise'|'verificado'|'recusado'|null,partner_reason:string|null,partner_required:boolean,doc_sent:boolean,selfie_sent:boolean,credential_sent:boolean}
export const CPF_DUPLICATE='Este CPF já está cadastrado em outra conta. Se ele é seu, você pode pedir a análise da equipe 369.'
const known=['CPF inválido. Confira os números.',CPF_DUPLICATE,'Seu CPF já foi confirmado. Para corrigir, fale com a equipe 369.','A verificação é para parceiros já aprovados na primeira etapa.','Primeiro confirme seu CPF em "Meu perfil".',
 'Envie as três fotos.','Sua verificação já foi aprovada.','Informe o motivo (3 a 300 caracteres).','Análise indisponível.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mesma regra do banco: 11 dígitos, não repetidos, dígitos verificadores corretos.
export function cpfValid(cpf:string){
 const d=cpf.replace(/\D/g,'');if(d.length!==11||/^(\d)\1{10}$/.test(d))return false
 const dv=(n:number)=>{let s=0;for(let i=0;i<n;i++)s+=Number(d[i])*(n+1-i);const r=(s*10)%11;return r===10?0:r}
 return dv(9)===Number(d[9])&&dv(10)===Number(d[10])
}
export function formatCpf(v:string){const d=v.replace(/\D/g,'').slice(0,11);return d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/,'.$1-$2')}

export async function myVerification(client:Client=getSupabaseClient()):Promise<Verification>{
 const rows=await call(client,()=>client.rpc('my_verification'),'Não foi possível carregar.')
 const r=Array.isArray(rows)?rows[0]:null
 return{cpf_status:(r?.cpf_status??null) as Verification['cpf_status'],cpf_masked:r?.cpf_masked??null,cpf_reason:r?.cpf_reason??null,partner_status:(r?.partner_status??null) as Verification['partner_status'],partner_reason:r?.partner_reason??null,partner_required:r?.partner_required??true,doc_sent:!!r?.doc_sent,selfie_sent:!!r?.selfie_sent,credential_sent:!!r?.credential_sent}
}
export async function setMyCpf(cpf:string,requestReview:boolean,client:Client=getSupabaseClient()){
 if(!cpfValid(cpf))throw Error('CPF inválido. Confira os números.')
 return await call(client,()=>client.rpc('set_my_cpf',{p_cpf:cpf.replace(/\D/g,''),p_request_review:requestReview}),'Não foi possível salvar o CPF.') as 'verificado'|'em_analise'
}
const types:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf'}
export async function uploadVerificationFile(owner:string,file:File,client:Client=getSupabaseClient()){
 const m=file.name.toLowerCase().match(/\.([a-z0-9]{2,5})$/),ext=m&&types[m[1]]?m[1]:file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':file.type==='image/webp'?'webp':null
 if(!ext)throw Error('Use uma foto (JPG, PNG ou WEBP) ou PDF. No iPhone, se a foto for HEIC, tire pela câmera do app.')
 if(file.size<1||file.size>10*1024*1024)throw Error('Cada foto pode ter até 10 MB.')
 if(!uuid.test(owner))throw Error('Conta inválida.')
 await verifiedIdentity(client)
 const rand=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('')
 const path=`${owner}/${rand}.${ext}`
 const {error}=await client.storage.from(BUCKET).upload(path,file,{contentType:types[ext],upsert:false})
 if(error)throw Error('Não foi possível enviar a foto. Confira o tamanho (até 10 MB) e tente de novo.')
 return path
}
export async function submitPartnerVerification(doc:string,selfie:string,credential:string,client:Client=getSupabaseClient()){
 await call(client,()=>client.rpc('submit_partner_verification',{p_doc:doc,p_selfie:selfie,p_credential:credential}),'Não foi possível enviar.',true)
}
// Abre a foto como blob (o endereço do Storage não precisa entrar na política de imagens do site).
export async function verificationImageUrl(path:string,client:Client=getSupabaseClient()){
 const {data,error}=await client.storage.from(BUCKET).download(path)
 if(error||!data)throw Error('Não foi possível abrir a foto.')
 return URL.createObjectURL(data)
}
export async function deleteVerificationFiles(paths:string[],client:Client=getSupabaseClient()){
 const list=paths.filter(Boolean);if(!list.length)return
 await client.storage.from(BUCKET).remove(list)
}
export async function adminListCpfReviews(client:Client=getSupabaseClient()){const rows=await call(client,()=>client.rpc('admin_list_cpf_reviews'),'Não foi possível carregar.');return Array.isArray(rows)?rows:[]}
export async function adminReviewCpf(user:string,approve:boolean,reason:string,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('admin_review_cpf',{p_user:user,p_approve:approve,p_reason:reason.trim()}),'Não foi possível registrar.',true)}
export async function adminListPartnerVerifications(client:Client=getSupabaseClient()){const rows=await call(client,()=>client.rpc('admin_list_partner_verifications'),'Não foi possível carregar.');return Array.isArray(rows)?rows:[]}
// Decide e apaga as fotos (minimização: depois da análise elas não são mais necessárias).
export async function adminReviewPartner(user:string,approve:boolean,reason:string,paths:(string|null)[],client:Client=getSupabaseClient()){
 if(reason.trim().length<3)throw Error('Informe o motivo (3 a 300 caracteres).')
 await call(client,()=>client.rpc('admin_review_partner',{p_user:user,p_approve:approve,p_reason:reason.trim()}),'Não foi possível registrar.',true)
 try{await deleteVerificationFiles(paths.filter((p):p is string=>!!p),client)}catch{/* a análise já foi registrada */}
}
export async function verifiedPartners(ids:string[],client:Client=getSupabaseClient()):Promise<Set<string>>{
 const list=[...new Set(ids.filter(i=>uuid.test(i)))].slice(0,60);if(!list.length)return new Set()
 const rows=await call(client,()=>client.rpc('verified_partners',{p_users:list}),'Não foi possível carregar.')
 return new Set((Array.isArray(rows)?rows:[]).map(r=>r.user_id))
}
// Onde o admin confere o registro (sites oficiais; a consulta de registrados fica dentro de cada site).
export const councilLookup:Record<string,{label:string,url:string|null}>={
 educacao_fisica:{label:'Site do CONFEF (consulta de registrados)',url:'https://www.confef.org.br/'},
 nutricao:{label:'Site do CFN (consulta de nutricionistas)',url:'https://www.cfn.org.br/'},
 fisioterapia:{label:'Site do COFFITO (consulta de profissionais)',url:'https://www.coffito.gov.br/'},
 psicologia:{label:'Site do CFP (cadastro de psicólogos)',url:'https://site.cfp.org.br/'},
 artes_marciais:{label:'Confira a carteira/certificado da confederação (CBJ, CBJJ, CBK) na foto',url:null},
}

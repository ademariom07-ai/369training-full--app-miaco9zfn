import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from './database.types'
import {getSupabaseClient} from './client'
import {verifiedIdentity,assertSessionUnchanged} from './profiles'
import {youtubeVideoId} from './videoFeed'

// Conteúdos dos profissionais (migração 20261124120000): aulas, vídeos, dicas, e-books, estudos e materiais.
type Client=SupabaseClient<Database>
export const contentKinds=['aula','video','dica','ebook','estudo','material'] as const
export type ContentKind=typeof contentKinds[number]
export const kindLabels:Record<ContentKind,string>={aula:'Aula',video:'Vídeo',dica:'Dica',ebook:'E-book / livro',estudo:'Estudo',material:'Material'}
export type Audience='publico'|'meus_alunos'|'selecionados'
export const audienceLabels:Record<Audience,string>={publico:'Todos os alunos da 369',meus_alunos:'Meus alunos',selecionados:'Alunos escolhidos'}
export type ContentItem={content_id:string,owner_id:string,owner_name:string,kind:ContentKind,title:string,description:string|null,body:string|null,youtube_id:string|null,file_path:string|null,file_name:string|null,file_size:number|null,price_cents:number,audience:Audience,published_at:string,unlocked:boolean,for_me:boolean}
export type MyContent={content_id:string,kind:ContentKind,title:string,description:string|null,body:string|null,youtube_id:string|null,file_path:string|null,file_name:string|null,file_size:number|null,price_cents:number,audience:Audience,status:'em_analise'|'publicado'|'recusado',review_reason:string|null,updated_at:string,recipients:string[],grants:string[]}
export type PendingContent={content_id:string,owner_name:string,kind:ContentKind,title:string,description:string|null,body:string|null,youtube_id:string|null,file_path:string|null,file_name:string|null,price_cents:number,created_at:string}
export type StudentGroup={group_id:string,name:string,members:string[]}
export const BUCKET='conteudos'
export const MAX_FILE=25*1024*1024
export const acceptedFiles='.pdf,.epub,.jpg,.jpeg,.png,.webp,.docx,.pptx,.xlsx,.mp3,.m4a,.mp4'
const extTypes:Record<string,string>={pdf:'application/pdf',epub:'application/epub+zip',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4'}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const known=['Conteúdo inválido: confira os campos.','Use um link do YouTube.','Arquivo inválido.','Escolha pelo menos um aluno.','Envie só para alunos com acompanhamento ativo com você.',
 'Limite diário de conteúdos atingido.','Conteúdos disponíveis para profissionais aprovados.','Este aluno não vê este conteúdo.','Informe o motivo da recusa.',
 'Dê um nome e escolha pelo menos um aluno.','Inclua só alunos com acompanhamento ativo com você.','Limite de grupos atingido.','Já existe um grupo com esse nome.','Conteúdo indisponível.','Grupo indisponível.']
const fail=(error:{message?:string}|null,fallback:string)=>Error(error?.message&&known.includes(error.message)?error.message:fallback)
async function call<T>(client:Client,task:()=>PromiseLike<{data:T|null,error:{message?:string}|null}>,fallback:string,allowNull=false):Promise<T>{
 const actor=await verifiedIdentity(client),result=await task();await assertSessionUnchanged(client,actor)
 if(result.error||(!allowNull&&(result.data===null||result.data===undefined)))throw fail(result.error,fallback)
 return result.data as T
}

// "R$ 29,90" → 2990. Vazio ou "grátis" → 0.
export function parsePrice(text:string):number{
 const t=text.trim().toLowerCase();if(!t||t.startsWith('gr'))return 0
 const clean=t.replace(/r\$|\s/g,''),norm=clean.includes(',')?clean.replace(/\./g,'').replace(',','.'):clean
 if(!/^\d+(\.\d{1,2})?$/.test(norm))throw Error('Preço inválido. Use, por exemplo, 29,90.')
 const cents=Math.round(Number(norm)*100);if(cents>100000)throw Error('O preço máximo é R$ 1.000,00.')
 return cents
}
export const formatPrice=(cents:number)=>cents?(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Grátis'
export const formatSize=(bytes:number|null)=>!bytes?'':bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1).replace('.',',')} MB`
export function fileExtension(name:string){const m=name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);return m&&extTypes[m[1]]?m[1]:null}

export type ContentInput={id:string|null,kind:ContentKind,title:string,description:string,body:string,youtube:string,file:{path:string,name:string,size:number}|null,price:string,audience:Audience,recipients:string[]}
export async function saveContent(input:ContentInput,client:Client=getSupabaseClient()){
 const title=input.title.trim().replace(/\s+/g,' ')
 if(title.length<3||title.length>120)throw Error('Dê um título com 3 a 120 caracteres.')
 if(input.description.length>2000||input.body.length>8000)throw Error('Texto longo demais.')
 const yt=input.youtube.trim();if(yt&&!youtubeVideoId(yt)&&!/^[A-Za-z0-9_-]{11}$/.test(yt))throw Error('Use um link do YouTube.')
 if(!yt&&!input.body.trim()&&!input.file)throw Error('Inclua um vídeo do YouTube, um texto ou um arquivo.')
 if(input.audience==='selecionados'&&!input.recipients.length)throw Error('Escolha pelo menos um aluno.')
 const price=parsePrice(input.price)
 const id=await call(client,()=>client.rpc('save_content',{p_id:input.id,p_kind:input.kind,p_title:title,p_description:input.description.trim()||null,p_body:input.body.trim()||null,
  p_youtube:yt||null,p_file_path:input.file?.path??null,p_file_name:input.file?.name.slice(0,120)??null,p_file_size:input.file?.size??null,p_price_cents:price,p_audience:input.audience,
  p_recipients:input.audience==='selecionados'?input.recipients:null}),'Não foi possível salvar o conteúdo.')
 if(typeof id!=='string'||!uuid.test(id))throw Error('Não foi possível salvar o conteúdo.')
 return id
}
// Envia o arquivo para a pasta do autor no Storage e devolve o caminho.
export async function uploadContentFile(owner:string,file:File,client:Client=getSupabaseClient()){
 const ext=fileExtension(file.name)
 if(!ext)throw Error('Formato não aceito. Use PDF, EPUB, imagem, Word, PowerPoint, Excel, MP3 ou MP4.')
 if(file.size<1||file.size>MAX_FILE)throw Error('O arquivo pode ter até 25 MB.')
 if(!uuid.test(owner))throw Error('Conta inválida.')
 await verifiedIdentity(client)
 const rand=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('')
 const path=`${owner}/${rand}.${ext}`
 const {error}=await client.storage.from(BUCKET).upload(path,file,{contentType:extTypes[ext],upsert:false})
 if(error)throw Error('Não foi possível enviar o arquivo. Confira o tamanho (até 25 MB) e tente de novo.')
 return{path,name:file.name.slice(0,120),size:file.size}
}
// Link temporário (5 min) para abrir o arquivo; o Storage confere se a pessoa tem acesso.
export async function openContentFile(path:string,client:Client=getSupabaseClient()){
 await verifiedIdentity(client)
 const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,300)
 if(error||!data?.signedUrl)throw Error('Não foi possível abrir o arquivo.')
 return data.signedUrl
}
export async function archiveContent(id:string,client:Client=getSupabaseClient()){if(!uuid.test(id))throw Error('Conteúdo inválido.');await call(client,()=>client.rpc('archive_content',{p_id:id}),'Não foi possível arquivar.',true)}
export async function reviewContent(id:string,approve:boolean,reason:string,client:Client=getSupabaseClient()){if(!uuid.test(id))throw Error('Conteúdo inválido.');return await call(client,()=>client.rpc('review_content',{p_id:id,p_approve:approve,p_reason:reason.trim()||null}),'Não foi possível registrar a análise.')}
export async function grantContent(id:string,user:string,grant:boolean,client:Client=getSupabaseClient()){if(!uuid.test(id)||!uuid.test(user))throw Error('Dados inválidos.');await call(client,()=>client.rpc('grant_content',{p_id:id,p_user:user,p_grant:grant}),'Não foi possível alterar o acesso.',true)}
const asKind=(k:string):ContentKind=>(contentKinds as readonly string[]).includes(k)?k as ContentKind:'material'
export async function listContents(scope:'para_mim'|'publicos'|'todos',page=1,client:Client=getSupabaseClient()):Promise<ContentItem[]>{
 const rows=await call(client,()=>client.rpc('list_contents',{p_scope:scope,p_page:page}),'Não foi possível carregar os conteúdos.')
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&uuid.test(r.content_id)).map(r=>({...r,kind:asKind(r.kind),audience:r.audience as Audience}))
}
export async function listMyContents(client:Client=getSupabaseClient()):Promise<MyContent[]>{
 const rows=await call(client,()=>client.rpc('list_my_contents'),'Não foi possível carregar seus conteúdos.')
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&uuid.test(r.content_id)).map(r=>({...r,kind:asKind(r.kind),audience:r.audience as Audience,status:r.status as MyContent['status'],recipients:r.recipients??[],grants:r.grants??[]}))
}
export async function listPendingContents(client:Client=getSupabaseClient()):Promise<PendingContent[]>{
 const rows=await call(client,()=>client.rpc('list_pending_contents'),'Não foi possível carregar os conteúdos.')
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&uuid.test(r.content_id)).map(r=>({...r,kind:asKind(r.kind)}))
}
export async function listStudentGroups(client:Client=getSupabaseClient()):Promise<StudentGroup[]>{
 const rows=await call(client,()=>client.rpc('list_student_groups'),'Não foi possível carregar os grupos.')
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&uuid.test(r.group_id)).map(r=>({...r,members:r.members??[]}))
}
export async function saveStudentGroup(id:string|null,name:string,members:string[],client:Client=getSupabaseClient()){
 const n=name.trim().replace(/\s+/g,' ');if(n.length<2||n.length>60)throw Error('Dê um nome de 2 a 60 letras ao grupo.')
 if(!members.length)throw Error('Escolha pelo menos um aluno.')
 return await call(client,()=>client.rpc('save_student_group',{p_id:id,p_name:n,p_members:members}),'Não foi possível salvar o grupo.')
}
export async function deleteStudentGroup(id:string,client:Client=getSupabaseClient()){await call(client,()=>client.rpc('delete_student_group',{p_id:id}),'Não foi possível apagar o grupo.',true)}

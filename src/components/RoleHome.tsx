import React from 'react'
import {Briefcase,Clapperboard,CalendarDays,ClipboardCheck,Dumbbell,Film,Home,Inbox,Leaf,LogOut,RefreshCw,ShieldCheck,Trophy,UserRound,Users,Wallet,type LucideIcon} from 'lucide-react'
import type {OwnProfile} from '@/lib/supabase/profiles'
import InstallApp from '@/components/InstallApp'

// Menus por perfil verificado. Só organiza a tela: a autorização continua no servidor.
export type RoleKind='aluno'|'parceiro'|'parceiro_pendente'|'admin'
export type RoleView={id:string,label:string,icon:LucideIcon,summary:string}

export function roleKind(profile:Pick<OwnProfile,'role'|'approved'>):RoleKind{
 if(profile.role==='admin')return 'admin'
 if(profile.role==='profissional')return profile.approved?'parceiro':'parceiro_pendente'
 return 'aluno'
}

const inicio:RoleView={id:'inicio',label:'Visão geral',icon:Home,summary:'Resumo do seu espaço.'}
const perfil:RoleView={id:'perfil',label:'Meu perfil',icon:UserRound,summary:'Nome exibido e dados da conta.'}
const esg:RoleView={id:'esg',label:'Projetos ESG',icon:Leaf,summary:'Projetos sociais e ambientais da comunidade.'}
const carteira:RoleView={id:'carteira',label:'Carteira',icon:Wallet,summary:'Saldo e reservas do piloto. Sem pagamentos reais.'}

const menus:Record<RoleKind,RoleView[]>={
 aluno:[inicio,
  {id:'profissionais',label:'Profissionais',icon:Users,summary:'Encontre um profissional e acompanhe seus vínculos.'},
  {id:'treino',label:'Meu treino',icon:Dumbbell,summary:'Treinos publicados pelo seu profissional.'},
  {id:'agenda',label:'Minha agenda',icon:CalendarDays,summary:'Suas reservas de horário.'},
  carteira,esg,
  {id:'parceiro',label:'Seja parceiro',icon:Briefcase,summary:'Cadastre-se como profissional da plataforma.'},
  perfil],
 parceiro:[inicio,
  {id:'alunos',label:'Meus alunos',icon:Users,summary:'Pedidos de vínculo e alunos ativos.'},
  {id:'agenda',label:'Minha agenda',icon:CalendarDays,summary:'Horários disponíveis, regras e reservas.'},
  {id:'treinos',label:'Treinos',icon:Dumbbell,summary:'Publique e acompanhe treinos dos seus alunos.'},
  {id:'meus-videos',label:'Meus vídeos',icon:Clapperboard,summary:'Envie vídeos para o feed dos alunos da sua região.'},
  carteira,esg,
  {id:'cadastro',label:'Meu cadastro profissional',icon:ClipboardCheck,summary:'Especialidade e situação da aprovação.'},
  perfil],
 parceiro_pendente:[inicio,
  {id:'cadastro',label:'Meu cadastro profissional',icon:ClipboardCheck,summary:'Acompanhe a análise do seu cadastro.'},
  {id:'agenda',label:'Minhas reservas',icon:CalendarDays,summary:'Reservas feitas com a sua conta.'},
  carteira,esg,perfil],
 admin:[inicio,
  {id:'aprovacoes',label:'Aprovações',icon:ShieldCheck,summary:'Cadastros profissionais aguardando análise.'},
  {id:'feed',label:'Vídeos do feed',icon:Clapperboard,summary:'Aprove os vídeos dos profissionais antes de irem para o feed.'},
  {id:'participantes',label:'Participantes',icon:Users,summary:'Visão geral de alunos e profissionais.'},
  {id:'servicos',label:'Serviços recebidos',icon:Inbox,summary:'Eventos de serviços que chegaram à plataforma.'},
  {id:'videos',label:'Vídeos — piloto',icon:Film,summary:'Biblioteca de vídeos em teste.'},
  {id:'esg',label:'Projetos ESG',icon:Leaf,summary:'Analise os projetos enviados.'},
  {id:'financeiro',label:'Financeiro',icon:Wallet,summary:'Reservas, cashback (rascunho) e carteira.'},
  {id:'ranking',label:'Ranking — rascunhos',icon:Trophy,summary:'Regras de pontuação em preparação.'},
  perfil],
}

export function roleMenu(profile:Pick<OwnProfile,'role'|'approved'>){return menus[roleKind(profile)]}
export function pickView(profile:Pick<OwnProfile,'role'|'approved'>,wanted:string){
 return roleMenu(profile).some(item=>item.id===wanted)?wanted:'inicio'
}

const titles:Record<RoleKind,{badge:string,title:string,text:string}>={
 aluno:{badge:'Aluno',title:'Seu espaço de evolução',text:'Encontre profissionais, acompanhe seus treinos e sua agenda em um só lugar.'},
 parceiro:{badge:'Parceiro',title:'Seu espaço profissional',text:'Organize seus alunos, sua agenda e os treinos que você publica.'},
 parceiro_pendente:{badge:'Parceiro em análise',title:'Cadastro profissional em análise',text:'Assim que a equipe aprovar seu cadastro, agenda, alunos e treinos serão liberados aqui.'},
 admin:{badge:'Administração',title:'Painel administrativo',text:'Aprovações, participantes e configurações da plataforma. Rascunhos financeiros não ativam pagamentos.'},
}

function firstName(name:string){return name.trim().split(/\s+/)[0]||'você'}

export function RoleShell({profile,view,onView,busy,onRefresh,onLogout,children}:{profile:Pick<OwnProfile,'role'|'approved'|'display_name'>,view:string,onView:(id:string)=>void,busy:boolean,onRefresh:()=>void,onLogout:()=>void,children:React.ReactNode}){
 const kind=roleKind(profile),menu=menus[kind],current=menu.find(item=>item.id===view)||inicio
 return <div className="role-home mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[230px_minmax(0,1fr)]" data-role={kind}>
  <aside className="min-w-0 md:sticky md:top-4 md:self-start rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-3">
   <img src="/assets/brand/logo-primary.png" alt="369 WELLNESS" className="mx-2 mb-3 hidden h-12 w-auto md:block"/>
   <p className="mx-2 mb-2 text-xs font-bold uppercase tracking-wider text-[#626274]">Seu espaço</p>
   <nav aria-label="Menu do perfil" className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
    {menu.map(item=>{const Icon=item.icon,active=item.id===current.id
     return <button key={item.id} type="button" aria-current={active?'page':undefined} onClick={()=>onView(item.id)}
      className={'flex min-h-11 shrink-0 items-center gap-3 rounded-[10px_22px_10px_22px] px-3 py-2 text-left text-sm font-semibold '+(active?'bg-[#a5ce41] text-[#33325a]':'text-[#626274] hover:bg-[#eeedf4]')}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0"/>{item.label}</button>})}
   </nav>
   <div className="mt-3"><InstallApp compact/></div>
   <div className="mt-3 hidden flex-col gap-2 border-t border-[#dddee4] pt-3 md:flex">
    <button type="button" disabled={busy} onClick={onRefresh} className="flex min-h-11 items-center gap-3 px-3 text-sm text-[#626274]"><RefreshCw aria-hidden="true" className="h-4 w-4"/>Atualizar conta</button>
    <button type="button" disabled={busy} onClick={onLogout} className="flex min-h-11 items-center gap-3 px-3 text-sm text-[#626274]"><LogOut aria-hidden="true" className="h-4 w-4"/>Sair deste dispositivo</button>
   </div>
  </aside>
  <div className="min-w-0 space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px_30px_12px_30px] bg-[#a5ce41] px-5 py-4 text-[#33325a]">
    <div><p className="text-sm font-semibold">{titles[kind].badge}</p><h1 className="text-2xl font-extrabold">Olá, {firstName(profile.display_name)}</h1></div>
    <p className="text-sm font-semibold">{current.label}</p>
   </header>
   {children}
   <div className="flex flex-wrap gap-3 md:hidden">
    <button type="button" disabled={busy} onClick={onRefresh} className="min-h-11 rounded-[10px_22px_10px_22px] border bg-white px-4 text-sm">Atualizar conta</button>
    <button type="button" disabled={busy} onClick={onLogout} className="min-h-11 rounded-[10px_22px_10px_22px] border bg-white px-4 text-sm">Sair deste dispositivo</button>
   </div>
  </div>
 </div>
}

export function RoleOverview({profile,onView,highlights,feed}:{profile:Pick<OwnProfile,'role'|'approved'>,onView:(id:string)=>void,highlights?:React.ReactNode,feed?:React.ReactNode}){
 const kind=roleKind(profile),info=titles[kind]
 return <div className="space-y-5">
  <section className="rounded-[12px_30px_12px_30px] bg-[#33325a] p-6 text-[#f7f6f2]">
   <p className="text-sm font-bold uppercase tracking-wider text-[#a5ce41]">{info.badge}</p>
   <h2 className="mt-2 text-2xl font-extrabold text-[#f7f6f2]">{info.title}</h2>
   <p className="mt-2 max-w-xl text-[#d5d4e1]">{info.text}</p>
  </section>
  {highlights}
  {feed}
  {feed&&<h2 className="pt-2 text-xl font-extrabold">Atalhos</h2>}
  <div className="grid gap-3 sm:grid-cols-2">
   {menus[kind].filter(item=>item.id!=='inicio').map(item=>{const Icon=item.icon
    return <button key={item.id} type="button" onClick={()=>onView(item.id)} className="flex min-h-11 items-start gap-3 rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4 text-left hover:border-[#a5ce41]">
     <span className="rounded-full bg-[#eeedf4] p-2"><Icon aria-hidden="true" className="h-5 w-5"/></span>
     <span><span className="block font-bold">{item.label}</span><span className="block text-sm text-[#626274]">{item.summary}</span></span>
    </button>})}
  </div>
 </div>
}

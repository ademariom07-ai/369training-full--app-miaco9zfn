import React from 'react'
import {BookOpen,Bot,History,Ruler,Star,UserCog,Library,Sparkles,MessageCircle,Store,CircleHelp,Compass,Briefcase,Clapperboard,CalendarDays,ClipboardCheck,Dumbbell,Film,Home,Inbox,Leaf,LogOut,RefreshCw,ShieldCheck,Trophy,UserRound,Users,Wallet,type LucideIcon} from 'lucide-react'
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
const esg:RoleView={id:'esg',label:'Projetos sociais',icon:Leaf,summary:'Projetos sociais e ambientais da comunidade (ESG).'}
const ia:RoleView={id:'ia',label:'Treinos com IA',icon:Sparkles,summary:'A IA monta uma sugestão de treino (ou dieta, para nutricionistas) em segundos.'}
const mensagens:RoleView={id:'mensagens',label:'Mensagens',icon:MessageCircle,summary:'Converse com seu profissional, seus alunos ou a equipe 369.'}
const comoFunciona:RoleView={id:'como-funciona',label:'Como funciona',icon:Compass,summary:'Os 3 pilares e o passo a passo da 369.'}
const carteira:RoleView={id:'carteira',label:'Carteira',icon:Wallet,summary:'Saldo e reservas do piloto. Sem pagamentos reais.'}

const menus:Record<RoleKind,RoleView[]>={
 aluno:[inicio,comoFunciona,
  {id:'profissionais',label:'Encontrar profissionais',icon:Users,summary:'Busque por modalidade, perto de você ou online, e veja a vitrine de cada um.'},
  {id:'treino',label:'Meu treino / dieta',icon:Dumbbell,summary:'Treino da semana e dieta, com vídeos e o que você já fez.'},
  {id:'medidas',label:'Medidas e fotos',icon:Ruler,summary:'Peso, medidas, gordura corporal e fotos de antes e depois, com gráficos.'},
  {id:'conteudos',label:'Conteúdos e e-books',icon:BookOpen,summary:'Aulas, vídeos, dicas, livros e materiais dos profissionais, grátis ou pagos.'},
  {id:'desafios',label:'Desafios e água',icon:Trophy,summary:'Aceite desafios, marque seus dias e acompanhe a água que você bebe, com lembretes.'},
  ia,
  {id:'agenda',label:'Minha agenda',icon:CalendarDays,summary:'Suas reservas de horário.'},
  mensagens,carteira,esg,
  {id:'parceiro',label:'Seja parceiro',icon:Briefcase,summary:'Cadastre-se como profissional da plataforma.'},
  perfil],
 parceiro:[inicio,
  {id:'alunos',label:'Meus alunos',icon:Users,summary:'Pedidos de vínculo e alunos ativos.'},
  {id:'agenda',label:'Minha agenda',icon:CalendarDays,summary:'Horários disponíveis, regras e reservas.'},
  {id:'isis',label:'Ísis — assistente',icon:Bot,summary:'Peça em uma frase: a Ísis monta e ajusta os treinos dos seus alunos usando os registros deles, e envia quando você confirmar.'},
  {id:'treinos',label:'Treinos e dietas',icon:Dumbbell,summary:'Monte treinos por dia da semana ou dietas por refeição e acompanhe o que o aluno fez.'},
  {id:'desafios-pro',label:'Desafios',icon:Trophy,summary:'Crie desafios para os seus alunos (dias marcados, treinos ou água) e veja quem está cumprindo.'},
  {id:'meus-conteudos',label:'Meus conteúdos',icon:BookOpen,summary:'Publique aulas, vídeos, dicas, e-books e materiais, grátis ou pagos, para todos, seus alunos ou um grupo.'},
  ia,
  mensagens,
  {id:'vitrine',label:'Minha vitrine',icon:Store,summary:'Apresentação, formação, modalidades e atendimento que os alunos veem.'},
  {id:'meus-exercicios',label:'Meus exercícios',icon:Library,summary:'Cadastre seus exercícios com explicação e vídeo para usar nos treinos.'},
  {id:'meus-videos',label:'Meus vídeos',icon:Clapperboard,summary:'Envie vídeos para o feed dos alunos da sua região.'},
  carteira,esg,
  {id:'cadastro',label:'Meu cadastro profissional',icon:ClipboardCheck,summary:'Especialidade e situação da aprovação.'},
  comoFunciona,perfil],
 parceiro_pendente:[inicio,
  {id:'cadastro',label:'Meu cadastro profissional',icon:ClipboardCheck,summary:'Acompanhe a análise do seu cadastro.'},
  {id:'agenda',label:'Minhas reservas',icon:CalendarDays,summary:'Reservas feitas com a sua conta.'},
  mensagens,carteira,esg,comoFunciona,perfil],
 admin:[inicio,
  {id:'verificacoes',label:'Verificações',icon:ShieldCheck,summary:'Fotos da etapa 2 dos parceiros e CPFs repetidos que pediram análise.'},
  {id:'usuarios',label:'Usuários',icon:UserCog,summary:'Busque contas, aprove ou recuse parceiros, suspenda, reative e exclua contas.'},
  {id:'aprovacoes',label:'Aprovações',icon:ShieldCheck,summary:'Cadastros profissionais aguardando análise.'},
  mensagens,
  {id:'feed',label:'Vídeos do feed',icon:Clapperboard,summary:'Aprove os vídeos dos profissionais antes de irem para o feed.'},
  {id:'avaliacoes',label:'Avaliações',icon:Star,summary:'Avaliações entre alunos e profissionais. Oculte as abusivas.'},
  {id:'desafios-admin',label:'Desafios',icon:Trophy,summary:'Desafios da equipe 369 para todos os alunos.'},
  {id:'conteudos-admin',label:'Conteúdos',icon:BookOpen,summary:'Aprove os conteúdos públicos dos profissionais e publique os da equipe 369.'},
  {id:'biblioteca',label:'Biblioteca de exercícios',icon:Library,summary:'Edite os textos dos exercícios oficiais e crie novos.'},
  {id:'participantes',label:'Participantes',icon:Users,summary:'Visão geral de alunos e profissionais.'},
  {id:'servicos',label:'Serviços recebidos',icon:Inbox,summary:'Eventos de serviços que chegaram à plataforma.'},
  {id:'videos',label:'Vídeos — piloto',icon:Film,summary:'Biblioteca de vídeos em teste.'},
  {id:'esg',label:'Projetos ESG',icon:Leaf,summary:'Analise os projetos enviados.'},
  {id:'financeiro',label:'Financeiro',icon:Wallet,summary:'Reservas, cashback (rascunho) e carteira.'},
  {id:'prototipo',label:'Protótipo antigo',icon:History,summary:'Demonstração com dados fictícios usada antes do app real. Só referência.'},
  {id:'ranking',label:'Ranking — rascunhos',icon:Trophy,summary:'Regras de pontuação em preparação.'},
  comoFunciona,perfil],
}

export function roleMenu(profile:Pick<OwnProfile,'role'|'approved'>){return menus[roleKind(profile)]}
export function pickView(profile:Pick<OwnProfile,'role'|'approved'>,wanted:string){
 return roleMenu(profile).some(item=>item.id===wanted)?wanted:'inicio'
}

// Explicação curta de cada tela, em linguagem simples (botão "?" no topo).
const helps:Record<string,string>={
 inicio:'Aqui você vê o seu próximo passo, os vídeos dos profissionais e os atalhos para tudo.',
 'como-funciona':'Explica os 3 pilares da 369 — foco, disciplina e estratégia — e o caminho para começar.',
 profissionais:'Escolha a modalidade e veja quem atende perto de você ou online. Abra a vitrine, conheça o profissional e toque em "Quero ser acompanhado". Quando ele aceitar, ele monta seus treinos e você vê os horários dele.',
 mensagens:'Converse com o seu profissional ou com seus alunos, e com a equipe 369 quando precisar de ajuda. A equipe não lê as conversas entre aluno e profissional.',
 'admin:mensagens':'Conversas de suporte com alunos e profissionais. Use a busca para iniciar uma conversa. Conversas entre aluno e profissional são privadas e não aparecem aqui.',
 'meus-exercicios':'Seus exercícios aparecem para você e seus alunos e podem ser usados nos treinos. Use nomes claros e, se puder, um vídeo do YouTube mostrando a execução.',
 biblioteca:'Exercícios oficiais da 369. Nos 30 animados você edita nome, outros nomes, músculos e as dicas de cada fase (a animação continua a mesma). Também dá para criar exercícios novos com texto e vídeo.',
 vitrine:'É o seu perfil público: aparece para os alunos na busca. Diga o que você faz, para quem, sua formação e se atende presencial ou online.',
 treino:'Seu treino da semana (com vídeo de cada exercício) e sua dieta. Toque em "Começar treino guiado": um exercício por vez, com animação, sugestão de carga e cronômetro de descanso. Ou, depois de treinar, use "Concluí todos os exercícios". Na aba "Evolução" você vê seus gráficos.',
 isis:'Converse com a Ísis como com uma colega: "cria o treino da semana da Célia, ela sentiu a lombar", "tira o levantamento terra", "pode enviar". Ela usa o treino atual e a evolução dos últimos 60 dias de cada aluno (frequência, cargas, esforço, dor, recados). Pergunte também "quem está evoluindo e quem está parado?" ou peça o relatório da semana. Você pode falar pelo microfone.',
 desafios:'Toque em "Aceitar desafio" para participar. Nos desafios de treino e de água, o progresso conta sozinho; nos outros, marque cada dia cumprido. Na água, use +250 ml / +500 ml e ligue os lembretes em "Meta e lembretes".',
 'desafios-pro':'Crie desafios para os seus alunos: marcar cada dia (ex.: alongamento), dias com treino registrado ou dias com a meta de água. Acompanhe o progresso de cada participante.',
 verificacoes:'Parceiros: confira as 3 fotos (documento, selfie com documento, selfie com a carteira do conselho) e o número no site do conselho; aprove ou recuse com motivo. As fotos são apagadas depois da decisão. CPFs: quem informou um CPF que já está em outra conta e pediu análise.',
 prototipo:'Telas da demonstração antiga (antes do app real), com dados fictícios guardados só no navegador. Não mexe no banco. Fica aqui só como referência de ideias.',
 usuarios:'Busque por nome ou e-mail. Em "Pedidos de parceiro" você aprova ou recusa quem pediu para ser parceiro (com motivo). Também suspende ou reativa parceiros e exclui contas (pede o motivo e a confirmação com o e-mail). Se a conta tiver registros que precisam ficar guardados, ela é anonimizada e o login é bloqueado. Tudo fica no registro de ações.',
 avaliacoes:'As 100 avaliações mais recentes. Oculte comentários ofensivos ou falsos, sempre com motivo. A média de cada pessoa usa as 100 últimas avaliações sem as 3 piores.',
 'desafios-admin':'Desafios da equipe 369, visíveis para todos os alunos.',
 medidas:'Registre peso e medidas (ou peça ao seu profissional) e veja os gráficos. As fotos de frente, lado e costas ficam privadas; compartilhe com seu profissional se quiser. Use "Comparar" para ver antes e depois.',
 conteudos:'Aulas, vídeos, dicas, e-books e materiais. Em "Do meu profissional" ficam os que o seu profissional enviou; em "Para todos", os da comunidade. Os pagos mostram o preço: combine com o profissional e ele libera o acesso.',
 'meus-conteudos':'Publique conteúdos grátis ou pagos. Escolha para quem: todos os alunos da 369 (passa pela aprovação da equipe), todos os seus alunos ou alunos escolhidos (você pode salvar grupos, como "Turma da manhã"). Nos pagos, libere o acesso de quem pagou.',
 'conteudos-admin':'Conteúdos públicos enviados pelos profissionais esperando aprovação, e os conteúdos da equipe 369 (publicados direto para todos).',
 ia:'A IA monta uma sugestão a partir das suas respostas. Para o aluno, só treino e depois do questionário de saúde; se tiver profissional, ele revisa antes. O profissional pode gerar treino ou dieta (nutricionistas) e editar antes de publicar.',
 'aluno:agenda':'Seus horários reservados com profissionais.',
 carteira:'Área de teste: mostra saldo e pedidos de saque simulados. Ainda não há pagamentos de verdade.',
 esg:'Projetos sociais e ambientais. Você pode sugerir um projeto e a equipe analisa.',
 parceiro:'Quer atender alunos pela 369? Informe sua área e seu registro profissional (por exemplo CREF ou CRN). A equipe analisa e libera as funções de parceiro.',
 perfil:'Seu nome, seu celular e seu CPF (guardamos só os 2 últimos dígitos). Mantenha o celular certo para os profissionais conseguirem falar com você. Em Notificações, ative os avisos no celular (mensagens, treinos, água). No fim da página você pode excluir sua conta e seus dados (LGPD).',
 alunos:'Pedidos de alunos que querem ser acompanhados por você e seus alunos ativos. Toque em "Abrir ficha do aluno" para ver tudo dele num lugar só: treinos e dietas, o que fez e a evolução, medidas e fotos, mensagem e avaliação. Vínculos encerrados deixam de aparecer. Aceite pedidos para montar treinos e liberar sua agenda. Você vê a nota de cada aluno e pode avaliar quem você acompanha.',
 'parceiro:agenda':'Defina os dias e horários em que você atende e as regras de agendamento. Logo abaixo ficam as reservas feitas.',
 treinos:'Escolha o aluno e monte o treino por dia da semana (com séries, repetições e vídeo) ou a dieta por refeição. Você também vê os treinos que o aluno gerou com IA, para revisar. Mais abaixo: o que o aluno fez e a avaliação física (medidas e fotos, se ele compartilhar).',
 'meus-videos':'Publique vídeos do YouTube. A equipe aprova e eles aparecem primeiro para os alunos da sua região.',
 cadastro:'Seus dados profissionais e a situação da sua aprovação. Para aceitar alunos, conclua a Etapa 2: CPF confirmado e 3 fotos rápidas, analisadas pela equipe 369.',
 'parceiro_pendente:agenda':'Reservas feitas com a sua conta.',
 aprovacoes:'Cadastros de profissionais esperando análise. Aprove ou recuse com um motivo.',
 feed:'Vídeos enviados pelos profissionais. Só vão para o feed dos alunos depois que você aprova.',
 participantes:'Lista de alunos e profissionais da plataforma.',
 servicos:'Registros de serviços recebidos de outros sistemas.',
 videos:'Teste de busca de vídeos de exercícios. Pode consumir créditos de serviços externos.',
 financeiro:'Regras de reserva, cashback e carteira. Tudo aqui ainda é rascunho: nenhum pagamento real é feito.',
 ranking:'Rascunhos das regras de pontuação. Nada é aplicado aos usuários ainda.',
}
export function viewHelp(kind:RoleKind,view:string){return helps[kind+':'+view]||helps[view]||''}

const titles:Record<RoleKind,{badge:string,title:string,text:string}>={
 aluno:{badge:'Aluno',title:'Foco, disciplina e estratégia para a sua evolução',text:'Defina seu objetivo, encontre profissionais perto de você ou online e acompanhe sua rotina em um só lugar.'},
 parceiro:{badge:'Parceiro',title:'Sua vitrine e seu consultório digital',text:'Apareça para alunos da sua região, organize sua agenda e acompanhe seus alunos em um só lugar.'},
 parceiro_pendente:{badge:'Parceiro em análise',title:'Cadastro profissional em análise',text:'Assim que a equipe aprovar seu cadastro, agenda, alunos e treinos serão liberados aqui.'},
 admin:{badge:'Administração',title:'Painel administrativo',text:'Aprovações, participantes e configurações da plataforma. Rascunhos financeiros não ativam pagamentos.'},
}

function firstName(name:string){return name.trim().split(/\s+/)[0]||'você'}

export function RoleShell({profile,view,onView,busy,onRefresh,onLogout,children,badges={}}:{profile:Pick<OwnProfile,'role'|'approved'|'display_name'>,view:string,onView:(id:string)=>void,busy:boolean,onRefresh:()=>void,onLogout:()=>void,children:React.ReactNode,badges?:Record<string,number>}){
 const kind=roleKind(profile),menu=menus[kind],current=menu.find(item=>item.id===view)||inicio
 const [help,setHelp]=React.useState(false)
 React.useEffect(()=>{setHelp(false)},[current.id])
 return <div className="role-home mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[230px_minmax(0,1fr)]" data-role={kind}>
  <aside className="min-w-0 md:sticky md:top-4 md:self-start rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-3">
   <img src="/assets/brand/logo-primary.png" alt="369 WELLNESS" className="mx-2 mb-3 hidden h-12 w-auto md:block"/>
   <p className="mx-2 mb-2 text-xs font-bold uppercase tracking-wider text-[#626274]">Seu espaço</p>
   <nav aria-label="Menu do perfil" className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
    {menu.map(item=>{const Icon=item.icon,active=item.id===current.id
     return <button key={item.id} type="button" aria-current={active?'page':undefined} onClick={()=>onView(item.id)}
      className={'flex min-h-11 shrink-0 items-center gap-3 rounded-[10px_22px_10px_22px] px-3 py-2 text-left text-sm font-semibold '+(active?'bg-[#a5ce41] text-[#33325a]':'text-[#626274] hover:bg-[#eeedf4]')}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0"/>{item.label}{(badges[item.id]||0)>0&&<span className="ml-auto rounded-full bg-[#33325a] px-2 text-xs font-bold text-[#f7f6f2]" aria-label={badges[item.id]+' não lidas'}>{badges[item.id]}</span>}</button>})}
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
    <div className="flex items-center gap-2"><p className="text-sm font-semibold">{current.label}</p>
     {viewHelp(kind,current.id)&&<button type="button" aria-expanded={help} aria-label={'Ajuda: '+current.label} onClick={()=>setHelp(v=>!v)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-[#33325a]"><CircleHelp aria-hidden="true" className="h-5 w-5"/></button>}</div>
   </header>
   {help&&viewHelp(kind,current.id)&&<p role="note" className="rounded-[12px_30px_12px_30px] border border-[#a5ce41] bg-[#f3f9e6] p-4">{viewHelp(kind,current.id)}</p>}
   {children}
   <div className="flex flex-wrap gap-3 md:hidden">
    <button type="button" disabled={busy} onClick={onRefresh} className="min-h-11 rounded-[10px_22px_10px_22px] border bg-white px-4 text-sm">Atualizar conta</button>
    <button type="button" disabled={busy} onClick={onLogout} className="min-h-11 rounded-[10px_22px_10px_22px] border bg-white px-4 text-sm">Sair deste dispositivo</button>
   </div>
  </div>
 </div>
}

export function RoleOverview({profile,onView,highlights,feed,journey}:{profile:Pick<OwnProfile,'role'|'approved'>,onView:(id:string)=>void,highlights?:React.ReactNode,feed?:React.ReactNode,journey?:React.ReactNode}){
 const kind=roleKind(profile),info=titles[kind]
 return <div className="space-y-5">
  <section className="rounded-[12px_30px_12px_30px] bg-[#33325a] p-6 text-[#f7f6f2]">
   <p className="text-sm font-bold uppercase tracking-wider text-[#a5ce41]">{info.badge}</p>
   <h2 className="mt-2 text-2xl font-extrabold text-[#f7f6f2]">{info.title}</h2>
   <p className="mt-2 max-w-xl text-[#d5d4e1]">{info.text}</p>
  </section>
  {journey}
  {highlights}
  {feed}
  {(()=>{const cards=<div className="grid gap-3 sm:grid-cols-2">
   {menus[kind].filter(item=>item.id!=='inicio').map(item=>{const Icon=item.icon
    return <button key={item.id} type="button" onClick={()=>onView(item.id)} className="flex min-h-11 items-start gap-3 rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4 text-left hover:border-[#a5ce41]">
     <span className="rounded-full bg-[#eeedf4] p-2"><Icon aria-hidden="true" className="h-5 w-5"/></span>
     <span><span className="block font-bold">{item.label}</span><span className="block text-sm text-[#626274]">{item.summary}</span></span>
    </button>})}
  </div>
   // Admin usa os atalhos como painel; aluno e parceiro veem primeiro o caminho e o feed.
   return kind==='admin'?cards:<details className="rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4"><summary className="min-h-11 cursor-pointer py-2 text-lg font-extrabold">Ver todas as funções</summary><div className="mt-3">{cards}</div></details>})()}
 </div>
}

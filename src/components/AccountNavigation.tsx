import React from 'react'
import type {OwnProfile} from '@/lib/supabase/profiles'

// Navigation reflects the verified profile; server authorization remains mandatory.
export default function AccountNavigation({profile}:{profile:Pick<OwnProfile,'role'|'approved'>}) {
 const admin=profile.role==='admin'
 const professional=profile.role==='profissional'&&profile.approved
 const participant=profile.role==='aluno'||professional
 return <nav aria-label="Módulos da minha conta" className="account-modules flex flex-wrap gap-2 rounded-[12px_30px_12px_30px] border bg-white p-3 [&>a]:rounded-[10px_22px_10px_22px] [&>a]:border [&>a]:px-3 [&>a]:py-2 [&>a]:text-blue-700 [&>a]:min-h-11 [&>a]:inline-flex [&>a]:items-center">
  <a href="#meu-perfil">Meu perfil</a>
  {admin&&<><a href="#administracao">Administração</a><a href="#participantes">Participantes</a><a href="#entrada-servicos">Serviços — eventos recebidos</a><a href="#piloto-videos">Vídeos — piloto</a><a href="#config-ranking">Ranking — rascunhos</a><a href="#config-cashback">Cashback — rascunhos</a></>}
  {professional&&<a href="#minha-agenda">Agenda</a>}
  {participant&&<><a href="#minhas-reservas">Reservas — em preparação</a><a href="#treinos-vinculos">Treinos e vínculos</a></>}
  <a href="#meu-esg">Projetos ESG</a><a href="#minha-carteira">Carteira — piloto</a>
  <a href="#cadastro-profissional">{admin?'Aprovações profissionais':'Cadastro profissional'}</a>
 </nav>
}

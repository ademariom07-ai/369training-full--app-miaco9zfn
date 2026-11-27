import React from 'react'
import {ExternalLink,History} from 'lucide-react'

const card='rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-4'
const pages=[
 ['/demonstracao.html','Demonstração (aluno, profissional e admin)','Telas do protótipo com dados de exemplo.'],
 ['/evolucao.html','Evolução','Gráficos e metas do protótipo.'],
 ['/historico.html','Histórico','Histórico de atendimentos do protótipo.'],
 ['/videos.html','Vídeos','Biblioteca de vídeos do protótipo.'],
 ['/evidencias.html','Evidências','Registro de evidências/testes da versão antiga.'],
 ['/pendencias.html','Pendências','Lista de pendências da versão antiga.'],
] as const

// Admin: protótipo antigo (antes do app real), guardado só como referência.
export default function AdminLegacy(){
 return <section className="space-y-4" aria-label="Protótipo antigo">
  <div><h2 className="flex items-center gap-2 text-xl font-extrabold"><History aria-hidden="true" className="h-5 w-5"/>Protótipo antigo (demonstração)</h2>
   <p className="text-sm text-[#626274]">Antes do app real (com Supabase), o site tinha uma <b>demonstração</b> feita para mostrar as telas e testar ideias com o grupo de foco e parceiros. Ela usa <b>dados fictícios guardados só no navegador</b> de quem abre — não lê nem grava nada do banco real. Foi trazida junto quando o site foi publicado aqui (15/11/2026) e serve como referência de ideias ainda não implementadas.</p>
   <p className="mt-1 text-sm text-[#626274]">Ela não aparece mais na página inicial e está fora dos buscadores. Quem tiver o endereço ainda consegue abrir (não há dado real nela). Se quiser, ela pode ser apagada de vez.</p></div>
  <ul className="grid gap-2 md:grid-cols-2">{pages.map(([href,title,desc])=><li key={href}><a href={href} target="_blank" rel="noreferrer" className={card+' flex items-start justify-between gap-2 hover:border-[#a5ce41]'}>
   <span><span className="block font-bold">{title}</span><span className="block text-sm text-[#626274]">{desc}</span></span><ExternalLink aria-hidden="true" className="mt-1 h-4 w-4 shrink-0"/></a></li>)}</ul>
 </section>
}

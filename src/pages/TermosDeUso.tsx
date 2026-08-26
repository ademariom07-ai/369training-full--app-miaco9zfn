import React from 'react'
import { Link } from 'react-router-dom'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#D4AF37] selection:text-black font-inter">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <CrestLogo size={40} showText subText />
          </Link>
          <Link to="/">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs font-montserrat uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar ao Início
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-4">
          <FileText className="w-3.5 h-3.5" />
          Documento Jurídico Vinculante
        </div>
        <h1 className="text-3xl sm:text-4xl font-black font-montserrat text-white uppercase tracking-tight">
          Termos de Uso — 369TRAINING
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Última atualização: {new Date().toLocaleDateString('pt-BR')} • Versão 2.4 (Brasil)
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-20">
        <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-10 rounded-2xl space-y-8 text-gray-300 leading-relaxed text-sm">
          {/* Seção 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">1.</span> Aceitação dos Termos
            </h2>
            <p>
              Ao acessar, cadastrar-se ou utilizar a plataforma{' '}
              <strong className="text-white">369TRAINING</strong>, operada pela{' '}
              <strong className="text-white">369TRAINING LTDA</strong>, você (&ldquo;Usuário&rdquo;,
              seja na condição de Aluno, Atleta, Profissional de Saúde ou Administrador) declara ter
              lido, compreendido e aceito integralmente estes Termos de Uso e a nossa Política de
              Privacidade.
            </p>
            <p>
              Caso você não concorde com qualquer disposição aqui estabelecida, solicitamos que
              interrompa imediatamente o uso da plataforma.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">2.</span> Descrição do Ecossistema B2B & B2C
            </h2>
            <p>
              A 369TRAINING é uma plataforma digital que conecta profissionais de Educação Física
              (CREF), Nutrição (CRN), Psicologia (CRP), Fisioterapia (CREFITO) e Artes Marciais a
              alunos e clientes interessados em serviços de treinamento físico, planejamento
              alimentar, suporte em saúde mental e psicologia clínica/esportiva, reabilitação
              biomecânica e desenvolvimento de alta performance.
            </p>
            <p>
              A plataforma fornece ferramentas de prescrição com Inteligência Artificial, gestão de
              agenda, controle de carteira digital, ranking de mérito profissional em árvore binária
              de até 36 níveis e sistema de cashback colaborativo com compromisso em metas ESG
              (Econômica, Social e Ecológica).
            </p>
          </section>

          {/* Seção 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">3.</span> Cadastro, Elegibilidade e Verificação
              Profissional
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Alunos:</strong> Devem possuir no mínimo 18 anos
                completos ou autorização expressa de seus responsáveis legais. O cadastro requer
                dados verídicos e atualizados.
              </li>
              <li>
                <strong className="text-white">Profissionais de Saúde e Treinadores:</strong> Devem
                comprovar habilitação legal e registro ativo perante o respectivo conselho de classe
                regional (CREF, CRN, CRP, CREFITO ou federação de artes marciais reconhecida).
              </li>
              <li>
                <strong className="text-[#D4AF37]">
                  Cláusula de Sigilo Profissional em Psicologia:
                </strong>{' '}
                O atendimento psicológico prestado por profissionais inscritos no CRP submete-se
                estritamente ao Código de Ética Profissional do Psicólogo. Todas as comunicações,
                anotações e dados sensíveis de saúde mental são de confidencialidade absoluta, sendo
                garantida a inviolabilidade do sigilo profissional entre psicólogo e paciente na
                plataforma.
              </li>
              <li>
                <strong className="text-white">Auditoria Regulatória:</strong> Todo cadastro
                profissional passa por validação administrativa antes da liberação de atendimento a
                alunos. A 369TRAINING reserva-se o direito de suspender cadastros com
                irregularidades documentais.
              </li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">4.</span> Obrigações e Responsabilidades dos Usuários
            </h2>
            <p>O Usuário compromete-se expressamente a:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                <span>Fornecer informações cadastrais e de saúde estritamente autênticas.</span>
              </div>
              <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                <span>
                  Manter a confidencialidade de suas credenciais de acesso (e-mail e senha).
                </span>
              </div>
              <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                <span>
                  Consultar profissional médico antes de iniciar treinos de alta intensidade.
                </span>
              </div>
              <div className="p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                <span>Não compartilhar conteúdos ilegais, difamatórios ou discriminatórios.</span>
              </div>
            </div>
          </section>

          {/* Seção 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">5.</span> Planos, Carteira Digital, Tarifas e
              Pagamentos
            </h2>
            <p>
              A 369TRAINING opera com planos de assinatura e taxas operacionais por serviço
              concluído:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Tarifa por Atendimento:</strong> Fixada de acordo com
                o plano contratado pelo profissional (Plano Básico: R$ 1,00; Plano Pro: R$ 2,00;
                Plano Premium: R$ 3,00 por serviço concluído).
              </li>
              <li>
                <strong className="text-white">Recarga via PIX:</strong> Os créditos adicionados à
                carteira do aluno por transferência PIX ficam condicionados à compensação e
                validação do comprovante.
              </li>
              <li>
                <strong className="text-white">Cashback e Pool 38%:</strong> Os créditos de cashback
                gerados por serviços concluídos são distribuídos conforme as regras matemáticas da
                árvore binária e possuem validade promocional para consumo na rede.
              </li>
              <li>
                <strong className="text-white">Saques:</strong> Profissionais habilitados podem
                solicitar resgate para contas bancárias de sua titularidade via PIX, sujeitos a
                prazos de compensação bancária e eventuais retenções tributárias legais.
              </li>
            </ul>
          </section>

          {/* Seção 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">6.</span> Prescrições e Inteligência Artificial
            </h2>
            <p>
              As ferramentas de Inteligência Artificial disponibilizadas no 369TRAINING têm caráter
              de <strong className="text-white">suporte técnico e otimização biomecânica</strong>. A
              avaliação clínica, liberação para esforço e supervisão dos exercícios permanecem sob
              responsabilidade do profissional credenciado ou por conta e risco do aluno quando
              optar por treinar de forma autônoma.
            </p>
          </section>

          {/* Seção 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">7.</span> Propriedade Intelectual
            </h2>
            <p>
              Todas as marcas, símbolos (incluindo o Brasão 369, algoritmos de árvore híbrida de 36
              níveis, códigos-fonte, designs e identidades visuais) são de propriedade exclusiva da
              369TRAINING LTDA e protegidos pelas Leis de Propriedade Industrial (Lei nº 9.279/1996)
              e Direitos Autorais (Lei nº 9.610/1998).
            </p>
          </section>

          {/* Seção 8 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">8.</span> Rescisão e Encerramento de Conta
            </h2>
            <p>
              O Usuário pode solicitar a exclusão de sua conta a qualquer momento através do perfil.
              A 369TRAINING poderá suspender ou encerrar imediatamente contas em caso de violação
              destes Termos, fraudes financeiras, ofensas na comunidade ou falsificação de registros
              de classe.
            </p>
          </section>

          {/* Seção 9 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#D4AF37]">9.</span> Foro, Legislação e Jurisdição por País
            </h2>
            <p>
              Estes Termos são regidos prioritariamente pelas leis da República Federativa do
              Brasil. Fica eleito o Foro da Comarca de São Paulo/SP (Brasil) para dirimir quaisquer
              controvérsias ou litígios oriundos deste instrumento para usuários domiciliados no
              Brasil, com renúncia expressa a qualquer outro foro.
            </p>
            <p>
              Para usuários residentes em outros países (Portugal, União Europeia, Reino Unido,
              Estados Unidos, Canadá e Austrália), aplicar-se-ão os princípios internacionais de
              proteção ao consumidor e regras de jurisdição correspondentes, mantendo-se a base
              contratual brasileira na ausência de tratado ou disposição cogente local em contrário.
            </p>
          </section>

          {/* Seção 10 */}
          <section className="space-y-3 pt-4 border-t border-[#2A2A2A]">
            <h2 className="text-base font-bold font-montserrat text-[#D4AF37] uppercase">
              Contato Jurídico & Compliance
            </h2>
            <p className="text-xs text-gray-400">
              Dúvidas sobre estes Termos de Uso podem ser encaminhadas diretamente para nossa equipe
              jurídica pelo e-mail:{' '}
              <a href="mailto:juridico@369training.com" className="text-[#D4AF37] underline">
                juridico@369training.com
              </a>{' '}
              ou pelo DPO em{' '}
              <a href="mailto:dpo@369training.com" className="text-[#D4AF37] underline">
                dpo@369training.com
              </a>
              .
            </p>
          </section>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A2A2A] bg-[#070707] py-6 px-6 text-center text-xs text-gray-500 font-inter">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} 369TRAINING LTDA. CNPJ: 00.000.000/0001-00</p>
          <div className="flex gap-4 text-xs">
            <Link to="/politica-de-privacidade" className="text-gray-400 hover:text-[#D4AF37]">
              Política de Privacidade
            </Link>
            <Link to="/lgpd-consentimentos" className="text-gray-400 hover:text-[#D4AF37]">
              LGPD & Consentimentos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
